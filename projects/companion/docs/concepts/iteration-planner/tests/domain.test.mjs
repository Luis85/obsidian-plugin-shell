import test from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../source/commands.ts';
import { emptyWorkspace, demoWorkspace } from '../source/fixtures.ts';
import { validateWorkspace } from '../source/validation.ts';
import { getIteration, getItem, summary, assignment, nameOf, clone, validDate, workingDays, mondayOnOrAfter, safeUrl, exportChangelog } from '../source/model.ts';
import { esc } from '../source/ui.ts';
const activeId = 'iteration-2';
const active = state => getIteration(state,activeId);
const draft = overrides => ({title:'Useful work',description:'',type:'Item',priority:'medium',estimate:null,ownerId:null,backlogId:'product',...overrides});
const newIteration = overrides => ({type:'saveIteration',id:null,goal:'A useful outcome',description:'',start:'2026-10-05',end:'2026-10-09',...overrides});
function progress(state,itemId,overrides={}) {
  const work = active(state).work.find(value=>value.itemId===itemId);
  return execute(state,{type:'updateWork',iterationId:activeId,itemId,status:work.status,note:work.note,nextAction:work.nextAction,blocker:work.blocker,doneCheck:work.doneCheck,releaseNote:work.releaseNote,ownerId:work.ownerId,daily:false,...overrides});
}
function close(state=demoWorkspace(),overrides={}) {
  return execute(state,{type:'closeIteration',iterationId:activeId,summary:'Useful progress',reviewNotes:'Two useful pieces; continue the smaller remaining slices.',goalOutcome:'partly-met',...overrides});
}
function rejectsWithoutMutation(state,command,pattern) {
  const bytes=JSON.stringify(state); assert.throws(()=>execute(state,command),pattern); assert.equal(JSON.stringify(state),bytes);
}
function importFails(change,pattern) { const state=demoWorkspace();change(state);assert.throws(()=>validateWorkspace(state),pattern); }

test('D01 synthetic workspace validates and current metrics describe real work',()=>{
  const state=demoWorkspace();assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(state))),state);
  const data=summary(active(state));assert.equal(data.done,2);assert.equal(data.total,6);assert.equal(data.percent,33);assert.equal(data.blocked,1);assert.equal(data.estimate,45);assert.equal(data.capacity,72);
});
test('D02 title-only item defaults and arbitrary custom types work',()=>{
  let state=execute(emptyWorkspace(),{type:'saveItem',id:null,draft:draft({title:'  Customer interview  ',type:'Research spike'})});
  assert.equal(state.items[0].title,'Customer interview');assert.equal(state.items[0].type,'Research spike');assert.equal(state.items[0].estimate,null);assert.equal(state.items[0].status,'backlog');
  rejectsWithoutMutation(state,{type:'saveItem',id:null,draft:draft({title:'  '})},/must contain/);
});
test('D03 multiple arbitrary backlogs, renaming and moving items preserve identities',()=>{
  let state=execute(emptyWorkspace(),{type:'createBacklog',title:'Operations'});const id=state.backlogs[1].id;
  state=execute(state,{type:'saveItem',id:null,draft:draft({backlogId:id})});const item=state.items[0];
  state=execute(state,{type:'renameBacklog',id,title:'Service operations'});
  state=execute(state,{type:'saveItem',id:item.id,draft:draft({backlogId:'product',title:'Renamed'})});
  assert.equal(state.items[0].id,item.id);assert.equal(state.items[0].backlogId,'product');assert.equal(state.backlogs[1].title,'Service operations');
});
test('D04 reorder is scoped to the selected backlog and safely bounded',()=>{
  let state=demoWorkspace();const before=state.items.filter(x=>x.backlogId==='product').map(x=>x.id);
  state=execute(state,{type:'moveItem',id:'item-1',direction:-1});assert.deepEqual(state.items.filter(x=>x.backlogId==='product').map(x=>x.id),before);
  state=execute(state,{type:'moveItem',id:'item-7',direction:1});assert.equal(state.items.findIndex(x=>x.id==='item-7'),7);assert.equal(state.items.findIndex(x=>x.id==='item-9'),8);
});
test('D05 auto indexing starts at zero and crosses ten without collision',()=>{
  let state=emptyWorkspace();for(let n=0;n<13;n++)state=execute(state,newIteration({goal:`Outcome ${n}`}));
  assert.deepEqual(state.iterations.map(x=>x.index),Array.from({length:13},(_,i)=>i));assert.equal(state.nextIteration,13);
  assert.equal(nameOf(state.iterations[12]),'Iteration — Outcome 12 — 12');assert.equal(new Set(state.iterations.map(x=>x.increment.id)).size,13);
});
test('D06 editing a draft retains index and its single increment identity',()=>{
  let state=execute(emptyWorkspace(),newIteration());const first=clone(state.iterations[0]);
  state=execute(state,newIteration({id:first.id,goal:'A clearer goal',description:'Detail',end:'2026-10-16'}));
  assert.equal(state.nextIteration,1);assert.equal(state.iterations[0].increment.id,first.increment.id);assert.equal(state.iterations[0].description,'Detail');
});
test('D07 invalid date ranges, impossible dates and excessively long windows fail atomically',()=>{
  const state=emptyWorkspace();
  for(const dates of [{start:'2026-10-10',end:'2026-10-01'},{start:'2026-02-30',end:'2026-03-06'},{start:'2026-10-01',end:'2028-10-01'}])rejectsWithoutMutation(state,newIteration(dates),/date|days/i);
});
test('D08 numeric and reference errors cannot partially add an item',()=>{
  for(const overrides of [{estimate:-1},{estimate:Infinity},{estimate:NaN},{backlogId:'missing'},{ownerId:'missing'}])rejectsWithoutMutation(demoWorkspace(),{type:'saveItem',id:null,draft:draft(overrides)},/number|backlog|person/i);
});
test('D09 UTC date helpers have deterministic inclusive weekday semantics',()=>{
  assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);
  assert.deepEqual(workingDays('2026-09-28','2026-10-02'),['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02']);
  assert.equal(mondayOnOrAfter('2026-10-03'),'2026-10-05');assert.equal(mondayOnOrAfter('2026-10-05'),'2026-10-05');
});
test('D10 empty or concurrent iterations cannot start',()=>{
  let state=execute(demoWorkspace(),newIteration());const id=state.iterations.at(-1).id;
  rejectsWithoutMutation(state,{type:'startIteration',iterationId:id},/active iteration/);
  const blank=execute(emptyWorkspace(),newIteration());rejectsWithoutMutation(blank,{type:'startIteration',iterationId:blank.iterations[0].id},/at least one/);
});
test('D11 planned work follows draft edits before the agreement is frozen',()=>{
  let state=execute(emptyWorkspace(),newIteration());state=execute(state,{type:'saveItem',id:null,draft:draft()});const itemId=state.items[0].id,iterationId=state.iterations[0].id;
  state=execute(state,{type:'addItems',iterationId,itemIds:[itemId],reason:''});
  state=execute(state,{type:'saveItem',id:itemId,draft:draft({title:'Refined title',estimate:8})});assert.equal(state.iterations[0].work[0].title,'Refined title');
  state=execute(state,{type:'startIteration',iterationId});assert.deepEqual(state.iterations[0].baseline,state.iterations[0].work);
  state=execute(state,{type:'saveItem',id:itemId,draft:draft({title:'Later canonical title',estimate:13})});assert.equal(state.iterations[0].baseline[0].title,'Refined title');assert.equal(state.iterations[0].work[0].estimate,8);
});
test('D12 work cannot be assigned twice, archived while assigned, or replan delivered',()=>{
  const state=demoWorkspace();
  rejectsWithoutMutation(state,{type:'addItems',iterationId:activeId,itemIds:['item-3'],reason:'Reason'},/already/);
  rejectsWithoutMutation(state,{type:'addItems',iterationId:activeId,itemIds:['item-1'],reason:'Reason'},/delivered/);
  rejectsWithoutMutation(state,{type:'addItems',iterationId:activeId,itemIds:['item-7','item-7'],reason:'Reason'},/more than once/);
  rejectsWithoutMutation(state,{type:'archiveItem',id:'item-3',archived:true},/open iteration/);
});
test('D13 scope changes require reasons and do not rewrite the agreed baseline',()=>{
  let state=demoWorkspace();const baseline=clone(active(state).baseline);
  rejectsWithoutMutation(state,{type:'addItems',iterationId:activeId,itemIds:['item-7'],reason:''},/reason/);
  state=execute(state,{type:'addItems',iterationId:activeId,itemIds:['item-7'],reason:'Accessible navigation is essential'});
  state=execute(state,{type:'removeWork',iterationId:activeId,itemId:'item-6',reason:'Defer documentation until the interaction settles'});
  assert.deepEqual(active(state).baseline,baseline);assert.deepEqual(active(state).scopeChanges.map(x=>x.action),['added','removed']);assert.equal(assignment(state,'item-6'),undefined);
});
test('D14 multi-item planning is atomic if a later selected item is invalid',()=>{
  const state=demoWorkspace();rejectsWithoutMutation(state,{type:'addItems',iterationId:activeId,itemIds:['item-7','missing'],reason:'A real reason'},/no longer exists/);assert.equal(assignment(state,'item-7'),undefined);
});
test('D15 Done requires explicit quality confirmation and a nonblank delivery note',()=>{
  const state=demoWorkspace();assert.throws(()=>progress(state,'item-3',{status:'done',doneCheck:false,releaseNote:'Delivered'}),/Definition of Done/);
  assert.throws(()=>progress(state,'item-3',{status:'done',doneCheck:true,releaseNote:' '}),/Definition of Done/);
  const after=progress(state,'item-3',{status:'done',doneCheck:true,releaseNote:'Layouts can be rearranged.'});assert.equal(summary(active(after)).done,3);assert.equal(getItem(after,'item-3').status,'done');assert.equal(summary(active(state)).done,2);
});
test('D16 reopening Done reduces delivered count without losing its draft note',()=>{
  const state=progress(demoWorkspace(),'item-1',{status:'doing'});assert.equal(summary(active(state)).done,1);assert.equal(active(state).work[0].doneCheck,false);assert.match(active(state).work[0].releaseNote,/Pages/);
  assert.throws(()=>progress(state,'item-1',{status:'blocked',blocker:''}),/blocker/);
});
test('D17 owner changes synchronize the live backlog but not the baseline',()=>{
  const before=demoWorkspace();const state=progress(before,'item-3',{ownerId:'jonas'});assert.equal(getItem(state,'item-3').ownerId,'jonas');assert.equal(active(state).baseline[2].ownerId,'maya');
});
test('D18 daily requires every current item, including delivered ones',()=>{
  let state=demoWorkspace();rejectsWithoutMutation(state,{type:'finishDaily',iterationId:activeId,summary:'Skipped'},/every/);
  for(const work of active(state).work)state=progress(state,work.itemId,{daily:true,note:`Discussed ${work.title}`,nextAction:'Smallest next step'});
  state=execute(state,{type:'finishDaily',iterationId:activeId,summary:'Unblock the import policy together.'});const day=active(state).daily.find(x=>x.date===state.clock);
  assert.equal(day.notes.length,6);assert.equal(day.finished,true);assert.match(day.summary,/import policy/);
});
test('D19 saving a daily twice upserts a single note and reopens that daily',()=>{
  let state=demoWorkspace();for(const work of active(state).work)state=progress(state,work.itemId,{daily:true});
  state=execute(state,{type:'finishDaily',iterationId:activeId,summary:'Completed'});state=progress(state,'item-3',{daily:true,note:'A corrected observation'});
  const day=active(state).daily.find(x=>x.date===state.clock);assert.equal(day.finished,false);assert.equal(day.notes.length,6);assert.equal(day.notes.find(x=>x.itemId==='item-3').note,'A corrected observation');
});
test('D20 scope added after a daily invalidates current-day completion',()=>{
  let state=demoWorkspace();for(const work of active(state).work)state=progress(state,work.itemId,{daily:true});state=execute(state,{type:'finishDaily',iterationId:activeId,summary:'Completed'});
  state=execute(state,{type:'addItems',iterationId:activeId,itemIds:['item-7'],reason:'New essential slice'});assert.equal(active(state).daily.find(x=>x.date===state.clock).finished,false);
  rejectsWithoutMutation(state,{type:'finishDaily',iterationId:activeId,summary:'Not yet'},/every/);
});
test('D21 out-of-window daily rejects all progress changes atomically',()=>{
  const state=execute(demoWorkspace(),{type:'setClock',date:'2026-10-05'});const before=JSON.stringify(state);
  assert.throws(()=>progress(state,'item-3',{daily:true,status:'done',doneCheck:true,releaseNote:'A change'}),/inside this iteration/);assert.equal(JSON.stringify(state),before);
});
test('D22 closing freezes one increment, returns unfinished work, and never auto-delivers',()=>{
  const before=demoWorkspace();const id=active(before).increment.id;const state=close(before);const iteration=active(state);
  assert.equal(iteration.stage,'closed');assert.equal(iteration.increment.id,id);assert.equal(iteration.increment.snapshot.delivered.length,2);assert.equal(iteration.increment.snapshot.unfinished.length,4);assert.equal(assignment(state,'item-3'),undefined);assert.equal(getItem(state,'item-3').status,'doing');
  assert.throws(()=>close(state),/Start this iteration/);assert.throws(()=>progress(state,'item-3',{status:'done',doneCheck:true,releaseNote:'x'}),/Start this iteration/);
});
test('D23 review needs goal assessment and observations, not a synthetic success flag',()=>{
  assert.throws(()=>close(demoWorkspace(),{goalOutcome:'not-assessed'}),/goal/);assert.throws(()=>close(demoWorkspace(),{reviewNotes:' '}),/observation/);
  const state=execute(demoWorkspace(),{type:'saveReview',iterationId:activeId,summary:'Draft',reviewNotes:'',goalOutcome:'not-assessed'});assert.equal(active(state).stage,'active');assert.equal(active(state).increment.snapshot,null);
});
test('D24 zero-delivery review is honest and still creates only one report',()=>{
  let state=progress(demoWorkspace(),'item-1',{status:'doing'});state=progress(state,'item-2',{status:'doing'});state=close(state,{goalOutcome:'not-met'});
  assert.equal(summary(active(state)).percent,0);assert.equal(active(state).increment.snapshot.delivered.length,0);assert.equal(active(state).increment.snapshot.unfinished.length,6);assert.match(exportChangelog(active(state)),/No completed work/);
});
test('D25 frozen snapshots survive canonical edits and explicit future planning',()=>{
  let state=close();const snapshot=JSON.stringify(active(state).increment.snapshot);
  state=execute(state,{type:'saveItem',id:'item-3',draft:draft({title:'A smaller follow-up',estimate:3,ownerId:'alex'})});state=execute(state,newIteration());const next=state.iterations.at(-1).id;
  state=execute(state,{type:'addItems',iterationId:next,itemIds:['item-3','item-4'],reason:''});state=execute(state,{type:'startIteration',iterationId:next});
  assert.equal(JSON.stringify(active(state).increment.snapshot),snapshot);assert.equal(getIteration(state,next).work[0].title,'A smaller follow-up');assert.equal(getIteration(state,next).work[1].status,'blocked');assert.match(getIteration(state,next).work[1].blocker,/Carried/);
});
test('D26 delivered work cannot be silently removed from live or frozen reports',()=>{
  rejectsWithoutMutation(demoWorkspace(),{type:'removeWork',iterationId:activeId,itemId:'item-1',reason:'Rewrite history'},/Delivered/);
  rejectsWithoutMutation(close(),{type:'removeWork',iterationId:activeId,itemId:'item-3',reason:'Rewrite history'},/frozen/);
});
test('D27 retro promotion creates one owned, traceable backlog improvement',()=>{
  let state=close();state=execute(state,{type:'addRetro',iterationId:activeId,category:'try',text:'Review risks earlier',ownerId:'maya'});const note=active(state).retro.at(-1);
  state=execute(state,{type:'retroToBacklog',iterationId:activeId,noteId:note.id,backlogId:'improvements'});const linked=active(state).retro.at(-1).backlogItemId;const item=getItem(state,linked);
  assert.equal(item.type,'Improvement');assert.equal(item.ownerId,'maya');assert.equal(item.backlogId,'improvements');assert.match(item.description,/iteration 2/);
  rejectsWithoutMutation(state,{type:'retroToBacklog',iterationId:activeId,noteId:note.id,backlogId:'product'},/already/);
  rejectsWithoutMutation(state,{type:'deleteRetro',iterationId:activeId,noteId:note.id},/traceability/);
});
test('D28 people and optional capacity are real editable resources',()=>{
  let state=execute(demoWorkspace(),{type:'saveResource',id:null,name:'Sam Taylor',role:'QA'});const id=state.resources.at(-1).id;
  state=execute(state,{type:'allocateResource',iterationId:activeId,resourceId:id,hours:12});assert.equal(summary(active(state)).capacity,84);
  state=execute(state,{type:'allocateResource',iterationId:activeId,resourceId:id,hours:6});assert.equal(summary(active(state)).capacity,78);
  state=execute(state,{type:'removeAllocation',iterationId:activeId,resourceId:id});assert.equal(summary(active(state)).capacity,72);
  rejectsWithoutMutation(state,{type:'allocateResource',iterationId:activeId,resourceId:id,hours:-5},/number/i);
});
test('D29 references allow explicit safe links but reject executable or credential URLs',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,<script>','file:///tmp/example','https://user:password@example.org'])assert.equal(safeUrl(url),false);
  assert.equal(safeUrl('https://example.org/brief'),true);const state=demoWorkspace();
  rejectsWithoutMutation(state,{type:'addReference',iterationId:activeId,title:'Bad',url:'javascript:alert(1)'},/safe HTTP/);
  const good=execute(state,{type:'addReference',iterationId:activeId,title:'Brief',url:'https://example.org/brief'});assert.equal(active(good).references.at(-1).title,'Brief');
});
test('D30 zero capacity, unknown estimates and empty draft show no false completion',()=>{
  const blank=execute(emptyWorkspace(),newIteration());assert.equal(summary(blank.iterations[0]).percent,0);assert.equal(summary(blank.iterations[0]).capacity,0);
  let state=execute(blank,{type:'saveItem',id:null,draft:draft()});state=execute(state,{type:'addItems',iterationId:state.iterations[0].id,itemIds:[state.items[0].id],reason:''});assert.equal(summary(state.iterations[0]).unestimated,1);
});
test('D31 import rejects schema confusion, extra keys, prototype pollution and wrong types',()=>{
  importFails(s=>s.kind='companion.project',/not an iteration/);importFails(s=>s.schemaVersion=2,/not an iteration/);
  importFails(s=>s.extra='hidden',/Unrecognized/);assert.throws(()=>validateWorkspace(JSON.parse('{"__proto__":{"polluted":true}}')),/Unrecognized/);assert.equal({}.polluted,undefined);
  importFails(s=>s.items[0].estimate='8',/number/i);importFails(s=>s.resources[0].name='',/missing/i);
});
test('D32 import rejects duplicate identities and counters that could reuse an index',()=>{
  importFails(s=>s.items.push(clone(s.items[0])),/Duplicate/);importFails(s=>s.iterations[1].index=s.iterations[0].index,/Duplicate/);importFails(s=>s.nextIteration=2,/exceed/);
  importFails(s=>s.iterations[2].baseline.push(clone(s.iterations[2].baseline[0])),/Duplicate/);
});
test('D33 import rejects dangling references and contradictory live states',()=>{
  importFails(s=>s.items[2].status='done',/disagree/);importFails(s=>s.iterations[2].work[0].ownerId='missing',/person/);
  importFails(s=>s.iterations[2].members[0].resourceId='missing',/person/);importFails(s=>s.iterations[2].daily[0].date='2026-01-01',/inside/);
});
test('D34 tampering with a frozen snapshot fails validation',()=>{
  const state=close();state.iterations[2].increment.snapshot.delivered[0].releaseNote='Tampered';assert.throws(()=>validateWorkspace(state),/does not match/);
  importFails(s=>s.iterations[0].increment.snapshot.delivered[0].status='doing',/only Done/);
});
test('D35 imported lower ID counters cannot collide with existing identities',()=>{
  let state=demoWorkspace();state.nextId=1;state=execute(state,{type:'saveItem',id:null,draft:draft()});assert.equal(new Set(state.items.map(x=>x.id)).size,state.items.length);assert.equal(state.items.at(-1).id,'item-13');
});
test('D36 archived items are recoverable; historical evidence is not deleted',()=>{
  let state=execute(demoWorkspace(),{type:'archiveItem',id:'item-7',archived:true});assert.equal(getItem(state,'item-7').archived,true);
  state=execute(state,{type:'archiveItem',id:'item-7',archived:false});assert.equal(getItem(state,'item-7').archived,false);
  const frozen=close(state);assert.equal(frozen.iterations[0].work.length,1);
});
test('D37 all template data is escaped; malicious text remains literal text',()=>{
  assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  const state=execute(emptyWorkspace(),{type:'saveItem',id:null,draft:draft({title:'<script>alert(1)</script>'})});assert.equal(state.items[0].title,'<script>alert(1)</script>');
});
test('D38 serialized closed history round trips without replacing actual progress',()=>{
  const state=close();const roundTrip=validateWorkspace(JSON.parse(JSON.stringify(state)));assert.deepEqual(roundTrip,state);
  const changelog=exportChangelog(active(roundTrip));assert.match(changelog,/Pages can now/);assert.match(changelog,/Not delivered/);assert.match(changelog,/not a release/);
});
