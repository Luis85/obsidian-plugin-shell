export const VERSION = 1;
export const STORAGE_KEY = "capacity-planner.prototype.v1";
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

export function parseDate(value) {
  const [y,m,d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y,m-1,d));
  return Number.isFinite(date.getTime()) ? date : null;
}
export function dateText(value) {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date) : "—";
}
export function iso(date) { return date.toISOString().slice(0,10); }
export function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
export function inclusiveDays(start, end) { return Math.round((end - start) / 86400000) + 1; }
export function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
export function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function makeIterations(plan) {
  const start = parseDate(plan.start);
  const due = parseDate(plan.due);
  if (!start || !due || due < start) return [];
  const chunk = Math.max(1, Number(plan.iterationWeeks) || 2) * 7;
  const result = [];
  let cursor = start;
  let index = 1;
  while (cursor <= due && result.length < 80) {
    const rawEnd = addDays(cursor, chunk - 1);
    const end = rawEnd > due ? due : rawEnd;
    result.push({id:`it-${iso(cursor)}`,index,name:`Iteration ${index}`,start:iso(cursor),end:iso(end),weeks:inclusiveDays(cursor,end)/7});
    cursor = addDays(end,1);
    index += 1;
  }
  return result;
}

export function nextPlanDates() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
  const toMonday = (8 - today.getUTCDay()) % 7;
  const start = addDays(today,toMonday);
  return {start:iso(start),due:iso(addDays(start,16*7-1))};
}

export function baseState() {
  const plan = {id:"plan-demo",name:"Custom Order Platform",budget:280000,start:"2026-10-05",due:"2027-01-22",iterationWeeks:2,daysPerWeek:5,hoursPerDay:8,unitName:"SP",hoursPerUnit:6};
  const its = makeIterations(plan);
  const all = (value) => Object.fromEntries(its.map(it=>[it.id,value]));
  const range = (values) => Object.fromEntries(its.map((it,i)=>[it.id,values[i] ?? 0]));
  return {
    schema:"capacity-planner.workspace",version:VERSION,plan,
    roles:[
      {id:"role-dm",name:"Delivery Manager",dayRate:950,availableFte:.5,fteByIteration:all(.4)},
      {id:"role-ba",name:"Business Analyst",dayRate:850,availableFte:1,fteByIteration:range([.8,.8,.8,.4,.4,0,0,0])},
      {id:"role-ux",name:"UX / UI",dayRate:800,availableFte:1,fteByIteration:range([.7,.7,.7,.7,.3,.3,0,0])},
      {id:"role-dev",name:"Software Engineering",dayRate:900,availableFte:2,fteByIteration:all(2)},
      {id:"role-qa",name:"QA Engineer",dayRate:780,availableFte:1,fteByIteration:range([0,0,.4,.4,.8,.8,.8,.6])}
    ],
    tasks:[
      {id:"task-1",title:"Kick-off and delivery setup",units:5,roleId:"role-dm",iterationId:its[0]?.id ?? null},
      {id:"task-2",title:"Domain discovery and backlog",units:8,roleId:"role-ba",iterationId:its[0]?.id ?? null},
      {id:"task-3",title:"Experience map and key flows",units:8,roleId:"role-ux",iterationId:its[0]?.id ?? null},
      {id:"task-4",title:"Core order service",units:21,roleId:"role-dev",iterationId:its[1]?.id ?? null},
      {id:"task-5",title:"Pricing and validation rules",units:13,roleId:"role-dev",iterationId:its[2]?.id ?? null},
      {id:"task-6",title:"Order-management UI",units:13,roleId:"role-dev",iterationId:its[3]?.id ?? null},
      {id:"task-7",title:"Automation foundation",units:8,roleId:"role-qa",iterationId:its[3]?.id ?? null},
      {id:"task-8",title:"Release hardening",units:10,roleId:null,iterationId:null},
      {id:"task-9",title:"Operational handover",units:5,roleId:null,iterationId:null}
    ]
  };
}

export function validate(candidate) {
  if (!candidate || candidate.schema !== "capacity-planner.workspace" || candidate.version !== VERSION) return "Unsupported workspace schema or version.";
  if (!candidate.plan || typeof candidate.plan.name !== "string" || !candidate.plan.name.trim()) return "Plan is missing.";
  if (typeof candidate.plan.unitName !== "string" || !candidate.plan.unitName.trim()) return "Task estimate unit is missing.";
  const start = parseDate(candidate.plan.start), due = parseDate(candidate.plan.due);
  if (!start || !due || due < start) return "Plan dates are invalid.";
  const ranges = {budget:[0,1e9],iterationWeeks:[.25,12],daysPerWeek:[1,7],hoursPerDay:[.25,24],hoursPerUnit:[0,10000]};
  for (const [key,[min,max]] of Object.entries(ranges)) {
    const value = Number(candidate.plan[key]);
    if (!Number.isFinite(value) || value < min || value > max) return `Plan value ${key} is invalid.`;
  }
  if (!Array.isArray(candidate.roles) || !Array.isArray(candidate.tasks)) return "Roles or tasks are missing.";
  const roleIds = new Set();
  for (const role of candidate.roles) {
    if (!role?.id || typeof role.name !== "string" || !role.name.trim() || roleIds.has(role.id)) return "Role identity is invalid.";
    roleIds.add(role.id);
    if (!Number.isFinite(Number(role.dayRate)) || Number(role.dayRate) < 0) return `Day rate for ${role.name} is invalid.`;
    if (role.availableFte !== undefined && (!Number.isFinite(Number(role.availableFte)) || Number(role.availableFte) < 0 || Number(role.availableFte) > 20)) return `FTE envelope for ${role.name} is invalid.`;
    if (!role.fteByIteration || typeof role.fteByIteration !== "object") return `FTE plan for ${role.name} is invalid.`;
    for (const value of Object.values(role.fteByIteration)) if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 20) return `FTE value for ${role.name} is invalid.`;
  }
  const taskIds = new Set();
  for (const task of candidate.tasks) {
    if (!task?.id || typeof task.title !== "string" || !task.title.trim() || taskIds.has(task.id)) return "Task identity is invalid.";
    taskIds.add(task.id);
    if (!Number.isFinite(Number(task.units)) || Number(task.units) < 0) return `Estimate for ${task.title} is invalid.`;
    if (task.roleId && !roleIds.has(task.roleId)) return `Task ${task.title} refers to a missing role.`;
  }
  return null;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { storageStatus="demo"; return baseState(); }
    const candidate = JSON.parse(raw);
    if (validate(candidate)) { storageStatus="invalid"; return baseState(); }
    storageStatus="saved"; return candidate;
  } catch { storageStatus="unavailble"; return baseState(); }
}

export const stateRef = {state:load(),taskFilter:"",draggedTaskId:null};
export function renderStorageStatus() {
  const pill = $("#storage-pill");
  const labels = {saved:"Saved locally",demo:"Demo · not saved",invalid:"Stored data invalid · demo shown",unavailable:"In-memory only"};
  pill.textContent = labels[storageStatus] || "In-memory only";
  pill.className = `pill ${storageStatus === "invalid" ? "warning" : storageStatus === "saved" ? "positive" : ""}`;
}
export function save() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(stateRef.state)); storageStatus="saved"; }
  catch { storageStatus="unavailable"; }
  renderStorageStatus();
}
export function announce(message) {
  clearTimeout(noticeTimer); notice.textContent=message; notice.classList.add("show");
  noticeTimer=window.setTimeout(()=>notice.classList.remove("show"),2600);
}
export function iterations() { return makeIterations(stateRef.state.plan); }
export function capacityFor(role,iteration) {
  const fte=Number(role.fteByIteration?.[iteration.id] ?? 0),pt=fte*iteration.weeks*Number(stateRef.state.plan.daysPerWeek),hours=pt*Number(stateRef.state.plan.hoursPerDay),cost=pt*Number(role.dayRate||0);
  return {fte,pt,hours,cost};
}
export function taskHours(task) { return Number(task.units||0)*Number(stateRef.state.plan.hoursPerUnit||0); }
export function tasksFor(roleId,iterationId) { return stateRef.state.tasks.filter(task=>task.roleId===roleId && task.iterationId===iterationId); }
export function roleTotals(role) {
  return iterations().reduce((acc,it)=>{const c=capacityFor(role,it);acc.pt+=c.pt;acc.hours+=c.hours;acc.cost+=c.cost;acc.fteWeeks+=c.fte*it.weeks;acc.weeks+=it.weeks;acc.peakFte=Math.max(acc.peakFte,c.fte);if(c.fte>Number(role.availableFte||0)+.001)acc.envelopeBreaches+=1;return acc;},{pt:0,hours:0,cost:0,fteWeeks:0,weeks:0,peakFte:0,envelopeBreaches:0});
}
export function iterationTotals(iteration) {
  const totals={pt:0,hours:0,cost:0,load:0,plannedFte:0,availableFte:0,envelopeBreaches:0,overloadCells:0};
  for(const role of stateRef.state.roles){const c=capacityFor(role,iteration),load=tasksFor(role.id,iteration.id).reduce((sum,t)=>sum+taskHours(t),0);totals.pt+=c.pt;totals.hours+=c.hours;totals.cost+=c.cost;totals.load+=load;totals.plannedFte+=c.fte;totals.availableFte+=Number(role.availableFte||0);if(c.fte>Number(role.availableFte||0)+.001)totals.envelopeBreaches+=1;if(load>c.hours+.001)totals.overloadCells+=1;}
  return totals;
}
export function planTotals() {
  const role=stateRef.state.roles.reduce((acc,r)=>{const t=roleTotals(r);acc.pt+=t.pt;acc.hours+=t.hours;acc.cost+=t.cost;acc.envelopeBreaches+=t.envelopeBreaches;return acc;},{pt:0,hours:0,cost:0,envelopeBreaches:0});
  const scheduled=stateRef.state.tasks.filter(t=>t.roleId&&t.iterationId).reduce((sum,t)=>sum+taskHours(t),0),backlogTasks=stateRef.state.tasks.filter(t=>!t.roleId||!t.iterationId),backlog=backlogTasks.reduce((sum,t)=>sum+taskHours(t),0),overloadCells=iterations().reduce((sum,it)=>sum+iterationTotals(it).overloadCells,0);
  return {...role,scheduled,backlog,backlogCount:backlogTasks.length,overloadCells};
}
export function reconcile(withNotice=true) {
  const validIterations=new Set(iterations().map(it=>it.id));let moved=0;
  for(const role of stateRef.state.roles){role.fteByIteration=Object.fromEntries(Object.entries(role.fteByIteration||{}).filter(([id])=>validIterations.has(id)));if(!Number.isFinite(Number(role.availableFte))){const values=Object.values(role.fteByIteration).map(Number).filter(Number.isFinite);role.availableFte=Math.max(0,...values)}}
  for(const task of stateRef.state.tasks){if(task.iterationId&&!validIterations.has(task.iterationId)){task.roleId=null;task.iterationId=null;moved+=1;}if(task.roleId&&!stateRef.state.roles.some(r=>r.id===task.roleId)){task.roleId=null;task.iterationId=null;moved+=1;}}
  if(moved&&withNotice)announce(`${moved} task${moved===1?"":"s"} moved back to backlog after plan changes.`);
}
