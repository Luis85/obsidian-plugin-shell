import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readWorkspaceFiles } from '#shared/companion/prototypes/files.ts';
import { validateAuthoringDocument } from '#shared/companion/authoring-contract.ts';
import { prototypeNavigation } from '../editor/prototype-navigation.ts';
import { prototypeComparisonView } from '../editor/prototype-comparison-view.ts';
import { prototypeView } from '../editor/prototype-view.ts';
import { api, document, workspace, main, alternate, activate, fork } from '../../../tests/support/prototype-fixture.mjs';
const hash = text => createHash('sha256').update(text).digest('hex');
const lab = () => api.change(fork(activate(workspace())),{type:'save',selection:alternate,document:document('Sitemap B')});
const restore = {type:'restore-snapshot',selection:alternate,source:main,recoveryId:'recovery-1'};
const state = w => ({workspace:w,working:document('Sitemap B'),opened:alternate,writable:true});
test('restore is a single immutable transaction with a sealed full-project recovery snapshot',()=>{
  const source=lab(), before=structuredClone(source), result=api.change(source,restore);
  assert.deepEqual(source,before);
  const recovery={...alternate,versionId:'recovery-1'};
  assert.equal(api.selected(result,recovery).version.sealed,true);
  assert.deepEqual(api.selected(result,recovery).variant,api.selected(source,alternate).variant);
  assert.deepEqual(api.selected(result,alternate).variant.document,document());
  assert.deepEqual(result.active,main);assert.deepEqual(api.active(result).variant,api.active(source).variant);
  assert.equal(api.selected(result,alternate).variant.revision,api.selected(source,alternate).variant.revision+1);
  assert.equal(result.revision,source.revision+1);
});
test('recovery can itself be restored without rewriting the earlier checkpoint',()=>{
  const first=api.change(lab(),restore), result=api.change(first,{...restore,source:{...alternate,versionId:'recovery-1'},recoveryId:'recovery-2'});
  assert.deepEqual(api.selected(result,alternate).variant.document,document('Sitemap B'));
  assert.deepEqual(result.prototypes[0].versions[1],first.prototypes[0].versions[1]);
  assert.deepEqual(api.selected(result,{...alternate,versionId:'recovery-2'}).variant.document,document());
});
test('restore rejects active, review, archived, sealed, missing, same-source and colliding targets without mutation',()=>{
  const source=lab();
  for(const action of [{...restore,selection:main,source:alternate},{...restore,source:alternate},{...restore,source:{...main,variantId:'missing'}},{...restore,recoveryId:'v1'}]) {
    const before=JSON.stringify(source);assert.throws(()=>api.change(source,action));assert.equal(JSON.stringify(source),before);
  }
  for(const status of ['review','approved','archived']) assert.throws(()=>api.change(api.change(source,{type:'status',selection:alternate,status}),restore));
  assert.throws(()=>api.change(api.change(source,{type:'seal',prototypeId:'exploration',versionId:'v1'}),restore),/READ_ONLY/);
});
test('restore capacity failure cannot publish a partial checkpoint or overwrite the draft',()=>{
  let source=lab();for(let i=2;i<=40;i++)source=api.change(source,{type:'version',prototypeId:'exploration',from:'v1',id:'v'+i});
  const before=JSON.stringify(source);assert.throws(()=>api.change(source,restore),/PROTOTYPE_LIMIT/);assert.equal(JSON.stringify(source),before);
});
test('prototype and version display metadata preserve paths, active source and project bytes',()=>{
  const source=activate(workspace()), doc=structuredClone(api.active(source).variant.document);
  const renamed=api.change(source,{type:'prototype-details',prototypeId:'exploration',name:'New title',description:'Reason'});
  const labelled=api.change(renamed,{type:'version-details',prototypeId:'exploration',versionId:'v1',label:'Validated direction'});
  assert.equal(labelled.prototypes[0].id,'exploration');assert.deepEqual(labelled.active,main);assert.deepEqual(api.active(labelled).variant.document,doc);
  const sealed=api.change(labelled,{type:'seal',prototypeId:'exploration',versionId:'v1'});
  assert.throws(()=>api.change(sealed,{type:'version-details',prototypeId:'exploration',versionId:'v1',label:'Override'}),/READ_ONLY/);
  const imported=structuredClone(sealed);imported.revision++;imported.prototypes[0].versions[0].label='Override';assert.throws(()=>api.replacement(sealed,imported),/SEALED/);
});
test('complete comparison finds goals and routes rather than relying on surface counts',()=>{
  const before=document(), after=document('Sitemap B'), copy=structuredClone(before), report=api.compare(before,after);
  assert.equal(report.equal,false);assert.ok(report.changes.some(c=>c.path==='/design/goal'));
  assert.ok(report.changes.some(c=>c.path==='/design/sitemap/routes/0/path'&&c.before==='"/inbox"'&&c.after==='"/dashboard"'));
  assert.deepEqual(before,copy);assert.equal(api.compare(before,structuredClone(before)).equal,true);
});
test('comparison includes notes and optional fields, bounds output and rejects foreign identities',()=>{
  const before=document(), after=document();after.notes.push('Changed note');
  assert.ok(api.compare(before,after).changes.some(c=>c.path.startsWith('/notes/')));
  after.project.id='other';assert.throws(()=>api.compare(before,after),/PROTOTYPE_PROJECT/);
  const a=document(), b=document();
  a.notes=Array(100).fill('a');b.notes=Array(100).fill('b'.repeat(220));
  b.project.name='Other title';b.project.description='Other description';b.design.goal='Other goal';
  const report=api.compare(a,b);assert.equal(report.total,103);assert.equal(report.changes.length,100);assert.equal(report.omitted,3);
  assert.ok(report.changes.every(c=>c.after.length<=180));
});
test('directory loader bounds exact bytes before parsing and refuses duplicate registry IDs before manifest reads',async()=>{
  const w=workspace(), files=new Map((await api.files(w,hash)).map(f=>[f.path,f.content]));
  const read=p=>Promise.resolve(files.get(p));
  files.set('docs/concepts/prototypes.json',' '.repeat(4_000_001));
  await assert.rejects(readWorkspaceFiles(read,validateAuthoringDocument,hash),/PROTOTYPE_LIMIT/);
  const registry={...w,prototypes:['exploration','exploration']};let reads=0;
  await assert.rejects(readWorkspaceFiles(async()=>{reads++;return JSON.stringify(registry);},validateAuthoringDocument,hash),/PROTOTYPE_DUPLICATE/);assert.equal(reads,1);
});
test('directory loader rejects malformed digest before reading a snapshot, and bounds manifest whitespace',async()=>{
  const files=new Map((await api.files(workspace(),hash)).map(f=>[f.path,f.content])), path='docs/concepts/exploration/prototype.json';
  const manifest=JSON.parse(files.get(path));manifest.item.versions[0].variants[0].document.sha256='bad';files.set(path,JSON.stringify(manifest));let reads=0;
  await assert.rejects(readWorkspaceFiles(async p=>{reads++;return files.get(p);},validateAuthoringDocument,hash),/PROTOTYPE_HASH/);assert.equal(reads,2);
  files.set(path,' '.repeat(4_000_001));await assert.rejects(readWorkspaceFiles(async p=>files.get(p),validateAuthoringDocument,hash),/PROTOTYPE_LIMIT/);
});
test('navigation filters saved projections, retains selection outside results, and uses stable keys',()=>{
  const source=lab(), before=JSON.stringify(source), filtered=prototypeNavigation(source,main,{query:'Find capture',status:'draft'});
  assert.match(filtered,/1 of 2 variants/);assert.match(filtered,/selection is retained/);assert.match(filtered,/data-key="exploration\/v1\/sitemap-b"/);
  assert.doesNotMatch(filtered,/data-key="exploration\/v1\/main"/);assert.equal(JSON.stringify(source),before);
  assert.match(prototypeNavigation(source,main,{query:'nothing matches',status:'all'}),/No matching variants/);
});
test('view escapes metadata and comparison payloads and only offers restore to editable targets',()=>{
  const w=lab();w.prototypes[0].name='<script>alert(1)</script>';const snapshot=state(w);
  const html=prototypeView(snapshot,alternate,'',"<img src=x>",true,false,{query:'" onfocus=x',status:'all'},api.selectionKey(main));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));
  assert.match(prototypeComparisonView(snapshot,alternate,api.selectionKey(main),false),/data-pm="restore-snapshot">/);
  assert.match(prototypeComparisonView(snapshot,main,api.selectionKey(alternate),false),/data-pm="restore-snapshot" disabled/);
  assert.match(prototypeComparisonView(snapshot,alternate,'working',false),/data-pm="restore-snapshot" disabled/);
});

test('identical-snapshot restore never creates redundant recovery history',()=>{
  const w=fork(activate(workspace())), before=JSON.stringify(w);
  assert.throws(()=>api.change(w,restore),/PROTOTYPE_RESTORE_UNCHANGED/);assert.equal(JSON.stringify(w),before);
});
