import { ensure, validDate, safeUrl, statuses, priorities, type Workspace, type Item, type Work, type Iteration } from './model.ts';

function object(value: unknown, keys: string[]): Map<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected a JSON object.');
  const props = new Map<string, unknown>(Object.entries(value));
  ensure([...props.keys()].every(key => keys.includes(key)), 'Unrecognized data field; this file may need a newer planner.');
  return props;
}
function text(value: unknown, max = 10000): string {
  ensure(typeof value === 'string' && value.length <= max, `Expected text up to ${max} characters.`);
  return value;
}
function title(value: unknown): string { const result = text(value, 180); ensure(result.trim(), 'A title is missing.'); return result; }
function id(value: unknown): string { const result = text(value, 80); ensure(/^[a-zA-Z0-9_-]+$/.test(result), 'Invalid identifier.'); return result; }
function optionalId(value: unknown): string | null { return value === null ? null : id(value); }
function number(value: unknown, max = 1000000): number {
  ensure(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max, 'Invalid non-negative number.'); return value;
}
function integer(value: unknown): number { const result = number(value); ensure(Number.isInteger(result), 'Expected a whole number.'); return result; }
function boolean(value: unknown): boolean { ensure(typeof value === 'boolean', 'Expected true or false.'); return value; }
function date(value: unknown): string { const result = text(value, 10); ensure(validDate(result), 'Invalid calendar date.'); return result; }
function oneOf<T extends string>(value: unknown, options: readonly T[]): T {
  const result = options.find(option => option === value); ensure(result !== undefined, 'Unknown state value.'); return result;
}
function array<T>(value: unknown, parse: (entry: unknown) => T, max = 5000): T[] {
  ensure(Array.isArray(value) && value.length <= max, `Expected a list of at most ${max} entries.`); return value.map(parse);
}
function unique(values: string[], label: string): void { ensure(new Set(values).size === values.length, `Duplicate ${label}.`); }
function parseItem(value: unknown): Item {
  const p = object(value, ['id','backlogId','title','description','type','priority','estimate','ownerId','status','archived']);
  return { id: id(p.get('id')), backlogId: id(p.get('backlogId')), title: title(p.get('title')),
    description: text(p.get('description')), type: title(p.get('type')), priority: oneOf(p.get('priority'), priorities),
    estimate: p.get('estimate') === null ? null : number(p.get('estimate'), 10000), ownerId: optionalId(p.get('ownerId')),
    status: oneOf(p.get('status'), statuses), archived: boolean(p.get('archived')) };
}
function parseWork(value: unknown): Work {
  const p = object(value, ['itemId','title','estimate','ownerId','status','note','nextAction','blocker','doneCheck','releaseNote','addedAt']);
  const work: Work = { itemId: id(p.get('itemId')), title: title(p.get('title')),
    estimate: p.get('estimate') === null ? null : number(p.get('estimate'), 10000), ownerId: optionalId(p.get('ownerId')),
    status: oneOf(p.get('status'), statuses), note: text(p.get('note')), nextAction: text(p.get('nextAction')),
    blocker: text(p.get('blocker')), doneCheck: boolean(p.get('doneCheck')), releaseNote: text(p.get('releaseNote')), addedAt: date(p.get('addedAt')) };
  ensure(work.status !== 'done' || (work.doneCheck && work.releaseNote.trim()), 'Done work needs a Definition of Done check and changelog entry.');
  ensure(work.status !== 'blocked' || work.blocker.trim(), 'Blocked work needs a reason.');
  return work;
}
function parseIteration(value: unknown): Iteration {
  const p = object(value, ['id','index','goal','description','start','end','stage','confidence','members','references','work','baseline','scopeChanges','daily','increment','retro']);
  const inc = object(p.get('increment'), ['id','summary','reviewNotes','goalOutcome','snapshot']);
  const snap = inc.get('snapshot') === null ? null : object(inc.get('snapshot'), ['date','delivered','unfinished']);
  const iteration: Iteration = {
    id: id(p.get('id')), index: integer(p.get('index')), goal: title(p.get('goal')), description: text(p.get('description')),
    start: date(p.get('start')), end: date(p.get('end')), stage: oneOf(p.get('stage'), ['planning','active','closed']),
    confidence: oneOf(p.get('confidence'), ['unknown','on-track','at-risk','off-track']),
    members: array(p.get('members'), entry => { const e = object(entry, ['resourceId','hours']); return {resourceId:id(e.get('resourceId')),hours:number(e.get('hours'),10000)}; }),
    references: array(p.get('references'), entry => {
      const e = object(entry, ['id','title','url']); const url = text(e.get('url'), 2000); ensure(safeUrl(url), 'References require a safe HTTP(S) URL.');
      return {id:id(e.get('id')),title:title(e.get('title')),url};
    }),
    work: array(p.get('work'), parseWork), baseline: p.get('baseline') === null ? null : array(p.get('baseline'), parseWork),
    scopeChanges: array(p.get('scopeChanges'), entry => { const e = object(entry, ['date','itemId','action','reason']);
      return {date:date(e.get('date')),itemId:id(e.get('itemId')),action:oneOf(e.get('action'), ['added','removed']),reason:title(e.get('reason'))}; }),
    daily: array(p.get('daily'), entry => { const e = object(entry, ['date','notes','finished','summary']);
      return { date:date(e.get('date')),finished:boolean(e.get('finished')),summary:text(e.get('summary')), notes:array(e.get('notes'), note => {
        const n = object(note, ['itemId','note','nextAction']); return {itemId:id(n.get('itemId')),note:text(n.get('note')),nextAction:text(n.get('nextAction'))}; }) }; }),
    increment: { id:id(inc.get('id')), summary:text(inc.get('summary')), reviewNotes:text(inc.get('reviewNotes')),
      goalOutcome:oneOf(inc.get('goalOutcome'), ['not-assessed','met','partly-met','not-met']),
      snapshot: snap ? {date:date(snap.get('date')),delivered:array(snap.get('delivered'),parseWork),unfinished:array(snap.get('unfinished'),parseWork)} : null },
    retro: array(p.get('retro'), entry => { const e = object(entry, ['id','category','text','ownerId','backlogItemId']);
      return {id:id(e.get('id')),category:oneOf(e.get('category'), ['keep','change','try']),text:title(e.get('text')),
        ownerId:optionalId(e.get('ownerId')),backlogItemId:optionalId(e.get('backlogItemId'))}; })
  };
  ensure(iteration.start <= iteration.end, 'End date must be on or after the start date.');
  ensure(new Date(iteration.end).getTime() - new Date(iteration.start).getTime() <= 366 * 86400000, 'An iteration cannot exceed 367 calendar days.');
  ensure((iteration.stage === 'closed') === Boolean(iteration.increment.snapshot), 'Only reviewed iterations have a frozen increment.');
  ensure(iteration.stage === 'planning' || iteration.baseline !== null, 'Started iterations need their planning baseline.');
  unique(iteration.work.map(work => work.itemId), 'iteration item');
  unique((iteration.baseline ?? []).map(work => work.itemId), 'baseline item');
  ensure(iteration.stage !== 'planning' || iteration.baseline === null, 'Draft planning cannot have an agreed baseline.');
  ensure(iteration.daily.every(day => day.date >= iteration.start && day.date <= iteration.end), 'A daily date must be inside its iteration.');
  ensure(iteration.work.every(work => work.status !== 'backlog'), 'Iteration work cannot have product-backlog status.');
  unique(iteration.members.map(member => member.resourceId), 'iteration member');
  unique(iteration.references.map(ref => ref.id), 'reference');
  unique(iteration.daily.map(daily => daily.date), 'daily date');
  unique(iteration.retro.map(retro => retro.id), 'retrospective note');
  for (const daily of iteration.daily) unique(daily.notes.map(note => note.itemId), 'daily item');
  if (iteration.increment.snapshot) {
    const snapshot = iteration.increment.snapshot;
    ensure(snapshot.delivered.every(work => work.status === 'done'), 'An increment can include only Done work.');
    ensure(snapshot.unfinished.every(work => work.status !== 'done'), 'Unfinished work cannot be Done.');
    const frozenWork = [...snapshot.delivered, ...snapshot.unfinished];
    unique(frozenWork.map(work => work.itemId), 'snapshot item');
    ensure(frozenWork.length === iteration.work.length && frozenWork.every(work => iteration.work.some(item => JSON.stringify(item) === JSON.stringify(work))), 'Frozen increment does not match the closed iteration.');
    ensure(iteration.increment.goalOutcome !== 'not-assessed' && iteration.increment.reviewNotes.trim(), 'Reviewed increments need an outcome and review notes.');
  }
  return iteration;
}
export function validateWorkspace(input: unknown): Workspace {
  const p = object(input, ['kind','schemaVersion','productName','clock','nextId','nextIteration','backlogs','items','resources','iterations']);
  ensure(p.get('kind') === 'iteration-planner.workspace' && p.get('schemaVersion') === 1,
    'This is not an iteration-planner workspace v1. Companion project exports use a different format.');
  const state: Workspace = {
    kind:'iteration-planner.workspace',schemaVersion:1,productName:title(p.get('productName')),clock:date(p.get('clock')),
    nextId:integer(p.get('nextId')),nextIteration:integer(p.get('nextIteration')),
    backlogs:array(p.get('backlogs'), entry => { const e = object(entry, ['id','title']); return {id:id(e.get('id')),title:title(e.get('title'))}; }),
    items:array(p.get('items'),parseItem),
    resources:array(p.get('resources'), entry => { const e = object(entry, ['id','name','role']); return {id:id(e.get('id')),name:title(e.get('name')),role:text(e.get('role'),180)}; }),
    iterations:array(p.get('iterations'),parseIteration,1000)
  };
  ensure(state.backlogs.length > 0, 'At least one backlog is required.');
  unique(state.backlogs.map(value => value.id), 'backlog'); unique(state.items.map(value => value.id), 'backlog item');
  unique(state.resources.map(value => value.id), 'person'); unique(state.iterations.map(value => value.id), 'iteration');
  unique(state.iterations.map(value => String(value.index)), 'iteration index');
  unique(state.iterations.map(value => value.increment.id), 'increment');
  ensure(state.nextIteration > Math.max(-1, ...state.iterations.map(value => value.index)), 'The next iteration index must exceed every existing index.');
  ensure(state.iterations.filter(value => value.stage === 'active').length <= 1, 'Only one iteration can be active per workspace.');
  const itemIds = new Set(state.items.map(item => item.id)); const resourceIds = new Set(state.resources.map(resource => resource.id));
  const openAssignments: string[] = [];
  for (const item of state.items) {
    ensure(state.backlogs.some(backlog => backlog.id === item.backlogId), 'An item refers to a missing backlog.');
    ensure(item.ownerId === null || resourceIds.has(item.ownerId), 'An item refers to a missing person.');
  }
  for (const iteration of state.iterations) {
    for (const work of [...iteration.work, ...(iteration.baseline ?? [])]) {
      ensure(itemIds.has(work.itemId), 'An iteration refers to a missing backlog item.');
      ensure(work.ownerId === null || resourceIds.has(work.ownerId), 'Work refers to a missing person.');
    }
    ensure(iteration.members.every(member => resourceIds.has(member.resourceId)), 'A capacity allocation refers to a missing person.');
    ensure(iteration.scopeChanges.every(change => itemIds.has(change.itemId)), 'A scope change refers to a missing item.');
    ensure(iteration.daily.every(daily => daily.notes.every(note => itemIds.has(note.itemId))), 'A daily note refers to a missing item.');
    for (const note of iteration.retro) {
      ensure(note.ownerId === null || resourceIds.has(note.ownerId), 'A retrospective note refers to a missing person.');
      ensure(note.backlogItemId === null || itemIds.has(note.backlogItemId), 'A retrospective action refers to a missing item.');
    }
    if (iteration.stage !== 'closed') {
      for (const work of iteration.work) {
        const item = state.items.find(value => value.id === work.itemId);
        ensure(item && !item.archived, 'Archived items cannot remain in an open iteration.');
        ensure(item.status === work.status, 'Live work and backlog status disagree.');
        openAssignments.push(work.itemId);
      }
    }
  }
  unique(openAssignments, 'open iteration assignment');
  return state;
}
