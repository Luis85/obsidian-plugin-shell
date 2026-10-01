import {$,VERSION,announce,capacityFor,clone,dateText,dialog,esc,euro,importInput,iterations,nextPlanDates,num,parseDate,reconcile,save,stateRef,taskHours,tasksFor,uid,validate} from "./core.ts";
import {assignTask,render} from "./render.ts";

function openDialog(title,body,onSubmit,submitText="Save") {
  dialog.innerHTML=`<form method="dialog" id="dialog-form"><div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" data-dialog-close aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div><div class="dialog-foot"><button type="button" data-dialog-close>Cancel</button><button class="primary" value="default" type="submit">${esc(submitText)}</button></div></form>`;
  dialog.querySelectorAll("[data-dialog-close]").forEach(btn=>btn.addEventListener("click",()=>dialog.close()));
  $("#dialog-form",dialog).addEventListener("submit",event=>{event.preventDefault();const ok=onSubmit(new FormData(event.currentTarget),event.currentTarget);if(ok!==false)dialog.close();});
  dialog.showModal();window.setTimeout(()=>dialog.querySelector("input,select,button")?.focus(),0);
}

export function planDialog(isNew) {
  const p=stateRef.state.plan,defaults=nextPlanDates();
  openDialog(isNew?"New resource plan":"Plan settings",`
    <div class="form-grid"><label class="wide">Plan name<input name="name" required maxlength="80" value="${isNew?"New delivery plan":esc(p.name)}"></label><label>Budget (€)<input name="budget" type="number" min="0" step="1000" required value="${isNew?"200000":esc(p.budget)}"></label><label>Iteration length (weeks)<input name="iterationWeeks" type="number" min=".25" max="12" step=".25" required value="${isNew?"2":esc(p.iterationWeeks)}"></label><label>Start<input name="start" type="date" required value="${isNew?defaults.start:esc(p.start)}"></label><label>Due<input name="due" type="date" required value="${isNew?defaults.due:esc(p.due)}"></label><label>Working days / FTE week<input name="daysPerWeek" type="number" min="1" max="7" step=".5" required value="${isNew?"5":esc(p.daysPerWeek)}"></label><label>Hours / project day<input name="hoursPerDay" type="number" min=".25" max="24" step=".25" required value="${isNew?"8":esc(p.hoursPerDay)}"></label><label>Task estimate unit name<input name="unitName" maxlength="12" required value="${isNew?"SP":esc(p.unitName)}"></label><label>Hours / estimate unit<input name="hoursPerUnit" type="number" min="0" step=".25" required value="${isNew?"6":esc(p.hoursPerUnit)}"></label></div>
    ${isNew?`<div class="callout">Creating a new plan replaces the current in-browser workspace. Export first if you need the current state.</div>`:`<div class="callout subtle">Changing the start date or iteration cadence can invalidate existing task placements. Affected tasks are returned to the backlog instead of being silently remapped.</div>`}
    <div class="formula">PT = FTE/week × iteration weeks × working days/week. Hours = PT × hours/day. Cost = PT × role day rate. A partial final iteration is prorated by its calendar-day fraction; holidays and personal leave are not modeled.</div>`,data=>{
      const candidate={...p,id:isNew?uid("plan"):p.id,name:String(data.get("name")||"").trim(),budget:Number(data.get("budget")),iterationWeeks:Number(data.get("iterationWeeks")),start:String(data.get("start")),due:String(data.get("due")),daysPerWeek:Number(data.get("daysPerWeek")),hoursPerDay:Number(data.get("hoursPerDay")),unitName:String(data.get("unitName")||"").trim(),hoursPerUnit:Number(data.get("hoursPerUnit"))};
      const probe={schema:"capacity-planner.workspace",version:VERSION,plan:candidate,roles:isNew?[]:stateRef.state.roles,tasks:isNew?[]:stateRef.state.tasks},error=validate(probe);
      if(error){announce(error);return false;}
      if(isNew&&(stateRef.state.roles.length||stateRef.state.tasks.length)&&!window.confirm("Create a new resource plan and replace the current workspace?"))return false;
      if(isNew)stateRef.state={schema:"capacity-planner.workspace",version:VERSION,plan:candidate,roles:[],tasks:[]};else stateRef.state.plan=candidate;
      reconcile(true);save();render();announce(isNew?"New resource plan created.":"Plan settings updated.");return true;
    },isNew?"Create plan":"Apply");
}

export function roleDialog() {
  openDialog("Add role",`<div class="form-grid"><label class="wide">Role name<input name="name" required maxlength="60" placeholder="e.g. Software Engineer"></label><label>Day rate (€ / PT)<input name="dayRate" type="number" min="0" step="10" required value="850"></label><label>FTE envelope / week<input name="availableFte" type="number" min="0" max="20" step=".1" required value="1"></label><label>Initial planned FTE / week<input name="fte" type="number" min="0" max="20" step=".1" required value="1"></label></div><div class="formula">The FTE envelope is the role capacity available to this plan. Planned FTE is what the plan consumes. Planning above the envelope is allowed but visibly flagged.</div>`,data=>{
    const name=String(data.get("name")||"").trim(),dayRate=Number(data.get("dayRate")),availableFte=Number(data.get("availableFte")),fte=Number(data.get("fte"));
    if(!name||!Number.isFinite(dayRate)||dayRate<0||!Number.isFinite(availableFte)||availableFte<0||availableFte>20||!Number.isFinite(fte)||fte<0||fte>20){announce("Enter a valid role, day rate and FTE values.");return false;}
    stateRef.state.roles.push({id:uid("role"),name,dayRate,availableFte,fteByIteration:Object.fromEntries(iterations().map(it=>[it.id,fte]))});save();render();announce(`${name} added${fte>availableFte?" with an FTE envelope warning":""}.`);return true;
  },"Add role");
}

export function roleSettingsDialog(roleId) {
  const role=stateRef.state.roles.find(r=>r.id===roleId);if(!role)return;
  openDialog(`Role settings · ${role.name}`,`<div class="form-grid"><label class="wide">Role name<input name="name" required maxlength="60" value="${esc(role.name)}"></label><label>Day rate (€ / PT)<input name="dayRate" type="number" min="0" step="10" required value="${esc(role.dayRate)}"></label><label>FTE envelope / week<input name="availableFte" type="number" min="0" max="20" step=".1" required value="${esc(role.availableFte)}"></label></div><div class="formula">Changing the FTE envelope does not rewrite the plan. Existing allocations above the new envelope remain visible as warnings.</div><div class="danger-zone"><div><strong>Remove role</strong><span>Assigned tasks return to the backlog; tasks are not deleted.</span></div><button type="button" class="danger" data-action="delete-role" data-role-id="${esc(role.id)}">Remove role</button></div>`,data=>{
    const name=String(data.get("name")||"").trim(),dayRate=Number(data.get("dayRate")),availableFte=Number(data.get("availableFte"));
    if(!name||!Number.isFinite(dayRate)||dayRate<0||!Number.isFinite(availableFte)||availableFte<0||availableFte>20){announce("Enter valid role settings.");return false;}
    role.name=name;role.dayRate=dayRate;role.availableFte=availableFte;save();render();announce(`${name} updated.`);return true;
  },"Save role");
}

export function deleteRole(roleId) {
  const role=stateRef.state.roles.find(r=>r.id===roleId);if(!role)return;
  const affected=stateRef.state.tasks.filter(t=>t.roleId===roleId).length;
  if(!window.confirm(`Remove role "${role.name}"? ${affected?`${affected} assigned task${affected===1?"":"s"} will return to the backlog.`:"No tasks are assigned to it."}`))return;
  for(const task of stateRef.state.tasks)if(task.roleId===roleId){task.roleId=null;task.iterationId=null;}
  stateRef.state.roles=stateRef.state.roles.filter(r=>r.id!==roleId);if(dialog.open)dialog.close();save();render();announce(`${role.name} removed${affected?`; ${affected} task${affected===1?"":"s"} returned to backlog`:""}.`);
}

export function allocateDialog(roleId) {
  const role=stateRef.state.roles.find(r=>r.id===roleId),its=iterations();if(!role||!its.length)return;
  const options=its.map(it=>`<option value="${esc(it.id)}">${esc(it.name)} · ${dateText(it.start)}</option>`).join("");
  openDialog(`Plan FTE · ${role.name}`,`<div class="form-grid"><label>From iteration<select name="from">${options}</select></label><label>Through iteration<select name="through">${options}</select></label><label>Planned FTE / week<input name="fte" type="number" min="0" max="20" step=".1" required value="${esc(role.fteByIteration[its[0].id]??Math.min(1,role.availableFte))}"></label><div class="metric-preview"><span>FTE envelope</span><strong>${num.format(role.availableFte)} FTE / week</strong><small>${euro.format(role.dayRate)} / PT</small></div></div><div class="formula">The same planned FTE is applied to every selected iteration. Set 0 to clear planned capacity while retaining the role. Values above ${num.format(role.availableFte)} FTE are allowed and flagged.</div>`,data=>{
    const from=its.findIndex(it=>it.id===data.get("from")),through=its.findIndex(it=>it.id===data.get("through")),fte=Number(data.get("fte"));if(from<0||through<from||!Number.isFinite(fte)||fte<0||fte>20){announce("Choose a valid iteration range and FTE.");return false;}
    for(let i=from;i<=through;i++)role.fteByIteration[its[i].id]=fte;save();render();announce(`${role.name}: ${num.format(fte)} FTE applied to iterations ${from+1}–${through+1}${fte>role.availableFte?"; staffing envelope exceeded":""}.`);return true;
  },"Apply range");
  const from=$("[name=\"from\"]",dialog),through=$("[name=\"through\"]",dialog);through.selectedIndex=its.length-1;from.addEventListener("change",()=>{if(through.selectedIndex<from.selectedIndex)through.selectedIndex=from.selectedIndex;});
}

export function taskDialog(taskId=null) {
  const task=taskId?stateRef.state.tasks.find(t=>t.id===taskId):null;
  openDialog(task?`Edit task · ${task.title}`:"Add task",`<div class="form-grid"><label class="wide">Task title<input name="title" required maxlength="100" placeholder="Outcome or deliverable" value="${task?esc(task.title):""}"></label><label>Estimate (${esc(stateRef.state.plan.unitName)})<input name="units" type="number" min="0" step=".25" required value="${task?esc(task.units):"5"}"></label>${task&&task.roleId?`<div class="metric-preview"><span>Current placement</span><strong>${esc(stateRef.state.roles.find(r=>r.id===task.roleId)?.name||"Role")}</strong><small>${esc(iterations().find(it=>it.id===task.iterationId)?.name||"Iteration")}</small></div>`:""}</div><div class="formula">At the current conversion, the estimate equals ${num.format((task?task.units:5)*stateRef.state.plan.hoursPerUnit)} h. Changing the estimate immediately updates capacity warnings.</div>${task?`<div class="danger-zone"><div><strong>Delete task</strong><span>Deletion removes the task from this prototype workspace.</span></div><button type="button" class="danger" data-action="delete-task" data-task-id="${esc(task.id)}">Delete task</button></div>`:""}`,data=>{
    const title=String(data.get("title")||"").trim(),units=Number(data.get("units"));if(!title||!Number.isFinite(units)||units<0){announce("Enter a valid title and estimate.");return false;}
    if(task){task.title=title;task.units=units;}else stateRef.state.tasks.push({id:uid("task"),title,units,roleId:null,iterationId:null});save();render();announce(task?`${title} updated.`:`${title} added to backlog.`);return true;
  },task?"Save task":"Add task");
}

export function assignmentDialog(taskId) {
  const task=stateRef.state.tasks.find(t=>t.id===taskId),its=iterations();if(!task||!stateRef.state.roles.length||!its.length){announce("Add at least one role and iteration first.");return;}
  const roleOptions=stateRef.state.roles.map(role=>`<option value="${esc(role.id)}" ${task.roleId===role.id?"selected":""}>${esc(role.name)}</option>`).join(""),iterOptions=its.map(it=>`<option value="${esc(it.id)}" ${task.iterationId===it.id?"selected":""}>${esc(it.name)} · ${dateText(it.start)}</option>`).join("");
  openDialog(`Assign task · ${task.title}`,`<div class="form-grid"><label>Role<select name="roleId">${roleOptions}</select></label><label>Iteration<select name="iterationId">${iterOptions}</select></label></div><div id="assignment-preview" class="assignment-preview"></div><div class="formula">${num.format(task.units)} ${esc(stateRef.state.plan.unitName)} = ${num.format(taskHours(task))} h. Overload is allowed for scenario exploration but remains visibly flagged.</div>`,data=>{assignTask(task.id,String(data.get("roleId")),String(data.get("iterationId")));return true;},"Assign");
  const roleSelect=$("[name=\"roleId\"]",dialog),iterationSelect=$("[name=\"iterationId\"]",dialog),preview=$("#assignment-preview",dialog);
  const updatePreview=()=>{const role=stateRef.state.roles.find(r=>r.id===roleSelect.value),it=its.find(i=>i.id===iterationSelect.value);if(!role||!it)return;const c=capacityFor(role,it),existing=tasksFor(role.id,it.id).filter(t=>t.id!==task.id).reduce((sum,t)=>sum+taskHours(t),0),projected=existing+taskHours(task),util=c.hours>0?projected/c.hours:(projected>0?Infinity:0),over=projected>c.hours+.001;preview.className=`assignment-preview ${over?"bad":"good"}`;preview.innerHTML=`<div><span>Projected task load</span><strong>${num.format(projected)} / ${num.format(c.hours)} h</strong></div><div><span>Utilization</span><strong>${Number.isFinite(util)?num.format(util*100):"∞"}%</strong></div><div><span>Planned FTE</span><strong>${num.format(c.fte)} / ${num.format(role.availableFte)}</strong></div>${over?`<p>Assignment exceeds planned capacity by ${num.format(projected-c.hours)} h.</p>`:""}`;};
  roleSelect.addEventListener("change",updatePreview);iterationSelect.addEventListener("change",updatePreview);updatePreview();
}

export function deleteTask(taskId) {
  const task=stateRef.state.tasks.find(t=>t.id===taskId);if(!task)return;if(!window.confirm(`Delete task "${task.title}" from this prototype workspace?`))return;
  stateRef.state.tasks=stateRef.state.tasks.filter(t=>t.id!==taskId);if(dialog.open)dialog.close();save();render();announce("Task deleted.");
}
export function exportWorkspace() {
  const blob=new Blob([JSON.stringify(stateRef.state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`${stateRef.state.plan.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"capacity-plan"}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);announce("Workspace exported.");
}
export async function importWorkspace(file) {
  try{const text=await file.text(),candidate=JSON.parse(text),error=validate(candidate);if(error){announce(error);return;}if(!window.confirm(`Replace the current workspace with "${candidate.plan.name}"?`))return;stateRef.state=clone(candidate);reconcile(true);save();render();announce("Workspace imported.");}catch{announce("Import failed. Choose a valid JSON workspace.");}finally{importInput.value="";}
}
