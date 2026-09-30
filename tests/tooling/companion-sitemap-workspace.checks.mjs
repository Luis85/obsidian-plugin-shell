/** Actual workspace composable, Vue lifecycle and full-project owner; explicit renderer/editor/file-port doubles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as storage from '../../scripts/companion/journey/project-store.ts';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const root = new URL('../../', import.meta.url);
const Vue = vm.runInThisContext(readFileSync(new URL('docs/concepts/companion/vendor/vue.runtime.global.prod.js',root),'utf8')+';Vue;');
const source=readFileSync(new URL('docs/concepts/companion/editor/workspace/use-workspace.ts',root),'utf8');
const seed=starterDocumentText('quick-capture');
async function load(env,urlApi){
  const dependencies={vue:Vue,'./contracts.ts':{useWorkspaceEnvironment:()=>env},'project-store.ts':storage};
  const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};vm.runInThisContext('(function(require,exports,URL){'+javascript+'\n})')(name=>{
    const dependency=dependencies[name]??dependencies[name.split('/').at(-1)];assert.ok(dependency,name);return dependency;
  },exports,urlApi);return exports;
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
  const files=new Map(present?[['project.companion.json',seed]]:[]),mounts=[],downloads=[],timers=[],revoked=[],links=[];let writes=0,guard=null,path='project.companion.json';
  const ports={async read(path){if(!files.has(path))throw Error('missing');return files.get(path);},
    async create(path,content){if(files.has(path))return {status:'conflict'};writes++;files.set(path,content);return {status:'committed',content};},
    async replace(path,before,content){if(files.get(path)!==before)return {status:'conflict'};writes++;files.set(path,content);return {status:'committed',content};}};
  const owner=new storage.JourneyProjectStore(ports);
  const env={store:owner,seed,mode,ownerId:'fixture',initialPath:path,rememberPath(p){path=p;},navigate(){},
    guard(check){guard=check;return()=>{if(guard===check)guard=null;};},
    mount(_root,host){
      const session=new SitemapSession(host),state={host,dirty:false,closed:false,pending:false,invalidations:0,session};mounts.push(state);
      return {ready:session.load().then(result=>assert.equal(result.status,'loaded')),canLeave:()=>!state.dirty&&!state.pending,isBusy:()=>state.pending,
        recovery:()=>({kind:'controlled editor draft'}),async restore(value){return value.accept===true;},viewState:()=>({}),
        invalidate(){state.invalidations++;},unmount(){state.closed=true;session.dispose();}};
    }};
  const urlApi={createObjectURL(blob){downloads.push(blob);return 'blob:controlled-'+downloads.length;},revokeObjectURL(url){revoked.push(url);}};
  const {useWorkspace}=await load(env,urlApi);let model;
  const view=renderer.createApp({setup(){model=useWorkspace();model.root.value={closest:()=>null,ownerDocument:{
    defaultView:{setTimeout(callback){timers.push(callback);}},createElement(tag){assert.equal(tag,'a');const link={click(){this.clicked=true;}};links.push(link);return link;}}};
    return()=>Vue.h('div');}});
  view.mount(element());await settled(model);
  t.after(()=>{view.unmount();owner.dispose();});
  return {model,view,owner,files,ports,env,mounts,downloads,timers,revoked,links,writes:()=>writes,guard:()=>guard,path:()=>path};
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

test('export uses the owner document and releases its standard object URL after the click',async t=>{
  const f=await fixture(t);f.model.exportSaved();
  assert.equal(f.downloads.length,1);assert.equal(f.links.length,1);
  assert.equal(f.links[0].clicked,true);assert.equal(f.links[0].href,'blob:controlled-1');
  assert.equal(f.links[0].download,'project.companion.json');
  assert.equal(f.timers.length,1);assert.deepEqual(f.revoked,[]);
  f.timers[0]();assert.deepEqual(f.revoked,['blob:controlled-1']);
  assert.equal(f.writes(),0);
});


test('selecting an unreadable or oversized import immediately invalidates prior approval',async t=>{
  const f=await fixture(t),m=f.model;m.beginImport(true);m.reviewImport();m.confirmed.value=true;
  await m.readImport({size:4_000_001,text:async()=>seed});
  assert.equal(m.reviewed.value,false);assert.equal(m.confirmed.value,false);await m.applyImport();assert.equal(f.writes(),0);
  m.reviewImport();m.confirmed.value=true;await m.readImport({size:10,text:async()=>{throw Error('private file');}});
  assert.equal(m.reviewed.value,false);assert.equal(m.confirmed.value,false);assert.doesNotMatch(m.error.value,/private file/);
});
test('typing while a file read is pending wins; late bytes cannot replace the authored import',async t=>{
  const f=await fixture(t),m=f.model;let finish;m.beginImport(false);
  const pending=m.readImport({size:seed.length,text:()=>new Promise(resolve=>{finish=resolve;})});
  assert.equal(m.readingImport.value,true);m.reviewImport();assert.equal(m.reviewed.value,false);
  m.importText.value='new typed draft';m.invalidateReview();finish(seed);await pending;
  assert.equal(m.importText.value,'new typed draft');assert.equal(m.readingImport.value,false);assert.equal(f.writes(),0);
});
test('refused imports consume approval and never silently retry a destination',async t=>{
  const f=await fixture(t),m=f.model;let attempts=0;f.ports.create=async()=>{attempts++;return {status:'conflict'};};
  m.beginImport(true);m.reviewImport();m.confirmed.value=true;await m.applyImport();await m.applyImport();
  assert.equal(attempts,1);assert.equal(m.reviewed.value,false);assert.equal(m.confirmed.value,false);assert.equal(f.writes(),0);
});
test('the active file identity does not follow an unsubmitted path or failed open',async t=>{
  const f=await fixture(t),m=f.model;assert.equal(m.activePath.value,'project.companion.json');
  m.path.value='another.companion.json';await m.openFile();
  assert.equal(m.activePath.value,'project.companion.json');assert.equal(m.canReplace.value,false);
  m.exportSaved();assert.equal(JSON.parse(await f.downloads[0].text()).project.id,JSON.parse(seed).project.id);
});
test('recovery reload cannot close an editor with a pending save even after confirmation',async t=>{
  const f=await fixture(t),m=f.model,first=f.mounts[0];m.beginRecovery();m.recoveryConfirmed.value=true;first.pending=true;
  await m.reloadStored();assert.equal(first.closed,false);assert.equal(f.mounts.length,1);assert.equal(m.recoveryOpen.value,true);
  first.pending=false;await m.reloadStored();assert.equal(first.closed,true);assert.equal(f.mounts.length,2);
});
test('an uncertain import into another path recovers that reviewed destination, not the previously opened file',async t=>{
  const f=await fixture(t),m=f.model,original=f.files.get(f.path());m.path.value='second.companion.json';
  f.ports.create=async(path,content)=>{f.files.set(path,content);return {status:'failed',certainty:'unknown'};};
  m.beginImport(true);m.reviewImport();m.confirmed.value=true;await m.applyImport();
  m.beginRecovery();assert.equal(m.recoveryPath.value,'second.companion.json');m.recoveryConfirmed.value=true;await m.reloadStored();
  assert.equal(m.activePath.value,'second.companion.json');assert.equal(f.owner.writable('second.companion.json'),true);
  assert.equal(f.files.get('project.companion.json'),original);
});
test('closing while mount readiness is pending never installs a late subscription or remembered path',async t=>{
  const f=await fixture(t),m=f.model;let ready,remembered=0,invalidations=0;f.env.rememberPath=()=>{remembered++;};
  f.env.mount=()=>({ready:new Promise(resolve=>{ready=resolve;}),isBusy:()=>false,canLeave:()=>true,
    recovery:()=>({}),restore:async()=>true,viewState:()=>({}),invalidate:()=>{invalidations++;},unmount(){}});
  const pending=m.openFile();while(!ready)await new Promise(resolve=>setImmediate(resolve));
  f.view.unmount();ready();await pending;const doc=JSON.parse(seed);doc.project.name='After close';f.files.set(f.path(),JSON.stringify(doc));
  await f.owner.refresh(f.path());assert.equal(remembered,0);assert.equal(invalidations,0);assert.equal(m.loaded.value,false);
});
test('external change cancels a replacement approval while preserving its import draft',async t=>{
  const f=await fixture(t),m=f.model;m.beginImport(true);m.importMode.value='replace';m.reviewImport();m.confirmed.value=true;
  const draft=m.importText.value,doc=JSON.parse(seed);doc.project.name='Other leaf';f.files.set(f.path(),JSON.stringify(doc));await f.owner.refresh(f.path());
  assert.equal(m.reviewed.value,false);assert.equal(m.confirmed.value,false);assert.equal(m.importText.value,draft);await m.applyImport();assert.equal(f.writes(),0);
});
test('recovery is a single review panel; cancellation returns to the retained unapproved import',async t=>{
  const f=await fixture(t),m=f.model;m.beginImport(true);m.beginRecovery();
  assert.equal(m.importOpen.value,false);assert.equal(m.recoveryOpen.value,true);m.cancelRecovery();
  assert.equal(m.importOpen.value,true);assert.equal(m.recoveryOpen.value,false);assert.equal(m.importText.value,seed);assert.equal(m.confirmed.value,false);
});
test('workspace unmount releases outstanding download URLs exactly once',async t=>{
  const f=await fixture(t);f.model.exportSaved();f.view.unmount();assert.deepEqual(f.revoked,['blob:controlled-1']);
  f.timers[0]();assert.deepEqual(f.revoked,['blob:controlled-1']);
});


test('review panels receive focus and Escape restores the trigger without writing',async t=>{
  const f=await fixture(t),m=f.model;let titleFocus=0,triggerFocus=0,prevented=0;
  m.root.value.closest=()=>({querySelector:()=>({focus(){titleFocus++;}})});
  m.root.value.ownerDocument.activeElement={isConnected:true,focus(){triggerFocus++;}};
  m.beginImport(true);await Vue.nextTick();assert.equal(titleFocus,1);
  m.escapeReview({defaultPrevented:false,preventDefault(){prevented++;},stopPropagation(){}});
  await Vue.nextTick();assert.equal(m.importOpen.value,false);assert.equal(triggerFocus,1);assert.equal(prevented,1);assert.equal(f.writes(),0);
});


test('revoking approval restores review focus only when its focused control was removed',async t=>{
  const f=await fixture(t),m=f.model;let focused=0;
  const doc=m.root.value.ownerDocument,previous={isConnected:true};doc.body={};
  m.root.value.closest=()=>({querySelector:()=>({focus(){focused++;}})});
  m.beginImport(true);await Vue.nextTick();m.reviewImport();await Vue.nextTick();doc.activeElement=previous;
  // Real DOM removal occurs in Vue's scheduled render, not synchronously inside the event.
  const stop=Vue.watch(()=>m.reviewed.value,reviewed=>{if(!reviewed&&Vue.toRaw(doc.activeElement)===previous){previous.isConnected=false;doc.activeElement=doc.body;}},{flush:'post'});
  t.after(stop);m.invalidateReview();
  await Vue.nextTick();await Vue.nextTick();assert.equal(focused,2);assert.equal(m.importOpen.value,true);assert.equal(f.writes(),0);
  m.reviewImport();doc.activeElement={isConnected:true};m.invalidateReview();
  await Vue.nextTick();await Vue.nextTick();assert.equal(focused,2,'Do not steal focus from a surviving input');
  m.reviewImport();doc.activeElement=previous;m.cancelImport();doc.activeElement=doc.body;
  await Vue.nextTick();await Vue.nextTick();assert.equal(m.importOpen.value,false);assert.equal(f.writes(),0);
});
