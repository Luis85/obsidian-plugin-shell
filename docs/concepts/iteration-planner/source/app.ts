import { ensure, getIteration, assignment, exportChangelog, type Workspace, type Status, type Priority, type Confidence, type Outcome, type RetroCategory } from './model.ts';
import { validateWorkspace } from './validation.ts';
import { execute, type Command } from './commands.ts';
import { demoWorkspace, emptyWorkspace } from './fixtures.ts';
import { esc, icon, button, iconButton, badge, iterationOptions, formatDate, type ViewState } from './ui.ts';
import { overview } from './overview.ts';
import { backlogView, planningView, resourcesView, historyView } from './planning.ts';
import { dailyView, incrementView, retroView } from './ceremonies.ts';
import { dialogSpec } from './dialogs.ts';

const storageKey = 'iteration-planner.prototype.v1';
let state: Workspace = demoWorkspace();
let protectedStored = false;
let dirty = false;
let unsaved = false;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
const ui: ViewState = {view:'overview',selectedId:'iteration-2',search:'',backlogFilter:'all',statusFilter:'all',showArchived:false,
  selectedItems:new Set(),dailyItemId:'',theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',remember:false,message:'',storageWarning:'',page:0};
const app = document.getElementById('app');
const modal = document.getElementById('planner-dialog');
ensure(app instanceof HTMLElement && modal instanceof HTMLDialogElement,'The prototype could not find its application frame.');
let modalKind = ''; let modalId = ''; let previousFocus: Element | null = null;
let pendingItems: string[] = [];
let pendingImport: Workspace | null = null;
let pendingReview: {summary:string;reviewNotes:string;goalOutcome:Outcome} | null = null;
let pendingConfirm: Command[] | 'demo' | 'empty' | null = null;
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try { state = validateWorkspace(JSON.parse(saved)); ui.remember = true; }
    catch { protectedStored = true; ui.storageWarning = 'A saved workspace could not be read. It has been left untouched; you are viewing the example.'; }
  }
} catch { ui.storageWarning = 'Browser storage is unavailable. Work stays in this tab; export JSON to keep it.'; }
function activeIteration() { return state.iterations.find(value=>value.id===ui.selectedId); }
function reconcile(): void {
  if (!activeIteration()) ui.selectedId = state.iterations.find(value=>value.stage==='active')?.id??state.iterations.at(-1)?.id??'';
  if (!state.backlogs.some(value=>value.id===ui.backlogFilter)) ui.backlogFilter='all';
  ui.selectedItems = new Set([...ui.selectedItems].filter(id=>state.items.some(item=>item.id===id&&!item.archived&&item.status!=='done')&&!assignment(state,id)));
}
function notify(message: string): void {
  const notice = document.getElementById('notice');
  if (!notice) return;
  notice.textContent = message; notice.classList.add('visible');
  clearTimeout(noticeTimer); noticeTimer = setTimeout(()=>notice.classList.remove('visible'),6000);
}
function persist(): void {
  if (!ui.remember||protectedStored) return;
  try { localStorage.setItem(storageKey,JSON.stringify(state)); ui.storageWarning=''; unsaved=false; }
  catch { ui.remember=false; ui.storageWarning='Browser save failed. Changes remain in this tab. Export JSON to keep your work.'; }
}
function render(): void {
  reconcile(); document.documentElement.dataset.theme=ui.theme;
  const focus = document.activeElement;
  const focusId = focus instanceof HTMLElement ? focus.id : '';
  const caret = focus instanceof HTMLInputElement && ['text','search'].includes(focus.type)?focus.selectionStart:null;
  const iteration = activeIteration();
  const entries = [{id:'overview',label:'Overview'},{id:'backlog',label:'Product backlog'},{id:'planning',label:'Iteration planning'},
    {id:'daily',label:'Daily walkthrough'},{id:'increment',label:'Increment & review'},{id:'retro',label:'Retrospective'}];
  const views: Record<string,()=>string> = {overview:()=>overview(state,iteration),backlog:()=>backlogView(state,ui),planning:()=>planningView(state,ui,iteration),
    daily:()=>dailyView(state,ui,iteration),increment:()=>incrementView(state,iteration),retro:()=>retroView(state,iteration),resources:()=>resourcesView(state,iteration),history:()=>historyView(state)};
  app.innerHTML = `<aside class="sidebar"><div class="brand"><span class="brand-mark">${icon('increment',24)}</span><div>Iteration<span>PLANNER</span></div></div><button class="workspace-button" data-action="settings"><span class="product-avatar">${esc(state.productName.slice(0,1))}</span><span><strong>${esc(state.productName)}</strong><small>Product workspace</small></span>${icon('settings',16)}</button>
    <div class="nav-caption">BUILD & IMPROVE</div><nav aria-label="Planner views">${entries.map(entry=>`<button class="nav-item ${ui.view===entry.id?'selected':''}" data-action="navigate" data-id="${entry.id}" ${ui.view===entry.id?'aria-current="page"':''}>${icon(entry.id)}<span>${entry.label}</span>${entry.id==='backlog'?`<small>${state.items.filter(item=>!item.archived&&item.status!=='done').length}</small>`:''}</button>`).join('')}</nav>
    <div class="nav-secondary"><div class="nav-caption">WORKSPACE</div>${['resources','history'].map(id=>`<button class="nav-item ${ui.view===id?'selected':''}" data-action="navigate" data-id="${id}" ${ui.view===id?'aria-current="page"':''}>${icon(id)}<span>${id==='resources'?'People & resources':'Iteration history'}</span></button>`).join('')}</div>
    <div class="sidebar-bottom"><div class="small-loop">${icon('leaf',23)}<strong>Small steps.<br>Useful increments.</strong><p>Progress is a team conversation, not a score.</p></div><button class="nav-item" data-action="help">${icon('help')}<span>How this works</span></button><span class="prototype-label">INTERACTIVE CONCEPT · v1</span></div></aside>
    <div class="workspace-main"><header class="topbar"><div class="breadcrumb">${icon(ui.view,17)}<span>${esc(state.productName)}</span><span>/</span><strong>${esc(entries.find(entry=>entry.id===ui.view)?.label??(ui.view==='resources'?'People & resources':'Iteration history'))}</strong></div><div class="toolbar-actions"><button class="demo-date" data-action="settings">${badge('Demo','neutral')} ${formatDate(state.clock,true)} ${state.clock.slice(0,4)}</button>${iconButton('Toggle light or dark theme','theme','','sun')}${iconButton('Import workspace JSON','import','','import')}${iconButton('Export workspace JSON','export','','export')}</div></header>
    <div class="iteration-switchbar"><label for="iteration-select">WORKING IN</label><select id="iteration-select" ${state.iterations.length?'':'disabled'}>${iterationOptions(state,ui.selectedId)||'<option>No iteration yet</option>'}</select><span class="save-state">${ui.remember?'Saved in this browser':'Session only · export to keep your work'}</span></div>
    ${ui.storageWarning?`<div class="storage-warning" role="status">${icon('warning',16)}${esc(ui.storageWarning)}</div>`:''}<main id="main" tabindex="-1">${(views[ui.view]??views.overview)()}</main>
    <footer class="app-footer"><span>PLAN → ADAPT → DELIVER → LEARN</span><span>Offline prototype · no vault or shared-team writes</span></footer></div>`;
  const restored = focusId?document.getElementById(focusId):null;
  if (restored instanceof HTMLElement) { restored.focus({preventScroll:true}); if(caret!==null&&restored instanceof HTMLInputElement)restored.setSelectionRange(caret,caret); }
}
function commit(commands: Command | Command[], message: string): void {
  const list = Array.isArray(commands)?commands:[commands];
  const candidate = list.reduce((current,command)=>execute(current,command),state);
  state=candidate; dirty=false; unsaved=true; reconcile(); persist(); render(); notify(message);
}
function closeDialog(): void { if(modal.open)modal.close(); }
function show(kind: string,id='',detail=''): void {
  if(!modal.open)previousFocus=document.activeElement;
  const spec=dialogSpec(kind,state,ui,id,detail); modalKind=kind;modalId=id;
  const contents=`<div class="dialog-heading"><div><div class="eyebrow">ITERATION PLANNER</div><h2 id="dialog-title">${esc(spec.title)}</h2></div>${iconButton('Close dialog','close-dialog','','close')}</div><p class="dialog-intro" id="dialog-description">${esc(spec.intro)}</p>`;
  const body=spec.ownForm?spec.body:`<form id="dialog-form">${spec.body}<p id="dialog-error" class="form-error" role="alert"></p><div class="dialog-actions">${button(spec.submit?'Cancel':'Close','close-dialog','','secondary')}${spec.submit?`<button class="btn primary" type="submit">${esc(spec.submit)}</button>`:''}</div></form>`;
  modal.innerHTML=contents+body;
  if(!modal.open)modal.showModal();
  const first=modal.querySelector('input:not([type="hidden"]),textarea,select');
  if(first instanceof HTMLElement)first.focus();
}
function navigate(view: string): void {closeDialog();dirty=false;ui.view=view;render();document.getElementById('page-title')?.focus({preventScroll:true});window.scrollTo(0,0);}
function download(name: string,content: string,type: string): void {
  const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function confirmCommands(commands: Command[]|'demo'|'empty',message: string): void {pendingConfirm=commands;show('confirm','',message);}
function data(form: HTMLFormElement,name: string): string {const value=new FormData(form).get(name);return typeof value==='string'?value:'';}
function choice<T extends string>(value: string,values: T[]): T {const found=values.find(option=>option===value);ensure(found!==undefined,'Choose a valid option.');return found;}
function error(error: unknown,form?: HTMLFormElement): void {
  const message=error instanceof Error?error.message:'The operation failed; no partial change was applied.';
  const target=form?.querySelector('.form-error')??(modal.open?modal.querySelector('.form-error'):null);
  if(target){target.textContent=message;target.scrollIntoView({block:'nearest'});}else notify(message);
}
function handleAction(action: string,id: string): void {
  const iteration=activeIteration();
  const needsIteration=['add-plan-item','remove-work','start-iteration','confidence','finish-daily','new-reference','new-retro','allocate','work','export-changelog','promote-retro'];
  if(needsIteration.includes(action))ensure(iteration,'Create an iteration first.');
  if(dirty&&['navigate','select-iteration','daily-select','work','new-iteration','new-item','close-dialog'].includes(action)&&!confirm('Discard unsaved form changes?'))return;
  switch(action){
    case 'navigate':navigate(id);break;
    case 'select-iteration':ui.selectedId=id;ui.dailyItemId='';navigate('overview');break;
    case 'daily-select':ui.dailyItemId=id;dirty=false;render();break;
    case 'new-iteration':show('iteration');break;
    case 'edit-iteration':show('iteration',id);break;
    case 'new-item':show('item');break;
    case 'edit-item':show('item',id);break;
    case 'review-feedback':show('feedback');break;
    case 'new-backlog':show('backlog');break;
    case 'rename-backlog':show('backlog',id);break;
    case 'work':show('work',id);break;
    case 'new-person':show('person');break;
    case 'edit-person':show('person',id);break;
    case 'allocate':show('allocate',id);break;
    case 'new-reference':show('reference');break;
    case 'new-retro':show('retro',id);break;
    case 'promote-retro':show('promote-retro',id);break;
    case 'confidence':show('confidence');break;
    case 'finish-daily':show('finish-daily');break;
    case 'start-iteration':show('start',id);break;
    case 'remove-work':show('scope-remove',id);break;
    case 'add-plan-item':pendingItems=[id];show('scope-add','',`Add “${state.items.find(item=>item.id===id)?.title}” to this iteration.`);break;
    case 'add-selected':{
      const select=document.getElementById('bulk-iteration');ensure(select instanceof HTMLSelectElement,'Choose a destination iteration.');
      ui.selectedId=select.value;pendingItems=[...ui.selectedItems];show('scope-add','',`Add ${pendingItems.length} selected items to the iteration.`);break;
    }
    case 'clear-selection':ui.selectedItems.clear();render();break;
    case 'previous-page':ui.page=Math.max(0,ui.page-1);render();break;
    case 'next-page':ui.page=Math.min(Math.max(0,Math.ceil(Number(id)/30)-1),ui.page+1);render();break;
    case 'move-up':case 'move-down':commit({type:'moveItem',id,direction:action==='move-up'?-1:1},'Backlog order updated.');break;
    case 'archive-item':case 'restore-item':confirmCommands([{type:'archiveItem',id,archived:action==='archive-item'}],`${action==='archive-item'?'Archive':'Restore'} this item? Historical snapshots are retained. Unsaved item edits are not applied.`);break;
    case 'remove-allocation':confirmCommands([{type:'removeAllocation',iterationId:ui.selectedId,resourceId:id}],'Remove this capacity allocation? The person stays in the directory.');break;
    case 'remove-reference':confirmCommands([{type:'removeReference',iterationId:ui.selectedId,id}],'Remove this iteration reference?');break;
    case 'delete-retro':confirmCommands([{type:'deleteRetro',iterationId:ui.selectedId,noteId:id}],'Remove this unlinked retrospective thought?');break;
    case 'help':show('help');break;
    case 'settings':show('settings');break;
    case 'theme':ui.theme=ui.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=ui.theme;break;
    case 'close-dialog':dirty=false;closeDialog();break;
    case 'reset-demo':confirmCommands('demo','Replace the current workspace with the synthetic example? Export first to keep your changes.');break;
    case 'reset-empty':confirmCommands('empty','Replace the current workspace with an empty product backlog? The iteration index restarts at 0 in the new workspace. Export first to keep history.');break;
    case 'export':download('iteration-planner.workspace.json',JSON.stringify(state,null,2)+'\n','application/json');unsaved=false;notify('Workspace JSON exported. This is not Companion project JSON.');break;
    case 'import':document.getElementById('workspace-import')?.click();break;
    case 'export-changelog':ensure(iteration,'Select an iteration.');download(`iteration-${iteration.index}-changelog.md`,exportChangelog(iteration),'text/markdown');notify('Changelog exported with delivered and unfinished work separated.');break;
    default:throw new Error('This interaction is not available.');
  }
}
function handleDialog(form: HTMLFormElement): void {
  const value=(name:string)=>data(form,name);const iterId=ui.selectedId;
  switch(modalKind){
    case 'iteration':{
      const before=new Set(state.iterations.map(value=>value.id));
      commit({type:'saveIteration',id:modalId||null,goal:value('goal'),description:value('description'),start:value('start'),end:value('end')},modalId?'Iteration plan updated.':'Iteration created with its own increment record.');
      ui.selectedId=modalId||state.iterations.find(value=>!before.has(value.id))?.id||ui.selectedId;closeDialog();navigate('planning');return;
    }
    case 'item':case 'feedback':commit({type:'saveItem',id:modalId||null,draft:{title:value('title'),description:value('description'),type:value('itemType')||'Item',backlogId:value('backlogId'),
      priority:choice<Priority>(value('priority'),['high','medium','low']),estimate:value('estimate')===''?null:Number(value('estimate')),ownerId:value('ownerId')||null}},modalId?'Backlog item updated; planning history preserved.':'Item added to the backlog.');break;
    case 'backlog':commit(modalId?{type:'renameBacklog',id:modalId,title:value('title')}:{type:'createBacklog',title:value('title')},'Backlog saved.');break;
    case 'person':commit({type:'saveResource',id:modalId||null,name:value('name'),role:value('role')},'Person saved. Allocate their available hours in an iteration.');break;
    case 'allocate':commit({type:'allocateResource',iterationId:iterId,resourceId:value('resourceId'),hours:Number(value('hours'))},'Iteration capacity updated.');break;
    case 'reference':commit({type:'addReference',iterationId:iterId,title:value('title'),url:value('url')},'Reference added.');break;
    case 'confidence':commit({type:'setConfidence',iterationId:iterId,confidence:choice<Confidence>(value('confidence'),['unknown','on-track','at-risk','off-track'])},'Team assessment updated.');break;
    case 'scope-add':commit({type:'addItems',iterationId:iterId,itemIds:pendingItems,reason:value('reason')},'Items added. The original agreement is preserved.');pendingItems=[];break;
    case 'scope-remove':commit({type:'removeWork',iterationId:iterId,itemId:modalId,reason:value('reason')},'Item removed from this iteration; its backlog history remains.');break;
    case 'start':commit({type:'startIteration',iterationId:iterId},'Planning agreed. Your daily walkthrough is ready.');closeDialog();navigate('overview');return;
    case 'finish-daily':commit({type:'finishDaily',iterationId:iterId,summary:value('summary')},'Daily completed. The next step is visible to the team.');break;
    case 'close-review':ensure(pendingReview,'The review draft expired.');commit({type:'closeIteration',iterationId:iterId,...pendingReview},'Increment frozen. Unfinished work is available for planning again.');pendingReview=null;closeDialog();navigate('increment');return;
    case 'retro':commit({type:'addRetro',iterationId:iterId,category:choice<RetroCategory>(value('category'),['keep','change','try']),text:value('text'),ownerId:value('ownerId')||null},'Retrospective thought captured.');break;
    case 'promote-retro':commit({type:'retroToBacklog',iterationId:iterId,noteId:modalId,backlogId:value('backlogId')},'Improvement added to the backlog, with a link to this retrospective.');break;
    case 'settings':{
      const remember=new FormData(form).get('remember')==='on';
      if(remember&&protectedStored&&!confirm('Replace the unreadable browser save with this workspace?'))return;
      if(remember)protectedStored=false;
      commit([{type:'renameProduct',title:value('productName')},{type:'setClock',date:value('clock')}],'Workspace settings updated.');
      ui.remember=remember;
      if(!remember&&!protectedStored){try{localStorage.removeItem(storageKey);}catch{ui.storageWarning='Local storage is unavailable; changes remain in this tab.';}}
      persist();render();break;
    }
    case 'import':ensure(pendingImport,'Choose the JSON file again.');state=pendingImport;pendingImport=null;ui.selectedId='';ui.selectedItems.clear();dirty=false;unsaved=true;reconcile();persist();render();notify('Workspace replaced after full validation.');break;
    case 'confirm':{
      ensure(pendingConfirm,'The confirmation expired.');
      if(typeof pendingConfirm==='string'){state=pendingConfirm==='demo'?demoWorkspace():emptyWorkspace();ui.selectedId='';ui.selectedItems.clear();dirty=false;unsaved=true;persist();render();notify('Workspace replaced.');}
      else commit(pendingConfirm,'Change applied.');pendingConfirm=null;break;
    }
    default:closeDialog();return;
  }
  dirty=false;closeDialog();
}
function handleSubmit(event: SubmitEvent,form: HTMLFormElement): void {
  event.preventDefault();
  if(form.id==='dialog-form'){handleDialog(form);return;}
  if(form.id==='quick-add-form'){
    commit({type:'saveItem',id:null,draft:{title:data(form,'title'),description:'',type:'Item',priority:'medium',estimate:null,ownerId:null,backlogId:ui.backlogFilter==='all'?state.backlogs[0].id:ui.backlogFilter}},'Idea captured.');document.getElementById('quick-title')?.focus();return;
  }
  if(form.id==='work-form'){
    const itemId=form.dataset.itemId??'';const daily=form.dataset.daily==='true';
    commit({type:'updateWork',iterationId:ui.selectedId,itemId,status:choice<Status>(data(form,'status'),['ready','doing','blocked','done']),
      note:data(form,'note'),nextAction:data(form,'nextAction'),blocker:data(form,'blocker'),doneCheck:data(form,'doneCheck')==='on',releaseNote:data(form,'releaseNote'),ownerId:data(form,'ownerId')||null,daily},daily?'Daily note saved. Move to the next item.':'Progress saved; the live increment is up to date.');
    if(daily){const iteration=getIteration(state,ui.selectedId);const day=iteration.daily.find(value=>value.date===state.clock);ui.dailyItemId=iteration.work.find(work=>!day?.notes.some(note=>note.itemId===work.itemId))?.itemId??itemId;render();}
    else closeDialog();return;
  }
  if(form.id==='review-form'){
    const draft={summary:data(form,'summary'),reviewNotes:data(form,'reviewNotes'),goalOutcome:choice<Outcome>(data(form,'goalOutcome'),['not-assessed','met','partly-met','not-met'])};
    if(event.submitter instanceof HTMLButtonElement&&event.submitter.value==='close'){pendingReview=draft;show('close-review');}
    else commit({type:'saveReview',iterationId:ui.selectedId,...draft},'Review draft saved. The increment is still live.');
  }
}
function listen(): void {
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target.closest('[data-action]'):null;if(target instanceof HTMLElement){try{handleAction(target.dataset.action??'',target.dataset.id??'');}catch(cause){error(cause);}}});
  document.addEventListener('submit',event=>{if(event.target instanceof HTMLFormElement){try{handleSubmit(event,event.target);}catch(cause){error(cause,event.target);}}});
  document.addEventListener('input',event=>{
    const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement))return;
    if(input.id==='backlog-search'){ui.search=input.value;ui.page=0;render();return;}
    if(input.closest('form'))dirty=true;
  });
  document.addEventListener('change',event=>{
    const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement))return;
    if(input.id==='iteration-select'){if(dirty&&!confirm('Discard unsaved changes?')){input.value=ui.selectedId;return;}ui.selectedId=input.value;ui.dailyItemId='';dirty=false;render();}
    else if(input.id==='backlog-filter'){ui.backlogFilter=input.value;ui.page=0;render();}
    else if(input.id==='status-filter'){ui.statusFilter=input.value;ui.page=0;render();}
    else if(input.id==='show-archived'&&input instanceof HTMLInputElement){ui.showArchived=input.checked;ui.page=0;render();}
    else if(input.dataset.selectItem&&input instanceof HTMLInputElement){if(input.checked)ui.selectedItems.add(input.dataset.selectItem);else ui.selectedItems.delete(input.dataset.selectItem);render();}
    else if(input.closest('form')){
      dirty=true;
      if(input.name==='status')for(const section of input.closest('form')?.querySelectorAll('[data-status-section]')??[]){if(section instanceof HTMLElement)section.hidden=section.dataset.statusSection!==input.value;}
    }
  });
  modal.addEventListener('cancel',event=>{if(dirty&&!confirm('Discard unsaved form changes?'))event.preventDefault();else dirty=false;});
  modal.addEventListener('close',()=>{modal.innerHTML='';modalKind='';modalId='';pendingImport=null;pendingReview=null;pendingConfirm=null;pendingItems=[];if(previousFocus instanceof HTMLElement&&previousFocus.isConnected)previousFocus.focus();else document.getElementById('page-title')?.focus({preventScroll:true});});
  const importInput=document.getElementById('workspace-import');
  if(importInput instanceof HTMLInputElement)importInput.addEventListener('change',async()=>{
    const file=importInput.files?.[0];if(!file)return;
    try{ensure(file.size<=2*1024*1024,'The workspace file must be 2 MB or smaller.');const candidate=validateWorkspace(JSON.parse(await file.text()));pendingImport=candidate;show('import','',`${candidate.backlogs.length} backlogs · ${candidate.items.length} items · ${candidate.iterations.length} iterations · ${candidate.resources.length} people`);}
    catch(cause){error(cause);}finally{importInput.value='';}
  });
  window.addEventListener('beforeunload',event=>{if(dirty||(unsaved&&!ui.remember)){event.preventDefault();event.returnValue='';}});
}
listen();render();requestAnimationFrame(()=>{document.documentElement.dataset.prototypeReady='true';});
