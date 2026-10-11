<script setup>
import {ref,computed,onMounted,onBeforeUnmount,watch} from 'vue';
import {APPS,FORMAT,VERSION,clone,id,sourceKey,reference,ownSource,ownEntities,emptyRegistry,safeData,parsePackage,packageSummary,mergePackage,makePackage,linkRecords,linkHealth,familyMarkdown,MAX_BYTES} from './protocol.mjs';

const config=JSON.parse(document.getElementById('family-config').textContent);
const appId=config.appId,app=APPS[appId];
const frame=ref(null),snapshot=ref(null),screen=ref('editor'),busy=ref(false),bootError=ref('');
const editorBytes=document.getElementById('family-editor-source').textContent.trim();
const editorHtml=editorBytes.startsWith('__')?'':new TextDecoder().decode(Uint8Array.from(atob(editorBytes),c=>c.charCodeAt(0)));
const token=id('bridge'),pending=new Map();let rpcCounter=0;
const notification=ref(''),noticeError=ref(false);let noticeTimer;
const prefsKey='opf.preferences.v1.'+appId;
const initialPrefs=(()=>{try{return JSON.parse(localStorage.getItem(prefsKey)||'{}')}catch{return {}}})();
const theme=ref(['dark','light'].includes(initialPrefs.theme)?initialPrefs.theme:'dark'),collapsed=ref(typeof initialPrefs.collapsed==='boolean'?initialPrefs.collapsed:(appId==='dissect')),mobileNav=ref(false);
const familyFolder=ref(typeof initialPrefs.familyFolder==='string'&&initialPrefs.familyFolder?initialPrefs.familyFolder:'Product/Family');
const registry=ref(emptyRegistry()),registryError=ref(''),registryBlocked=ref(false),registryRaw=ref('');
const registryHistory=ref([]),registryFuture=ref([]);let registryKey='';
const searchOpen=ref(false),searchText=ref(''),familyOpen=ref(false),importOpen=ref(false),exportOpen=ref(false),linkOpen=ref(false),recoveryOpen=ref(false);
const importText=ref(''),importError=ref(''),staged=ref(null),updateExisting=ref(false),importMode=ref('references');
const fileInput=ref(null),exportText=ref(''),exportFile=ref(''),exportError=ref('');
const selectedRef=ref(null),catalogQuery=ref(''),catalogSource=ref('all'),catalogScope=ref('all');
const linkQuery=ref(''),linkTarget=ref(''),relation=ref('relates-to'),linkNote=ref('');
const adoption=ref(null);
const own=computed(()=>snapshot.value?ownEntities(snapshot.value):[]);
const allEntities=computed(()=>[...own.value,...registry.value.records]);
const entityMap=computed(()=>new Map(allEntities.value.map(e=>[e.ref,e])));
const localSource=computed(()=>snapshot.value?ownSource(snapshot.value):null);
const currentEntity=computed(()=>{const s=snapshot.value?.selection;return s&&localSource.value?entityMap.value.get(reference(localSource.value,s.kind,s.id)):null;});
const selectedEntity=computed(()=>entityMap.value.get(selectedRef.value)||null);
const localNav=computed(()=>snapshot.value?.nav||[]);
const filteredEntities=computed(()=>allEntities.value.filter(e=>{
  const local=sourceKey(e.source)===sourceKey(localSource.value);
  return (catalogScope.value==='all'||(catalogScope.value==='local'?local:catalogScope.value==='external'?!local:e.missing))&&
    (catalogSource.value==='all'||e.source.appId===catalogSource.value)&&
    [e.title,e.kind,e.summary,e.id,e.source.workspaceTitle].join(' ').toLowerCase().includes(catalogQuery.value.toLowerCase());
}));
const sourceOptions=computed(()=>[{label:'All apps',value:'all'},...Object.entries(APPS).map(([value,a])=>({label:a.name,value}))]);
const selectedLinks=computed(()=>registry.value.links.filter(l=>l.from===selectedRef.value||l.to===selectedRef.value));
const attention=computed(()=>registry.value.links.filter(l=>linkHealth(l,allEntities.value)!=='resolved').length+registry.value.records.filter(e=>e.missing).length);
const importSummary=computed(()=>staged.value&&localSource.value?packageSummary(staged.value,registry.value,localSource.value):null);
const restorable=computed(()=>staged.value?.source.appId===appId?staged.value.natives.find(n=>sourceKey(n.source)===sourceKey(staged.value.source)):null);
const searchResults=computed(()=>allEntities.value.filter(e=>[e.title,e.kind,e.id,e.summary].join(' ').toLowerCase().includes(searchText.value.toLowerCase())).slice(0,60));
const linkCandidates=computed(()=>allEntities.value.filter(e=>e.ref!==currentEntity.value?.ref&&[e.title,e.kind,e.source.appId].join(' ').toLowerCase().includes(linkQuery.value.toLowerCase())).slice(0,150));
const mainTitle=computed(()=>screen.value==='connections'?'Connections':screen.value==='exchange'?'Import & export':screen.value==='guide'?'Working together':screen.value==='preferences'?'Appearance & folders':snapshot.value?.title||app.name);
const mainDescription=computed(()=>screen.value==='connections'?'Connect your product’s definitions, journeys, pages and interface evidence.':screen.value==='exchange'?'Carry a complete workspace and its connections between independent tools.':screen.value==='guide'?'Four focused tools. One product language.':screen.value==='preferences'?'A familiar workspace, wherever you are working.':app.purpose);
const statusWarning=computed(()=>!!registryError.value||snapshot.value?.save?.state==='warning'||snapshot.value?.save?.state==='dirty');
const relationOptions=[{label:'Relates to',value:'relates-to'},{label:'Uses definition',value:'uses-definition'},{label:'Supports story',value:'supports-story'},{label:'Appears on page',value:'appears-on'},{label:'Explores interface',value:'explores'},{label:'Verifies behavior',value:'verifies'}];
const navIcons={'library':'boxes','architecture':'network','relationships':'git-branch','review':'clipboard-check','exchange':'arrow-left-right','settings':'settings','help':'circle-help','map':'map','backlog':'list','releases':'layers','personas':'users','files':'folder','inventory':'list','navigation':'git-branch','atlas':'boxes','rehearsal':'play','canvas':'scan','layers':'layers','interactions':'mouse-pointer-2','annotations':'message-square'};
// Dynamic adapter icons must resolve to the icons bundled in vite.config.mjs.
const bundledIcons=new Set(['boxes', 'panels-top-left', 'network', 'scan', 'folder', 'layers', 'map', 'list', 'users', 'settings', 'circle-help', 'git-branch', 'clipboard-check', 'arrow-left-right', 'book-open', 'layout-grid', 'mouse-pointer-2', 'message-square', 'play', 'file-code', 'link', 'package', 'arrow-up-right', 'plus', 'search', 'moon', 'sun', 'download', 'upload', 'undo-2', 'redo-2', 'panel-left-close', 'panel-left-open', 'chevron-right', 'check', 'x', 'external-link', 'filter', 'copy', 'ellipsis', 'triangle-alert', 'circle', 'shield-check', 'keyboard', 'diamond', 'file-text', 'refresh-cw', 'unlink', 'arrow-right', 'monitor', 'grip', 'eye']);
const iconAliases={box:'boxes',grid:'layout-grid',help:'circle-help',tree:'git-branch','list-tree':'git-branch',navigation:'network','check-square':'clipboard-check',components:'boxes',fit:'scan',canvas:'scan',cursor:'mouse-pointer-2','arrow-right-left':'arrow-left-right'};
function iconFor(item){const requested=String(item.icon||'').replace(/^i-lucide-/,'').replace(/^lucide:/,'');const mapped=iconAliases[requested]||requested;const fallback=navIcons[String(item.id||'').split(':')[0]]||'file-text';return 'i-lucide-'+(bundledIcons.has(mapped)?mapped:bundledIcons.has(fallback)?fallback:'file-text');}
function appName(id){return APPS[id]?.name||id;}
function isLocal(entity){return !!entity&&sourceKey(entity.source)===sourceKey(localSource.value);}
function kindLabel(kind){return String(kind||'record').replace(/^[^.]+\./,'').replaceAll('-',' ');}
function notify(message,error=false){notification.value=message;noticeError.value=error;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notification.value='',error?10000:5000);}
function persistPrefs(){try{localStorage.setItem(prefsKey,JSON.stringify({theme:theme.value,collapsed:collapsed.value,familyFolder:familyFolder.value}));}catch{notify('Appearance is applied for this session; browser storage is unavailable.',true);}}
function applyTheme(){document.documentElement.classList.toggle('dark',theme.value==='dark');document.documentElement.dataset.theme=theme.value;document.documentElement.style.colorScheme=theme.value;}
watch(theme,async()=>{applyTheme();persistPrefs();if(snapshot.value)try{await rpc('setTheme',theme.value);}catch(e){notify(e.message,true);}});
watch(collapsed,persistPrefs);
function toggleTheme(){theme.value=theme.value==='dark'?'light':'dark';}
function rpc(method,args={}){
  return new Promise((resolve,reject)=>{
    if(!frame.value?.contentWindow){reject(new Error('The editor is still opening. Try again in a moment.'));return;}
    const requestId=++rpcCounter;
    const timeout=setTimeout(()=>{pending.delete(requestId);reject(new Error('The editor did not respond. Your saved work is still available; reload this HTML if needed.'));},10000);
    pending.set(requestId,{resolve,reject,timeout});
    // Vue refs wrap imported records in proxies. Only plain JSON crosses the
    // iframe boundary; postMessage cannot structured-clone reactive proxies.
    try{frame.value.contentWindow.postMessage({channel:'opf:bridge:1',token,requestId,method,args:clone(args)},'*');}
    catch(error){clearTimeout(timeout);pending.delete(requestId);reject(new Error(error?.message||'This request could not be sent to the editor.'));}
  });
}
async function initFrame(){try{const s=await rpc('init',{theme:theme.value});acceptSnapshot(s);bootError.value='';}catch(error){bootError.value=error.message;}}
function validateRegistry(value,source=localSource.value){
  safeData(value);
  if(value?.schemaVersion!==1||!['records','links','sources'].every(k=>Array.isArray(value[k])))throw new Error('The saved family connection data is invalid.');
  const natives=[{source,data:{}},...value.sources];
  parsePackage({format:FORMAT,schemaVersion:1,packageId:'registry-validation',exportedAt:new Date().toISOString(),source,entities:value.records,links:value.links,natives});
  if(value.records.some(e=>sourceKey(e.source)===sourceKey(source)))throw new Error('The saved reference registry contains records owned by this editor.');
  return value;
}
function loadRegistry(source){
  const key='opf.connections.v1.'+sourceKey(source);
  if(registryKey===key)return;
  registryKey=key;registryError.value='';registryBlocked.value=false;registryRaw.value='';registryHistory.value=[];registryFuture.value=[];
  try{const raw=localStorage.getItem(key);registryRaw.value=raw||'';registry.value=raw?validateRegistry(JSON.parse(raw),source):emptyRegistry();}
  catch(error){registry.value=emptyRegistry();registryBlocked.value=true;registryError.value='Saved connections could not be opened. Download the recovery data before replacing it.';}
}
function acceptSnapshot(s){if(!s||s.appId!==appId||!s.workspace)return;loadRegistry(ownSource(s));snapshot.value=s;}
function receive(event){
  if(event.source!==frame.value?.contentWindow||event.data?.channel!=='opf:bridge:1'||event.data.token!==token)return;
  const message=event.data;
  if(message.type==='response'){
    const item=pending.get(message.requestId);if(!item)return;clearTimeout(item.timeout);pending.delete(message.requestId);
    message.error?item.reject(new Error(message.error)):item.resolve(message.result);
  }else if(message.type==='snapshot')acceptSnapshot(message.snapshot);
  else if(message.type==='error')notify(message.error,true);
  else if(message.type==='shortcut'){if(message.name==='search')searchOpen.value=true;else openLinks();}
}
function saveRegistry(next,{remember=true}={}){
  if(registryBlocked.value)throw new Error(registryError.value);
  if(remember){registryHistory.value.push(clone(registry.value));if(registryHistory.value.length>40)registryHistory.value.shift();registryFuture.value=[];}
  registry.value=next;
  try{const raw=JSON.stringify(next);localStorage.setItem(registryKey,raw);registryRaw.value=raw;registryError.value='';}
  catch(error){registryError.value='Connections are in memory only. Export a family package before closing this page.';}
}
function undoRegistry(){if(!registryHistory.value.length)return;const previous=registryHistory.value.pop();registryFuture.value.push(clone(registry.value));saveRegistry(previous,{remember:false});notify('Connection change undone.');}
function redoRegistry(){if(!registryFuture.value.length)return;const next=registryFuture.value.pop();registryHistory.value.push(clone(registry.value));saveRegistry(next,{remember:false});notify('Connection change restored.');}
async function command(name){
  try{if(name==='undo'&&screen.value!=='editor'){undoRegistry();return;}if(name==='redo'&&screen.value!=='editor'){redoRegistry();return;}
    screen.value='editor';await rpc('command',{name});
  }catch(error){notify(error.message,true);}
}
async function navigate(item){
  try{screen.value='editor';await rpc('navigate',{view:item.id});mobileNav.value=false;}
  catch(error){notify(error.message,true);}
}
async function reveal(entity){
  searchOpen.value=false;
  if(!isLocal(entity)){screen.value='connections';selectedRef.value=entity.ref;return;}
  try{screen.value='editor';await rpc('navigate',{entityId:entity.id});}catch(error){notify(error.message,true);}
}
function openScreen(value){screen.value=value;mobileNav.value=false;if(value==='connections'&&!selectedRef.value)selectedRef.value=currentEntity.value?.ref||registry.value.records[0]?.ref||own.value[0]?.ref||null;}
function savedGuard(){const save=snapshot.value?.save;if(save?.state==='dirty'&&save.draft!==false)throw new Error('Save or discard the open editor draft before exporting, importing a backup, or creating a linked item.');}
function download(filename,text,mime='application/json'){
  const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  window.__familyLastDownload={filename,text,mime};
}
async function prepareExport(){
  exportOpen.value=true;exportError.value='';exportText.value='';busy.value=true;
  try{savedGuard();const native=await rpc('exportNative');const latest=await rpc('getSnapshot');acceptSnapshot(latest);const pack=makePackage(snapshot.value,registry.value,native);exportText.value=JSON.stringify(pack,null,2);exportFile.value=appId+'-family.json';}
  catch(error){exportError.value=error.message;}finally{busy.value=false;}
}
function exportMarkdown(){try{const file=familyMarkdown(snapshot.value,registry.value,familyFolder.value);download(file.path.split('/').pop(),file.content,'text/markdown;charset=utf-8');notify('Connection note downloaded. Place it in '+familyFolder.value+'.');}catch(error){notify(error.message,true);}}
async function copyText(text){try{await navigator.clipboard.writeText(text);notify('Copied.');}catch{notify('Clipboard access is unavailable. Select and copy the text, or use Download.',true);}}
function showImport(){staged.value=null;importError.value='';importText.value='';updateExisting.value=false;importMode.value='references';importOpen.value=true;}
function stageImport(text){
  staged.value=null;importMode.value='references';
  try{staged.value=parsePackage(text);importError.value='';}
  catch(error){importError.value=error.message;}
}
function reviewImport(){stageImport(importText.value);}
function pastePackage(event){
  const text=event.clipboardData?.getData('text/plain');
  if(!text||text.length<=50*1024)return;
  // Substantial clipboard payloads go directly to the explicit review step.
  // Keeping thousands of JSON lines out of the text editor avoids needless
  // browser text layout. Validation and Import context remain separate.
  event.preventDefault();importText.value='';stageImport(text);
}
async function chooseFile(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  staged.value=null;importText.value='';importError.value='';importMode.value='references';
  if(file.size>MAX_BYTES){importError.value='Choose a family package smaller than 32 MB.';return;}
  try{stageImport(await file.text());}catch(error){importError.value='This file could not be read. Choose a local JSON package.';}
}
async function applyImport(){
  if(!staged.value||busy.value)return;busy.value=true;
  try{
    if(registryBlocked.value)throw new Error(registryError.value);
    const pack=staged.value;
    if(importMode.value==='restore'){
      if(!restorable.value)throw new Error('This package does not contain a native backup for this editor.');
      savedGuard();
      // Compute a valid connection candidate before restoring native data.
      const targetSource=restorable.value.source;
      const inspected=await rpc('inspectNative',restorable.value.data);
      if(inspected?.workspace?.id!==targetSource.workspaceId)throw new Error('The native backup’s workspace identity does not match this package. No workspace changes were made.');
      let targetRegistry=sourceKey(targetSource)===sourceKey(localSource.value)?registry.value:emptyRegistry();
      if(sourceKey(targetSource)!==sourceKey(localSource.value)){
        const raw=localStorage.getItem('opf.connections.v1.'+sourceKey(targetSource));if(raw)targetRegistry=validateRegistry(JSON.parse(raw),targetSource);
      }
      const next=mergePackage(pack,targetRegistry,targetSource,{updateExisting:updateExisting.value});
      await rpc('restoreNative',restorable.value.data);
      acceptSnapshot(await rpc('getSnapshot'));
      if(sourceKey(localSource.value)!==sourceKey(targetSource))throw new Error('The restored native workspace has a different identity from its package. Connections were not applied.');
      saveRegistry(next);screen.value='editor';
    }else{
      saveRegistry(mergePackage(pack,registry.value,localSource.value,{updateExisting:updateExisting.value}));
      screen.value='connections';selectedRef.value=registry.value.records.find(e=>sourceKey(e.source)===sourceKey(pack.source))?.ref||registry.value.records[0]?.ref||null;
    }
    importOpen.value=false;notify(registryError.value||'Package imported. Source records keep their original ownership.',!!registryError.value);
  }catch(error){importError.value=error.message;}finally{busy.value=false;}
}
function openLinks(){
  if(!currentEntity.value){openScreen('connections');notify('Select a record in the editor to attach a connection.');return;}
  linkTarget.value='';linkQuery.value='';linkNote.value='';relation.value='relates-to';linkOpen.value=true;
}
function createLink(){try{saveRegistry(linkRecords(registry.value,currentEntity.value?.ref,linkTarget.value,relation.value,linkNote.value));linkOpen.value=false;notify(registryError.value||'Connection added. Both records keep their own source.',!!registryError.value);}catch(error){notify(error.message,true);}}
function removeLink(link){try{const next=clone(registry.value);next.links=next.links.filter(l=>l.id!==link.id);saveRegistry(next);notify('Connection removed. Use Undo to restore it.');}catch(error){notify(error.message,true);}}
function otherEnd(link,ref){return link.from===ref?link.to:link.from;}
let adoptionRequest=0;
watch([selectedRef,selectedEntity,()=>snapshot.value?.selection,()=>snapshot.value?.workspace.id],async()=>{
  const request=++adoptionRequest;
  adoption.value=null;const entity=selectedEntity.value;if(!entity||isLocal(entity)||!snapshot.value)return;
  try{const result=await rpc('canAdopt',entity);if(request===adoptionRequest&&selectedRef.value===entity.ref)adoption.value=result;}
  catch{if(request===adoptionRequest)adoption.value=null;}
});
async function adoptSelected(){
  const entity=selectedEntity.value;if(!entity||busy.value)return;busy.value=true;
  try{
    savedGuard();if(registryBlocked.value)throw new Error(registryError.value);
    const native=registry.value.sources.find(n=>sourceKey(n.source)===sourceKey(entity.source))?.data||null;
    const result=await rpc('adopt',{entity:clone(entity),native});
    acceptSnapshot(await rpc('getSnapshot'));
    const adopted=own.value.find(e=>e.id===result?.entityId);
    if(adopted&&!registry.value.links.some(l=>l.from===adopted.ref&&l.to===entity.ref))saveRegistry(linkRecords(registry.value,adopted.ref,entity.ref,entity.kind.startsWith('ui.')?'uses-definition':'relates-to','Created from a source snapshot.'));
    screen.value='editor';notify(result?.message||'A linked local item was created.');
  }catch(error){notify(error.message,true);}finally{busy.value=false;}
}
function keyboard(event){
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchOpen.value=true;}
  if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='l'){event.preventDefault();openLinks();}
}
function storage(event){
  if(event.key===registryKey&&event.newValue!==registryRaw.value){registryBlocked.value=true;registryError.value='Another tab changed these connections. Export this tab’s package before reloading to use the newer data.';}
}
function recoverConnections(){
  const source=localSource.value;
  if(registryError.value.startsWith('Another tab')){registryKey='';loadRegistry(source);recoveryOpen.value=false;notify(registryError.value||'Connections reloaded from this browser.',!!registryError.value);return;}
  registryBlocked.value=false;registryError.value='';saveRegistry(emptyRegistry());recoveryOpen.value=false;notify(registryError.value||'A fresh connection index is ready.',!!registryError.value);
}
function warnBeforeClose(event){if(registryError.value&&!registryBlocked.value){event.preventDefault();event.returnValue='';}}
onMounted(()=>{applyTheme();window.addEventListener('message',receive);document.addEventListener('keydown',keyboard);window.addEventListener('storage',storage);window.addEventListener('beforeunload',warnBeforeClose);document.title=app.name+' · Obsidian Product Family';
  window.ProductFamily={version:config.version,getSnapshot:()=>clone(snapshot.value),getRegistry:()=>clone(registry.value),rpc,makePackage:async()=>makePackage(snapshot.value,registry.value,await rpc('exportNative')),review:input=>packageSummary(parsePackage(input),registry.value,localSource.value),importPackage:async(input,options={})=>{const p=parsePackage(input);saveRegistry(mergePackage(p,registry.value,localSource.value,options));return clone(registry.value);},link:(from,to,relation)=>saveRegistry(linkRecords(registry.value,from,to,relation)),get theme(){return theme.value;},setTheme:value=>{theme.value=value;},openScreen};
});
onBeforeUnmount(()=>{window.removeEventListener('message',receive);document.removeEventListener('keydown',keyboard);window.removeEventListener('storage',storage);window.removeEventListener('beforeunload',warnBeforeClose);clearTimeout(noticeTimer);for(const p of pending.values())clearTimeout(p.timeout);});
</script>

<template>
  <PfApp :toaster="null" :tooltip="{delayDuration:300}">
    <a class="skip-link" href="#work-surface">Skip to workspace</a>
    <div class="family-window">
      <nav class="family-ribbon" aria-label="Product family tools">
        <button class="ribbon-gem" aria-label="About the product family" @click="familyOpen=true"><PfIcon name="i-lucide-diamond" /></button>
        <PfTooltip :text="app.name"><PfButton :icon="app.icon" variant="soft" color="primary" :aria-label="app.name+' editor'" class="ribbon-tool active" @click="screen='editor'" /></PfTooltip>
        <PfTooltip text="Connections"><PfButton icon="i-lucide-link" color="neutral" variant="ghost" aria-label="View connections" class="ribbon-tool" @click="openScreen('connections')" /></PfTooltip>
        <PfTooltip text="Search · Ctrl K"><PfButton icon="i-lucide-search" color="neutral" variant="ghost" aria-label="Search this workspace" class="ribbon-tool" @click="searchOpen=true" /></PfTooltip>
        <div class="ribbon-space" />
        <PfTooltip text="Product family"><PfButton icon="i-lucide-layout-grid" color="neutral" variant="ghost" aria-label="Open product family overview" class="ribbon-tool" @click="familyOpen=true" /></PfTooltip>
        <PfTooltip :text="theme==='dark'?'Use light theme':'Use dark theme'"><PfButton :icon="theme==='dark'?'i-lucide-sun':'i-lucide-moon'" color="neutral" variant="ghost" aria-label="Toggle light and dark theme" class="ribbon-tool" @click="toggleTheme" /></PfTooltip>
        <PfTooltip text="Workspace preferences"><PfButton icon="i-lucide-settings" color="neutral" variant="ghost" aria-label="Appearance and folders" class="ribbon-tool" @click="openScreen('preferences')" /></PfTooltip>
      </nav>

      <PfDashboardGroup unit="px" :persistent="false" :storage-key="'opf-'+appId" class="family-dashboard">
        <PfDashboardSidebar v-model:collapsed="collapsed" v-model:open="mobileNav" :default-size="214" :min-size="190" :max-size="280" :collapsed-size="0" collapsible :toggle="false" class="family-sidebar" :ui="{header:'family-side-header',body:'family-side-body',footer:'family-side-footer'}">
          <template #header><div class="vault-brand"><PfIcon name="i-lucide-folder" /><span>Product Lab</span><PfBadge color="neutral" variant="subtle" size="xs">LOCAL</PfBadge></div></template>
          <template #default>
            <div class="side-app"><PfIcon :name="app.icon" /><div><strong>{{ app.name }}</strong><span>{{ app.purpose }}</span></div></div>
            <PfButton color="neutral" variant="outline" icon="i-lucide-search" class="side-search" @click="searchOpen=true">Find a record <kbd>⌘ K</kbd></PfButton>
            <p class="nav-heading">Workspace</p>
            <nav aria-label="Editor navigation" class="editor-nav">
              <PfButton v-for="item in localNav" :key="item.id" :icon="iconFor(item)" :color="screen==='editor'&&snapshot?.view===item.id?'primary':'neutral'" :variant="screen==='editor'&&snapshot?.view===item.id?'soft':'ghost'" class="nav-item" :aria-current="screen==='editor'&&snapshot?.view===item.id?'page':undefined" @click="navigate(item)"><span>{{ item.label }}</span><span v-if="item.count!==undefined" class="nav-count">{{ item.count }}</span></PfButton>
            </nav>
            <p class="nav-heading family-heading">Product family</p>
            <PfButton icon="i-lucide-link" :color="screen==='connections'?'primary':'neutral'" :variant="screen==='connections'?'soft':'ghost'" class="nav-item" @click="openScreen('connections')"><span>Connections</span><span class="nav-count">{{ registry.links.length }}</span></PfButton>
            <PfButton icon="i-lucide-arrow-left-right" :color="screen==='exchange'?'primary':'neutral'" :variant="screen==='exchange'?'soft':'ghost'" class="nav-item" @click="openScreen('exchange')">Import & export</PfButton>
            <PfButton icon="i-lucide-book-open" :color="screen==='guide'?'primary':'neutral'" :variant="screen==='guide'?'soft':'ghost'" class="nav-item" @click="openScreen('guide')">Working together</PfButton>
            <div class="side-context"><span class="status-dot" /><div><strong>Works on its own</strong><p>Bring in other tools when you need the context.</p></div></div>
          </template>
          <template #footer><PfIcon name="i-lucide-diamond" /><span>Obsidian plugin prototype</span></template>
        </PfDashboardSidebar>

        <PfDashboardPanel id="work-surface" class="family-panel" :ui="{body:'family-panel-body'}">
          <template #header>
            <PfDashboardNavbar :toggle="false" class="family-tabbar">
              <template #left>
                <PfButton :icon="collapsed?'i-lucide-panel-left-open':'i-lucide-panel-left-close'" variant="ghost" color="neutral" aria-label="Toggle workspace sidebar" class="sidebar-toggle-desktop" @click="collapsed=!collapsed" />
                <PfButton icon="i-lucide-panel-left-open" variant="ghost" color="neutral" aria-label="Open workspace menu" class="sidebar-toggle-mobile" @click="mobileNav=true" />
                <div class="workspace-tab"><PfIcon :name="app.icon" /><span>{{ snapshot?.workspace.title||app.name }}</span></div>
              </template>
              <template #right><span class="tab-motto">Your product, connected.</span><PfBadge color="neutral" variant="subtle" size="xs">OFFLINE</PfBadge></template>
            </PfDashboardNavbar>
            <header class="family-page-header">
              <div class="page-heading"><div class="family-breadcrumb"><span>Product Lab</span><PfIcon name="i-lucide-chevron-right" /><span>{{ app.name }}</span></div><h1>{{ mainTitle }}</h1><p>{{ mainDescription }}</p></div>
              <div class="page-actions">
                <div class="history-actions"><PfButton icon="i-lucide-undo-2" variant="ghost" color="neutral" :disabled="screen==='editor'?!snapshot?.canUndo:!registryHistory.length" :aria-label="screen==='editor'?'Undo editor change':'Undo connection change'" @click="command('undo')" /><PfButton icon="i-lucide-redo-2" variant="ghost" color="neutral" :disabled="screen==='editor'?!snapshot?.canRedo:!registryFuture.length" :aria-label="screen==='editor'?'Redo editor change':'Redo connection change'" @click="command('redo')" /></div>
                <PfTooltip :text="currentEntity?'Link '+currentEntity.title:'Select a record to link'"><PfButton icon="i-lucide-link" color="neutral" variant="outline" class="link-action" aria-label="Link selected record" :disabled="!snapshot" @click="openLinks"><span>Link</span></PfButton></PfTooltip>
                <PfButton icon="i-lucide-upload" variant="outline" color="neutral" aria-label="Import" :disabled="!snapshot" @click="showImport"><span class="action-label">Import</span></PfButton>
                <PfButton icon="i-lucide-download" variant="outline" color="neutral" aria-label="Export" :disabled="!snapshot" @click="prepareExport"><span class="action-label">Export</span></PfButton>
                <PfButton v-if="screen==='editor'&&snapshot?.primary" icon="i-lucide-plus" color="primary" class="primary-action" @click="command(snapshot.primary.command)">{{ snapshot.primary.label }}</PfButton>
                <PfButton v-else-if="screen==='connections'" color="primary" icon="i-lucide-plus" @click="showImport">Bring in context</PfButton>
              </div>
            </header>
            <div v-if="registryError" role="alert" class="family-warning"><PfIcon name="i-lucide-triangle-alert" /><span>{{ registryError }}</span><PfButton v-if="registryRaw" size="xs" color="neutral" variant="outline" @click="download(appId+'-connections-recovery.json',registryRaw)">Download recovery</PfButton><PfButton v-if="registryBlocked" size="xs" color="neutral" variant="outline" @click="recoveryOpen=true">{{ registryError.startsWith('Another tab')?'Reload connections':'Recover connections' }}</PfButton></div>
          </template>

          <template #body>
            <div v-show="screen==='editor'" class="editor-host">
              <div v-if="!snapshot" class="editor-loading"><div v-if="bootError" class="empty-state"><PfIcon name="i-lucide-triangle-alert" /><h2>The editor could not open</h2><p>{{ bootError }}</p><PfButton @click="initFrame">Try again</PfButton></div><div v-else class="skeleton-workspace"><div /><div /><div /><div /><span>Opening {{ app.name }}…</span></div></div>
              <iframe ref="frame" :title="app.name+' specialized editor'" :srcdoc="editorHtml" class="native-editor" @load="initFrame" />
            </div>

            <section v-if="screen==='connections'" class="connections-view">
              <div class="connection-toolbar"><PfInput v-model="catalogQuery" icon="i-lucide-search" placeholder="Find records, sources or IDs…" aria-label="Search connection records" class="catalog-search" /><PfSelect v-model="catalogSource" :items="sourceOptions" aria-label="Filter records by source app" /><div class="scope-toggle"><PfButton v-for="[value,label] in [['all','All records'],['external','Imported'],['local','This editor'],['attention','Missing']]" :key="value" :color="catalogScope===value?'primary':'neutral'" :variant="catalogScope===value?'soft':'ghost'" size="sm" @click="catalogScope=value">{{ label }}</PfButton></div><span class="record-total">{{ filteredEntities.length }} records</span></div>
              <div class="connections-layout">
                <div class="record-list" role="list" aria-label="Available product records">
                  <div class="list-intro"><span>RECORD / PURPOSE</span><span>SOURCE</span></div>
                  <button v-for="entity in filteredEntities" :key="entity.ref" role="listitem" class="reference-row" :class="{selected:selectedRef===entity.ref}" @click="selectedRef=entity.ref"><div class="reference-mark"><PfIcon :name="APPS[entity.source.appId]?.icon||'i-lucide-file-text'" /></div><div class="reference-copy"><strong>{{ entity.title }}</strong><span>{{ entity.kind }}<template v-if="entity.summary"> · {{ entity.summary }}</template></span></div><div class="reference-origin"><span>{{ isLocal(entity)?'This editor':appName(entity.source.appId) }}</span><small :class="{missing:entity.missing}">{{ entity.missing?'Missing at source':isLocal(entity)?'Owned here':'Snapshot' }}</small></div></button>
                  <div v-if="!filteredEntities.length" class="empty-state"><PfIcon name="i-lucide-search" /><h2>{{ registry.records.length?'No records match':'Bring the product into view' }}</h2><p>{{ registry.records.length?'Try a different search or source filter.':'Import a family package from another editor. Its records become available here as source-owned snapshots.' }}</p><PfButton v-if="!registry.records.length" icon="i-lucide-upload" @click="showImport">Import a family package</PfButton></div>
                </div>
                <aside class="reference-detail" aria-label="Connection record details">
                  <template v-if="selectedEntity"><div class="detail-eyebrow"><PfIcon :name="APPS[selectedEntity.source.appId]?.icon||'i-lucide-file-text'" />{{ appName(selectedEntity.source.appId) }}<PfBadge :color="selectedEntity.missing?'warning':'neutral'" variant="subtle" size="xs">{{ isLocal(selectedEntity)?'Owned here':selectedEntity.missing?'Missing':'Snapshot' }}</PfBadge></div><h2>{{ selectedEntity.title }}</h2><p class="detail-summary">{{ selectedEntity.summary||'No description has been added to this record.' }}</p><dl class="reference-meta"><dt>Type</dt><dd>{{ selectedEntity.kind }}</dd><dt>Workspace</dt><dd>{{ selectedEntity.source.workspaceTitle }}</dd><dt>Stable ID</dt><dd class="mono">{{ selectedEntity.id }}</dd><template v-if="selectedEntity.status"><dt>Status</dt><dd>{{ selectedEntity.status }}</dd></template><template v-if="selectedEntity.path"><dt>Note path</dt><dd class="mono">{{ selectedEntity.path }}</dd></template></dl>
                    <p v-if="selectedEntity.missing" class="inline-warning">The latest export from its owner no longer includes this record. The last known snapshot is preserved for review.</p>
                    <div class="detail-actions"><PfButton v-if="isLocal(selectedEntity)" icon="i-lucide-arrow-up-right" @click="reveal(selectedEntity)">Find in editor</PfButton><PfButton v-else-if="adoption?.allowed" icon="i-lucide-plus" :loading="busy" :disabled="selectedEntity.missing" @click="adoptSelected">{{ adoption.label }}</PfButton><PfButton variant="outline" color="neutral" icon="i-lucide-copy" aria-label="Copy stable record reference" @click="copyText(selectedEntity.ref)" /></div>
                    <p v-if="!isLocal(selectedEntity)" class="field-hint">{{ adoption?.hint||'The source owns this record. Link it to a local item to keep the context close.' }}</p>
                    <div class="detail-section-title"><h3>Connections</h3><span>{{ selectedLinks.length }}</span></div>
                    <div v-for="link in selectedLinks" :key="link.id" class="connection-card"><button class="connection-target" @click="selectedRef=otherEnd(link,selectedEntity.ref)"><small>{{ link.relation.replaceAll('-',' ') }} {{ link.to===selectedEntity.ref?'←':'→' }}</small><strong>{{ entityMap.get(otherEnd(link,selectedEntity.ref))?.title||'Unresolved reference' }}</strong></button><PfBadge v-if="linkHealth(link,allEntities)!=='resolved'" color="warning" size="xs" variant="subtle">{{ linkHealth(link,allEntities) }}</PfBadge><PfButton icon="i-lucide-unlink" variant="ghost" color="neutral" size="xs" aria-label="Remove this connection" @click="removeLink(link)" /></div>
                    <p v-if="!selectedLinks.length" class="quiet-empty">No connections yet. Select a local record in the editor, then choose <strong>Link</strong>.</p>
                    <details class="reference-data"><summary>Source record data</summary><pre>{{ JSON.stringify(selectedEntity.data||{},null,2) }}</pre></details>
                  </template>
                  <div v-else class="empty-state"><PfIcon name="i-lucide-link" /><h2>Every connection has context</h2><p>Select a record to inspect its source, use it in this editor, or follow its relationships.</p></div>
                </aside>
              </div>
            </section>

            <section v-if="screen==='exchange'" class="content-page exchange-page">
              <div class="page-lead"><span class="eyebrow">PORTABLE BY DESIGN</span><h2>Your work travels with you.</h2><p>A family package includes this editor’s complete native backup, its owned records, and the reference snapshots and links you have brought in.</p></div>
              <div class="exchange-grid"><article class="exchange-card"><PfIcon name="i-lucide-package" /><h3>Family package</h3><p>The common format every member of the family understands. Review additions and changes before importing.</p><div class="card-actions"><PfButton icon="i-lucide-download" @click="prepareExport">Export package</PfButton><PfButton color="neutral" variant="outline" icon="i-lucide-upload" @click="showImport">Import package</PfButton></div></article><article class="exchange-card"><PfIcon name="i-lucide-folder" /><h3>Native workspace & vault files</h3><p>Keep using {{ app.name }}’s specialized formats, original import flow, and document exports.</p><div class="card-actions"><PfButton color="neutral" variant="outline" icon="i-lucide-download" @click="command('export-native')">Native exports</PfButton><PfButton color="neutral" variant="ghost" @click="command('import-native')">Native import</PfButton></div></article><article class="exchange-card"><PfIcon name="i-lucide-file-text" /><h3>Connections as a vault note</h3><p>Export the relationship index with Markdown and frontmatter. Keep source references beside the native notes.</p><code>{{ familyFolder }}/{{ appId }}-links.md</code><div class="card-actions"><PfButton color="neutral" variant="outline" @click="exportMarkdown">Download connection note</PfButton></div></article></div>
              <div class="exchange-explainer"><h3>What happens when you import?</h3><ol><li><strong>Review the package.</strong> See its source, additions, changed snapshots and any missing records.</li><li><strong>Choose how to handle changes.</strong> Existing snapshots are kept unless you choose to update them.</li><li><strong>Use the context.</strong> Link records, bind a definition to a page, create a story, or place a canvas instance where the receiving tool supports it.</li></ol><p class="field-hint">Each HTML saves independently in your browser. Native vault exports are files to place into Obsidian; this prototype does not directly write into your vault.</p></div>
            </section>

            <section v-if="screen==='guide'" class="content-page guide-page">
              <div class="page-lead"><span class="eyebrow">A CONNECTED PRODUCT WORKSPACE</span><h2>Small tools. Clear responsibilities.</h2><p>Start with the tool that fits your task. Connect the results when you need the bigger picture.</p></div>
              <div class="family-role-grid"><article v-for="[key,item] in Object.entries(APPS)" :key="key" :class="{current:key===appId}"><PfIcon :name="item.icon" /><h3>{{ item.name }}</h3><p>{{ item.purpose }}</p><span>{{ key==='component-atlas'?'C4 architecture · UI contracts':key==='storyloom'?'Activities · Stories · Releases':key==='sitemap-atlas'?'Pages · Hierarchy · Navigation':key==='resource-atlas'?'Roles · FTE · Person-days':'Instances · Annotations · Scenarios' }}</span><PfBadge v-if="key===appId" variant="soft" size="xs">YOU ARE HERE</PfBadge></article></div>
              <div class="guide-example"><h3>A useful workflow to try</h3><div class="example-step"><span>1</span><p>Define a <strong>Project card</strong> in Component Atlas and export a family package.</p></div><div class="example-step"><span>2</span><p>Import it into Sitemap Atlas, select a page, and use <strong>Connections</strong> to bind the definition to that page.</p></div><div class="example-step"><span>3</span><p>Bring the page into Storyloom. Create a story from its snapshot and refine the user need, acceptance criteria and release.</p></div><div class="example-step"><span>4</span><p>Bring a UI definition or page into Dissect. Place a safe canvas instance, add annotations and explore the interaction.</p></div></div>
              <div class="guide-columns"><article><h3>Ownership stays clear</h3><p>A definition is edited in Component Atlas. A story is edited in Storyloom. Links connect them without giving one tool responsibility for the other’s records.</p><p>Renaming a record does not change its stable reference. Removing a source record leaves a reviewable snapshot and a missing-source status after its next package is imported.</p></article><article><h3>Available without the other plugins</h3><p>Packages carry source titles, IDs, record data and native snapshots. You can read and link imported context even when its original app is not installed.</p><p>Dissect’s imported UI definitions are data-only previews. Executable components and Storybook assertions remain available for the built-in demonstration components.</p></article></div>
              <div class="keyboard-guide"><PfIcon name="i-lucide-keyboard" /><span><kbd>Ctrl / ⌘ K</kbd> Search records</span><span><kbd>Ctrl / ⌘ Shift L</kbd> Link selected record</span><PfButton variant="ghost" color="neutral" @click="command('help')">{{ app.name }} guide <PfIcon name="i-lucide-arrow-up-right" /></PfButton></div>
            </section>

            <section v-if="screen==='preferences'" class="content-page preferences-page"><div class="page-lead"><span class="eyebrow">WORKSPACE PREFERENCES</span><h2>Make room for your work.</h2><p>The same Storyloom palette and Nuxt UI foundation are available in every editor.</p></div><div class="preference-row"><div><h3>Appearance</h3><p>A quiet charcoal workspace or a soft light canvas.</p></div><PfSelect v-model="theme" :items="[{label:'Storyloom dark',value:'dark'},{label:'Storyloom light',value:'light'}]" aria-label="Theme" /></div><div class="preference-row"><div><h3>Navigation sidebar</h3><p>Keep the navigation close, or give the canvas more space.</p></div><PfSwitch :model-value="!collapsed" aria-label="Show desktop sidebar" @update:model-value="collapsed=!$event" /></div><div class="preference-row"><div><h3>Family connection notes</h3><p>A relative folder for the exported Markdown relationship index.</p></div><div class="folder-preference"><PfInput v-model="familyFolder" aria-label="Family connection notes folder" /><PfButton variant="outline" color="neutral" @click="()=>{try{familyMarkdown(snapshot,registry,familyFolder);persistPrefs();notify('Connection note folder updated.')}catch(e){notify(e.message,true)}}">Save</PfButton></div></div><div class="preference-row"><div><h3>{{ app.name }} settings</h3><p>Configure the specialized editor’s own folders and options.</p></div><PfButton icon="i-lucide-arrow-up-right" variant="outline" color="neutral" @click="command('settings')">Editor settings</PfButton></div><div class="build-note"><PfIcon name="i-lucide-check" /><p>Vue 3 · Nuxt UI 4.11.3 · Family Exchange v1<br><span>Bundled locally in this independent prototype.</span></p></div></section>
          </template>

          <template #footer><footer class="family-statusbar"><span>{{ app.name }}</span><span class="status-records">{{ own.length }} records · {{ registry.links.length }} connections<span v-if="attention"> · {{ attention }} to review</span></span><span class="save-indicator"><span class="status-dot" :class="{warning:statusWarning}" />{{ registryError?'Export to keep connections':snapshot?.save?.label||'Opening workspace' }}</span><span class="status-prototype">Local prototype</span></footer></template>
        </PfDashboardPanel>
      </PfDashboardGroup>
    </div>

    <div v-if="notification" class="family-toast" :class="{error:noticeError}" :role="noticeError?'alert':'status'"><PfIcon :name="noticeError?'i-lucide-triangle-alert':'i-lucide-check'" /><span>{{ notification }}</span><PfButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" aria-label="Dismiss notification" @click="notification=''" /></div>

    <PfModal v-model:open="recoveryOpen" :title="registryError.startsWith('Another tab')?'Reload saved connections?':'Start a fresh connection index?'" description="This action changes the local family connection index. Export a copy first if you want to keep the current connection data." :ui="{content:'family-modal'}"><template #body><p>{{ registryError.startsWith('Another tab')?'The newer connection index saved by the other tab will replace the context currently shown here.':'The unreadable connection index will be replaced with an empty one. You can then import a valid family package.' }}</p><PfButton v-if="registryRaw" variant="outline" color="neutral" class="review-button" icon="i-lucide-download" @click="download(appId+'-connections-recovery.json',registryRaw)">Download recovery copy</PfButton></template><template #footer><PfButton variant="ghost" color="neutral" @click="recoveryOpen=false">Cancel</PfButton><PfButton @click="recoverConnections">{{ registryError.startsWith('Another tab')?'Reload connections':'Start fresh' }}</PfButton></template></PfModal>

    <PfModal v-model:open="searchOpen" title="Find a product record" description="Search this editor and the source snapshots you have imported." :ui="{content:'family-modal search-modal',body:'modal-body'}"><template #body><PfInput v-model="searchText" autofocus icon="i-lucide-search" placeholder="Search titles, descriptions, types or IDs…" aria-label="Search product records" class="full-input" /><div class="search-results"><button v-for="entity in searchResults" :key="entity.ref" class="search-result" @click="reveal(entity)"><PfIcon :name="APPS[entity.source.appId]?.icon||'i-lucide-file-text'" /><span><strong>{{ entity.title }}</strong><small>{{ entity.kind }} · {{ appName(entity.source.appId) }}</small></span><PfIcon name="i-lucide-arrow-up-right" /></button><p v-if="!searchResults.length" class="quiet-empty">No matching records. Try a shorter title or import another workspace.</p></div></template></PfModal>

    <PfModal v-model:open="familyOpen" title="Your product family" description="Each prototype is complete on its own. Keep the HTML files in one folder; these shortcuts open a new tab." :ui="{content:'family-modal'}"><template #body><div class="family-switcher"><a v-for="[key,item] in Object.entries(APPS)" :key="key" :href="key===appId?undefined:'./'+item.file" target="_blank" rel="noopener" :aria-current="key===appId?'page':undefined" class="family-app-link" @click="key===appId&&(familyOpen=false)"><PfIcon :name="item.icon" /><span><strong>{{ item.name }}</strong><small>{{ item.purpose }}</small></span><PfBadge v-if="key===appId" variant="subtle" size="xs">Open</PfBadge><PfIcon v-else name="i-lucide-arrow-up-right" /></a></div><p class="field-hint">Switching files does not transfer work. Use a family package to bring source context into another editor.</p></template><template #footer><PfButton variant="outline" color="neutral" @click="familyOpen=false;openScreen('guide')">How they work together</PfButton></template></PfModal>

    <PfModal v-model:open="importOpen" title="Import a family package" description="Review the source and changes before anything is applied." :ui="{content:'family-modal import-modal'}"><template #body><input ref="fileInput" type="file" accept=".json,application/json" class="visually-hidden" aria-label="Choose family package JSON" @change="chooseFile" /><div class="import-file-row"><PfButton icon="i-lucide-upload" color="neutral" variant="outline" @click="fileInput.click()">Choose JSON file</PfButton><span>Product Family Exchange v1 · up to 32 MB</span></div><label class="field-label" for="package-json">Or paste a family package</label><PfTextarea id="package-json" v-model="importText" :rows="4" :maxrows="4" :autoresize="false" :spellcheck="false" wrap="off" autocomplete="off" autocapitalize="off" placeholder="Paste the exported JSON here…" class="full-input mono" @paste="pastePackage" @update:model-value="staged=null;importError='';importMode='references'" /><PfButton v-if="!staged" class="review-button" color="neutral" variant="outline" :disabled="!importText.trim()" @click="reviewImport">Review package</PfButton><div v-if="importError" class="inline-warning" role="alert">{{ importError }}</div><template v-if="staged"><div class="import-source"><PfIcon :name="APPS[staged.source.appId]?.icon||'i-lucide-package'" /><div><strong>{{ staged.source.workspaceTitle }}</strong><span>{{ appName(staged.source.appId) }} · {{ new Date(staged.exportedAt).toLocaleString() }}</span></div></div><div class="import-counts"><div><strong>{{ importSummary.added }}</strong><span>new records</span></div><div><strong>{{ importSummary.changed }}</strong><span>changed snapshots</span></div><div><strong>{{ importSummary.links }}</strong><span>connections</span></div><div><strong>{{ importSummary.missing }}</strong><span>missing at source</span></div></div><PfCheckbox v-model="updateExisting" label="Update existing snapshots with this package" description="Leave unchecked to keep the versions you already have. Missing-source status is still reviewed." /><div v-if="restorable" class="restore-choice"><label class="field-label" for="import-mode">How should this editor use the package?</label><PfSelect id="import-mode" v-model="importMode" class="full-input" :items="[{label:'Add external context only',value:'references'},{label:'Restore this editor’s native workspace backup',value:'restore'}]" /><p v-if="importMode==='restore'" class="inline-warning">This replaces the editor’s current native workspace with the backup. Save open drafts first. Native Undo restores the previous editor state; connection history is separate.</p><p v-else class="field-hint">{{ importSummary.owned }} source records already belong to this workspace and are kept under local ownership.</p></div><p v-if="importSummary.missing" class="field-hint">Missing records keep their last known snapshots and existing links for review.</p></template></template><template #footer><PfButton variant="ghost" color="neutral" @click="importOpen=false">Cancel</PfButton><PfButton :disabled="!staged" :loading="busy" @click="applyImport">{{ importMode==='restore'?'Restore workspace':'Import context' }}</PfButton></template></PfModal>

    <PfModal v-model:open="exportOpen" title="Export a family package" description="A complete, portable snapshot. Every family editor can read this file." :ui="{content:'family-modal export-modal'}"><template #body><div v-if="exportError" role="alert" class="inline-warning">{{ exportError }}</div><div v-else-if="!exportText" class="quiet-empty">Preparing the native backup and reference snapshots…</div><template v-else><div class="export-summary"><PfIcon name="i-lucide-package" /><div><strong>{{ exportFile }}</strong><span>{{ own.length }} owned records · {{ registry.records.length }} imported snapshots · {{ registry.links.length }} connections</span></div><PfBadge color="neutral" variant="subtle">v1</PfBadge></div><p class="field-hint">Includes this editor’s native backup. When another editor imports it, your records remain source-owned snapshots.</p><details><summary>Inspect package JSON</summary><PfTextarea :model-value="exportText" readonly :rows="10" :maxrows="10" :autoresize="false" :spellcheck="false" wrap="off" aria-label="Export package JSON" class="full-input mono" /></details></template></template><template #footer><PfButton variant="ghost" color="neutral" @click="exportOpen=false;command('export-native')">Native export formats</PfButton><PfButton variant="outline" color="neutral" :disabled="!exportText" @click="copyText(exportText)">Copy JSON</PfButton><PfButton icon="i-lucide-download" :disabled="!exportText" @click="download(exportFile,exportText);notify('Family package downloaded.')">Download package</PfButton></template></PfModal>

    <PfModal v-model:open="linkOpen" title="Connect a product record" :description="currentEntity?'Add context to “'+currentEntity.title+'”. Both records keep their original owners.':'Select a local record in the editor first.'" :ui="{content:'family-modal link-modal'}"><template #body><template v-if="currentEntity"><label class="field-label" for="link-search">Connect to</label><PfInput id="link-search" v-model="linkQuery" icon="i-lucide-search" placeholder="Search available records…" class="full-input" /><div class="link-candidates" role="radiogroup" aria-label="Choose target record"><button v-for="entity in linkCandidates" :key="entity.ref" role="radio" :aria-checked="linkTarget===entity.ref" class="link-candidate" :class="{selected:linkTarget===entity.ref}" @click="linkTarget=entity.ref"><PfIcon :name="APPS[entity.source.appId]?.icon||'i-lucide-file-text'" /><span><strong>{{ entity.title }}</strong><small>{{ entity.kind }} · {{ isLocal(entity)?'This editor':appName(entity.source.appId) }}</small></span><PfIcon v-if="linkTarget===entity.ref" name="i-lucide-check" /></button><p v-if="!linkCandidates.length" class="quiet-empty">No target records are available. Import a family package to bring in context.</p></div><div class="link-fields"><div><label class="field-label" for="link-relation">Relationship</label><PfSelect id="link-relation" v-model="relation" :items="relationOptions" class="full-input" /></div><div><label class="field-label" for="link-note">Context (optional)</label><PfInput id="link-note" v-model="linkNote" placeholder="Why are these connected?" class="full-input" /></div></div></template></template><template #footer><PfButton color="neutral" variant="ghost" @click="linkOpen=false">Cancel</PfButton><PfButton :disabled="!linkTarget||!currentEntity" icon="i-lucide-link" @click="createLink">Create connection</PfButton></template></PfModal>
  </PfApp>
</template>
