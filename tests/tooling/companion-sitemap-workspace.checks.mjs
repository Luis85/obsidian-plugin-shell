/** Actual workspace composable, Vue lifecycle and full-project owner; explicit renderer/editor/file-port doubles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as storage from '../../scripts/companion/journey/project-store.ts';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
const root = new URL('../../', import.meta.url);
const Vue = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/vue.runtime.global.prod.js',root),'utf8')+';Vue;');
const source=readFileSync(new URL('docs/concepts/companion/editor/workspace/use-workspace.ts',root),'utf8');
const seed=readFileSync(new URL('docs/concepts/companion/starters/quick-capture.companion.json',root),'utf8');
async function load(env){
  const dependencies={vue:Vue,'./contracts.ts':{useWorkspaceEnvironment:()=>env},'project-store.ts':storage};
  const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};vm.runInThisContext('(function(require,exports){'+javascript+'\n})')(name=>{
    const dependency=dependencies[name]??dependencies[name.split('/').at(-1)];assert.ok(dependency,name);return dependency;
  },exports);return exports;
}
const element=()=>({children:[],parent:null});
const renderer=Vue.createRenderer({createElement:element,createText:element,createComment:element,
  setText(){},setElementText(){},patchProp(){},parentNode:n=>n.parent,nextSibling:()=>null,
  insert(n,p){n.parent=p;p.children.push(n);},remove(n){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);}});
async function settled(model){
  const until=Date.now()+5000;do{await Vue.nextTick();await new Promise(resolve=>setImmediate(resolve));if(!model.busy.value)return;}while(Date.now()<until);
  assert.fail('Workspace operation did not settle');
}
async function fixture(t,{present=true,mode='native'}={}){
  const files=new Map(present?[['project.companion.json',seed]]:[]),mounts=[],downloads=[];let writes=0,guard=null,path='project.companion.json';
  const ports={async read(path){if(!files.has(path))throw Error('missing');return files.get(path);},
    async create(path,content){if(files.has(path))return {status:'conflict'};writes++;files.set(path,content);return {status:'committed',content};},
    async replace(path,before,content){if(files.get(path)!==before)return {status:'conflict'};writes++;files.set(path,content);return {status:'committed',content};}};
  const owner=new storage.JourneyProjectStore(ports);
  const env={store:owner,seed,mode,ownerId:'fixture',initialPath:path,rememberPath(p){path=p;},navigate(){},
    guard(check){guard=check;return()=>{if(guard===check)guard=null;};},
    mount(_root,host){
      const session=new SitemapSession(host),state={host,dirty:false,closed:false,invalidations:0,session};mounts.push(state);
      return {ready:session.load().then(result=>assert.equal(result.status,'loaded')),canLeave:()=>!state.dirty,
        recovery:()=>({kind:'controlled editor draft'}),async restore(value){return value.accept===true;},viewState:()=>({}),
        invalidate(){state.invalidations++;},unmount(){state.closed=true;session.dispose();}};
    }};
  const {useWorkspace}=await load(env);let model;
  const view=renderer.createApp({setup(){model=useWorkspace();model.root.value={ownerDocument:{
    defaultView:{URL:{createObjectURL(blob){downloads.push(blob);return 'blob:controlled';},revokeObjectURL(){}},setTimeout(){}},createElement:()=>({click(){}})}};
    return()=>Vue.h('div');}});
  view.mount(element());await settled(model);
  t.after(()=>{view.unmount();owner.dispose();});
  return {model,view,owner,files,ports,mounts,downloads,writes:()=>writes,guard:()=>guard,path:()=>path};
}
test('native first open never creates missing data; reviewed approval creates then mounts the actual document session',async t=>{
  const f=await fixture(t,{present:false}),m=f.model;assert.equal(m.loaded.value,false);assert.equal(f.writes(),0);
  m.beginImport(true);await m.applyImport();assert.equal(f.writes(),0);m.reviewImport();assert.equal(m.reviewed.value,true);
  await m.applyImport();assert.equal(f.writes(),0);m.confirmed.value=true;await m.applyImport();
  assert.equal(f.writes(),1);assert.equal(m.loaded.value,true);assert.equal(m.importOpen.value,false);
  assert.equal(f.mounts.length,1);assert.equal(f.path(),'project.companion.json');assert.equal(JSON.parse(f.files.get(f.path())).schemaVersion,6);
});
test('full-project session saves, exported JSON is canonical, and reopening creates a fresh independent editor',async t=>{
  const f=await fixture(t),first=f.mounts[0],before=JSON.parse(f.files.get(f.path()));
  const node=first.session.snapshot().design.nodes[0];
  assert.equal((await first.session.apply(first.session.plan({type:'rename',surface:node.id,label:'Changed native title'}))).status,'committed');
  f.model.exportSaved();const exported=JSON.parse(await f.downloads[0].text());assert.equal(exported.design.nodes[0].label,'Changed native title');
  assert.deepEqual(exported.design.visualDesigns,before.design.visualDesigns);assert.equal(f.writes(),1);
  await f.model.openFile();assert.equal(first.closed,true);assert.equal(f.mounts.length,2);assert.equal(f.mounts[1].session.snapshot().design.nodes[0].label,'Changed native title');
});
test('stale import cannot replace concurrent bytes; explicit recovery opens the stored revision',async t=>{
  const f=await fixture(t),m=f.model,first=f.mounts[0];m.beginImport(true);m.importMode.value='replace';m.reviewImport();m.confirmed.value=true;
  const current=JSON.parse(seed);current.project.name='External project';f.files.set(f.path(),JSON.stringify(current));
  await m.applyImport();assert.equal(f.writes(),0);assert.match(m.error.value,/changed/);assert.equal(first.closed,false);
  m.beginRecovery();m.recoveryConfirmed.value=true;await m.reloadStored();assert.equal(first.closed,true);assert.equal(m.recoveryOpen.value,false);
  assert.equal(JSON.parse(f.files.get(f.path())).project.name,'External project');assert.equal(f.writes(),0);
});
test('corrupt stored bytes are not repaired and failed recovery retains the current unsaved editor',async t=>{
  const f=await fixture(t),m=f.model,first=f.mounts[0];first.dirty=true;f.files.set(f.path(),'{broken');
  m.beginRecovery();m.recoveryConfirmed.value=true;await m.reloadStored();
  assert.equal(first.closed,false);assert.equal(first.dirty,true);assert.equal(m.recoveryOpen.value,true);assert.equal(f.files.get(f.path()),'{broken');assert.equal(f.writes(),0);
});
test('review is input-bound and unfinished editor drafts block project replacement and navigation',async t=>{
  const f=await fixture(t),m=f.model,first=f.mounts[0];first.dirty=true;
  m.beginImport(true);assert.equal(m.importOpen.value,false);assert.equal(f.guard()(),false);await m.openFile();assert.equal(first.closed,false);
  first.dirty=false;m.beginImport(true);m.reviewImport();m.confirmed.value=true;m.importText.value+=' ';
  await m.applyImport();assert.equal(m.reviewed.value,false);assert.equal(f.writes(),0);assert.equal(first.closed,false);
});
test('external modifications invalidate the current leaf; identical self-write events do not',async t=>{
  const f=await fixture(t),m=f.model,first=f.mounts[0];await f.owner.refresh(f.path());assert.equal(first.invalidations,0);
  const doc=JSON.parse(seed);doc.project.name='External edit';f.files.set(f.path(),JSON.stringify(doc));await f.owner.refresh(f.path());
  assert.equal(first.invalidations,1);assert.equal(m.changed.value,true);assert.equal(first.closed,false);
});
test('cancelled late file reads cannot repopulate an import review',async t=>{
  const f=await fixture(t),m=f.model;let finish;m.beginImport(false);
  const pending=m.readImport({size:seed.length,text:()=>new Promise(resolve=>{finish=resolve;})});m.cancelImport();finish(seed);await pending;
  assert.equal(m.importOpen.value,false);assert.equal(m.importText.value,'');assert.equal(f.writes(),0);
});
test('destroying the view releases guard, subscriptions and editor without deleting saved data',async t=>{
  const f=await fixture(t),first=f.mounts[0];const before=f.files.get(f.path());f.view.unmount();
  assert.equal(first.closed,true);assert.equal(f.guard(),null);await f.owner.refresh(f.path());assert.equal(first.invalidations,0);assert.equal(f.files.get(f.path()),before);assert.equal(f.writes(),0);
});
