import {$,activeScenario,announce,dateText,esc,euro,num,pct,personById,renderStorageStatus,roleById,save,stateRef,taskById} from "./core.ts";
import {actualHoursFor,allocatedTaskHours,baselineComparison,cellActualHours,cellAllocations,cellLoad,iterationTotals,personLabel,remainingTaskHours,roleEnvelope,rolePlan,roleTotals,scenarioMetrics,taskEstimateHours} from "./metrics.ts";

function taskStaff(task) {
  const owner=task.ownerPersonId?personById(task.ownerPersonId):null,people=(task.assigneeIds||[]).map(id=>personById(id)).filter(Boolean);
  return {owner,people,label:`Owner ${owner?.name||"unassigned"} · ${people.length} ${people.length===1?"person":"people"}`};
}
function taskBacklogCard(task,scenario) {
  const estimate=taskEstimateHours(task),allocated=allocatedTaskHours(task.id,scenario),remaining=remainingTaskHours(task,scenario),staff=taskStaff(task);
  return `<article class="task-card backlog-card" draggable="true" data-task-id="${esc(task.id)}" tabindex="0" aria-label="${esc(task.title)}, ${num.format(remaining)} hours remaining, ${esc(staff.label)}"><div class="task-title-row"><div class="task-title">${esc(task.title)}</div>${staff.owner?`<span class="owner-chip" title="Task owner">${esc(staff.owner.name)}</span>`:""}</div><div class="task-meta"><span>${num.format(task.units)} ${esc(stateRef.state.project.unitName)}</span><span>${num.format(allocated)} / ${num.format(estimate)} h allocated</span></div><div class="task-staff"><span>${esc(staff.label)}</span>${staff.people.length>1?`<span>${esc(staff.people.map(person=>person.name).join(", "))}</span>`:""}</div><div class="task-actions"><button type="button" data-action="allocate-task" data-task-id="${esc(task.id)}">Allocate</button><button type="button" data-action="edit-task" data-task-id="${esc(task.id)}">Edit</button></div></article>`;
}
function allocationCard(allocation) {
  const task=taskById(allocation.taskId),actual=actualHoursFor(allocation),person=personLabel(allocation.personId),owner=task?.ownerPersonId?personLabel(task.ownerPersonId):"No owner";
  return `<article class="task-card allocation-card" draggable="true" data-allocation-id="${esc(allocation.id)}" tabindex="0" aria-label="${esc(task?.title||"Task")}, ${num.format(allocation.hours)} planned hours"><div class="task-title-row"><div class="task-title">${esc(task?.title||"Unknown task")}</div>${task?.ownerPersonId?`<span class="owner-dot" title="Owner ${esc(owner)}">O</span>`:""}</div><div class="task-meta"><span>${num.format(allocation.hours)} h planned</span><span>${num.format(actual)} h actual</span><span>${esc(person)}</span></div><div class="task-actions compact-actions"><button type="button" data-action="edit-allocation" data-allocation-id="${esc(allocation.id)}">Edit</button><button type="button" data-action="record-actual" data-allocation-id="${esc(allocation.id)}">Actual</button><button type="button" data-action="remove-allocation" data-allocation-id="${esc(allocation.id)}">Remove</button></div></article>`;
}
export function renderScenarioSelect() {
  const select=$("#scenario-select"),current=stateRef.state.activeScenarioId;
  select.innerHTML=stateRef.state.scenarios.filter(item=>item.status!=="archived").map(item=>`<option value="${esc(item.id)}" ${item.id===current?"selected":""}>${esc(item.name)}${item.status==="approved"?" · approved":""}</option>`).join("");
}
function renderProjectMeta() {
  const project=stateRef.state.project,scenario=activeScenario();
  $("#app-plan-title").textContent=project.name;$("#plan-heading").textContent=scenario.name;$("#board-heading").textContent=`Current plan · ${scenario.name}`;
  $("#timeline-pill").textContent=`${project.iterations.length} iterations · ${project.timelineOwner==="iteration-planner"?"Iteration Planner owned":"project owned"}`;
  $("#calendar-pill").textContent=`${project.people.filter(person=>!person.inactive).length} people · ${project.workingDays.length} workdays/week`;
  $("#unit-pill").textContent=`1 ${project.unitName} = ${num.format(project.hoursPerUnit)} h`;
  $("#scenario-status-pill").textContent=scenario.status;$("#scenario-status-pill").className=`pill ${scenario.status==="approved"?"positive":""}`;
}
function renderKpis() {
  const scenario=activeScenario(),m=scenarioMetrics(scenario),order=Number(stateRef.state.project.orderValue||0),budget=Number(scenario.budget||0),budgetUse=budget>0?m.forecastWithContingency/budget:0;
  const groups=[
    {title:"Commercial",items:[{label:"Resource budget",value:euro.format(budget),sub:`Forecast ${pct(budgetUse)} of budget`},{label:"Forecast / EAC",value:euro.format(m.forecastWithContingency),sub:`Actual ${euro.format(m.actualInternalCost)} · ETC ${euro.format(m.etcLaborCost)}`},{label:"Budget variance",value:euro.format(m.budgetVariance),tone:m.budgetVariance<0?"negative":"positive",sub:`Incl. ${num.format(scenario.contingencyPct)}% contingency`},{label:"Forecast margin",value:euro.format(m.margin),tone:m.marginPct<scenario.targetMarginPct/100?"warn-text":"positive",sub:`${pct(m.marginPct)} of ${euro.format(order)} order value`}]},
    {title:"Delivery",items:[{label:"Planned capacity",value:`${num.format(m.plannedHours)} h`,sub:"Role capacity in active plan"},{label:"Allocated work",value:`${num.format(m.plannedHours-m.unallocatedHours)} h`,sub:`${m.unallocatedTasks} incomplete tasks`},{label:"Unallocated",value:`${num.format(m.unallocatedHours)} h`,tone:m.unallocatedHours>.01?"warn-text":"positive",sub:"Still needs role / iteration allocation"},{label:"Actual effort",value:`${num.format(m.actualHours)} h`,sub:"Project actuals shared across plans"}]}
  ];
  $("#kpis").innerHTML=groups.map(group=>`<section class="summary-group"><h3>${group.title}</h3><div>${group.items.map(item=>`<div class="summary-metric"><span>${item.label}</span><strong class="${item.tone||""}">${item.value}</strong><small>${item.sub}</small></div>`).join("")}</div></section>`).join("");
  const roleBudgetBreaches=stateRef.state.project.roles.filter(role=>roleTotals(role,scenario).budgetOver).length,issueCount=m.envelopeBreaches+m.personOverloads+m.overloadCells+roleBudgetBreaches+(m.budgetVariance<0?1:0)+(m.unallocatedHours>.01?1:0)+(m.marginPct<scenario.targetMarginPct/100?1:0);
  $("#summary-signal").innerHTML=`<span class="summary-chip ${m.budgetVariance<0?"bad":"good"}">${m.budgetVariance<0?`${euro.format(-m.budgetVariance)} over`:`${euro.format(m.budgetVariance)} budget`}</span><span class="summary-chip ${m.unallocatedHours>.01?"warn":"good"}">${num.format(m.unallocatedHours)} h open</span><span class="summary-chip ${issueCount?"warn":"good"}">${issueCount} issue${issueCount===1?"":"s"}</span>`;
}
function renderChecks() {
  const scenario=activeScenario(),m=scenarioMetrics(scenario),roleBudgetBreaches=stateRef.state.project.roles.filter(role=>roleTotals(role,scenario).budgetOver).length;
  const checks=[
    {label:"Budget",tone:m.budgetVariance>=0?"good":"bad",value:m.budgetVariance>=0?`${euro.format(m.budgetVariance)} remaining`:`${euro.format(-m.budgetVariance)} over`,detail:"Forecast including contingency"},
    {label:"Staffing",tone:m.envelopeBreaches||m.personOverloads?"warn":"good",value:`${m.envelopeBreaches} role · ${m.personOverloads} person breaches`,detail:"Plan versus actual availability"},
    {label:"Task load",tone:m.overloadCells?"bad":"good",value:`${m.overloadCells} overloaded cells`,detail:"Task hours versus planned role capacity"},
    {label:"Scope",tone:m.unallocatedHours>.01?"warn":"good",value:`${num.format(m.unallocatedHours)} h unallocated`,detail:`${m.unallocatedTasks} incomplete task${m.unallocatedTasks===1?"":"s"}`},
    {label:"Commercial",tone:roleBudgetBreaches||m.marginPct<scenario.targetMarginPct/100?"warn":"good",value:`${roleBudgetBreaches} role budget breaches`,detail:`Margin ${pct(m.marginPct)} vs ${num.format(scenario.targetMarginPct)}% target`}
  ];
  $("#checks").innerHTML=`<section class="summary-group summary-check-group"><h3>Planning checks</h3><div>${checks.map(check=>`<div class="summary-check ${check.tone}"><i aria-hidden="true"></i><span><strong>${check.label}</strong><small>${check.detail}</small></span><b>${check.value}</b></div>`).join("")}</div></section>`;
}
export function renderSummaryVisibility() {
  const panel=$("#summary-panel"),toggle=$("#summary-toggle");panel.hidden=!stateRef.summaryExpanded;toggle.setAttribute("aria-expanded",String(stateRef.summaryExpanded));toggle.lastElementChild.textContent=stateRef.summaryExpanded?"⌃":"⌄";document.body.classList.toggle("summary-open",stateRef.summaryExpanded);
}
export function renderBacklog() {
  const scenario=activeScenario(),all=stateRef.state.project.tasks.filter(task=>remainingTaskHours(task,scenario)>.01),query=stateRef.taskFilter.trim().toLowerCase(),items=query?all.filter(task=>{const staff=taskStaff(task);return [task.title,staff.owner?.name,...staff.people.map(person=>person.name)].filter(Boolean).some(value=>value.toLowerCase().includes(query));}):all;
  $("#backlog-count").textContent=query?`${items.length}/${all.length}`:String(all.length);
  $("#backlog").innerHTML=items.length?items.map(task=>taskBacklogCard(task,scenario)).join(""):`<div class="empty">${all.length?"No tasks match this filter.":"All estimated work is allocated."}<br><small>${all.length?"Try title or owner.":"Edit a task or remove an allocation to reopen work."}</small></div>`;
}
function renderCell(role,it,scenario) {
  const p=rolePlan(role,it,scenario),e=roleEnvelope(role,it),load=cellLoad(role.id,it.id,scenario),actual=cellActualHours(role.id,it.id),over=load>p.hours+.01,staffOver=p.hours>e.hours+.01,allocs=cellAllocations(role.id,it.id,scenario),util=p.hours>0?load/p.hours:(load>0?Infinity:0);
  return `<div class="capacity-cell ${over?"overloaded":""} ${staffOver?"envelope-over":""}" data-role-id="${esc(role.id)}" data-iteration-id="${esc(it.id)}"><div class="cell-head"><div><div class="capacity-amount">${num.format(p.fte)} / ${num.format(e.fte)} FTE · ${num.format(p.pt)} PT</div><div class="capacity-detail">${num.format(p.hours)} h · ${e.source==="people"?"people-derived":"manual"} envelope</div><div class="capacity-detail">${euro.format(p.cost)} · ${euro.format(p.rate)}/PT</div></div><div class="cell-badges"><span class="util ${over?"over":""}">${Number.isFinite(util)?num.format(util*100):"∞"}%</span>${staffOver?`<span class="fte-badge">staffing gap</span>`:""}</div></div><div class="cell-meter"><span class="${over?"over":""}" style="width:${Math.min(100,Number.isFinite(util)?util*100:100)}%"></span></div><div class="capacity-detail">Tasks ${num.format(load)} h · actual ${num.format(actual)} h</div><div class="cell-tasks">${allocs.length?allocs.map(allocationCard).join(""):`<div class="cell-empty">${p.fte>0?"Drop remaining task work here":e.fte>0?"No planned FTE":"No available people"}</div>`}</div></div>`;
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
  renderScenarioSelect();renderProjectMeta();renderStorageStatus();renderKpis();renderChecks();renderSummaryVisibility();renderBacklog();renderTimeline();renderBaselineStrip();wireDrag();
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
