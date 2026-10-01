(() => {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "capacity-planner.prototype.v1";
  function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing prototype element: ${selector}`);
    return element;
  }
  const dialog = $<HTMLDialogElement>("#dialog");
  const notice = $<HTMLElement>("#notice");
  const importInput = $<HTMLInputElement>("#workspace-import");
  let noticeTimer = 0;
  let draggedTaskId = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);

  const euro = new Intl.NumberFormat("de-DE", { style:"currency", currency:"EUR", maximumFractionDigits:0 });
  const num = new Intl.NumberFormat("de-DE", { maximumFractionDigits:1 });

  function parseDate(value) {
    const [y,m,d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(Date.UTC(y,m-1,d));
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function dateText(value) {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(date) : "—";
  }

  function iso(date) {
    return date.toISOString().slice(0,10);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function inclusiveDays(start, end) {
    return Math.round((end - start) / 86400000) + 1;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  }

  function makeIterations(plan) {
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
      result.push({
        id: `it-${iso(cursor)}`,
        index,
        name: `Iteration ${index}`,
        start: iso(cursor),
        end: iso(end),
        weeks: inclusiveDays(cursor, end) / 7
      });
      cursor = addDays(end, 1);
      index += 1;
    }
    return result;
  }

  function baseState() {
    const plan = {
      id:"plan-demo",
      name:"Custom Order Platform",
      budget:280000,
      start:"2026-10-05",
      due:"2027-01-22",
      iterationWeeks:2,
      daysPerWeek:5,
      hoursPerDay:8,
      unitName:"SP",
      hoursPerUnit:6
    };
    const iterations = makeIterations(plan);
    const all = (value) => Object.fromEntries(iterations.map(it => [it.id,value]));
    const range = (values) => Object.fromEntries(iterations.map((it,i) => [it.id, values[i] ?? 0]));
    return {
      schema:"capacity-planner.workspace",
      version:VERSION,
      plan,
      roles:[
        {id:"role-dm",name:"Delivery Manager",dayRate:950,fteByIteration:all(.4)},
        {id:"role-ba",name:"Business Analyst",dayRate:850,fteByIteration:range([.8,.8,.8,.4,.4,0,0,0])},
        {id:"role-ux",name:"UX / UI",dayRate:800,fteByIteration:range([.7,.7,.7,.7,.3,.3,0,0])},
        {id:"role-dev",name:"Software Engineering",dayRate:900,fteByIteration:all(2)},
        {id:"role-qa",name:"QA Engineer",dayRate:780,fteByIteration:range([0,0,.4,.4,.8,.8,.8,.6])}
      ],
      tasks:[
        {id:"task-1",title:"Kick-off and delivery setup",units:5,roleId:"role-dm",iterationId:iterations[0]?.id ?? null},
        {id:"task-2",title:"Domain discovery and backlog",units:8,roleId:"role-ba",iterationId:iterations[0]?.id ?? null},
        {id:"task-3",title:"Experience map and key flows",units:8,roleId:"role-ux",iterationId:iterations[0]?.id ?? null},
        {id:"task-4",title:"Core order service",units:21,roleId:"role-dev",iterationId:iterations[1]?.id ?? null},
        {id:"task-5",title:"Pricing and validation rules",units:13,roleId:"role-dev",iterationId:iterations[2]?.id ?? null},
        {id:"task-6",title:"Order-management UI",units:13,roleId:"role-dev",iterationId:iterations[3]?.id ?? null},
        {id:"task-7",title:"Automation foundation",units:8,roleId:"role-qa",iterationId:iterations[3]?.id ?? null},
        {id:"task-8",title:"Release hardening",units:10,roleId:null,iterationId:null},
        {id:"task-9",title:"Operational handover",units:5,roleId:null,iterationId:null}
      ]
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validate(candidate: any) {
    if (!candidate || candidate.schema !== "capacity-planner.workspace" || candidate.version !== VERSION) return "Unsupported workspace schema or version.";
    if (!candidate.plan || typeof candidate.plan.name !== "string") return "Plan is missing.";
    const start = parseDate(candidate.plan.start), due = parseDate(candidate.plan.due);
    if (!start || !due || due < start) return "Plan dates are invalid.";
    for (const key of ["budget","iterationWeeks","daysPerWeek","hoursPerDay","hoursPerUnit"]) {
      const value = Number(candidate.plan[key]);
      if (!Number.isFinite(value) || value < 0) return `Plan value ${key} is invalid.`;
    }
    if (!Array.isArray(candidate.roles) || !Array.isArray(candidate.tasks)) return "Roles or tasks are missing.";
    const roleIds = new Set();
    for (const role of candidate.roles) {
      if (!role?.id || typeof role.name !== "string" || roleIds.has(role.id)) return "Role identity is invalid.";
      roleIds.add(role.id);
      if (!Number.isFinite(Number(role.dayRate)) || Number(role.dayRate) < 0) return `Day rate for ${role.name} is invalid.`;
      if (!role.fteByIteration || typeof role.fteByIteration !== "object") return `FTE plan for ${role.name} is invalid.`;
      for (const value of Object.values(role.fteByIteration)) {
        if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 20) return `FTE value for ${role.name} is invalid.`;
      }
    }
    const taskIds = new Set();
    for (const task of candidate.tasks) {
      if (!task?.id || typeof task.title !== "string" || taskIds.has(task.id)) return "Task identity is invalid.";
      taskIds.add(task.id);
      if (!Number.isFinite(Number(task.units)) || Number(task.units) < 0) return `Estimate for ${task.title} is invalid.`;
      if (task.roleId && !roleIds.has(task.roleId)) return `Task ${task.title} refers to a missing role.`;
    }
    return null;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return baseState();
      const candidate = JSON.parse(raw);
      return validate(candidate) ? baseState() : candidate;
    } catch {
      return baseState();
    }
  }

  let state: any = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#storage-pill").textContent = "Saved locally";
    } catch {
      $("#storage-pill").textContent = "In-memory only";
    }
  }

  function announce(message) {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.classList.add("show");
    noticeTimer = window.setTimeout(() => notice.classList.remove("show"), 2200);
  }

  function iterations() {
    return makeIterations(state.plan);
  }

  function capacityFor(role, iteration) {
    const fte = Number(role.fteByIteration?.[iteration.id] ?? 0);
    const pt = fte * iteration.weeks * Number(state.plan.daysPerWeek);
    const hours = pt * Number(state.plan.hoursPerDay);
    const cost = pt * Number(role.dayRate || 0);
    return {fte,pt,hours,cost};
  }

  function taskHours(task) {
    return Number(task.units || 0) * Number(state.plan.hoursPerUnit || 0);
  }

  function tasksFor(roleId, iterationId) {
    return state.tasks.filter(task => task.roleId === roleId && task.iterationId === iterationId);
  }

  function roleTotals(role) {
    return iterations().reduce((acc,it) => {
      const c = capacityFor(role,it);
      acc.pt += c.pt; acc.hours += c.hours; acc.cost += c.cost; acc.fte += c.fte;
      return acc;
    }, {pt:0,hours:0,cost:0,fte:0});
  }

  function planTotals() {
    const role = state.roles.reduce((acc,r) => {
      const t = roleTotals(r);
      acc.pt += t.pt; acc.hours += t.hours; acc.cost += t.cost;
      return acc;
    }, {pt:0,hours:0,cost:0});
    const scheduled = state.tasks.filter(t => t.roleId && t.iterationId).reduce((sum,t) => sum + taskHours(t),0);
    const backlog = state.tasks.filter(t => !t.roleId || !t.iterationId).reduce((sum,t) => sum + taskHours(t),0);
    return {...role,scheduled,backlog};
  }

  function taskCard(task, compact = false) {
    const assigned = task.roleId && task.iterationId;
    return `<article class="task-card" draggable="true" data-task-id="${esc(task.id)}" tabindex="0" aria-label="${esc(task.title)}, ${num.format(task.units)} ${esc(state.plan.unitName)}">
      <div class="task-title">${esc(task.title)}</div>
      <div class="task-meta">
        <span>${num.format(task.units)} ${esc(state.plan.unitName)}</span>
        <span>·</span><span>${num.format(taskHours(task))} h</span>
      </div>
      ${compact ? "" : `<div class="task-actions"><button type="button" data-action="assign-task" data-task-id="${esc(task.id)}">${assigned ? "Move" : "Assign"}</button>${assigned ? `<button type="button" data-action="unassign-task" data-task-id="${esc(task.id)}">Backlog</button>` : ""}<button type="button" data-action="delete-task" data-task-id="${esc(task.id)}">Delete</button></div>`}
    </article>`;
  }

  function renderKpis() {
    const totals = planTotals();
    const budget = Number(state.plan.budget);
    const remaining = budget - totals.cost;
    const use = budget > 0 ? totals.cost / budget : 0;
    const util = totals.hours > 0 ? totals.scheduled / totals.hours : 0;
    $("#kpis").innerHTML = `
      <div class="kpi"><div class="label">Budget</div><div class="value">${euro.format(budget)}</div><div class="sub">Commercial ceiling</div><div class="budget-track"><span class="${use>1?"over":""}" style="width:${Math.min(100,use*100)}%"></span></div></div>
      <div class="kpi"><div class="label">Planned role cost</div><div class="value">${euro.format(totals.cost)}</div><div class="sub">${num.format(use*100)}% of budget</div></div>
      <div class="kpi"><div class="label">Remaining</div><div class="value" style="color:${remaining<0?"var(--red)":"var(--green)"}">${euro.format(remaining)}</div><div class="sub">${remaining<0?"Plan exceeds budget":"Unplanned budget"}</div></div>
      <div class="kpi"><div class="label">Capacity</div><div class="value">${num.format(totals.pt)} PT</div><div class="sub">${num.format(totals.hours)} assigned hours</div></div>
      <div class="kpi"><div class="label">Scheduled load</div><div class="value">${num.format(totals.scheduled)} h</div><div class="sub">${num.format(util*100)}% of role capacity</div></div>
      <div class="kpi"><div class="label">Backlog load</div><div class="value">${num.format(totals.backlog)} h</div><div class="sub">${state.tasks.filter(t=>!t.roleId||!t.iterationId).length} unassigned tasks</div></div>`;
  }

  function renderBacklog() {
    const items = state.tasks.filter(task => !task.roleId || !task.iterationId);
    $("#backlog-count").textContent = String(items.length);
    $("#backlog").innerHTML = items.length ? items.map(task => taskCard(task)).join("") : `<div class="empty">All tasks are assigned.<br><small>Drag an assigned task back here to unassign it.</small></div>`;
  }

  function renderTimeline() {
    const its = iterations();
    const timeline = $("#timeline");
    timeline.style.setProperty("--iteration-count", String(Math.max(1,its.length)));
    const totalsByRole = state.roles.map(role => roleTotals(role));
    const maxHours = Math.max(1,...totalsByRole.map(t => t.hours));

    const head = `<div class="timeline-row timeline-head" style="--iteration-count:${Math.max(1,its.length)}">
      <div class="corner"><div><strong>Roles / swimlanes</strong><div class="capacity-detail">FTE → PT → hours</div></div></div>
      ${its.map(it => `<div class="iter-head"><strong>${esc(it.name)}</strong><span>${dateText(it.start)} – ${dateText(it.end)}</span><span>${num.format(it.weeks)} weeks</span></div>`).join("")}
    </div>`;

    const rows = state.roles.map((role,index) => {
      const totals = totalsByRole[index];
      const laneHeight = Math.round(112 + 105 * (totals.hours / maxHours));
      const avgFte = its.length ? totals.fte / its.length : 0;
      return `<div class="timeline-row role-row" style="--iteration-count:${Math.max(1,its.length)};--lane-height:${laneHeight}px">
        <div class="role-summary">
          <div class="role-name-line"><strong title="${esc(role.name)}">${esc(role.name)}</strong><button type="button" data-action="allocate-role" data-role-id="${esc(role.id)}">Plan FTE</button></div>
          <div class="capacity-detail">Avg ${num.format(avgFte)} FTE/week · ${euro.format(role.dayRate)}/PT</div>
          <div class="role-totals"><span><strong>${num.format(totals.pt)}</strong> PT</span><span><strong>${num.format(totals.hours)}</strong> h</span><span>${euro.format(totals.cost)}</span><span>${num.format(totals.hours/maxHours*100)}% scale</span></div>
          <div class="lane-scale" title="Relative total capacity"><span style="width:${Math.max(5,totals.hours/maxHours*100)}%"></span></div>
        </div>
        ${its.map(it => {
          const c = capacityFor(role,it);
          const cellTasks = tasksFor(role.id,it.id);
          const load = cellTasks.reduce((sum,t) => sum + taskHours(t),0);
          const util = c.hours > 0 ? load / c.hours : (load > 0 ? Infinity : 0);
          const over = load > c.hours + .001;
          return `<div class="capacity-cell ${over?"overloaded":""}" data-role-id="${esc(role.id)}" data-iteration-id="${esc(it.id)}">
            <div class="cell-head">
              <div><div class="capacity-amount">${num.format(c.fte)} FTE · ${num.format(c.pt)} PT</div><div class="capacity-detail">${num.format(c.hours)} h capacity</div></div>
              <span class="util ${over?"over":""}">${Number.isFinite(util)?num.format(util*100):"∞"}%</span>
            </div>
            <div class="cell-meter" aria-hidden="true"><span class="${over?"over":""}" style="width:${Math.min(100,Number.isFinite(util)?util*100:100)}%"></span></div>
            <div class="cell-tasks">${cellTasks.length ? cellTasks.map(t => taskCard(t,true)).join("") : `<div class="cell-empty">${c.fte>0?"Drop tasks here":"0 FTE — still droppable"}</div>`}</div>
          </div>`;
        }).join("")}
      </div>`;
    }).join("");

    timeline.innerHTML = head + (state.roles.length ? rows : `<div class="empty" style="margin:20px">Add a role to start capacity planning.</div>`);
  }

  function render() {
    reconcile(false);
    const its = iterations();
    $("#app-plan-title").textContent = state.plan.name;
    $("#plan-heading").textContent = state.plan.name;
    $("#date-pill").textContent = `${dateText(state.plan.start)} → ${dateText(state.plan.due)}`;
    $("#iteration-pill").textContent = `${its.length} iterations · ${num.format(state.plan.iterationWeeks)} week cadence`;
    $("#unit-pill").textContent = `1 ${state.plan.unitName} = ${num.format(state.plan.hoursPerUnit)} h`;
    renderKpis(); renderBacklog(); renderTimeline(); wireDrag();
  }

  function reconcile(withNotice = true) {
    const validIterations = new Set(iterations().map(it => it.id));
    let moved = 0;
    for (const role of state.roles) {
      role.fteByIteration = Object.fromEntries(Object.entries(role.fteByIteration || {}).filter(([id]) => validIterations.has(id)));
    }
    for (const task of state.tasks) {
      if (task.iterationId && !validIterations.has(task.iterationId)) {
        task.roleId = null; task.iterationId = null; moved += 1;
      }
      if (task.roleId && !state.roles.some(r => r.id === task.roleId)) {
        task.roleId = null; task.iterationId = null; moved += 1;
      }
    }
    if (moved && withNotice) announce(`${moved} task${moved===1?"":"s"} moved back to backlog after plan changes.`);
  }

  function wireDrag() {
    document.querySelectorAll<HTMLElement>(".task-card").forEach(card => {
      card.addEventListener("dragstart", event => {
        draggedTaskId = card.dataset.taskId;
        card.classList.add("dragging");
        event.dataTransfer?.setData("text/plain", draggedTaskId || "");
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => {
        draggedTaskId = null;
        card.classList.remove("dragging");
        document.querySelectorAll(".drop-active").forEach(el => el.classList.remove("drop-active"));
      });
    });
    document.querySelectorAll<HTMLElement>(".capacity-cell").forEach(cell => {
      cell.addEventListener("dragover", event => {
        event.preventDefault();
        cell.classList.add("drop-active");
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("drop-active"));
      cell.addEventListener("drop", event => {
        event.preventDefault();
        cell.classList.remove("drop-active");
        const id = event.dataTransfer?.getData("text/plain") || draggedTaskId;
        assignTask(id, cell.dataset.roleId, cell.dataset.iterationId);
      });
    });
    $("#backlog").addEventListener("dragover", event => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    $("#backlog").addEventListener("drop", event => {
      event.preventDefault();
      const id = event.dataTransfer?.getData("text/plain") || draggedTaskId;
      unassignTask(id);
    });
  }

  function assignTask(taskId, roleId, iterationId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !state.roles.some(r=>r.id===roleId) || !iterations().some(i=>i.id===iterationId)) return;
    task.roleId = roleId; task.iterationId = iterationId;
    save(); render(); announce(`${task.title} assigned.`);
  }

  function unassignTask(taskId) {
    const task = state.tasks.find(t=>t.id===taskId);
    if (!task) return;
    task.roleId = null; task.iterationId = null;
    save(); render(); announce(`${task.title} moved to backlog.`);
  }

  function openDialog(title, body, onSubmit, submitText = "Save") {
    dialog.innerHTML = `<form method="dialog" id="dialog-form">
      <div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button type="button" data-dialog-close aria-label="Close dialog">×</button></div>
      <div class="dialog-body">${body}</div>
      <div class="dialog-foot"><button type="button" data-dialog-close>Cancel</button><button class="primary" value="default" type="submit">${esc(submitText)}</button></div>
    </form>`;
    dialog.querySelectorAll("[data-dialog-close]").forEach(btn => btn.addEventListener("click",()=>dialog.close()));
    $("#dialog-form",dialog).addEventListener("submit", event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const ok = onSubmit(new FormData(form), form);
      if (ok !== false) dialog.close();
    });
    dialog.showModal();
    window.setTimeout(() => dialog.querySelector("input,select,button")?.focus(),0);
  }

  function planDialog(isNew) {
    const p = state.plan;
    openDialog(isNew ? "New resource plan" : "Plan settings", `
      <div class="form-grid">
        <label class="wide">Plan name<input name="name" required maxlength="80" value="${isNew?"New delivery plan":esc(p.name)}"></label>
        <label>Budget (€)<input name="budget" type="number" min="0" step="1000" required value="${isNew?"200000":esc(p.budget)}"></label>
        <label>Iteration length (weeks)<input name="iterationWeeks" type="number" min=".25" max="12" step=".25" required value="${isNew?"2":esc(p.iterationWeeks)}"></label>
        <label>Start<input name="start" type="date" required value="${isNew?"2026-10-05":esc(p.start)}"></label>
        <label>Due<input name="due" type="date" required value="${isNew?"2027-01-22":esc(p.due)}"></label>
        <label>Working days / FTE week<input name="daysPerWeek" type="number" min="1" max="7" step=".5" required value="${isNew?"5":esc(p.daysPerWeek)}"></label>
        <label>Hours / project day<input name="hoursPerDay" type="number" min=".25" max="24" step=".25" required value="${isNew?"8":esc(p.hoursPerDay)}"></label>
        <label>Task estimate unit name<input name="unitName" maxlength="12" required value="${isNew?"SP":esc(p.unitName)}"></label>
        <label>Hours / estimate unit<input name="hoursPerUnit" type="number" min="0" step=".25" required value="${isNew?"6":esc(p.hoursPerUnit)}"></label>
      </div>
      ${isNew ? `<div class="callout">Creating a new plan replaces the current in-browser workspace. Export first if you need the current state.</div>` : ""}
      <div class="formula">Prototype calculation: PT = FTE/week × iteration weeks × working days/week. Hours = PT × hours/day. Cost = PT × role day rate. Calendar holidays are not modeled.</div>
    `, data => {
      const candidate = {
        ...p,
        id:isNew?uid("plan"):p.id,
        name:String(data.get("name")||"").trim(),
        budget:Number(data.get("budget")),
        iterationWeeks:Number(data.get("iterationWeeks")),
        start:String(data.get("start")),
        due:String(data.get("due")),
        daysPerWeek:Number(data.get("daysPerWeek")),
        hoursPerDay:Number(data.get("hoursPerDay")),
        unitName:String(data.get("unitName")||"").trim(),
        hoursPerUnit:Number(data.get("hoursPerUnit"))
      };
      if (!candidate.name || !candidate.unitName || !parseDate(candidate.start) || !parseDate(candidate.due) || parseDate(candidate.due) < parseDate(candidate.start)) {
        announce("Enter a valid plan name, unit and date range."); return false;
      }
      if (isNew) state = {schema:"capacity-planner.workspace",version:VERSION,plan:candidate,roles:[],tasks:[]};
      else state.plan = candidate;
      reconcile(true); save(); render(); announce(isNew ? "New resource plan created." : "Plan settings updated.");
      return true;
    }, isNew ? "Create plan" : "Apply");
  }

  function roleDialog() {
    openDialog("Add role", `
      <div class="form-grid">
        <label class="wide">Role name<input name="name" required maxlength="60" placeholder="e.g. Software Engineer"></label>
        <label>Day rate (€ / PT)<input name="dayRate" type="number" min="0" step="10" required value="850"></label>
        <label>Initial FTE / week<input name="fte" type="number" min="0" max="20" step=".1" required value="1"></label>
      </div>
      <div class="formula">Initial FTE applies to all current iterations. Use “Plan FTE” on the role lane to change a range later.</div>
    `, data => {
      const name = String(data.get("name")||"").trim();
      const dayRate = Number(data.get("dayRate")), fte = Number(data.get("fte"));
      if (!name || !Number.isFinite(dayRate) || dayRate < 0 || !Number.isFinite(fte) || fte < 0 || fte > 20) { announce("Enter a valid role, day rate and FTE."); return false; }
      state.roles.push({id:uid("role"),name,dayRate,fteByIteration:Object.fromEntries(iterations().map(it=>[it.id,fte]))});
      save(); render(); announce(`${name} added.`);
      return true;
    }, "Add role");
  }

  function allocateDialog(roleId) {
    const role = state.roles.find(r=>r.id===roleId);
    const its = iterations();
    if (!role || !its.length) return;
    const options = its.map(it=>`<option value="${esc(it.id)}">${esc(it.name)} · ${dateText(it.start)}</option>`).join("");
    openDialog(`Plan FTE · ${role.name}`, `
      <div class="form-grid">
        <label>From iteration<select name="from">${options}</select></label>
        <label>Through iteration<select name="through">${options}</select></label>
        <label>FTE / week<input name="fte" type="number" min="0" max="20" step=".1" required value="${esc(role.fteByIteration[its[0].id] ?? 1)}"></label>
        <label>Day rate (€ / PT)<input name="dayRate" type="number" min="0" step="10" required value="${esc(role.dayRate)}"></label>
      </div>
      <div class="formula">The same FTE value is applied to every selected iteration. Set 0 FTE to clear capacity while retaining the role.</div>
    `, data => {
      const from = its.findIndex(it=>it.id===data.get("from"));
      const through = its.findIndex(it=>it.id===data.get("through"));
      const fte = Number(data.get("fte")), dayRate = Number(data.get("dayRate"));
      if (from < 0 || through < from || !Number.isFinite(fte) || fte < 0 || fte > 20 || !Number.isFinite(dayRate) || dayRate < 0) { announce("Choose a valid iteration range and FTE."); return false; }
      for (let i=from;i<=through;i++) role.fteByIteration[its[i].id] = fte;
      role.dayRate = dayRate;
      save(); render(); announce(`${role.name}: ${num.format(fte)} FTE applied to iterations ${from+1}–${through+1}.`);
      return true;
    }, "Apply range");
    const from = dialog.querySelector<HTMLSelectElement>('[name="from"]');
    const through = dialog.querySelector<HTMLSelectElement>('[name="through"]');
    if (through) through.selectedIndex = its.length - 1;
  }

  function taskDialog() {
    openDialog("Add task", `
      <div class="form-grid">
        <label class="wide">Task title<input name="title" required maxlength="100" placeholder="Outcome or deliverable"></label>
        <label>Estimate (${esc(state.plan.unitName)})<input name="units" type="number" min="0" step=".25" required value="5"></label>
      </div>
      <div class="formula">At the current conversion, 5 ${esc(state.plan.unitName)} = ${num.format(5*state.plan.hoursPerUnit)} h. The unit name and conversion are configurable in Plan settings.</div>
    `, data => {
      const title = String(data.get("title")||"").trim(), units = Number(data.get("units"));
      if (!title || !Number.isFinite(units) || units < 0) { announce("Enter a valid title and estimate."); return false; }
      state.tasks.push({id:uid("task"),title,units,roleId:null,iterationId:null});
      save(); render(); announce(`${title} added to backlog.`);
      return true;
    }, "Add task");
  }

  function assignmentDialog(taskId) {
    const task = state.tasks.find(t=>t.id===taskId);
    const its = iterations();
    if (!task || !state.roles.length || !its.length) { announce("Add at least one role and iteration first."); return; }
    const roleOptions = state.roles.map(role=>`<option value="${esc(role.id)}" ${task.roleId===role.id?"selected":""}>${esc(role.name)}</option>`).join("");
    const iterOptions = its.map(it=>`<option value="${esc(it.id)}" ${task.iterationId===it.id?"selected":""}>${esc(it.name)} · ${dateText(it.start)}</option>`).join("");
    openDialog(`Assign task · ${task.title}`, `
      <div class="form-grid">
        <label>Role<select name="roleId">${roleOptions}</select></label>
        <label>Iteration<select name="iterationId">${iterOptions}</select></label>
      </div>
      <div class="formula">${num.format(task.units)} ${esc(state.plan.unitName)} = ${num.format(taskHours(task))} h. Capacity warnings update after assignment.</div>
    `, data => {
      assignTask(task.id,String(data.get("roleId")),String(data.get("iterationId")));
      return true;
    }, "Assign");
  }

  function deleteTask(taskId) {
    const task = state.tasks.find(t=>t.id===taskId);
    if (!task) return;
    if (!window.confirm(`Delete task "${task.title}" from this prototype workspace?`)) return;
    state.tasks = state.tasks.filter(t=>t.id!==taskId);
    save(); render(); announce("Task deleted.");
  }

  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.plan.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "capacity-plan"}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
    announce("Workspace exported.");
  }

  async function importWorkspace(file) {
    try {
      const text = await file.text();
      const candidate = JSON.parse(text);
      const error = validate(candidate);
      if (error) { announce(error); return; }
      if (!window.confirm(`Replace the current workspace with "${candidate.plan.name}"?`)) return;
      state = clone(candidate);
      reconcile(true); save(); render(); announce("Workspace imported.");
    } catch {
      announce("Import failed. Choose a valid JSON workspace.");
    } finally {
      importInput.value = "";
    }
  }

  document.addEventListener("click", event => {
    const target = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "allocate-role") allocateDialog(target.dataset.roleId);
    if (action === "assign-task") assignmentDialog(target.dataset.taskId);
    if (action === "unassign-task") unassignTask(target.dataset.taskId);
    if (action === "delete-task") deleteTask(target.dataset.taskId);
  });

  $("#new-plan-btn").addEventListener("click",()=>planDialog(true));
  $("#edit-plan-btn").addEventListener("click",()=>planDialog(false));
  $("#add-role-btn").addEventListener("click",roleDialog);
  $("#add-task-btn").addEventListener("click",taskDialog);
  $("#sidebar-add-task").addEventListener("click",taskDialog);
  $("#export-btn").addEventListener("click",exportWorkspace);
  $("#import-btn").addEventListener("click",()=>importInput.click());
  importInput.addEventListener("change",()=>{ if(importInput.files?.[0]) importWorkspace(importInput.files[0]); });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dialog.open) dialog.close();
  });

  render();
  save();
})();