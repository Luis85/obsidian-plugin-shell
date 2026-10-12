import {ref,computed,watch,onMounted,onBeforeUnmount} from 'vue';
import {normalizePlan,computePlan,computeAllocation,makeBuckets,addDays,parseDate,formatDate,ROLE_COLORS} from './domain.mjs';
import {parseImport,serializePlan,serializeWorkspace,serializeRoleCsv,serializeDailyCsv,serializePeriodCsv,createMarkdownExport,normalizeVaultFolder,safeFilename,MAX_IMPORT_BYTES} from './io.mjs';
import {createDemoPlan} from './demo.mjs';
import {APPS,clone,id,reference,sourceKey,ownSource,ownEntities,parsePackage,emptyRegistry,makePackage,packageSummary,mergePackage,linkRecords,linkHealth,safeData} from './family-protocol.mjs';

const STORAGE='resource-atlas.workspace.v1';
const PREFS='opf.preferences.v1.resource-atlas';
const ROLE_LABELS={violet:'Violett',blue:'Blau',cyan:'Türkis',green:'Grün',amber:'Ocker',rose:'Rosé'};
const DAY_NAMES=['','Mo','Di','Mi','Do','Fr','Sa','So'];
const DE=new Intl.NumberFormat('de-DE',{minimumFractionDigits:1,maximumFractionDigits:2});
const compactNumber=new Intl.NumberFormat('de-DE',{maximumFractionDigits:2});
export const number=v=>DE.format(Number(v)||0);
export const compact=v=>compactNumber.format(Number(v)||0);
export function dateLabel(value,year=true){if(!value)return '–';try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',...(year?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(parseDate(value)*86400000));}catch{return value;}}
function numeric(value){if(typeof value==='number')return value;const s=String(value??'').trim();return s?Number(s.replace(',','.')):NaN;}
function copyName(value,suffix,limit){return value.slice(0,limit-suffix.length).trimEnd()+suffix;}
function emptyPlan(name='Neuer Einsatzplan'){
  const now=new Date();const today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  return {id:id('plan'),name,start:today,end:addDays(today,90),budgetPt:null,calendar:{workdays:[1,2,3,4,5],hoursPerDay:8,holidays:[]},roles:[],allocations:[],blocks:[],notes:''};
}
function initialState(){const p=createDemoPlan();return {plans:[p],activePlanId:p.id,registries:{}};}
function validateRegistry(value,p){
  safeData(value);
  if(value?.schemaVersion!==1||!['records','links','sources'].every(k=>Array.isArray(value[k])))throw new Error('Der Verknüpfungsindex ist ungültig.');
  const source={appId:'resource-atlas',workspaceId:p.id,workspaceTitle:p.name};
  parsePackage({format:'obsidian-product-family',schemaVersion:1,packageId:'storage-validation',exportedAt:'2026-01-01T00:00:00.000Z',source,entities:value.records,links:value.links,natives:[{source,data:JSON.parse(serializePlan(p))},...value.sources]});
  if(value.records.some(e=>sourceKey(e.source)===sourceKey(source)))throw new Error('Eigene Datensätze gehören nicht in den externen Index.');
  return value;
}
function validateState(value){
  const native=parseImport(serializeWorkspace(value.plans,value.activePlanId));
  const registries={};
  for(const p of native.plans)if(value.registries&&Object.hasOwn(value.registries,p.id))registries[p.id]=validateRegistry(value.registries[p.id],p);
  return {plans:native.plans,activePlanId:native.activePlanId,registries};
}

export function usePlanner(){
  let lastRaw='',noticeTimer;
  const storageError=ref(''),storageLocked=ref(false),recoveryRaw=ref(''),otherTab=ref(false),memoryOnly=ref(false);
  const state=ref((()=>{
    try{
      const raw=localStorage.getItem(STORAGE);lastRaw=raw||'';if(!raw)return initialState();
      const saved=JSON.parse(raw);
      if(saved.format!=='resource-atlas-local'||saved.schemaVersion!==1)throw new Error('Unbekanntes Speicherformat.');
      return validateState(saved.state);
    }catch(error){storageError.value='Der gespeicherte Arbeitsstand konnte nicht geöffnet werden. Sichere die Originaldaten, bevor du einen neuen Stand beginnst.';storageLocked.value=true;recoveryRaw.value=lastRaw;return initialState();}
  })());
  const prefs=(()=>{try{const value=JSON.parse(localStorage.getItem(PREFS)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {}}})();
  const theme=ref(['light','dark'].includes(prefs.theme)?prefs.theme:'dark');
  const collapsed=ref(prefs.collapsed===true),mobileNav=ref(false),folder=ref(typeof prefs.folder==='string'?prefs.folder:'Product/Resources'),folderInput=ref(folder.value);
  const view=ref('timeline'),granularity=ref('week'),fit=ref(true),tool=ref('select'),analysisMode=ref('week'),roleQuery=ref('');
  const draft=ref(null),draftBase=ref(''),formError=ref(''),selectedId=ref(null);
  const notice=ref(''),noticeError=ref(false),history=ref([]),future=ref([]);
  const confirmOpen=ref(false),confirmation=ref({title:'',description:'',label:'Weiter',danger:false}),pendingAction=ref(null);
  const searchOpen=ref(false),searchText=ref(''),familyOpen=ref(false);
  const importOpen=ref(false),importText=ref(''),importError=ref(''),staged=ref(null),importMode=ref('merge'),overwrite=ref(false),updateSnapshots=ref(false),fileInput=ref(null);
  const exportOpen=ref(false),exportType=ref('plan'),exportError=ref('');
  const selectedReference=ref(''),referenceQuery=ref(''),linkTarget=ref('plan'),linkRelation=ref('relates-to');
  const plan=computed(()=>state.value.plans.find(p=>p.id===state.value.activePlanId)||state.value.plans[0]);
  const calculation=computed(()=>computePlan(plan.value));
  const totals=computed(()=>calculation.value.totals);
  const periods=computed(()=>makeBuckets(calculation.value,analysisMode.value));
  const filteredRoles=computed(()=>calculation.value.roles.filter(r=>r.name.toLowerCase().includes(roleQuery.value.toLowerCase())));
  const dirty=computed(()=>draft.value&&JSON.stringify(draft.value.data)!==draftBase.value);
  const registry=computed(()=>Object.hasOwn(state.value.registries,plan.value.id)?state.value.registries[plan.value.id]:emptyRegistry());
  const planOptions=computed(()=>state.value.plans.map(p=>({label:p.name,value:p.id})));
  const workdayLabel=computed(()=>plan.value.calendar.workdays.map(d=>DAY_NAMES[d]).join(' · '));
  const selectedRole=computed(()=>draft.value?.kind==='role'?plan.value.roles.find(r=>r.id===draft.value.id):draft.value?.kind==='allocation'?plan.value.roles.find(r=>r.id===draft.value.data.roleId):null);
  const roleStats=computed(()=>selectedRole.value?calculation.value.roles.find(r=>r.id===selectedRole.value.id):null);
  const maxPeriod=computed(()=>Math.max(1,...periods.value.map(p=>p.netPt)));
  watch(()=>plan.value.id,()=>{linkTarget.value='plan';selectedReference.value='';});

  function notify(message,error=false){notice.value=message;noticeError.value=error;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.value='',error?10000:4500);}
  function persist(){
    try{const raw=JSON.stringify({format:'resource-atlas-local',schemaVersion:1,state:state.value});localStorage.setItem(STORAGE,raw);lastRaw=raw;memoryOnly.value=false;storageError.value='';return true;}
    catch{memoryOnly.value=true;storageError.value='Änderungen sind nur in diesem Tab gespeichert. Exportiere alle Pläne, bevor du ihn schließt.';return false;}
  }
  function remember(){
    history.value.push(clone(state.value));future.value=[];
    while(history.value.length>40||history.value.length>1&&JSON.stringify(history.value).length>12000000)history.value.shift();
  }
  function commit(recipe,message,{rememberChange=true}={}){
    if(storageLocked.value){notify(storageError.value,true);throw new Error(storageError.value);}
    const next=clone(state.value);recipe(next);
    const valid=validateState(next);
    if(JSON.stringify(valid)===JSON.stringify(state.value))return false;
    if(rememberChange)remember();state.value=valid;persist();
    if(message)notify(storageError.value||message,!!storageError.value);
    return true;
  }
  function editPlan(next,pid=plan.value.id){const at=next.plans.findIndex(p=>p.id===pid);if(at<0)throw new Error('Der Plan ist nicht mehr vorhanden.');return next.plans[at];}
  function ask(title,description,label,fn,danger=false){confirmation.value={title,description,label,danger};pendingAction.value=fn;confirmOpen.value=true;}
  function confirm(){const fn=pendingAction.value;confirmOpen.value=false;pendingAction.value=null;try{fn?.();}catch(error){notify(error.message,true);}}
  function guard(fn){if(dirty.value)ask('Ungespeicherte Eingaben verwerfen?','Deine Änderungen im Inspector sind noch nicht übernommen. Du kannst weiterbearbeiten oder sie verwerfen.','Verwerfen',()=>{draft.value=null;fn();});else try{fn();}catch(error){notify(error.message,true);}}
  function closeInspector(){guard(()=>{draft.value=null;selectedId.value=null;formError.value='';});}
  function setView(value){guard(()=>{view.value=value;draft.value=null;selectedId.value=null;mobileNav.value=false;tool.value='select';});}
  function switchPlan(value){if(value===plan.value.id)return;guard(()=>{state.value.activePlanId=value;draft.value=null;selectedId.value=null;tool.value='select';if(!storageLocked.value)persist();});}
  function setDraft(kind,data,{isNew=false,recordId=data.id}={}){draft.value={kind,id:recordId,isNew,data:clone(data)};draftBase.value=JSON.stringify(draft.value.data);formError.value='';selectedId.value=recordId;}
  function openRole(roleId){
    guard(()=>{const role=plan.value.roles.find(r=>r.id===roleId);const data=role?{...role,applyFte:plan.value.allocations.filter(a=>a.roleId===role.id).every(a=>a.fte===role.fte)}:{id:id('role'),name:'',fte:1,color:ROLE_COLORS[plan.value.roles.length%ROLE_COLORS.length],notes:'',applyFte:true};setDraft('role',data,{isNew:!role});});
  }
  function openAllocation(allocationId,range={}){
    guard(()=>{
      if(!plan.value.roles.length){openRole();notify('Lege zuerst eine Rolle an. Danach kannst du ihren Einsatz einzeichnen.');return;}
      const a=plan.value.allocations.find(a=>a.id===allocationId);
      const role=plan.value.roles.find(r=>r.id===range.roleId)||selectedRole.value||plan.value.roles[0];
      const start=range.start||plan.value.start;
      const end=range.end||formatDate(Math.min(parseDate(start)+6,parseDate(plan.value.end)));
      setDraft('allocation',a||{id:id('allocation'),roleId:role.id,name:'',start,end,fte:role.fte,notes:''},{isNew:!a});
    });
  }
  function openBlock(blockId,range={}){
    guard(()=>{const b=plan.value.blocks.find(b=>b.id===blockId);const start=range.start||plan.value.start;setDraft('block',b?{...b,roleId:b.roleId||'__all__',percent:b.fraction*100}:{id:id('block'),roleId:range.roleId||'__all__',name:'',start,end:range.end||formatDate(Math.min(parseDate(start)+6,parseDate(plan.value.end))),percent:100},{isNew:!b});});
  }
  function openPlan(isNew=false){guard(()=>{const p=isNew?emptyPlan():plan.value;setDraft('plan',{id:p.id,name:p.name,start:p.start,end:p.end,budgetPt:p.budgetPt??'',notes:p.notes},{isNew});});}
  function openCalendar(){guard(()=>setDraft('calendar',{workdays:plan.value.calendar.workdays,hoursPerDay:plan.value.calendar.hoursPerDay},{recordId:'calendar'}));}
  function openHoliday(holidayId){guard(()=>{const h=plan.value.calendar.holidays.find(h=>h.id===holidayId);setDraft('holiday',h||{id:id('holiday'),date:plan.value.start,name:''},{isNew:!h});});}
  function changeDraft(field,value){
    if(!draft.value)return;
    if(draft.value.kind==='allocation'&&field==='roleId'){
      const prior=plan.value.roles.find(r=>r.id===draft.value.data.roleId),next=plan.value.roles.find(r=>r.id===value);
      if(next&&numeric(draft.value.data.fte)===prior?.fte)draft.value.data.fte=next.fte;
    }
    draft.value.data[field]=value;formError.value='';
  }
  function candidatePlan(){
    if(!draft.value)return plan.value;
    const d=draft.value,p=clone(plan.value),v=clone(d.data);
    const upsert=(rows,value)=>{const at=rows.findIndex(r=>r.id===d.id);at>=0?rows.splice(at,1,value):rows.push(value);};
    if(d.kind==='role'){
      const role={id:d.id,name:v.name,fte:numeric(v.fte),color:v.color,notes:v.notes||''};upsert(p.roles,role);
      if(v.applyFte)for(const a of p.allocations)if(a.roleId===d.id)a.fte=role.fte;
    }
    if(d.kind==='allocation')upsert(p.allocations,{id:d.id,roleId:v.roleId,name:v.name||'',start:v.start,end:v.end,fte:numeric(v.fte),notes:v.notes||''});
    if(d.kind==='block')upsert(p.blocks,{id:d.id,roleId:v.roleId==='__all__'?null:v.roleId,name:v.name,start:v.start,end:v.end,fraction:numeric(v.percent)/100});
    if(d.kind==='holiday')upsert(p.calendar.holidays,{id:d.id,date:v.date,name:v.name});
    if(d.kind==='calendar'){p.calendar.workdays=[...v.workdays];p.calendar.hoursPerDay=numeric(v.hoursPerDay);}
    if(d.kind==='plan'){
      const target=d.isNew?emptyPlan(v.name):p;
      Object.assign(target,{id:d.id,name:v.name,start:v.start,end:v.end,budgetPt:String(v.budgetPt).trim()===''?null:numeric(v.budgetPt),notes:v.notes||''});
      return normalizePlan(target);
    }
    return normalizePlan(p);
  }
  const draftPreview=computed(()=>{
    if(!draft.value)return null;
    try{
      const next=candidatePlan(),c=computePlan(next),d=draft.value;
      if(d.kind==='allocation'){
        const a=c.allocations.find(a=>a.id===d.id);
        return {title:'Aufwand dieses Einsatzes',items:[{label:'Arbeitstage im Plan',value:compact(a.workingDays)},{label:'Vor Sperrzeiten',value:number(a.grossPt)+' PT'},{label:'Durch Sperrzeiten entfällt',value:number(a.blockedPt)+' PT'},{label:'Geplant',value:number(a.netPt)+' PT'}],note:a.clipped?'Nur der Anteil innerhalb des Planzeitraums wird berechnet.':'Start- und Endtag sind eingeschlossen. Wochenenden und eingetragene Feiertage folgen deinem Kalender.'};
      }
      if(d.kind==='role'){
        const r=c.roles.find(r=>r.id===d.id);return {title:'Rolle im gesamten Plan',items:[{label:'Geplanter Aufwand',value:number(r.netPt)+' PT'},{label:'Verfügbare Kapazität',value:number(r.capacityPt)+' PT'},{label:'Einsatzzeiträume',value:String(r.activeAllocationCount)}],note:'Ohne Einsatzzeiträume entstehen keine geplanten Personentage.'};
      }
      return {title:'Auswirkung auf den Plan',items:[{label:'Geplanter Aufwand',value:number(c.totals.netPt)+' PT'},{label:'Änderung zum gespeicherten Stand',value:(c.totals.netPt>=totals.value.netPt?'+':'')+number(c.totals.netPt-totals.value.netPt)+' PT'}],note:d.kind==='block'?'Sperrzeiten reduzieren den Aufwand im vorhandenen Zeitraum. Einsätze werden nicht automatisch verschoben.':d.kind==='plan'?'Außerhalb liegende Einsatzanteile bleiben gespeichert, zählen jedoch nicht zum Plan.':null};
    }catch{return null;}
  });
  function saveDraft(){
    try{
      const d=draft.value,nextPlan=candidatePlan();if(!d)return;
      commit(next=>{const at=next.plans.findIndex(p=>p.id===nextPlan.id);at>=0?next.plans.splice(at,1,nextPlan):next.plans.push(nextPlan);next.activePlanId=nextPlan.id;},d.isNew?'Eintrag angelegt.':'Änderungen übernommen.');
      draft.value=null;selectedId.value=null;formError.value='';
    }catch(error){formError.value=error.message;}
  }
  function deleteDraft(){
    if(!draft.value||draft.value.isNew)return;
    const d=clone(draft.value),p=plan.value;
    let description='Der Eintrag wird entfernt. Du kannst die Änderung rückgängig machen.';
    if(d.kind==='role')description='Diese Rolle wird mit ihren '+p.allocations.filter(a=>a.roleId===d.id).length+' Einsätzen und ihren rollenspezifischen Sperrzeiten entfernt. Verknüpfungen bleiben für die Prüfung erhalten.';
    if(d.kind==='plan')description='Der Plan und seine lokalen Verknüpfungen werden entfernt. Andere Pläne bleiben erhalten. Rückgängig stellt ihn wieder her.';
    ask(d.kind==='plan'?'Plan löschen?':d.kind==='role'?'Rolle löschen?':'Eintrag löschen?',description,'Löschen',()=>{
      commit(next=>{
        const target=editPlan(next);
        if(d.kind==='plan'){next.plans=next.plans.filter(p=>p.id!==d.id);delete next.registries[d.id];if(!next.plans.length)next.plans=[emptyPlan()];next.activePlanId=next.plans[0].id;}
        if(d.kind==='role'){target.roles=target.roles.filter(r=>r.id!==d.id);target.allocations=target.allocations.filter(a=>a.roleId!==d.id);target.blocks=target.blocks.filter(b=>b.roleId!==d.id);}
        if(d.kind==='allocation')target.allocations=target.allocations.filter(a=>a.id!==d.id);
        if(d.kind==='block')target.blocks=target.blocks.filter(b=>b.id!==d.id);
        if(d.kind==='holiday')target.calendar.holidays=target.calendar.holidays.filter(h=>h.id!==d.id);
      },'Eintrag gelöscht. Rückgängig ist verfügbar.');draft.value=null;selectedId.value=null;
    },true);
  }
  function duplicateDraft(){
    if(dirty.value){notify('Übernimm oder verwirf zuerst deine Eingaben.',true);return;}
    const d=draft.value;if(d?.kind==='allocation'){const copy={...clone(d.data),id:id('allocation'),name:copyName(d.data.name||'Einsatz',' · Kopie',160)};setDraft('allocation',copy,{isNew:true});}
  }
  function duplicatePlan(){
    guard(()=>{const p=clone(plan.value);p.id=id('plan');p.name=copyName(p.name,' · Kopie',200);commit(next=>{next.plans.push(p);next.activePlanId=p.id;},'Plan dupliziert. Seine Einsatzdaten sind unabhängig.');draft.value=null;});
  }
  function moveAllocation(change){
    if(dirty.value){notify('Übernimm oder verwirf zuerst deine Eingaben im Inspector.',true);return;}
    try{commit(next=>{const a=editPlan(next).allocations.find(a=>a.id===change.id);if(!a)throw new Error('Der Einsatz ist nicht mehr vorhanden.');a.start=change.start;a.end=change.end;},'Einsatzzeitraum aktualisiert.');if(draft.value?.id===change.id)openAllocation(change.id);}
    catch(error){notify(error.message,true);}
  }
  function moveDraft(delta){const a=draft.value?.data;if(draft.value?.kind==='allocation')moveAllocation({id:draft.value.id,start:addDays(a.start,delta),end:addDays(a.end,delta)});}
  function undo(){guard(()=>{if(!history.value.length||storageLocked.value)return;future.value.push(clone(state.value));state.value=history.value.pop();draft.value=null;selectedId.value=null;persist();notify('Änderung rückgängig gemacht.');});}
  function redo(){guard(()=>{if(!future.value.length||storageLocked.value)return;history.value.push(clone(state.value));state.value=future.value.pop();draft.value=null;selectedId.value=null;persist();notify('Änderung wiederhergestellt.');});}
  function download(filename,text,mime='application/json'){
    const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    window.__resourceLastDownload={filename,text,mime};
  }
  function recover(){
    if(otherTab.value){ask('Neueren Arbeitsstand laden?','Der von einem anderen Tab gespeicherte Stand ersetzt die Anzeige in diesem Tab. Exportiere diesen Stand vorher, wenn du ihn behalten möchtest.','Neu laden',()=>location.reload());return;}
    ask('Neuen Arbeitsstand beginnen?','Die unlesbaren Browserdaten werden durch den angezeigten Beispielstand ersetzt. Lade vorher die Originaldaten herunter, wenn du sie behalten möchtest.','Neu beginnen',()=>{if(persist()){storageLocked.value=false;recoveryRaw.value='';history.value=[];future.value=[];notify('Ein neuer Arbeitsstand ist bereit.');}else notify('Der neue Stand konnte nicht gespeichert werden. Die Originaldaten bleiben für die Sicherung verfügbar.',true);},true);
  }
  function persistPrefs(){try{localStorage.setItem(PREFS,JSON.stringify({theme:theme.value,collapsed:collapsed.value,folder:folder.value}));}catch{notify('Darstellung gilt nur für diesen Tab; Browser-Speicher ist nicht verfügbar.',true);}}
  function applyTheme(){document.documentElement.classList.toggle('dark',theme.value==='dark');document.documentElement.dataset.theme=theme.value;document.documentElement.style.colorScheme=theme.value;}
  watch(theme,()=>{applyTheme();persistPrefs();});
  watch(collapsed,persistPrefs);
  function toggleTheme(){theme.value=theme.value==='dark'?'light':'dark';}
  function saveFolder(){try{folder.value=normalizeVaultFolder(folderInput.value);folderInput.value=folder.value;persistPrefs();notify('Exportordner gespeichert.');}catch(error){notify(error.message,true);}}

  function snapshot(){
    const p=plan.value,c=calculation.value,roleMap=new Map(p.roles.map(r=>[r.id,r]));
    const entities=[{id:p.id,kind:'resource.plan',title:p.name,summary:dateLabel(p.start)+' – '+dateLabel(p.end)+' · '+number(c.totals.netPt)+' PT',data:{start:p.start,end:p.end,budgetPt:p.budgetPt,plannedPt:c.totals.netPt,hoursPerDay:p.calendar.hoursPerDay}}];
    for(const r of p.roles){const stats=c.roles.find(s=>s.id===r.id);entities.push({id:r.id,kind:'resource.role',title:r.name,summary:compact(r.fte)+' FTE · '+number(stats.netPt)+' PT',data:{...clone(r),plannedPt:stats.netPt,capacityPt:stats.capacityPt}});}
    for(const a of p.allocations){const stats=c.allocations.find(s=>s.id===a.id);entities.push({id:a.id,kind:'resource.allocation',title:roleMap.get(a.roleId).name+' · '+(a.name||'Einsatz'),summary:dateLabel(a.start)+' – '+dateLabel(a.end)+' · '+number(stats.netPt)+' PT',data:clone(a)});}
    for(const b of p.blocks)entities.push({id:b.id,kind:'resource.block',title:b.name.trim()||'Sperrzeit',summary:(b.roleId?roleMap.get(b.roleId).name:'Alle Rollen')+' · '+compact(b.fraction*100)+' % gesperrt',data:clone(b)});
    return {appId:'resource-atlas',workspace:{id:p.id,title:p.name},title:p.name,view:view.value,entities,selection:{kind:'resource.plan',id:p.id},save:{state:storageError.value?'warning':dirty.value?'dirty':'saved',draft:!!dirty.value}};
  }
  const own=computed(()=>ownEntities(snapshot()));
  const allReferences=computed(()=>[...own.value,...registry.value.records]);
  const entityMap=computed(()=>new Map(allReferences.value.map(e=>[e.ref,e])));
  const externalRecords=computed(()=>registry.value.records.filter(e=>[e.title,e.kind,e.summary,e.source.workspaceTitle].join(' ').toLowerCase().includes(referenceQuery.value.toLowerCase())));
  const selectedEntity=computed(()=>registry.value.records.find(e=>e.ref===selectedReference.value)||externalRecords.value[0]||null);
  const currentLinks=computed(()=>registry.value.links.filter(l=>l.from===selectedEntity.value?.ref||l.to===selectedEntity.value?.ref));
  const localLinkOptions=computed(()=>own.value.map(e=>({value:e.ref,label:e.title+' · '+e.kind.replace('resource.','')})));
  const linkAttention=computed(()=>registry.value.links.filter(l=>linkHealth(l,allReferences.value)!=='resolved').length);
  function requireSaved(){if(dirty.value)throw new Error('Übernimm oder verwirf zuerst die Eingaben im Inspector.');}
  function familyPackage(){requireSaved();return makePackage(snapshot(),registry.value,JSON.parse(serializePlan(plan.value)));}
  function importFamily(input,options={}){
    const pack=parsePackage(input),source=ownSource(snapshot()),nextRegistry=mergePackage(pack,registry.value,source,options);
    commit(next=>{next.registries[plan.value.id]=nextRegistry;},'Kontext importiert. Die Quelldaten bleiben unter eigener Verantwortung.');
    selectedReference.value=nextRegistry.records.find(e=>sourceKey(e.source)===sourceKey(pack.source))?.ref||nextRegistry.records[0]?.ref||'';
    return clone(nextRegistry);
  }
  function addLink(){
    try{const from=linkTarget.value==='plan'?own.value[0].ref:linkTarget.value;if(!selectedEntity.value)throw new Error('Wähle zuerst einen importierten Datensatz.');
      if(!own.value.some(entity=>entity.ref===from))throw new Error('Wähle eine Rolle oder einen Einsatz aus dem aktuellen Plan.');
      const nextRegistry=linkRecords(registry.value,from,selectedEntity.value.ref,linkRelation.value);
      commit(next=>{next.registries[plan.value.id]=nextRegistry;},'Verknüpfung angelegt.');
    }catch(error){notify(error.message,true);}
  }
  function removeLink(link){
    try{commit(next=>{const r=clone(registry.value);r.links=r.links.filter(l=>l.id!==link.id);next.registries[plan.value.id]=r;},'Verknüpfung entfernt. Rückgängig ist verfügbar.');}catch(error){notify(error.message,true);}
  }
  function endpoint(link){const ref=link.from===selectedEntity.value?.ref?link.to:link.from;return entityMap.value.get(ref)?.title||'Nicht aufgelöster Datensatz';}
  function sourceName(appId){return APPS[appId]?.name||appId;}
  function nativeImport(input,{asCopy=false,replaceExisting=false}={}){
    requireSaved();
    const parsed=typeof input==='string'?parseImport(input):input;
    const incoming=parsed.plans.map(p=>{const copy=clone(p);if(asCopy){copy.id=id('plan');copy.name=copyName(copy.name,' · Importkopie',200);}return copy;});
    const conflicts=incoming.filter(p=>state.value.plans.some(old=>old.id===p.id));
    if(conflicts.length&&!replaceExisting)throw new Error('Bestätige das Ersetzen vorhandener Pläne oder importiere unabhängige Kopien.');
    commit(next=>{for(const p of incoming){const at=next.plans.findIndex(old=>old.id===p.id);at>=0?next.plans.splice(at,1,p):next.plans.push(p);}next.activePlanId=asCopy?incoming[0].id:incoming.find(p=>p.id===parsed.activePlanId)?.id||incoming[0].id;},incoming.length+' Plan'+(incoming.length===1?'':'e')+' importiert.');
    draft.value=null;return clone(plan.value);
  }
  function showImport(){guard(()=>{draft.value=null;staged.value=null;importError.value='';importText.value='';overwrite.value=false;updateSnapshots.value=false;importMode.value='merge';importOpen.value=true;});}
  function stageImport(text){
    staged.value=null;importError.value='';overwrite.value=false;importMode.value='merge';
    try{
      if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error('Wähle eine Datei unter 32 MB.');
      let json;try{json=JSON.parse(text);}catch{}
      if(json?.format==='obsidian-product-family')staged.value={kind:'family',package:parsePackage(json)};
      else staged.value={...parseImport(text)};
    }catch(error){importError.value=error.message;}
  }
  function pasteImport(event){const text=event.clipboardData?.getData('text/plain');if(text&&text.length>50*1024){event.preventDefault();importText.value='';stageImport(text);}}
  async function chooseFile(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;staged.value=null;importText.value='';importError.value='';
    if(file.size>MAX_IMPORT_BYTES){importError.value='Wähle eine Datei unter 32 MB.';return;}
    try{stageImport(await file.text());}catch{importError.value='Die Datei konnte nicht gelesen werden. Wähle eine lokale JSON- oder Markdown-Datei.';}
  }
  const importConflicts=computed(()=>staged.value?.plans?.filter(p=>state.value.plans.some(old=>old.id===p.id))||[]);
  const importFamilySummary=computed(()=>staged.value?.kind==='family'?packageSummary(staged.value.package,registry.value,ownSource(snapshot())):null);
  const familyRestorable=computed(()=>staged.value?.kind==='family'&&staged.value.package.source.appId==='resource-atlas');
  function applyImport(){
    try{
      if(!staged.value)return;
      if(staged.value.kind==='family'){
        if(importMode.value==='restore'){
          const pack=staged.value.package,native=pack.natives.find(n=>sourceKey(n.source)===sourceKey(pack.source));
          if(!native||pack.source.appId!=='resource-atlas')throw new Error('Kein passendes Resource-Atlas-Backup enthalten.');
          const parsed=parseImport(JSON.stringify(native.data));
          if(parsed.plans.length!==1||parsed.plans[0].id!==pack.source.workspaceId)throw new Error('Die Identität des nativen Plans stimmt nicht mit dem Paket überein. Es wurde nichts geändert.');
          if(state.value.plans.some(p=>p.id===pack.source.workspaceId)&&!overwrite.value)throw new Error('Bestätige zuerst das Ersetzen des vorhandenen Plans.');
          const source={appId:'resource-atlas',workspaceId:parsed.plans[0].id,workspaceTitle:parsed.plans[0].name};
          const targetRegistry=Object.hasOwn(state.value.registries,source.workspaceId)?state.value.registries[source.workspaceId]:emptyRegistry();
          const nextRegistry=mergePackage(pack,targetRegistry,source,{updateExisting:updateSnapshots.value});
          commit(next=>{const p=parsed.plans[0],at=next.plans.findIndex(old=>old.id===p.id);at>=0?next.plans.splice(at,1,p):next.plans.push(p);next.registries[p.id]=nextRegistry;next.activePlanId=p.id;},'Plan und Verknüpfungen wiederhergestellt.');
          view.value='timeline';
        }else{importFamily(staged.value.package,{updateExisting:updateSnapshots.value});view.value='connections';}
      }else{nativeImport(staged.value,{asCopy:importMode.value==='copy',replaceExisting:overwrite.value});view.value='timeline';}
      importOpen.value=false;draft.value=null;
    }catch(error){importError.value=error.message;}
  }
  function showExport(type='plan'){guard(()=>{draft.value=null;exportType.value=type;exportError.value='';exportOpen.value=true;});}
  const exportFormats=[
    {value:'plan',label:'Aktueller Plan · JSON'},{value:'workspace',label:'Alle Pläne · JSON'},{value:'markdown',label:'Obsidian-Notiz · Markdown'},
    {value:'roles',label:'Rollenübersicht · CSV'},{value:'weeks',label:'Wochenaufwand · CSV'},{value:'days',label:'Taggenaue Berechnung · CSV'},{value:'family',label:'Product Family · JSON'}
  ];
  const exportData=computed(()=>{
    try{
      const p=plan.value,name=safeFilename(p.name),c=calculation.value;
      if(exportType.value==='plan')return {filename:name+'.json',text:serializePlan(p),mime:'application/json',hint:'Vollständiger Plan mit Kalender, Rollen, Einsätzen und Sperrzeiten.'};
      if(exportType.value==='workspace')return {filename:'resource-atlas-alle-plaene.json',text:serializeWorkspace(state.value.plans,state.value.activePlanId),mime:'application/json',hint:'Alle nativen Pläne. Externe Familienverknüpfungen exportierst du je Plan als Familienpaket.'};
      if(exportType.value==='markdown'){const file=createMarkdownExport(p,{folder:folder.value,calculation:c});return {filename:file.filename,text:file.content,mime:'text/markdown;charset=utf-8',hint:'Ziel im Vault: '+file.path+'. Enthält lesbare Tabellen, Frontmatter und vollständige Wiederherstellungsdaten.'};}
      if(exportType.value==='roles')return {filename:name+'-rollen.csv',text:serializeRoleCsv(p,c),mime:'text/csv;charset=utf-8',hint:'Rollen mit Bruttoaufwand, Sperrzeiten, geplanten PT und Kapazität. Semikolon und Dezimalkomma.'};
      if(exportType.value==='weeks')return {filename:name+'-wochen.csv',text:serializePeriodCsv(p,c,'week'),mime:'text/csv;charset=utf-8',hint:'Aufwand je Rolle und ISO-Kalenderwoche; Randwochen folgen den tatsächlichen Plandaten.'};
      if(exportType.value==='days')return {filename:name+'-tage.csv',text:serializeDailyCsv(p,c),mime:'text/csv;charset=utf-8',hint:'Eine Zeile je Rolle und Kalendertag. Geeignet zum Nachvollziehen der Berechnung.'};
      return {filename:name+'-family.json',text:JSON.stringify(familyPackage(),null,2),mime:'application/json',hint:'Eigene Ressourcenplanung, externe Snapshots, Verknüpfungen und nativer Plan. In allen vier bisherigen Prototypen lesbar.'};
    }catch(error){return {error:error.message};}
  });
  function downloadExport(){const data=exportData.value;if(data.error){exportError.value=data.error;return;}download(data.filename,data.text,data.mime);notify('Export heruntergeladen.');}
  async function copyExport(){try{if(exportData.value.error)throw new Error(exportData.value.error);await navigator.clipboard.writeText(exportData.value.text);notify('Export kopiert.');}catch(error){exportError.value='Kopieren ist hier nicht verfügbar. Nutze Datei herunterladen oder die Textvorschau.';}}
  const searchResults=computed(()=>{
    const q=searchText.value.trim().toLowerCase();
    return [{id:plan.value.id,kind:'plan',title:plan.value.name,subtitle:'Aktueller Plan'},...plan.value.roles.map(r=>({id:r.id,kind:'role',title:r.name,subtitle:compact(r.fte)+' FTE'})),...plan.value.allocations.map(a=>({id:a.id,kind:'allocation',title:a.name||'Einsatz',subtitle:(plan.value.roles.find(r=>r.id===a.roleId)?.name||'')+' · '+dateLabel(a.start,false)+'–'+dateLabel(a.end,false)})),...plan.value.blocks.map(b=>({id:b.id,kind:'block',title:b.name,subtitle:'Sperrzeit'}))].filter(r=>(r.title+' '+r.subtitle).toLowerCase().includes(q)).slice(0,60);
  });
  function reveal(result){searchOpen.value=false;view.value='timeline';if(result.kind==='role')openRole(result.id);if(result.kind==='allocation')openAllocation(result.id);if(result.kind==='block')openBlock(result.id);if(result.kind==='plan')openPlan();}
  function keyboard(event){
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();searchOpen.value=true;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&!typing){event.preventDefault();event.shiftKey?redo():undo();}
    if(event.key==='Escape'&&draft.value&&!confirmOpen.value&&!importOpen.value&&!exportOpen.value&&!searchOpen.value){event.preventDefault();closeInspector();}
  }
  function storageChanged(event){if(event.key===STORAGE&&event.newValue!==lastRaw){storageLocked.value=true;otherTab.value=true;storageError.value=memoryOnly.value?'Dieser Tab enthält ungesicherte Änderungen; ein anderer Tab hat ebenfalls gespeichert. Sichere diesen Stand vor dem Neuladen.':'Ein anderer Tab hat den Arbeitsstand geändert. Exportiere bei Bedarf diesen Stand und lade anschließend den neueren Stand.';recoveryRaw.value=memoryOnly.value?JSON.stringify({format:'resource-atlas-local',schemaVersion:1,state:state.value}):lastRaw;}}
  function beforeUnload(event){if(dirty.value||memoryOnly.value){event.preventDefault();event.returnValue='';}}
  onMounted(()=>{
    applyTheme();if(!lastRaw&&!storageLocked.value)persist();document.addEventListener('keydown',keyboard);window.addEventListener('storage',storageChanged);window.addEventListener('beforeunload',beforeUnload);
    window.ResourceAtlas={version:'1.0.0',getPlan:()=>clone(plan.value),getState:()=>clone(state.value),getCalculation:()=>clone(calculation.value),nativeExport:()=>JSON.parse(serializePlan(plan.value)),importNative:(text,options)=>nativeImport(text,options),replacePlan:p=>{requireSaved();const valid=normalizePlan(p);commit(next=>{const at=next.plans.findIndex(old=>old.id===valid.id);at>=0?next.plans.splice(at,1,valid):next.plans.push(valid);next.activePlanId=valid.id;});},storageKey:STORAGE};
    window.ProductFamily={version:'1.0.0',getSnapshot:()=>clone(snapshot()),getRegistry:()=>clone(registry.value),makePackage:async()=>familyPackage(),review:input=>packageSummary(parsePackage(input),registry.value,ownSource(snapshot())),importPackage:async(input,options)=>importFamily(input,options),get theme(){return theme.value;},setTheme:value=>{if(['dark','light'].includes(value))theme.value=value;},openScreen:setView,rpc:async(method,args)=>{
      if(method==='getSnapshot')return clone(snapshot());
      if(method==='exportNative')return JSON.parse(serializePlan(plan.value));
      if(method==='inspectNative'){const parsed=parseImport(JSON.stringify(args));if(parsed.plans.length!==1)throw new Error('Genau ein nativer Plan ist erforderlich.');return {workspace:{id:parsed.plans[0].id,title:parsed.plans[0].name}};}
      if(method==='restoreNative'){requireSaved();return nativeImport(JSON.stringify(args),{replaceExisting:true});}
      if(method==='canAdopt')return {allowed:false,label:'Als Kontext verknüpfen',hint:'Ressourcenplanung bleibt unabhängig von Story-Schätzungen und Komponenten.'};
      throw new Error('Diese Operation wird nicht unterstützt.');
    }};
  });
  onBeforeUnmount(()=>{clearTimeout(noticeTimer);document.removeEventListener('keydown',keyboard);window.removeEventListener('storage',storageChanged);window.removeEventListener('beforeunload',beforeUnload);});
  return {APPS,ROLE_COLORS,ROLE_LABELS,DAY_NAMES,state,plan,calculation,totals,periods,maxPeriod,theme,collapsed,mobileNav,folder,folderInput,view,granularity,fit,tool,analysisMode,roleQuery,filteredRoles,draft,dirty,formError,selectedId,draftPreview,selectedRole,roleStats,notice,noticeError,history,future,confirmOpen,confirmation,searchOpen,searchText,searchResults,familyOpen,storageError,storageLocked,recoveryRaw,otherTab,memoryOnly,planOptions,workdayLabel,
    importOpen,importText,importError,staged,importMode,overwrite,updateSnapshots,fileInput,importConflicts,importFamilySummary,familyRestorable,exportOpen,exportType,exportFormats,exportData,exportError,
    registry,allReferences,externalRecords,selectedReference,selectedEntity,referenceQuery,linkTarget,linkRelation,currentLinks,localLinkOptions,linkAttention,
    number,compact,dateLabel,notify,setView,switchPlan,openRole,openAllocation,openBlock,openPlan,openCalendar,openHoliday,changeDraft,saveDraft,closeInspector,deleteDraft,duplicateDraft,duplicatePlan,moveAllocation,moveDraft,undo,redo,confirm,recover,download,toggleTheme,saveFolder,showImport,stageImport,pasteImport,chooseFile,applyImport,showExport,downloadExport,copyExport,sourceName,addLink,removeLink,endpoint,reveal};
}
