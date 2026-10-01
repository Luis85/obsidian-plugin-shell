import {$,activeScenario,announce,dateText,esc,euro,num,pct,personById,renderStorageStatus,roleById,save,stateRef,taskById} from "./core.ts";
import {actualHoursFor,allocatedTaskHours,baselineComparison,cellActualHours,cellAllocations,cellLoad,iterationTotals,personAvailability,personLabel,personLoad,remainingTaskHours,roleEnvelope,roleLabel,rolePlan,roleTotals,scenarioMetrics,taskEstimateHours} from "./metrics.ts";

function taskBacklogCard(task,scenario) {
  const estimate=taskEstimateHours(task),allocated=allocatedTaskHours(task.id,scenario),remaining=remainingTaskHours(task,scenario);
  return `<article class="task-card backlog-card" draggable="true" data-task-id="${esc(task.id)}" tabindex="0" aria-label="${esc(task.title)}, ${num.format(remaining)} hours remaining"><div class="task-title">${esc(task.title)}</div><div class="task-meta"><span>${num.format(task.units)} ${esc(stateRef.state.project.unitName)}</span><span>${num.format(allocated)} / ${num.format(estimate)} h allocated</span></div><div class="task-actions"><button type="button" data-action="allocate-task" data-task-id="${esc(task.id)}">Allocate</button><button type="button" data-action="edit-task" data-task-id="${esc(task.id)}">Edit</button></div></article>`;
}
function allocationCard(allocation) {
  const task=taskById(allocation.taskId),actual=actualHoursFor(allocation),person=personLabel(allocation.personId);
  return `<article class="task-card allocation-card" draggable="true" data-allocation-id="${esc(allocation.id)}" tabindex="0" aria-label="${esc(task?.title||"Task")}, ${num.format(allocation.hours)} planned hours"><div class="task-title">${esc(task?.title||"Unknown task")}</div><div class="task-meta"><span>${num.format(allocation.hours)} h planned</span><span>${num.format(actual)} h actual</span><span>${esc(person)}</span></div><div class="task-actions compact-actions"><button type="button" data-action="edit-allocation" data-allocation-id="${esc(allocation.id)}">Edit</button><button type="button" data-action="record-actual" data-allocation-id="${esc(allocation.id)}">Actual</button><button type="button" data-action="remove-allocation" data-allocation-id="${esc(allocation.id)}">Remove</button></div></article>`;
}
export function renderScenarioSelect() {
  const select=$("#scenario-select"),current=stateRef.state.activeScenarioId;
  select.innerHTML=stateRef.state.scenarios.filter(item=>item.status!=="archived").map(item=>`<option value="${esc(item.id)}" ${item.id===current?"selected":""}>${esc(item.name)}${item.status==="approved"?" · approved":""}</option>`).join("");
}
function renderProjectMeta() {
  const project=stateRef.state.project,scenario=activeScenario();
  $("#app-plan-title").textContent=project.name;$("#plan-heading").textContent=scenario.name;
  $("#timeline-pill").textContent=`${project.iterations.length} shared iterations · ${project.timelineOwner==="iteration-planner"?"Iteration Planner owned":"Project owned"}`;
  $("#calendar-pill").textContent=`${project.workingDays.length} workdays/week · ${project.holidays.length} holidays`;
  $("#unit-pill").textContent=`1 ${project.unitName} = ${num.format(project.hoursPerUnit)} h`;
  $("#scenario-status-pill").textContent=scenario.status;$("#scenario-status-pill").className=`pill ${scenario.status==="approved"?"positive":""}`;
}
function renderKpis() {
  const scenario=activeScenario(),m=scenarioMetrics(scenario),order=Number(stateRef.state.project.orderValue||0),budget=Number(scenario.budget||0),budgetUse=budget>0?m.forecastWithContingency/budget:0;
  $("#kpis").innerHTML=`
    <div class="kpi"><div class="label">Resource budget</div><div class="value">${euro.format(budget)}</div><div class="sub">Forecast ${pct(budgetUse)} of budget</div><div class="budget-track"><span class="${budgetUse>1?"over":""}" style="width:${Math.min(100,budgetUse*100)}%"></span></div></div>
    <div class="kpi"><div class="label">Forecast / EAC</div><div class="value">${euro.format(m.forecastWithContingency)}</div><div class="sub">Actual ${euro.format(m.actualInternalCost)} · ETC ${euro.format(m.etcLaborCost)}</div></div>
    <div class="kpi"><div class="label">Budget variance</div><div class="value ${m.budgetVariance<0?"negative":"positive"}">${euro.format(m.budgetVariance)}</div><div class="sub">After ${num.format(scenario.contingencyPct)}% contingency</div></div>
    <div class="kpi"><div class="label">Order value</div><div class="value">${euro.format(order)}</div><div class="sub">Target margin ${num.format(scenario.targetMarginPct)}%</div></div>
    <div class="kpi"><div class="label">Forecast margin</div><div class="value ${m.marginPct<scenario.targetMarginPct/100?"warn-text":"positive"}">${euro.format(m.margin)}</div><div class="sub">${pct(m.marginPct)} margin</div></div>
    <div class="kpi"><div class="label">Work allocation</div><div class="value">${num.format(m.unallocatedHours)} h open</div><div class="sub">${m.unallocatedTasks} tasks still need allocation</div></div>
    <div class="kpi"><div class="label">Actual effort</div><div class="value">${num.format(m.actualHours)} h</div><div class="sub">Planned role capacity ${num.format(m.plannedHours)} h</div></div>`;
}
function renderChecks() {
  const scenario=activeScenario(),m=scenarioMetrics(scenario),roleBudgetBreaches=stateRef.state.project.roles.filter(role=>roleTotals(role,scenario).budgetOver).length;
  const cards=[
    {label:"Budget",tone:m.budgetVariance>=0?"good":"bad",value:m.budgetVariance>=0?`${euro.format(m.budgetVariance)} remaining`:`${euro.format(-m.budgetVariance)} over`,detail:"Forecast including contingency"},
    {label:"Staffing",tone:m.envelopeBreaches||m.personOverloads?"warn":"good",value:`${m.envelopeBreaches} role · ${m.personOverloads} person breaches`,detail:"Planned work versus actual availability"},
    {label:"Task load",tone:m.overloadCells?"bad":"good",value:`${m.overloadCells} overloaded cells`,detail:"Allocated task hours versus planned role capacity"},
    {label:"Scope",tone:m.unallocatedHours>.01?"warn":"good",value:`${num.format(m.unallocatedHours)} h unallocated`,detail:`${m.unallocatedTasks} task${m.unallocatedTasks===1?"":"s"} incomplete`},
    {label:"Commercial",tone:roleBudgetBreaches||m.marginPct<scenario.targetMarginPct/100?"warn":"good",value:`${roleBudgetBreaches} role budget breaches`,detail:`Forecast margin ${pct(m.marginPct)} vs ${num.format(scenario.targetMarginPct)}% target`}
  ];
  $("#checks").innerHTML=`<div class="checks-title"><strong>Planning checks</strong><span>Conditions that need a decision</span></div>${cards.map(card=>`<div class="check-card ${card.tone}"><div class="check-label">${card.label}</div><strong>${card.value}</strong><span>${card.detail}</span></div>`).join("")}`;
}
export function renderBacklog() {
  const scenario=activeScenario(),all=stateRef.state.project.tasks.filter(task=>remainingTaskHours(task,scenario)>.01),query=stateRef.taskFilter.trim().toLowerCase(),items=query?all.filter(task=>task.title.toLowerCase().includes(query)):all;
  $("#backlog-count").textContent=query?`${items.length}/${all.length}`:String(all.length);
  $("#backlog").innerHTML=items.length?items.map(task=>taskBacklogCard(task,scenario)).join(""):`<div class="empty">${all.length?"No tasks match this filter.":"All estimated work is allocated."}<br><small>${all.length?"Try another search.":"Edit a task or remove an allocation to reopen work."}</small></div>`;
}
function renderCell(role,it,scenario) {
  const p=rolePlan(role,it,scenario),e=roleEnvelope(role,it),load=cellLoad(role.id,it.id,scenario),actual=cellActualHours(role.id,it.id),over=load>p.hours+.01,staffOver=p.hours>e.hours+.01,allocs=cellAllocations(role.id,it.id,scenario),util=p.hours>0?load/p.hours:(load>0?Infinity:0);
  return `<div class="capacity-cell ${over?"overloaded":""} ${staffOver?"envelope-over":""}" data-role-id="${esc(role.id)}" data-iteration-id="${esc(it.id)}"><div class="cell-head"><div><div class="capacity-amount">${num.format(p.fte)} / ${num.format(e.fte)} FTE · ${num.format(p.pt)} PT</div><div class="capacity-detail">${num.format(p.hours)} h · ${e.source==="people"?"people-derived":"manual"} envelope</div><div class="capacity-detail">${euro.format(p.cost)} · rate ${euro.format(p.rate)}/PT</div></div><div class="cell-badges"><span class="util ${over?"over":""}">${Number.isFinite(util)?num.format(util*100):"∞"}%</span>${staffOver?`<span class="fte-badge">staffing gap</span>`:""}</div></div><div class="cell-meter"><span class="${over?"over":""}" style="width:${Math.min(100,Number.isFinite(util)?util*100:100)}%"></span></div><div class="capacity-detail">Tasks ${num.format(load)} h · actual ${num.format(actual)} h</div><div class="cell-tasks">${allocs.length?allocs.map(allocationCard).join(""):`<div class="cell-empty">${p.fte>0?"Drop remaining task work here":e.fte>0?"No planned FTE":"No available people"}</div>`}</div></div>`;
}
function renderTimeline() {
  const scenario=activeScenario(),its=stateRef.state.project.iterations,timeline=$("#timeline"),totalsByRole=stateRef.state.project.roles.map(role=>roleTotals(role,scenario)),maxHours=Math.max(1,...totalsByRole.map(t=>t.hours));
  timeline.style.setProperty("--iteration-count",String(Math.max(1,its.length)));
  const head=`<div class="timeline-row timeline-head"><div class="corner"><div><strong>Roles / staffing</strong><div class="capacity-detail">planned / available FTE · PT · cost</div></div></div>${its.map(it=>`<div class="iter-head"><strong>${esc(it.name)}</strong><span>${dateText(it.start)} – ${dateText(it.end)}</span></div>`).join("")}</div>`;
  const summary=`<div class="timeline-row iteration-summary-row"><div class="iteration-summary-label"><strong>Iteration totals</strong><span>All roles</span></div>${its.map(it=>{const t=iterationTotals(it,scenario),issue=t.envelopeBreaches||t.overloadCells||t.personOverloads;return `<div class="iteration-total ${issue?"has-issue":""}"><strong>${num.format(t.plannedFte)} / ${num.format(t.envelopeFte)} FTE</strong><span>${num.format(t.pt)} PT · ${num.format(t.hours)} h</span><span>${euro.format(t.cost)}</span><span>Tasks ${num.format(t.load)} h · actual ${num.format(t.actualHours)} h</span>${issue?`<em>${t.envelopeBreaches} staffing · ${t.overloadCells} load · ${t.personOverloads} person</em>`:""}</div>`;}).join("")}</div>`;
  const rows=stateRef.state.project.roles.map((role,index)=>{const totals=totalsByRole[index],laneHeight=Math.round(134+80*(totals.hours/maxHours)),rolePeople=stateRef.state.project.people.filter(person=>person.roleId===role.id);return `<div class="timeline-row role-row" style="--lane-height:${laneHeight}px"><div class="role-summary"><div class="role-name-line"><strong>${esc(role.name)}</strong><div class="role-actions"><button type="button" data-action="plan-fte" data-role-id="${esc(role.id)}">Plan</button><button type="button" data-action="edit-role" data-role-id="${esc(role.id)}">Edit</button></div></div><div class="capacity-detail">${rolePeople.length?`${rolePeople.length} people`:"manual envelope"} · peak ${num.format(totals.peakFte)} planned FTE</div><div class="capacity-detail">${euro.format(role.dayRate)}/PT · bucket ${role.budgetCap?euro.format(role.budgetCap):"none"}</div><div class="role-totals"><span><strong>${num.format(totals.pt)}</strong> PT</span><span><strong>${num.format(totals.hours)}</strong> h</span><span>${euro.format(totals.cost)}</span><span class="${totals.budgetOver?"bad-text":""}">${totals.budgetOver?"budget over":"bucket OK"}</span></div><div class="lane-scale"><span style="width:${Math.max(4,totals.hours/maxHours*100)}%"></span></div></div>${its.map(it=>renderCell(role,it,scenario)).join("")}</div>`;}).join("");
  timeline.innerHTML=head+summary+(rows||`<div class="empty board-empty">Add a role to begin staffing the shared project timeline.</div>`);
}
function renderBaselineStrip() {
  const scenario=activeScenario(),baseline=stateRef.state.baselines.find(item=>item.scenarioId===scenario.id&&item.approvedAt)||stateRef.state.baselines.find(item=>item.scenarioId===scenario.id),host=$("#baseline-strip");
  if(!baseline){host.innerHTML=`<div><strong>No baseline yet</strong><span>Create a snapshot when this resource plan is ready for review.</span></div><button type="button" data-action="open-baselines">Create baseline</button>`;return;}
  const diff=baselineComparison(baseline,scenario);host.innerHTML=`<div><strong>${esc(baseline.name)}${baseline.approvedAt?" · approved":""}</strong><span>Δ forecast ${euro.format(diff.costDelta)} · Δ capacity ${num.format(diff.hoursDelta)} h · Δ margin ${euro.format(diff.marginDelta)}</span></div><button type="button" data-action="open-baselines">Baselines</button>`;
}
export function render() {
  renderScenarioSelect();renderProjectMeta();renderStorageStatus();renderKpis();renderChecks();renderBacklog();renderTimeline();renderBaselineStrip();wireDrag();
}
export function assignAllocation(allocationId,roleId,iterationId) {
  const scenario=activeScenario(),allocation=scenario.allocations.find(item=>item.id===allocationId);if(!allocation)return;allocation.roleId=roleId;allocation.iterationId=iterationId;save();render();announce("Allocation moved.");
}
export function wireTaskCards(root=document) {
  root.querySelectorAll("[draggable=true]").forEach(card=>{card.addEventListener("dragstart",event=>{stateRef.dragged={taskId:card.dataset.taskId||null,allocationId:card.dataset.allocationId||null};card.classList.add("dragging");event.dataTransfer?.setData("text/plain",JSON.stringify(stateRef.dragged));});card.addEventListener("dragend",()=>{stateRef.dragged=null;card.classList.remove("dragging");document.querySelectorAll(".drop-active").forEach(el=>el.classList.remove("drop-active"));});});
}
function wireDrag() {
  wireTaskCards(document);document.querySelectorAll(".capacity-cell").forEach(cell=>{cell.addEventListener("dragover",event=>{event.preventDefault();cell.classList.add("drop-active");});cell.addEventListener("dragleave",()=>cell.classList.remove("drop-active"));cell.addEventListener("drop",event=>{event.preventDefault();cell.classList.remove("drop-active");const raw=event.dataTransfer?.getData("text/plain");let payload=stateRef.dragged;try{payload=raw?JSON.parse(raw):payload;}catch{};document.dispatchEvent(new CustomEvent("capacity-drop",{detail:{...payload,roleId:cell.dataset.roleId,iterationId:cell.dataset.iterationId}}));});});
}
