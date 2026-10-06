import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { api, document as projectDocument, workspace, activate, main } from '../support/prototype-fixture.mjs';
const bridge=readFileSync(new URL('../../scripts/concepts/prototype-bridge.js',import.meta.url),'utf8');
// The trusted adapter executes unchanged. Only host ports are injected to exercise failure boundaries.
function host({remember=true,commit=true,valid=true,conflict=false}={}) {
  const state={project:{id:'design-lab',prototypes:workspace()},settings:{remember},generator:{plan:'stale'},activeRun:null};
  const env={state,writes:0,commit,valid,conflict,working:projectDocument('Sitemap B'),designUi:{plan:'stale'}};
  const factory=new Function('env','api',`
    let state=env.state,storageWarning='';const CompanionJourney={prototypeApi:api},tdUi={busy:false},designUi=env.designUi;
    const project=()=>state.project,document={addEventListener(){}},designCopy=structuredClone;
    const companionProjectDocument=()=>env.working,companionProjectToken=()=>'';
    const companionCanReplace=()=>{if(env.conflict||storageWarning)throw Error('storage conflict');};
    const validState=()=>env.valid,saveConceptState=()=>{env.writes++;env.persisted=JSON.parse(JSON.stringify(state));if(!env.commit)storageWarning='uncertain';return env.commit;};
    const companionReview=text=>({project:JSON.parse(text)});
    ${bridge}
    return {read:pmRead,save:pmSave,import:pmImport,preserve:pmPreserveWorkspace,identity:pmGuardIdentity,
      generation:pmGenerationProject,valid:pmValidWorkspace,warning:()=>storageWarning};
  `);
  return {env,adapter:factory(env,api)};
}
test('browser adapter commits a valid candidate once and invalidates pending generation only on success',()=>{
  const {env,adapter}=host(),before=structuredClone(env.state.project.prototypes),next=activate(before);
  adapter.save(next,api.key(before));assert.equal(env.writes,1);assert.deepEqual(env.state.project.prototypes,next);
  assert.equal(env.state.generator.plan,null);assert.equal(env.designUi.plan,null);
  next.prototypes[0].name='Outside mutation';assert.notEqual(env.state.project.prototypes.prototypes[0].name,'Outside mutation');
});
test('failed persistence retains the previous workspace and pending plans, without claiming success',()=>{
  const {env,adapter}=host({commit:false}),before=structuredClone(env.state.project.prototypes);
  assert.throws(()=>adapter.save(activate(before),api.key(before)),/could not commit/);
  assert.deepEqual(env.state.project.prototypes,before);assert.equal(env.writes,1);assert.equal(env.state.generator.plan,'stale');assert.equal(adapter.warning(),'uncertain');
  assert.throws(()=>adapter.save(activate(before),api.key(before)),/storage conflict/);assert.equal(env.writes,1);
});
test('quota preflight rejects a large candidate before the persistence port is called',()=>{
  const {env,adapter}=host();env.state.padding='x'.repeat(5_000_001);const before=structuredClone(env.state.project.prototypes);
  assert.throws(()=>adapter.save(activate(before),api.key(before)),/5 MB/);assert.equal(env.writes,0);assert.deepEqual(env.state.project.prototypes,before);
});
test('invalid state and stale UI revisions never call persistence',()=>{
  const {env,adapter}=host({valid:false}),before=structuredClone(env.state.project.prototypes);
  assert.throws(()=>adapter.save(activate(before),api.key(before)),/safely persisted/);assert.deepEqual(env.state.project.prototypes,before);
  env.valid=true;assert.throws(()=>adapter.save(activate(before),'outdated'),/workspace changed/);assert.equal(env.writes,0);
});
test('ordinary project import preserves an independent copy of the library and refuses a different identity',()=>{
  const {env,adapter}=host(),next={id:'design-lab'};adapter.preserve(next);assert.deepEqual(next.prototypes,env.state.project.prototypes);
  next.prototypes.prototypes[0].name='Outside';assert.notEqual(next.prototypes.prototypes[0].name,env.state.project.prototypes.prototypes[0].name);
  assert.throws(()=>adapter.preserve({id:'other'}),/another project/);assert.throws(()=>adapter.identity('other'),/pin this project ID/);adapter.identity('design-lab');
});
test('generator handoff reads only the saved active source and fails closed without an active variant',()=>{
  const {env,adapter}=host();assert.equal(adapter.generation(),null);
  env.state.project.prototypes=activate(env.state.project.prototypes);assert.deepEqual(adapter.generation(),projectDocument());
  assert.equal(env.working.design.goal,'Sitemap B');delete env.state.project.prototypes;assert.equal(adapter.generation(),env.state.project);
});
test('workspace import refuses protected edits and wrong identities without losing either copy',()=>{
  const {env,adapter}=host();env.state.project.prototypes=activate(env.state.project.prototypes);const before=structuredClone(env.state.project.prototypes),changed=structuredClone(before);
  changed.revision++;changed.prototypes[0].versions[0].variants[0].document.design.goal='Tampered';changed.prototypes[0].versions[0].variants[0].revision++;
  assert.throws(()=>adapter.import(api.json(changed),api.key(before)),/PROTOTYPE_SNAPSHOT_PROTECTED/);assert.deepEqual(env.state.project.prototypes,before);assert.equal(env.writes,0);
  assert.equal(adapter.valid(before,'another'),false);assert.equal(adapter.valid({...before,schemaVersion:9},'design-lab'),false);
});

test('prototype changes invalidate the generation plan in the exact state sent to persistence',()=>{
  const {env,adapter}=host(), before=env.state.project.prototypes;
  adapter.save(activate(before),api.key(before));
  assert.equal(env.persisted.generator.plan,null);
  assert.deepEqual(env.persisted.project.prototypes,env.state.project.prototypes);
});
