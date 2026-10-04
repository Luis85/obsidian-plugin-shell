import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginJourneyDraft, editJourneyDraft, finishJourneyDraft, journeyStepTransitions } from '../../scripts/companion/sitemap/journey-draft.ts';
import { applySitemapCommand, planSurfaceRemoval } from '../../scripts/companion/sitemap/commands.ts';
import { inspectSitemap } from '../../scripts/companion/sitemap/validate.ts';
import { planSitemapChange, applySitemapChange, travelSitemapHistory } from '../../scripts/companion/sitemap/transaction.ts';
function fixture() {
  return {
    nodes: [{ id: 'root', kind: 'view', label: 'Workspace', parent: null },
      ...['home','list','detail'].map(id => ({ id, kind: 'page', label: id, parent: 'root' })),
      { id: 'dialog', kind: 'modal', label: 'Confirmation', parent: null },
      { id: 'group', kind: 'group', label: 'Group', parent: null }],
    links: [
      { id: 'browse', from: 'home', to: 'list', kind: 'navigate', label: 'Browse' },
      { id: 'search', from: 'home', to: 'list', kind: 'navigate', label: 'Search' },
      { id: 'read', from: 'list', to: 'detail', kind: 'navigate', label: 'Read' },
      { id: 'confirm', from: 'detail', to: 'dialog', kind: 'open', label: 'Confirm' },
      { id: 'return', from: 'dialog', to: 'detail', kind: 'navigate', label: 'Return' },
      { id: 'condition', from: 'home', to: 'detail', kind: 'conditional', label: 'When selected' },
      { id: 'data', from: 'home', to: 'list', kind: 'data', label: 'Data only' },
    ],
    canvas: { positions: {home:{x:12,y:34}} },
    visualDesigns: { revisions: [{id:'published',text:'Keep exact bytes'}] },
    sitemap: { schema: 1, routes: [{ id:'list-route',surface:'list',path:'/list/:id' }], journeys: [{
      id: 'journey-1', name: 'Read a record', steps: [
        { id: 'step-5', surface: 'home', via: null },
        { id: 'step-7', surface: 'list', via: 'search' },
        { id: 'read-step', surface: 'detail', via: 'read' },
      ],
    }] },
  };
}
const append = (d, draft, surface) => editJourneyDraft(d, draft, {type:'append',surface});
const fails = (fn, code) => assert.throws(fn, error => error.code === code);
test('opening a journey detaches exact steps and retains the selected branch rather than choosing the first action', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1');
  assert.deepEqual(draft.journey,d.sitemap.journeys[0]);assert.equal(draft.nextStep,8);
  draft.journey.steps[1].via='browse';assert.equal(d.sitemap.journeys[0].steps[1].via,'search');
  fails(()=>beginJourneyDraft(d,'missing'),'SITEMAP_REFERENCE');
});
test('new journeys allocate distinct IDs and never invent a first matching branch', () => {
  const d=fixture(), original=structuredClone(d);
  let draft=append(d,beginJourneyDraft(d),'home');draft=append(d,draft,'list');
  assert.equal(draft.journey.id,'journey-2');assert.equal(draft.journey.steps[1].via,null);
  assert.deepEqual(journeyStepTransitions(d,draft.journey.steps,1).map(edge=>edge.id),['browse','search']);
  draft=editJourneyDraft(d,draft,{type:'transition',step:'step-2',via:'search'});
  const journey=finishJourneyDraft(d,draft,'Search records'), next=applySitemapCommand(d,{type:'journey',journey});
  assert.equal(next.sitemap.journeys[1].steps[1].via,'search');assert.deepEqual(d,original);
  assert.deepEqual(next.nodes,d.nodes);assert.deepEqual(next.links,d.links);assert.deepEqual(next.sitemap.routes,d.sitemap.routes);
  assert.deepEqual(next.visualDesigns,d.visualDesigns);assert.deepEqual(next.canvas,d.canvas);
});
test('a unique normal action may prefill; a condition remains a deliberate planning-only selection', () => {
  const d=fixture();let draft=append(d,beginJourneyDraft(d),'list');draft=append(d,draft,'detail');
  assert.equal(draft.journey.steps[1].via,'read');
  draft=append(d,append(d,beginJourneyDraft(d),'home'),'detail');assert.equal(draft.journey.steps[1].via,null);
  draft=editJourneyDraft(d,draft,{type:'transition',step:'step-2',via:'condition'});
  const next=applySitemapCommand(d,{type:'journey',journey:finishJourneyDraft(d,draft,'Conditional intent')});
  assert.ok(inspectSitemap(next).some(f=>f.code==='JOURNEY_CONDITION_UNIMPLEMENTED'));
});
test('incoming actions must match direction, endpoints and supported kinds', () => {
  const d=fixture(), draft=append(d,append(d,beginJourneyDraft(d),'home'),'list');
  for(const via of ['read','data','missing','return']) fails(()=>editJourneyDraft(d,draft,{type:'transition',step:'step-2',via}),'SITEMAP_JOURNEY');
  fails(()=>editJourneyDraft(d,draft,{type:'transition',step:'step-1',via:'browse'}),'SITEMAP_JOURNEY');
});
test('reordering keeps stable identities and clears invalid adjacency without substituting a branch', () => {
  const d=fixture(), original=beginJourneyDraft(d,'journey-1');
  const moved=editJourneyDraft(d,original,{type:'move',step:'step-7',offset:1});
  assert.deepEqual(moved.journey.steps.map(step=>step.id),['step-5','read-step','step-7']);
  assert.deepEqual(moved.journey.steps.map(step=>step.via),[null,null,null]);
  assert.equal(original.journey.steps[1].via,'search');
  fails(()=>editJourneyDraft(d,original,{type:'move',step:'step-5',offset:-1}),'SITEMAP_ORDER');
});
test('removing a step retains all surviving IDs and never reuses a removed allocation within the draft', () => {
  const d=fixture();let draft=append(d,beginJourneyDraft(d,'journey-1'),'dialog');
  assert.equal(draft.journey.steps.at(-1).id,'step-8');
  draft=editJourneyDraft(d,draft,{type:'remove',step:'step-8'});draft=append(d,draft,'dialog');
  assert.equal(draft.journey.steps.at(-1).id,'step-9');
  draft=editJourneyDraft(d,draft,{type:'remove',step:'step-7'});
  assert.deepEqual(draft.journey.steps.map(step=>step.id),['step-5','read-step','step-9']);
  assert.equal(draft.journey.steps[1].via,null);assert.equal(draft.journey.steps[2].via,'confirm');
});
test('repeated surfaces and modal returns retain separate step identities', () => {
  const d=fixture();let draft=beginJourneyDraft(d);
  for(const surface of ['detail','dialog','detail'])draft=append(d,draft,surface);
  assert.deepEqual(draft.journey.steps.map(step=>step.via),[null,'confirm','return']);
  assert.equal(new Set(draft.journey.steps.map(step=>step.id)).size,3);
  assert.doesNotThrow(()=>finishJourneyDraft(d,draft,'Review then return'));
});
test('renaming and exact replay update one journey and retain original step identities', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1');
  assert.equal(applySitemapCommand(d,{type:'journey',journey:finishJourneyDraft(d,draft,draft.journey.name)}),d);
  const next=applySitemapCommand(d,{type:'journey',journey:finishJourneyDraft(d,draft,'Renamed journey')});
  assert.equal(next.sitemap.journeys.length,1);assert.deepEqual(next.sitemap.journeys[0].steps,d.sitemap.journeys[0].steps);
});
test('retained unresolved history stays exact until a deliberate surface repair', () => {
  let d=fixture();d=applySitemapCommand(d,{type:'remove',surface:'list',review:planSurfaceRemoval(d,'list').review});
  const draft=beginJourneyDraft(d,'journey-1');assert.equal(draft.journey.steps[1].unresolved,true);
  assert.deepEqual(finishJourneyDraft(d,draft,'Unresolved').steps,d.sitemap.journeys[0].steps);
  const repaired=editJourneyDraft(d,draft,{type:'surface',step:'step-7',surface:'home'});
  assert.deepEqual(repaired.journey.steps[1],{id:'step-7',surface:'home',via:null});
  assert.equal(repaired.journey.steps[2].unresolved,true,'repair does not silently fix another retained reference');
});
test('selecting an unchanged resolved surface preserves the exact incoming action', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1');
  assert.deepEqual(editJourneyDraft(d,draft,{type:'surface',step:'step-7',surface:'list'}),draft);
});
test('changing a surface clears affected transitions but retains IDs', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1');
  const changed=editJourneyDraft(d,draft,{type:'surface',step:'step-7',surface:'dialog'});
  assert.equal(changed.journey.steps[1].via,null);assert.equal(changed.journey.steps[2].via,null);
  assert.deepEqual(changed.journey.steps.map(step=>step.id),draft.journey.steps.map(step=>step.id));
});
test('draft edits reject unknown fields, unsafe accessors and missing or structural targets without mutation', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1'), before=structuredClone(draft);
  for(const edit of [{type:'append',surface:'group'},{type:'append',surface:'missing'},{type:'remove',step:'missing'},
    {type:'move',step:'step-5',offset:7},{type:'unknown'},{type:'append',surface:'home',execute:true}])assert.throws(()=>editJourneyDraft(d,draft,edit));
  let invoked=false;const hostile={type:'append',get surface(){invoked=true;return 'home';}};
  assert.throws(()=>editJourneyDraft(d,draft,hostile));assert.equal(invoked,false);assert.deepEqual(draft,before);
});
test('empty titles, too few steps, oversized collections and reused counters remain blocked', () => {
  const d=fixture(), draft=beginJourneyDraft(d,'journey-1');
  fails(()=>finishJourneyDraft(d,draft,' '),'SITEMAP_SHAPE');
  fails(()=>finishJourneyDraft(d,beginJourneyDraft(d),'Empty'),'SITEMAP_JOURNEY');
  fails(()=>editJourneyDraft(d,{...draft,nextStep:7},{type:'remove',step:'step-5'}),'SITEMAP_LIMIT');
  const full={journey:{id:'journey-2',name:'Limit',steps:Array.from({length:120},(_,i)=>({id:'step-'+(i+1),surface:'home',via:null}))},nextStep:121};
  fails(()=>append(d,full,'home'),'SITEMAP_LIMIT');
});
test('reviewed journey edits obey stale-project rejection and exact undo/redo', () => {
  const d=fixture(), journey=finishJourneyDraft(d,beginJourneyDraft(d,'journey-1'),'Reviewed edit');
  const plan=planSitemapChange(d,{type:'journey',journey});
  const changed=applySitemapCommand(d,{type:'rename',surface:'home',label:'Concurrent edit'});
  assert.throws(()=>applySitemapChange(changed,plan));
  const result=applySitemapChange(d,plan);
  const undone=travelSitemapHistory(result.design,result.history,'undo');assert.deepEqual(undone.design,d);
  assert.deepEqual(travelSitemapHistory(undone.design,undone.history,'redo').design,result.design);
});
