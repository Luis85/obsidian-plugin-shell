import {activeScenario,announce,clone,commit,dateText,esc,generateIterations,nextPlanDates,num,reconcileTimeline,stateRef,uid} from "./core.ts";
import {render} from "./render.ts";
import {openDialog,parseLines} from "./dialogs-common.ts";

function emptyRolePlans() {
  return Object.fromEntries(stateRef.state.project.roles.map(role=>[role.id,{fteByIteration:{},rateByIteration:{}}]));
}
export function newPlanDialog() {
  const active=activeScenario();
  openDialog("New resource plan",`<div class="form-grid"><label class="wide">Plan name<input name="name" required maxlength="80" value="${esc(active.name)} copy"></label><label>Start from<select name="basis"><option value="clone">Clone active plan</option><option value="blank">Blank plan</option></select></label><label>Resource budget (€)<input name="budget" type="number" min="0" step="1000" value="${esc(active.budget)}" required></label><label>Contingency (%)<input name="contingencyPct" type="number" min="0" max="100" step=".5" value="${esc(active.contingencyPct)}" required></label><label>Target margin (%)<input name="targetMarginPct" type="number" min="-100" max="100" step=".5" value="${esc(active.targetMarginPct)}" required></label></div><div class="callout subtle">Resource plans are scenarios. They share the same canonical project timeline, people, roles, tasks and actuals; only planned staffing, allocations and commercials differ.</div>`,data=>{
    const name=String(data.get("name")||"").trim(),basis=String(data.get("basis")),budget=Number(data.get("budget")),contingencyPct=Number(data.get("contingencyPct")),targetMarginPct=Number(data.get("targetMarginPct"));
    if(!name||![budget,contingencyPct,targetMarginPct].every(Number.isFinite)){announce("Enter valid plan settings.");return false;}
    const scenario=basis==="clone"?clone(active):{rolePlans:emptyRolePlans(),allocations:[],nonLaborCosts:[]};
    scenario.id=uid("scenario");scenario.name=name;scenario.status="draft";scenario.budget=budget;scenario.contingencyPct=contingencyPct;scenario.targetMarginPct=targetMarginPct;scenario.createdAt=new Date().toISOString();
    stateRef.state.scenarios.push(scenario);stateRef.state.activeScenarioId=scenario.id;commit("scenario.created",`${name} created from ${basis==="clone"?active.name:"blank plan"}`);render();announce(`${name} created and selected.`);return true;
  },"Create plan");
}
export function planSettingsDialog() {
  const scenario=activeScenario();
  openDialog(`Plan settings · ${scenario.name}`,`<div class="form-grid"><label class="wide">Plan name<input name="name" required maxlength="80" value="${esc(scenario.name)}"></label><label>Status<select name="status"><option value="draft" ${scenario.status==="draft"?"selected":""}>Draft</option><option value="approved" ${scenario.status==="approved"?"selected":""}>Approved</option></select></label><label>Resource budget (€)<input name="budget" type="number" min="0" step="1000" required value="${esc(scenario.budget)}"></label><label>Contingency (%)<input name="contingencyPct" type="number" min="0" max="100" step=".5" required value="${esc(scenario.contingencyPct)}"></label><label>Target margin (%)<input name="targetMarginPct" type="number" min="-100" max="100" step=".5" required value="${esc(scenario.targetMarginPct)}"></label></div><div class="formula">Changing this plan never changes the shared iteration calendar or team availability.</div>`,data=>{
    const oldName=scenario.name,name=String(data.get("name")||"").trim();if(!name){announce("Plan name is required.");return false;}
    scenario.name=name;scenario.status=String(data.get("status"));scenario.budget=Number(data.get("budget"));scenario.contingencyPct=Number(data.get("contingencyPct"));scenario.targetMarginPct=Number(data.get("targetMarginPct"));commit("scenario.updated",`${oldName} updated`);render();announce("Resource plan saved.");return true;
  },"Save plan");
}
export function duplicateScenario(scenarioId) {
  const source=stateRef.state.scenarios.find(item=>item.id===scenarioId);if(!source)return;const copy=clone(source);copy.id=uid("scenario");copy.name=`${source.name} copy`;copy.status="draft";copy.createdAt=new Date().toISOString();stateRef.state.scenarios.push(copy);stateRef.state.activeScenarioId=copy.id;commit("scenario.duplicated",`${source.name} duplicated`);render();announce(`${copy.name} created.`);
}
export function archiveScenario(scenarioId) {
  const scenario=stateRef.state.scenarios.find(item=>item.id===scenarioId);if(!scenario)return;if(stateRef.state.scenarios.filter(item=>item.status!=="archived").length<=1){announce("Keep at least one active resource plan.");return;}scenario.status="archived";if(stateRef.state.activeScenarioId===scenario.id)stateRef.state.activeScenarioId=stateRef.state.scenarios.find(item=>item.status!=="archived").id;commit("scenario.archived",scenario.name);render();announce(`${scenario.name} archived.`);
}
export function scenarioManagerDialog() {
  const rows=stateRef.state.scenarios.map(item=>`<div class="management-row ${item.id===stateRef.state.activeScenarioId?"selected":""}"><div><strong>${esc(item.name)}</strong><span>${esc(item.status)} · created ${dateText(item.createdAt?.slice(0,10))}</span></div><div class="row-actions">${item.status!=="archived"&&item.id!==stateRef.state.activeScenarioId?`<button type="button" data-action="activate-scenario" data-scenario-id="${esc(item.id)}">Open</button>`:""}<button type="button" data-action="duplicate-scenario" data-scenario-id="${esc(item.id)}">Duplicate</button>${item.status!=="archived"?`<button type="button" data-action="archive-scenario" data-scenario-id="${esc(item.id)}">Archive</button>`:""}</div></div>`).join("");
  openDialog("Resource plans / scenarios",`<div class="management-list">${rows}</div><div class="callout subtle">All plans share actuals and project facts. Use baselines for immutable approval snapshots.</div>`,null,"",{hideSubmit:true});
}
export function activateScenario(scenarioId) {
  const scenario=stateRef.state.scenarios.find(item=>item.id===scenarioId&&item.status!=="archived");if(!scenario)return;stateRef.state.activeScenarioId=scenario.id;commit("scenario.activated",scenario.name);if(document.querySelector("dialog[open]"))document.querySelector("dialog[open]").close();render();announce(`${scenario.name} opened.`);
}

function parseHolidayLines(value) {
  const holidays=[];for(const line of parseLines(value)){const [date,...name]=line.split("|");if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error(`Invalid holiday line: ${line}`);holidays.push({id:uid("holiday"),date,name:name.join("|").trim()||"Holiday"});}return holidays;
}
function parseExternalIterations(value) {
  const parsed=JSON.parse(String(value||"[]"));if(!Array.isArray(parsed)||!parsed.length)throw new Error("External timeline must be a non-empty JSON array.");return parsed.map((item,index)=>{if(!item?.id||!item.start||!item.end)throw new Error(`Iteration ${index+1} needs id, start and end.`);return{id:String(item.id),index:Number(item.index||index+1),name:String(item.name||`Iteration ${index+1}`),start:String(item.start),end:String(item.end)};});
}
export function projectTimelineDialog() {
  const p=stateRef.state.project,t=p.timeline||nextPlanDates(),holidayText=(p.holidays||[]).map(item=>`${item.date}|${item.name}`).join("\n"),external=JSON.stringify(p.iterations,null,2),working=(p.workingDays||[1,2,3,4,5]).join(",");
  openDialog("Project & shared timeline",`<div class="form-grid"><label class="wide">Project name<input name="name" required maxlength="80" value="${esc(p.name)}"></label><label>Order value (€)<input name="orderValue" type="number" min="0" step="1000" value="${esc(p.orderValue)}" required></label><label>Timeline authority<select name="timelineOwner"><option value="shared-project" ${p.timelineOwner==="shared-project"?"selected":""}>Capacity project</option><option value="iteration-planner" ${p.timelineOwner==="iteration-planner"?"selected":""}>Iteration Planner / upstream</option></select></label><label>Start<input name="start" type="date" value="${esc(t.start)}"></label><label>Due<input name="due" type="date" value="${esc(t.due)}"></label><label>Iteration length (weeks)<input name="iterationWeeks" type="number" min=".25" max="12" step=".25" value="${esc(t.iterationWeeks||2)}"></label><label>Hours / project day<input name="hoursPerDay" type="number" min=".25" max="24" step=".25" value="${esc(p.hoursPerDay)}" required></label><label>Working weekdays (Sun=0)<input name="workingDays" value="${esc(working)}" required></label><label>Estimate unit<input name="unitName" maxlength="12" value="${esc(p.unitName)}" required></label><label>Hours / estimate unit<input name="hoursPerUnit" type="number" min="0" step=".25" value="${esc(p.hoursPerUnit)}" required></label><label class="wide">Project holidays · one per line: YYYY-MM-DD|Name<textarea name="holidays" rows="4">${esc(holidayText)}</textarea></label><label class="wide">Upstream iterations JSON · used when authority is Iteration Planner<textarea name="externalIterations" rows="8">${esc(external)}</textarea></label></div><div class="callout subtle">Scenarios never own dates. Regenerating or syncing the shared timeline keeps stable iteration IDs when supplied upstream; allocations on removed iterations return to unallocated scope.</div>`,data=>{
    try{
      const owner=String(data.get("timelineOwner")),start=String(data.get("start")),due=String(data.get("due")),iterationWeeks=Number(data.get("iterationWeeks")),workingDays=String(data.get("workingDays")).split(",").map(v=>Number(v.trim())).filter(v=>Number.isInteger(v)&&v>=0&&v<=6);
      if(!workingDays.length)throw new Error("At least one working weekday is required.");
      const iterations=owner==="iteration-planner"?parseExternalIterations(data.get("externalIterations")):generateIterations(start,due,iterationWeeks);if(!iterations.length)throw new Error("The shared timeline is empty or invalid.");
      p.name=String(data.get("name")||"").trim();p.orderValue=Number(data.get("orderValue"));p.timelineOwner=owner;p.timeline={start,due,iterationWeeks};p.iterations=iterations;p.hoursPerDay=Number(data.get("hoursPerDay"));p.workingDays=[...new Set(workingDays)];p.unitName=String(data.get("unitName")||"").trim();p.hoursPerUnit=Number(data.get("hoursPerUnit"));p.holidays=parseHolidayLines(data.get("holidays"));
      for(const person of p.people)person.availabilityByIteration=Object.fromEntries(Object.entries(person.availabilityByIteration||{}).filter(([id])=>iterations.some(it=>it.id===id)));
      const removed=reconcileTimeline();commit("timeline.updated",`${owner} timeline updated; ${removed} allocations removed`);render();announce(`Shared timeline saved${removed?`; ${removed} allocation${removed===1?"":"s"} returned to scope`:""}.`);return true;
    }catch(error){announce(error.message||"Timeline settings are invalid.");return false;}
  },"Save project & timeline");
}
