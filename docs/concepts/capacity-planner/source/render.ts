import {$,announce,capacityFor,dateText,esc,euro,iterationTotals,iterations,num,planTotals,reconcile,renderStorageStatus,roleTotals,save,stateRef,taskHours,tasksFor} from "./core.ts";

function taskCard(task,compact=false) {
  const assigned=task.roleId&&task.iterationId,label=`${task.title}, ${num.format(task.units)} ${stateRef.state.plan.unitName}, ${num.format(taskHours(task))} hours${assigned?", assigned":", unassigned"}`;
  const actions=compact
    ? `<div class="task-actions compact-actions"><button type="button" data-action="assign-task" data-task-id="${esc(task.id)}">Move</button><button type="button" data-action="edit-task" data-task-id="${esc(task.id)}">Edit</button><button type="button" data-action="unassign-task" data-task-id="${esc(task.id)}">Backlog</button></div>`
    : `<div class="task-actions"><button type="button" data-action="assign-task" data-task-id="${esc(task.id)}">${assigned?"Move":"Assign"}</button><button type="button" data-action="edit-task" data-task-id="${esc(task.id)}">Edit</button>${assigned?`<button type="button" data-action="unassign-task" data-task-id="${esc(task.id)}">Backlog</button>`:""}<button type="button" data-action="delete-task" data-task-id="${esc(task.id)}">Delete</button></div>`;
  return `<article class="task-card" draggable="true" data-task-id="${esc(task.id)}" tabindex="0" aria-label="${esc(label)}" aria-keyshortcuts="Enter Space" title="Drag to move, or press Enter for assignment"><div class="task-title">${esc(task.title)}</div><div class="task-meta"><span>${num.format(task.units)} ${esc(stateRef.state.plan.unitName)}</span><span>·</span><span>${num.format(taskHours(task))} h</span></div>${actions}</article>`;
}

function renderKpis() {
  const totals=planTotals(),budget=Number(stateRef.state.plan.budget),remaining=budget-totals.cost,use=budget>0?totals.cost/budget:(totals.cost>0?Infinity:0),util=totals.hours>0?totals.scheduled/totals.hours:0;
  $("#kpis").innerHTML=`
    <div class="kpi"><div class="label">Budget</div><div class="value">${euro.format(budget)}</div><div class="sub">Resource-plan ceiling</div><div class="budget-track"><span class="${use>1?"over":""}" style="width:${Math.min(100,Number.isFinite(use)?use*100:100)}%"></span></div></div>
    <div class="kpi"><div class="label">Planned role cost</div><div class="value">${euro.format(totals.cost)}</div><div class="sub">${Number.isFinite(use)?num.format(use*100):"∞"}% of budget</div></div>
    <div class="kpi"><div class="label">Remaining</div><div class="value ${remaining<0?"negative":"positive"}">${euro.format(remaining)}</div><div class="sub">${remaining<0?"Plan exceeds budget":"Unallocated budget"}</div></div>
    <div class="kpi"><div class="label">Planned capacity</div><div class="value">${num.format(totals.pt)} PT</div><div class="sub">${num.format(totals.hours)} capacity hours</div></div>
    <div class="kpi"><div class="label">Scheduled load</div><div class="value">${num.format(totals.scheduled)} h</div><div class="sub">${num.format(util*100)}% of planned capacity</div></div>
    <div class="kpi"><div class="label">Unassigned load</div><div class="value">${num.format(totals.backlog)} h</div><div class="sub">${totals.backlogCount} backlog task${totals.backlogCount===1?"":"s"}</div></div>`;
}

function renderChecks() {
  const totals=planTotals(),budget=Number(stateRef.state.plan.budget),remaining=budget-totals.cost;
  const cards=[
    {label:"Budget",tone:remaining<0?"bad":budget===0?"warn":"good",value:remaining<0?`${euro.format(Math.abs(remaining))} over`:budget===0?"No budget set":`${euro.format(remaining)} free`,detail:remaining<0?"Reduce planned FTE or rates, or revise the budget.":"Planned role cost versus resource budget."},
    {label:"FTE envelope",tone:totals.envelopeBreaches?"warn":"good",value:totals.envelopeBreaches?`${totals.envelopeBreaches} breach${totals.envelopeBreaches===1?"":"es"}`:"Within limits",detail:totals.envelopeBreaches?"Planned FTE exceeds the role's envelope in one or more iterations.":"All role allocations fit their FTE envelope."},
    {label:"Task load",tone:totals.overloadCells?"bad":"good",value:totals.overloadCells?`${totals.overloadCells} overloaded cell${totals.overloadCells===1?"":"s"}`:"Within capacity",detail:totals.overloadCells?"Estimated task hours exceed planned role capacity.":"Assigned task load fits planned role capacity."},
    {label:"Backlog",tone:totals.backlogCount?"warn":"good",value:totals.backlogCount?`${totals.backlogCount} unassigned`:"Fully scheduled",detail:totals.backlogCount?`${num.format(totals.backlog)} h still needs a role and iteration.`:"Every task has a role and iteration."}
  ];
  $("#checks").innerHTML=`<div class="checks-title"><strong>Planning checks</strong><span>Explicit conditions, not a health score</span></div>${cards.map(card=>`<div class="check-card ${card.tone}"><div class="check-label">${card.label}</div><strong>${card.value}</strong><span>${card.detail}</span></div>`).join("")}`;
}

export function renderBacklog() {
  const all=stateRef.state.tasks.filter(task=>!task.roleId||!task.iterationId),query=stateRef.taskFilter.trim().toLowerCase(),items=query?all.filter(task=>task.title.toLowerCase().includes(query)):all;
  $("#backlog-count").textContent=query?`${items.length}/${all.length}`:String(all.length);
  $("#backlog").innerHTML=items.length?items.map(task=>taskCard(task)).join(""):`<div class="empty">${all.length?"No tasks match this filter.":"All tasks are assigned."}<br><small>${all.length?"Try another search.":"Assigned tasks can be moved back here."}</small></div>`;
}

function renderTimeline() {
  const its=iterations(),timeline=$("#timeline"),totalsByRole=stateRef.state.roles.map(role=>roleTotals(role)),maxHours=Math.max(1,...totalsByRole.map(t=>t.hours));
  timeline.style.setProperty("--iteration-count",String(Math.max(1,its.length)));
  const head=`<div class="timeline-row timeline-head" style="--iteration-count:${Math.max(1,its.length)}"><div class="corner"><div><strong>Roles / swimlanes</strong><div class="capacity-detail">Planned FTE → PT → hours → cost</div></div></div>${its.map(it=>`<div class="iter-head"><strong>${esc(it.name)}</strong><span>${dateText(it.start)} – ${dateText(it.end)}</span><span>${num.format(it.weeks)} weeks</span></div>`).join("")}</div>`;
  const summary=`<div class="timeline-row iteration-summary-row" style="--iteration-count:${Math.max(1,its.length)}"><div class="iteration-summary-label"><strong>Iteration totals</strong><span>All roles · planned / envelope</span></div>${its.map(it=>{const t=iterationTotals(it),util=t.hours>0?t.load/t.hours:(t.load>0?Infinity:0),hasIssue=t.envelopeBreaches||t.overloadCells;return `<div class="iteration-total ${hasIssue?"has-issue":""}" aria-label="${esc(it.name)} totals"><strong>${num.format(t.plannedFte)} / ${num.format(t.availableFte)} FTE</strong><span>${num.format(t.pt)} PT · ${num.format(t.hours)} h</span><span>${euro.format(t.cost)}</span><span class="${t.overloadCells?"bad-text":""}">${num.format(t.load)} h tasks · ${Number.isFinite(util)?num.format(util*100):"∞"}%</span>${t.envelopeBreaches?`<em>${t.envelopeBreaches} FTE envelope breach${t.envelopeBreaches===1?"":"es"}</em>`:""}</div>`;}).join("")}</div>`;
  const rows=stateRef.state.roles.map((role,index)=>{
    const totals=totalsByRole[index],laneHeight=Math.round(126+94*(totals.hours/maxHours)),avgFte=totals.weeks>0?totals.fteWeeks/totals.weeks:0;
    return `<div class="timeline-row role-row" style="--iteration-count:${Math.max(1,its.length)};--lane-height:${laneHeight}px"><div class="role-summary"><div class="role-name-line"><strong title="${esc(role.name)}">${esc(role.name)}</strong><div class="role-actions"><button type="button" data-action="allocate-role" data-role-id="${esc(role.id)}">Plan FTE</button><button type="button" data-action="role-settings" data-role-id="${esc(role.id)}" aria-label="Edit ${esc(role.name)}">Edit</button></div></div><div class="capacity-detail">Avg ${num.format(avgFte)} planned · ${num.format(role.availableFte)} FTE envelope/week</div><div class="capacity-detail">${euro.format(role.dayRate)}/PT${totals.envelopeBreaches?` · <span class="warn-text">${totals.envelopeBreaches} envelope breach${totals.envelopeBreaches===1?"":"es"}</span>`:""}</div><div class="role-totals"><span><strong>${num.format(totals.pt)}</strong> PT</span><span><strong>${num.format(totals.hours)}</strong> h</span><span>${euro.format(totals.cost)}</span><span>Peak ${num.format(totals.peakFte)} FTE</span></div><div class="lane-scale" title="Relative total planned capacity"><span style="width:${Math.max(5,totals.hours/maxHours*100)}%"></span></div></div>${its.map(it=>renderCell(role,it)).join("")}</div>`;
  }).join("");
  timeline.innerHTML=head+summary+(stateRef.state.roles.length?rows:`<div class="empty board-empty">Add a role to start capacity planning.</div>`);
}

function renderCell(role,it) {
  const c=capacityFor(role,it),cellTasks=tasksFor(role.id,it.id),load=cellTasks.reduce((sum,t)=>sum+taskHours(t),0),util=c.hours>0?load/c.hours:(load>0?Infinity:0),over=load>c.hours+.001,envelopeOver=c.fte>Number(role.availableFte||0)+.001;
  const aria=`${role.name}, ${it.name}: ${num.format(c.fte)} planned FTE of ${num.format(role.availableFte)} envelope, ${num.format(c.pt)} PT, ${num.format(c.hours)} capacity hours, ${num.format(load)} task hours`;
  return `<div class="capacity-cell ${over?"overloaded":""} ${envelopeOver?"envelope-over":""}" data-role-id="${esc(role.id)}" data-iteration-id="${esc(it.id)}" role="group" aria-label="${esc(aria)}"><div class="cell-head"><div><div class="capacity-amount">${num.format(c.fte)} / ${num.format(role.availableFte)} FTE · ${num.format(c.pt)} PT</div><div class="capacity-detail">${num.format(c.hours)} h · ${euro.format(c.cost)}</div></div><div class="cell-badges"><span class="util ${over?"over":""}">${Number.isFinite(util)?num.format(util*100):"∞"}%</span>${envelopeOver?`<span class="fte-badge">FTE over</span>`:""}</div></div><div class="cell-meter" aria-hidden="true"><span class="${over?"over":""}" style="width:${Math.min(100,Number.isFinite(util)?util*100:100)}%"></span></div><div class="cell-tasks">${cellTasks.length?cellTasks.map(t=>taskCard(t,true)).join(""):`<div class="cell-empty">${c.fte>0?"Drop tasks here":role.availableFte>0?"No planned FTE":"No FTE envelope"}</div>`}</div></div>`;
}

export function render() {
  reconcile(false);
  const its=iterations();
  $("#app-plan-title").textContent=stateRef.state.plan.name;$("#plan-heading").textContent=stateRef.state.plan.name;
  $("#date-pill").textContent=`${dateText(stateRef.state.plan.start)} → ${dateText(stateRef.state.plan.due)}`;
  $("#iteration-pill").textContent=`${its.length} iterations · ${num.format(stateRef.state.plan.iterationWeeks)} week cadence`;
  $("#unit-pill").textContent=`1 ${stateRef.state.plan.unitName} = ${num.format(stateRef.state.plan.hoursPerUnit)} h`;
  renderStorageStatus();renderKpis();renderChecks();renderBacklog();renderTimeline();wireDrag();
}

export function wireTaskCards(root=document) {
  root.querySelectorAll(".task-card").forEach(card=>{
    card.addEventListener("dragstart",event=>{stateRef.draggedTaskId=card.dataset.taskId;card.classList.add("dragging");event.dataTransfer?.setData("text/plain",stateRef.draggedTaskId||"");if(event.dataTransfer)event.dataTransfer.effectAllowed="move";});
    card.addEventListener("dragend",()=>{stateRef.draggedTaskId=null;card.classList.remove("dragging");document.querySelectorAll(".drop-active").forEach(el=>el.classList.remove("drop-active"));});
  });
}
function wireDrag() {
  wireTaskCards(document);
  document.querySelectorAll(".capacity-cell").forEach(cell=>{
    cell.addEventListener("dragover",event=>{event.preventDefault();cell.classList.add("drop-active");if(event.dataTransfer)event.dataTransfer.dropEffect="move";});
    cell.addEventListener("dragleave",()=>cell.classList.remove("drop-active"));
    cell.addEventListener("drop",event=>{event.preventDefault();cell.classList.remove("drop-active");assignTask(event.dataTransfer?.getData("text/plain")||stateRef.draggedTaskId,cell.dataset.roleId,cell.dataset.iterationId);});
  });
  $("#backlog").addEventListener("dragover",event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="move";});
  $("#backlog").addEventListener("drop",event=>{event.preventDefault();unassignTask(event.dataTransfer?.getData("text/plain")||stateRef.draggedTaskId);});
}
export function assignTask(taskId,roleId,iterationId) {
  const task=stateRef.state.tasks.find(t=>t.id===taskId);
  if(!task||!stateRef.state.roles.some(r=>r.id===roleId)||!iterations().some(i=>i.id===iterationId))return;
  task.roleId=roleId;task.iterationId=iterationId;save();render();announce(`${task.title} assigned.`);
}
export function unassignTask(taskId) {
  const task=stateRef.state.tasks.find(t=>t.id===taskId);if(!task)return;
  task.roleId=null;task.iterationId=null;save();render();announce(`${task.title} moved to backlog.`);
}
