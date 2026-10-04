import {
  clone, ensure, required, getIteration, getItem, assignment,
  type Workspace, type Work, type Iteration, type Status, type Priority, type Confidence,
  type Outcome, type RetroCategory
} from './model.ts';
import { validateWorkspace } from './validation.ts';

export interface ItemDraft {
  title: string; description: string; type: string; priority: Priority;
  estimate: number | null; ownerId: string | null; backlogId: string;
}
export type Command =
  | { type: 'createBacklog'; title: string }
  | { type: 'renameBacklog'; id: string; title: string }
  | { type: 'saveItem'; id: string | null; draft: ItemDraft }
  | { type: 'archiveItem'; id: string; archived: boolean }
  | { type: 'moveItem'; id: string; direction: number }
  | { type: 'saveIteration'; id: string | null; goal: string; description: string; start: string; end: string }
  | { type: 'addItems'; iterationId: string; itemIds: string[]; reason: string }
  | { type: 'removeWork'; iterationId: string; itemId: string; reason: string }
  | { type: 'startIteration'; iterationId: string }
  | { type: 'updateWork'; iterationId: string; itemId: string; status: Status; note: string;
      nextAction: string; blocker: string; doneCheck: boolean; releaseNote: string; ownerId: string | null; daily: boolean }
  | { type: 'finishDaily'; iterationId: string; summary: string }
  | { type: 'setConfidence'; iterationId: string; confidence: Confidence }
  | { type: 'saveReview' | 'closeIteration'; iterationId: string; summary: string; reviewNotes: string; goalOutcome: Outcome }
  | { type: 'saveResource'; id: string | null; name: string; role: string }
  | { type: 'allocateResource'; iterationId: string; resourceId: string; hours: number }
  | { type: 'removeAllocation'; iterationId: string; resourceId: string }
  | { type: 'addReference'; iterationId: string; title: string; url: string }
  | { type: 'removeReference'; iterationId: string; id: string }
  | { type: 'addRetro'; iterationId: string; category: RetroCategory; text: string; ownerId: string | null }
  | { type: 'retroToBacklog'; iterationId: string; noteId: string; backlogId: string }
  | { type: 'deleteRetro'; iterationId: string; noteId: string }
  | { type: 'renameProduct'; title: string }
  | { type: 'setClock'; date: string };

function uid(state: Workspace, prefix: string): string {
  const all = JSON.stringify(state);
  let candidate: string;
  do { candidate = `${prefix}-${state.nextId++}`; } while (all.includes(`"${candidate}"`));
  return candidate;
}
function editable(iteration: Iteration): void { ensure(iteration.stage !== 'closed', 'This increment is frozen. Create a new backlog item for further work.'); }
function active(iteration: Iteration): void { ensure(iteration.stage === 'active', 'Start this iteration before recording delivery progress.'); }
function changeReason(iteration: Iteration, reason: string): string {
  return iteration.stage === 'active' ? required(reason, 'Scope-change reason') : '';
}
function newWork(state: Workspace, itemId: string): Work {
  const item = getItem(state, itemId);
  return { itemId, title:item.title, estimate:item.estimate, ownerId:item.ownerId,
    status:item.status === 'backlog' ? 'ready' : item.status, note:'', nextAction:'', blocker:'',
    doneCheck:false, releaseNote:'', addedAt:state.clock };
}
export function execute(input: Workspace, command: Command): Workspace {
  const state = clone(input);
  switch (command.type) {
    case 'createBacklog': state.backlogs.push({id:uid(state,'backlog'),title:required(command.title)}); break;
    case 'renameBacklog': {
      const backlog = state.backlogs.find(value => value.id === command.id);
      ensure(backlog, 'Backlog not found.'); backlog.title = required(command.title); break;
    }
    case 'saveItem': {
      const draft = { ...command.draft, title:required(command.draft.title), type:required(command.draft.type || 'Item', 'Type') };
      if (command.id) {
        Object.assign(getItem(state, command.id), draft);
        for (const iteration of state.iterations.filter(value => value.stage === 'planning')) {
          const work = iteration.work.find(value => value.itemId === command.id);
          if (work) Object.assign(work, {title:draft.title,estimate:draft.estimate,ownerId:draft.ownerId});
        }
      }
      else state.items.push({...draft,id:uid(state,'item'),status:'backlog',archived:false});
      break;
    }
    case 'archiveItem': {
      ensure(!assignment(state, command.id), 'Remove this item from its open iteration before archiving it.');
      getItem(state, command.id).archived = command.archived; break;
    }
    case 'moveItem': {
      const item = getItem(state, command.id);
      const indexes = state.items.map((value,index) => ({value,index})).filter(entry => entry.value.backlogId === item.backlogId);
      const current = indexes.findIndex(entry => entry.value.id === item.id);
      const target = current + Math.sign(command.direction);
      if (target >= 0 && target < indexes.length) {
        const a = indexes[current].index; const b = indexes[target].index;
        [state.items[a],state.items[b]] = [state.items[b],state.items[a]];
      }
      break;
    }
    case 'saveIteration': {
      if (command.id) {
        const iteration = getIteration(state, command.id);
        ensure(iteration.stage === 'planning', 'The goal and dates are frozen when planning is agreed.');
        Object.assign(iteration, {goal:required(command.goal,'Goal'),description:command.description,start:command.start,end:command.end});
      } else {
        state.iterations.push({id:uid(state,'iteration'),index:state.nextIteration++,goal:required(command.goal,'Goal'),
          description:command.description,start:command.start,end:command.end,stage:'planning',confidence:'unknown',
          members:[],references:[],work:[],baseline:null,scopeChanges:[],daily:[],retro:[],
          increment:{id:uid(state,'increment'),summary:'',reviewNotes:'',goalOutcome:'not-assessed',snapshot:null}});
      }
      break;
    }
    case 'addItems': {
      const iteration = getIteration(state, command.iterationId); editable(iteration);
      const reason = changeReason(iteration, command.reason);
      ensure(command.itemIds.length > 0, 'Select at least one backlog item.');
      ensure(new Set(command.itemIds).size === command.itemIds.length, 'An item was selected more than once.');
      for (const itemId of command.itemIds) {
        const item = getItem(state,itemId);
        ensure(!item.archived && item.status !== 'done', 'Archived or delivered items cannot be planned again.');
        ensure(!assignment(state,itemId), 'One of these items already belongs to an open iteration.');
        const work = newWork(state,itemId);
        if (work.status === 'blocked') { work.blocker = 'Carried blocker — clarify in the next daily.'; }
        iteration.work.push(work); item.status = work.status;
        const today = iteration.daily.find(day => day.date === state.clock);
        if (today) today.finished = false;
        if (iteration.stage === 'active') iteration.scopeChanges.push({date:state.clock,itemId,action:'added',reason});
      }
      break;
    }
    case 'removeWork': {
      const iteration = getIteration(state, command.iterationId); editable(iteration);
      const reason = changeReason(iteration, command.reason);
      const work = iteration.work.find(value => value.itemId === command.itemId);
      ensure(work && work.status !== 'done', 'Delivered work cannot be silently removed. Reopen it explicitly first.');
      iteration.work = iteration.work.filter(value => value.itemId !== command.itemId);
      if (iteration.stage === 'active') iteration.scopeChanges.push({date:state.clock,itemId:command.itemId,action:'removed',reason});
      break;
    }
    case 'startIteration': {
      const iteration = getIteration(state,command.iterationId);
      ensure(iteration.stage === 'planning', 'Only a planned iteration can be started.');
      ensure(!state.iterations.some(value => value.stage === 'active'), 'Review and close the active iteration first.');
      ensure(iteration.work.length > 0, 'Choose at least one backlog item before agreeing the plan.');
      iteration.baseline = clone(iteration.work); iteration.stage = 'active'; break;
    }
    case 'updateWork': {
      const iteration = getIteration(state,command.iterationId); active(iteration);
      const work = iteration.work.find(value => value.itemId === command.itemId); ensure(work, 'Work item not found.');
      ensure(command.status !== 'backlog', 'Iteration work must be Ready, In progress, Blocked or Done.');
      ensure(command.status !== 'done' || (command.doneCheck && command.releaseNote.trim()), 'To mark Done, confirm the Definition of Done and write what was delivered.');
      ensure(command.status !== 'blocked' || command.blocker.trim(), 'Describe the blocker before saving.');
      Object.assign(work, {status:command.status,note:command.note,nextAction:command.nextAction,blocker:command.blocker,
        doneCheck:command.status === 'done' && command.doneCheck,releaseNote:command.releaseNote,ownerId:command.ownerId});
      Object.assign(getItem(state,command.itemId),{status:command.status,ownerId:command.ownerId});
      if (command.daily) {
        ensure(state.clock >= iteration.start && state.clock <= iteration.end, 'Set the demo date inside this iteration to record a daily.');
        let daily = iteration.daily.find(value => value.date === state.clock);
        if (!daily) { daily = {date:state.clock,notes:[],finished:false,summary:''}; iteration.daily.push(daily); }
        const note = {itemId:command.itemId,note:command.note,nextAction:command.nextAction};
        daily.notes = [...daily.notes.filter(value => value.itemId !== command.itemId),note]; daily.finished = false;
      }
      break;
    }
    case 'finishDaily': {
      const iteration = getIteration(state,command.iterationId); active(iteration);
      const daily = iteration.daily.find(value => value.date === state.clock);
      ensure(daily && iteration.work.every(work => daily.notes.some(note => note.itemId === work.itemId)), 'Walk every current iteration item before finishing the daily.');
      daily.summary = command.summary; daily.finished = true; break;
    }
    case 'setConfidence': {
      const iteration = getIteration(state,command.iterationId); editable(iteration); iteration.confidence = command.confidence; break;
    }
    case 'saveReview':
    case 'closeIteration': {
      const iteration = getIteration(state,command.iterationId); active(iteration);
      Object.assign(iteration.increment,{summary:command.summary,reviewNotes:command.reviewNotes,goalOutcome:command.goalOutcome});
      if (command.type === 'closeIteration') {
        ensure(command.goalOutcome !== 'not-assessed', 'Record whether the goal was achieved.');
        ensure(command.reviewNotes.trim(), 'Record a review observation before closing.');
        iteration.increment.snapshot = {date:state.clock,delivered:clone(iteration.work.filter(work => work.status === 'done')),
          unfinished:clone(iteration.work.filter(work => work.status !== 'done'))};
        iteration.stage = 'closed';
      }
      break;
    }
    case 'saveResource': {
      const fields = {name:required(command.name,'Name'),role:command.role};
      if (command.id) { const person = state.resources.find(value => value.id === command.id); ensure(person,'Person not found.'); Object.assign(person,fields); }
      else state.resources.push({id:uid(state,'person'),...fields}); break;
    }
    case 'allocateResource': {
      const iteration = getIteration(state,command.iterationId); editable(iteration);
      iteration.members = [...iteration.members.filter(member => member.resourceId !== command.resourceId),{resourceId:command.resourceId,hours:command.hours}]; break;
    }
    case 'removeAllocation': {
      const iteration = getIteration(state,command.iterationId); editable(iteration);
      iteration.members = iteration.members.filter(member => member.resourceId !== command.resourceId); break;
    }
    case 'addReference': {
      const iteration = getIteration(state,command.iterationId); editable(iteration);
      iteration.references.push({id:uid(state,'ref'),title:required(command.title),url:command.url.trim()}); break;
    }
    case 'removeReference': {
      const iteration = getIteration(state,command.iterationId); editable(iteration);
      iteration.references = iteration.references.filter(ref => ref.id !== command.id); break;
    }
    case 'addRetro': {
      const iteration = getIteration(state,command.iterationId);
      iteration.retro.push({id:uid(state,'retro'),category:command.category,text:required(command.text,'Retrospective note'),ownerId:command.ownerId,backlogItemId:null}); break;
    }
    case 'retroToBacklog': {
      const iteration = getIteration(state,command.iterationId);
      const note = iteration.retro.find(value => value.id === command.noteId); ensure(note && !note.backlogItemId,'This action was already added to the backlog.');
      const itemId = uid(state,'item');
      state.items.push({id:itemId,backlogId:command.backlogId,title:note.text,description:`Retrospective action from iteration ${iteration.index}: ${iteration.goal}`,
        type:'Improvement',priority:'medium',estimate:null,ownerId:note.ownerId,status:'backlog',archived:false});
      note.backlogItemId = itemId; break;
    }
    case 'deleteRetro': {
      const iteration = getIteration(state,command.iterationId);
      const note = iteration.retro.find(value => value.id === command.noteId);
      ensure(note && !note.backlogItemId,'Linked actions are retained for traceability.');
      iteration.retro = iteration.retro.filter(value => value.id !== command.noteId); break;
    }
    case 'renameProduct': state.productName = required(command.title,'Product name'); break;
    case 'setClock': state.clock = command.date; break;
    default: throw new Error('Unknown planner command.');
  }
  return validateWorkspace(state);
}
