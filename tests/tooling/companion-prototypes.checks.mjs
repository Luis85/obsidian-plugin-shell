import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readWorkspaceFiles } from '../../scripts/companion/prototypes/files.ts';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { prototypeJson, slug } from '../../scripts/companion/prototypes/safety.ts';
import { api, document, workspace, main, alternate, activate, fork } from '../support/prototype-fixture.mjs';
const hash = text => createHash('sha256').update(text).digest('hex');
const fail = (fn,code) => assert.throws(fn,error=>error.code===code || error.message.includes(code));
test('capture owns a complete independent project snapshot and preserves fixtures and notes',()=>{
  const doc=document(), source=api.empty(doc.project.id), created=api.change(source,{type:'create',id:'exploration',name:'Explore',description:'',document:doc});
  assert.deepEqual(api.selected(created,main).variant.document,doc);
  assert.equal(source.prototypes.length,0); doc.design.goal='changed';
  assert.equal(api.selected(created,main).variant.document.design.goal,'Sitemap A');
  assert.equal(created.active,null);assert.equal(created.revision,2);
});
test('fork and explicit save isolate sitemap B including routes without changing active A',()=>{
  const active=activate(workspace()), other=fork(active), saved=api.change(other,{type:'save',selection:alternate,document:document('Sitemap B')});
  assert.equal(api.active(saved).variant.document.design.sitemap.routes[0].path,'/inbox');
  assert.equal(api.selected(saved,alternate).variant.document.design.sitemap.routes[0].path,'/dashboard');
  assert.equal(api.selected(other,alternate).variant.document.design.goal,'Sitemap A');
  assert.equal(api.selected(saved,alternate).variant.revision,2);
});
test('activation requires explicit approval; switching demotes prior active without deleting it',()=>{
  fail(()=>api.active(workspace()),'PROTOTYPE_ACTIVE_REQUIRED');
  fail(()=>api.change(workspace(),{type:'activate',selection:main}),'PROTOTYPE_APPROVAL_REQUIRED');
  const switched=activate(fork(activate(workspace())),alternate);
  assert.deepEqual(switched.active,alternate);assert.equal(api.selected(switched,main).variant.status,'approved');
  assert.equal(switched.prototypes[0].versions[0].variants.filter(v=>v.status==='active').length,1);
});
test('editing, status changes and archiving cannot overwrite an active snapshot',()=>{
  const w=activate(workspace()), bytes=JSON.stringify(w);
  for(const action of [{type:'save',selection:main,document:document('Sitemap B')},{type:'details',selection:main,name:'Changed',hypothesis:''},{type:'status',selection:main,status:'draft'},{type:'archive',prototypeId:'exploration',archived:true}]) assert.throws(()=>api.change(w,action));
  assert.equal(JSON.stringify(w),bytes);
});
test('sealed versions retain every saved snapshot; new versions are independent drafts',()=>{
  const w=api.change(activate(fork(workspace())),{type:'seal',prototypeId:'exploration',versionId:'v1'});
  fail(()=>api.change(w,{type:'save',selection:alternate,document:document('Sitemap B')}),'PROTOTYPE_READ_ONLY');
  fail(()=>fork(w),'PROTOTYPE_READ_ONLY');
  const next=api.change(w,{type:'version',prototypeId:'exploration',id:'v2',from:'v1'});
  assert.equal(next.prototypes[0].versions[1].sealed,false);
  assert.ok(next.prototypes[0].versions[1].variants.every(x=>x.status==='draft'&&x.revision===1));
  assert.deepEqual(next.active,main);assert.deepEqual(next.prototypes[0].versions[0],w.prototypes[0].versions[0]);
});
test('archiving and restoration are non-destructive and never auto-activate',()=>{
  let w=api.change(activate(workspace()),{type:'deactivate'});
  w=api.change(w,{type:'archive',prototypeId:'exploration',archived:true});
  fail(()=>api.change(w,{type:'activate',selection:main}),'PROTOTYPE_APPROVAL_REQUIRED');
  const restored=api.change(w,{type:'archive',prototypeId:'exploration',archived:false});
  assert.equal(restored.active,null);assert.equal(api.selected(restored,main).variant.document.design.goal,'Sitemap A');
});
test('variant archive can only return to draft before review',()=>{
  const w=api.change(workspace(),{type:'status',selection:main,status:'archived'});
  fail(()=>api.change(w,{type:'status',selection:main,status:'approved'}),'PROTOTYPE_STATUS');
  assert.equal(api.selected(api.change(w,{type:'status',selection:main,status:'draft'}),main).variant.status,'draft');
});
test('multiple prototypes still share exactly one project-level active selection',()=>{
  const w=api.change(activate(workspace()),{type:'create',id:'onboarding',name:'Onboarding',description:'',document:document('Sitemap B')});
  const pick={prototypeId:'onboarding',versionId:'v1',variantId:'main'}, next=activate(w,pick);
  assert.deepEqual(next.active,pick);assert.equal(api.selected(next,main).variant.status,'approved');
});
test('rejects duplicate IDs, wrong project and invalid variant states without mutation',()=>{
  const w=workspace(), before=api.key(w);
  fail(()=>api.change(w,{type:'create',id:'exploration',name:'Duplicate',description:'',document:document()}),'PROTOTYPE_DUPLICATE');
  const doc=document();doc.project.id='another-project';fail(()=>api.change(w,{type:'save',selection:main,document:doc}),'PROTOTYPE_PROJECT');
  fail(()=>api.change(w,{type:'status',selection:main,status:'published'}),'PROTOTYPE_STATUS');assert.equal(api.key(w),before);
});
test('rejects traversal, Windows device names, dangerous properties, invalid selectors and future versions',()=>{
  for(const name of ['../outside','A','nul','com1','foo/bar','a\\b','a:','prototype','constructor','a.','é']) fail(()=>slug(name),'PROTOTYPE_PATH');
  for(const mutate of [w=>w.schemaVersion=9,w=>w.extra=1,w=>w.active={...main},w=>w.prototypes[0].versions[0].variants[0].status='active']) {
    const w=workspace();mutate(w);assert.throws(()=>api.validate(w));
  }
  assert.throws(()=>api.selected(workspace(),{...main,versionId:'../v1'}));
});
test('transport validation never invokes getters, toJSON or custom prototypes',()=>{
  let calls=0;
  assert.throws(()=>prototypeJson({get value(){calls++;return 1;}}));
  assert.throws(()=>prototypeJson({toJSON(){calls++;return {};}}));
  const cycle={};cycle.loop=cycle;assert.throws(()=>prototypeJson(cycle));
  assert.throws(()=>prototypeJson(new Date()));assert.throws(()=>prototypeJson([,1]));
  assert.throws(()=>prototypeJson(JSON.parse('{"__proto__":{"polluted":true}}')));
  assert.equal(calls,0);assert.equal({}.polluted,undefined);
});
test('active pointer ambiguity, archived active and revision overflow fail closed',()=>{
  const w=activate(fork(workspace()));w.prototypes[0].versions[0].variants[1].status='active';assert.throws(()=>api.validate(w));
  const x=activate(workspace());x.prototypes[0].archived=true;assert.throws(()=>api.validate(x));
  const y=workspace();y.revision=Number.MAX_SAFE_INTEGER;assert.throws(()=>api.change(y,{type:'deactivate'}));
});
test('directory export is deterministic and round-trips the complete validated workspace',async()=>{
  const w=activate(fork(workspace())),files=await api.files(w,hash),map=new Map(files.map(f=>[f.path,f.content]));
  assert.deepEqual(files,await api.files(w,hash));
  assert.ok(map.has('docs/concepts/exploration/prototype.json'));
  assert.ok(map.has(api.snapshotPath(alternate)));assert.ok(map.has('docs/concepts/prototypes.json'));
  assert.deepEqual(await readWorkspaceFiles(async path=>map.get(path),validateAuthoringDocument,hash),w);
});
test('snapshot tampering and manifest path substitution are rejected',async()=>{
  const files=await api.files(activate(workspace()),hash),map=new Map(files.map(f=>[f.path,f.content]));
  const key=api.snapshotPath(main),original=map.get(key);map.set(key,original+' ');
  await assert.rejects(readWorkspaceFiles(async path=>map.get(path),validateAuthoringDocument,hash),/PROTOTYPE_SNAPSHOT_CHANGED/);
  map.set(key,original);const manifestPath='docs/concepts/exploration/prototype.json',manifest=JSON.parse(map.get(manifestPath));
  manifest.item.versions[0].variants[0].document.path='../../outside.json';map.set(manifestPath,JSON.stringify(manifest));
  await assert.rejects(readWorkspaceFiles(async path=>map.get(path),validateAuthoringDocument,hash),/PROTOTYPE_PATH/);
});
test('workspace import cannot erase history, thaw sealed versions or overwrite protected snapshots',()=>{
  const w=api.change(activate(workspace()),{type:'seal',prototypeId:'exploration',versionId:'v1'});
  api.replacement(w,structuredClone(w));
  for(const mutate of [x=>x.prototypes=[],x=>x.prototypes[0].versions[0].sealed=false,x=>x.prototypes[0].versions[0].variants[0].document.design.goal='wrong']) {
    const x=structuredClone(w);x.revision++;mutate(x);assert.throws(()=>api.replacement(w,x));
  }
  const newer=fork(workspace());api.replacement(workspace(),newer);
  fail(()=>api.replacement(newer,workspace()),'PROTOTYPE_STALE');
});
