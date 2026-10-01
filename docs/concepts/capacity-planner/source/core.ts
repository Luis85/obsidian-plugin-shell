export const VERSION = 2;
export const STORAGE_KEY = "capacity-planner.prototype.v2";

export function $(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Missing prototype element: ${selector}`);
  return element;
}
export const dialog = $("#dialog");
export const notice = $("#notice");
export const importInput = $("#workspace-import");
let noticeTimer = 0;
let storageStatus = "demo";

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]);
export const euro = new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR", maximumFractionDigits:0 });
export const num = new Intl.NumberFormat("de-DE", { maximumFractionDigits:1 });
export const pct = (value) => `${num.format(Number(value || 0) * 100)}%`;

export function parseDate(value) {
  const [y,m,d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y,m-1,d));
  return Number.isFinite(date.getTime()) ? date : null;
}
export function iso(date) { return date.toISOString().slice(0,10); }
export function addDays(date, days) { const next=new Date(date); next.setUTCDate(next.getUTCDate()+days); return next; }
export function inclusiveDays(start,end) { return Math.round((end-start)/86400000)+1; }
export function dateText(value) {
  const date=parseDate(value);
  return date ? new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date) : "—";
}
export function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
export function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function slug(value) { return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "item"; }
export function nowIso() { return new Date().toISOString(); }

export function generateIterations(startValue,dueValue,weeks=2) {
  const start=parseDate(startValue),due=parseDate(dueValue);
  if(!start||!due||due<start)return[];
  const chunk=Math.max(1,Number(weeks)||2)*7,result=[];
  let cursor=start,index=1;
  while(cursor<=due&&result.length<100){
    const rawEnd=addDays(cursor,chunk-1),end=rawEnd>due?due:rawEnd;
    result.push({id:`it-${iso(cursor)}`,index,name:`Iteration ${index}`,start:iso(cursor),end:iso(end)});
    cursor=addDays(end,1);index+=1;
  }
  return result;
}
export function nextPlanDates() {
  const now=new Date(),today=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  const start=addDays(today,(8-today.getUTCDay())%7);
  return {start:iso(start),due:iso(addDays(start,16*7-1))};
}

function makeLaborPlan(iterations, values) {
  const byIteration={};
  iterations.forEach((it,index)=>{byIteration[it.id]=Array.isArray(values)?Number(values[index]??0):Number(values||0);});
  return byIteration;
}
function baseProject() {
  const start="2026-10-05",due="2027-01-22",iterations=generateIterations(start,due,2);
  return {
    id:"project-demo",name:"Custom Order Platform",orderValue:420000,hoursPerDay:8,
    workingDays:[1,2,3,4,5],unitName:"SP",hoursPerUnit:6,timelineOwner:"shared-project",
    timeline:{start,due,iterationWeeks:2},iterations,
    holidays:[{id:"holiday-1",date:"2026-12-25",name:"Christmas Day"},{id:"holiday-2",date:"2027-01-01",name:"New Year"}],
    roles:[
      {id:"role-dm",name:"Delivery Manager",dayRate:950,manualFte:.5,budgetCap:60000},
      {id:"role-ba",name:"Business Analyst",dayRate:850,manualFte:1,budgetCap:65000},
      {id:"role-ux",name:"UX / UI",dayRate:800,manualFte:1,budgetCap:55000},
      {id:"role-dev",name:"Software Engineering",dayRate:900,manualFte:2,budgetCap:150000},
      {id:"role-qa",name:"QA Engineer",dayRate:780,manualFte:1,budgetCap:65000}
    ],
    people:[
      {id:"person-alex",name:"Alex",roleId:"role-dm",baseFte:.5,availabilityByIteration:{},leave:[]},
      {id:"person-sam",name:"Sam",roleId:"role-ba",baseFte:1,availabilityByIteration:{},leave:[]},
      {id:"person-mia",name:"Mia",roleId:"role-ux",baseFte:1,availabilityByIteration:{},leave:[]},
      {id:"person-lin",name:"Lin",roleId:"role-dev",baseFte:1,availabilityByIteration:{},leave:[]},
      {id:"person-jordan",name:"Jordan",roleId:"role-dev",baseFte:1,availabilityByIteration:{},leave:[{id:"leave-1",start:"2026-12-21",end:"2027-01-03",label:"Year-end leave"}]},
      {id:"person-priya",name:"Priya",roleId:"role-qa",baseFte:1,availabilityByIteration:{},leave:[]}
    ],
    tasks:[
      {id:"task-1",title:"Kick-off and delivery setup",units:5,ownerPersonId:"person-alex",assigneeIds:["person-alex"]},
      {id:"task-2",title:"Domain discovery and backlog",units:8,ownerPersonId:"person-sam",assigneeIds:["person-sam"]},
      {id:"task-3",title:"Experience map and key flows",units:8,ownerPersonId:"person-mia",assigneeIds:["person-mia"]},
      {id:"task-4",title:"Core order service",units:21,ownerPersonId:"person-lin",assigneeIds:["person-lin","person-jordan"]},
      {id:"task-5",title:"Pricing and validation rules",units:13,ownerPersonId:"person-jordan",assigneeIds:["person-lin","person-jordan"]},
      {id:"task-6",title:"Order-management UI",units:13,ownerPersonId:"person-mia",assigneeIds:["person-mia","person-lin","person-jordan"]},
      {id:"task-7",title:"Automation foundation",units:8,ownerPersonId:"person-priya",assigneeIds:["person-priya"]},
      {id:"task-8",title:"Release hardening",units:10,ownerPersonId:"person-priya",assigneeIds:["person-priya","person-jordan"]},
      {id:"task-9",title:"Operational handover",units:5,ownerPersonId:"person-alex",assigneeIds:["person-alex","person-sam"]}
    ],
    actuals:[
      {id:"actual-1",taskId:"task-1",roleId:"role-dm",personId:"person-alex",iterationId:iterations[0].id,hours:18,dayRate:950},
      {id:"actual-2",taskId:"task-2",roleId:"role-ba",personId:"person-sam",iterationId:iterations[0].id,hours:30,dayRate:850},
      {id:"actual-3",taskId:"task-4",roleId:"role-dev",personId:"person-lin",iterationId:iterations[1].id,hours:32,dayRate:900}
    ],
    persistence:{basePath:"Projects/Custom Order Platform",projectPath:"Project",scenarioPath:"Capacity Plans",iterationPath:"Iterations",rolePath:"Roles",personPath:"People",taskPath:"Tasks",actualPath:"Actuals",baselinePath:"Baselines",auditPath:"Audit",conflictPolicy:"warn"}
  };
}
function baseScenario(project) {
  const its=project.iterations;
  return {
    id:"scenario-baseline",name:"Baseline Delivery Plan",status:"draft",budget:280000,contingencyPct:8,targetMarginPct:25,createdAt:nowIso(),
    rolePlans:{
      "role-dm":{fteByIteration:makeLaborPlan(its,.4),rateByIteration:{}},
      "role-ba":{fteByIteration:makeLaborPlan(its,[.8,.8,.8,.4,.4,0,0,0]),rateByIteration:{}},
      "role-ux":{fteByIteration:makeLaborPlan(its,[.7,.7,.7,.7,.3,.3,0,0]),rateByIteration:{}},
      "role-dev":{fteByIteration:makeLaborPlan(its,2),rateByIteration:{}},
      "role-qa":{fteByIteration:makeLaborPlan(its,[0,0,.4,.4,.8,.8,.8,.6]),rateByIteration:{}}
    },
    allocations:[
      {id:"alloc-1",taskId:"task-1",roleId:"role-dm",personId:"person-alex",iterationId:its[0].id,hours:30},
      {id:"alloc-2",taskId:"task-2",roleId:"role-ba",personId:"person-sam",iterationId:its[0].id,hours:48},
      {id:"alloc-3",taskId:"task-3",roleId:"role-ux",personId:"person-mia",iterationId:its[0].id,hours:48},
      {id:"alloc-4",taskId:"task-4",roleId:"role-dev",personId:"person-lin",iterationId:its[1].id,hours:84},
      {id:"alloc-5",taskId:"task-4",roleId:"role-dev",personId:"person-jordan",iterationId:its[2].id,hours:42},
      {id:"alloc-6",taskId:"task-5",roleId:"role-dev",personId:"person-lin",iterationId:its[2].id,hours:78},
      {id:"alloc-7",taskId:"task-6",roleId:"role-dev",personId:"person-jordan",iterationId:its[3].id,hours:54},
      {id:"alloc-8",taskId:"task-6",roleId:"role-ux",personId:"person-mia",iterationId:its[3].id,hours:24},
      {id:"alloc-9",taskId:"task-7",roleId:"role-qa",personId:"person-priya",iterationId:its[3].id,hours:48}
    ],
    nonLaborCosts:[{id:"cost-cloud",name:"Cloud environments",planned:12000,actual:4000},{id:"cost-security",name:"External security review",planned:8000,actual:0}]
  };
}
export function baseState() {
  const project=baseProject(),scenario=baseScenario(project),at=nowIso();
  return normalizeWorkspace({schema:"capacity-planner.workspace",version:VERSION,id:"workspace-demo",revision:1,updatedAt:at,project,scenarios:[scenario],activeScenarioId:scenario.id,baselines:[],audit:[{id:"audit-1",at,revision:1,action:"workspace.created",detail:"Demo workspace created"}]});
}

export function normalizeWorkspace(workspace) {
  if(!workspace?.project)return workspace;
  workspace.project.actuals=Array.isArray(workspace.project.actuals)?workspace.project.actuals:[];
  workspace.project.persistence=workspace.project.persistence||{};if(!workspace.project.persistence.actualPath)workspace.project.persistence.actualPath="Actuals";
  workspace.baselines=Array.isArray(workspace.baselines)?workspace.baselines:[];
  workspace.audit=Array.isArray(workspace.audit)?workspace.audit:[];
  const people=new Set((workspace.project.people||[]).map(person=>person.id)),roles=new Map((workspace.project.roles||[]).map(role=>[role.id,role]));
  for(const scenario of workspace.scenarios||[]){scenario.allocations=Array.isArray(scenario.allocations)?scenario.allocations:[];scenario.nonLaborCosts=Array.isArray(scenario.nonLaborCosts)?scenario.nonLaborCosts:[];scenario.rolePlans=scenario.rolePlans||{};}
  for(const task of workspace.project.tasks||[]){
    const inferred=[];
    for(const scenario of workspace.scenarios||[])for(const allocation of scenario.allocations||[])if(allocation.taskId===task.id&&allocation.personId&&people.has(allocation.personId))inferred.push(allocation.personId);
    const existing=Array.isArray(task.assigneeIds)?task.assigneeIds:[];
    task.assigneeIds=[...new Set([...existing,...inferred].filter(id=>people.has(id)))];
    if(task.ownerPersonId&&!people.has(task.ownerPersonId))task.ownerPersonId=null;
    if(task.ownerPersonId&&!task.assigneeIds.includes(task.ownerPersonId))task.assigneeIds.unshift(task.ownerPersonId);
    if(task.ownerPersonId===undefined)task.ownerPersonId=null;
  }
  for(const actual of workspace.project.actuals){if(!Number.isFinite(Number(actual.dayRate)))actual.dayRate=Number(roles.get(actual.roleId)?.dayRate||0);}
  return workspace;
}

export function activeScenario(state=stateRef.state) { return state.scenarios.find(item=>item.id===state.activeScenarioId) || state.scenarios[0]; }
export function roleById(id,state=stateRef.state){return state.project.roles.find(role=>role.id===id);}
export function personById(id,state=stateRef.state){return state.project.people.find(person=>person.id===id);}
export function taskById(id,state=stateRef.state){return state.project.tasks.find(task=>task.id===id);}
export function iterationById(id,state=stateRef.state){return state.project.iterations.find(it=>it.id===id);}

export function validate(candidate) {
  if(!candidate||candidate.schema!=="capacity-planner.workspace"||candidate.version!==VERSION)return"Unsupported capacity-planner workspace version.";
  if(!candidate.id||!candidate.project||!Array.isArray(candidate.scenarios)||!candidate.scenarios.length)return"Workspace structure is incomplete.";
  const project=candidate.project;
  if(!project.name||!Array.isArray(project.iterations)||!project.iterations.length)return"Project timeline is missing.";
  if(!Array.isArray(project.roles)||!Array.isArray(project.people)||!Array.isArray(project.tasks)||!Array.isArray(project.actuals))return"Project resources are incomplete.";
  if(!candidate.scenarios.some(item=>item.id===candidate.activeScenarioId))return"Active resource plan is missing.";
  const ids=(items)=>{const set=new Set();for(const item of items){if(!item?.id||set.has(item.id))return false;set.add(item.id);}return true;};
  if(!ids(project.iterations)||!ids(project.roles)||!ids(project.people)||!ids(project.tasks)||!ids(project.actuals)||!ids(candidate.scenarios))return"Duplicate or missing identities detected.";
  const iterationIds=new Set(project.iterations.map(item=>item.id)),roleIds=new Set(project.roles.map(item=>item.id)),personIds=new Set(project.people.map(item=>item.id)),taskIds=new Set(project.tasks.map(item=>item.id));
  for(const person of project.people)if(!roleIds.has(person.roleId))return `Person ${person.name||person.id} refers to a missing role.`;
  for(const task of project.tasks){
    if(task.ownerPersonId&&!personIds.has(task.ownerPersonId))return `Task ${task.title||task.id} refers to a missing owner.`;
    if(task.assigneeIds!==undefined&&(!Array.isArray(task.assigneeIds)||task.assigneeIds.some(id=>!personIds.has(id))))return `Task ${task.title||task.id} has invalid assigned people.`;
    if(!Number.isFinite(Number(task.units))||Number(task.units)<0)return `Task ${task.title||task.id} has an invalid estimate.`;
  }
  for(const actual of project.actuals){
    if(!taskIds.has(actual.taskId)||!roleIds.has(actual.roleId)||!iterationIds.has(actual.iterationId)||actual.personId&&!personIds.has(actual.personId))return"An actual-effort record has an invalid task, role, person or iteration reference.";
    if(!Number.isFinite(Number(actual.hours))||Number(actual.hours)<=0||actual.dayRate!==undefined&&(!Number.isFinite(Number(actual.dayRate))||Number(actual.dayRate)<0))return"An actual-effort record has invalid hours or rate.";
  }
  for(const scenario of candidate.scenarios){
    if(!Array.isArray(scenario.allocations)||!Array.isArray(scenario.nonLaborCosts))return `Resource plan ${scenario.name||scenario.id} is incomplete.`;
    if(!ids(scenario.allocations)||!ids(scenario.nonLaborCosts))return `Resource plan ${scenario.name||scenario.id} has duplicate allocation or cost identities.`;
    const allocated=new Map();
    for(const allocation of scenario.allocations){
      if(!taskIds.has(allocation.taskId)||!roleIds.has(allocation.roleId)||!iterationIds.has(allocation.iterationId)||allocation.personId&&!personIds.has(allocation.personId))return `Resource plan ${scenario.name||scenario.id} has an invalid allocation reference.`;
      if(allocation.personId&&project.people.find(person=>person.id===allocation.personId)?.roleId!==allocation.roleId)return `Allocation person does not belong to its selected role.`;
      const hours=Number(allocation.hours);if(!Number.isFinite(hours)||hours<=0)return"Task allocation hours must be positive.";
      allocated.set(allocation.taskId,(allocated.get(allocation.taskId)||0)+hours);
    }
    for(const [taskId,hours] of allocated){const task=project.tasks.find(item=>item.id===taskId),estimate=Number(task?.units||0)*Number(project.hoursPerUnit||0);if(hours>estimate+.01)return `Task ${task?.title||taskId} is allocated beyond its estimate.`;}
    for(const roleId of Object.keys(scenario.rolePlans||{}))if(!roleIds.has(roleId))return `Resource plan ${scenario.name||scenario.id} refers to a missing role plan.`;
    for(const cost of scenario.nonLaborCosts)if(!Number.isFinite(Number(cost.planned))||Number(cost.planned)<0||!Number.isFinite(Number(cost.actual))||Number(cost.actual)<0)return"Non-labor costs must be non-negative numbers.";
  }
  return null;
}

function load() {
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){storageStatus="demo";return baseState();}
    const candidate=JSON.parse(raw),error=validate(candidate);
    if(error){storageStatus="invalid";return baseState();}
    storageStatus="saved";return normalizeWorkspace(candidate);
  }catch{storageStatus="unavailable";return baseState();}
}
export const stateRef={state:load(),taskFilter:"",dragged:null,dirty:false,lastSavedAt:null,summaryExpanded:false};
export function renderStorageStatus() {
  const pill=$("#storage-pill"),labels={saved:"Saved",demo:"Demo · not saved",dirty:"Unsaved changes",invalid:"Stored data invalid · demo shown",unavailable:"In-memory only"};
  const key=stateRef.dirty?"dirty":storageStatus;
  pill.textContent=labels[key]||"In-memory only";pill.className=`pill ${key==="invalid"||key==="dirty"?"warning":key==="saved"?"positive":""}`;
  const revision=$("#revision-pill");revision.textContent=`r${stateRef.state.revision}`;
}
export function save() {
  let persisted=false;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(stateRef.state));storageStatus="saved";stateRef.dirty=false;stateRef.lastSavedAt=nowIso();persisted=true;}
  catch{storageStatus="unavailable";}
  renderStorageStatus();return persisted;
}
export function markDirty(){stateRef.dirty=true;renderStorageStatus();}
export function commit(action,detail,{persist=true}={}) {
  stateRef.state.revision=Number(stateRef.state.revision||0)+1;stateRef.state.updatedAt=nowIso();
  stateRef.state.audit.unshift({id:uid("audit"),at:stateRef.state.updatedAt,revision:stateRef.state.revision,action,detail:String(detail||"")});
  if(stateRef.state.audit.length>300)stateRef.state.audit.length=300;
  stateRef.dirty=true;if(persist)save();else renderStorageStatus();
}
export function announce(message) { clearTimeout(noticeTimer);notice.textContent=message;notice.classList.add("show");noticeTimer=window.setTimeout(()=>notice.classList.remove("show"),3000); }

export function reconcileTimeline() {
  const valid=new Set(stateRef.state.project.iterations.map(it=>it.id));let removed=0;
  for(const scenario of stateRef.state.scenarios){
    for(const plan of Object.values(scenario.rolePlans||{})){
      plan.fteByIteration=Object.fromEntries(Object.entries(plan.fteByIteration||{}).filter(([id])=>valid.has(id)));
      plan.rateByIteration=Object.fromEntries(Object.entries(plan.rateByIteration||{}).filter(([id])=>valid.has(id)));
    }
    const before=scenario.allocations.length;scenario.allocations=scenario.allocations.filter(item=>valid.has(item.iterationId));removed+=before-scenario.allocations.length;
  }
  stateRef.state.project.actuals=stateRef.state.project.actuals.filter(item=>valid.has(item.iterationId));
  return removed;
}
