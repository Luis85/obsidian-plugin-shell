import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteOperations } from '../../scripts/companion/runtime/note-operations.ts';
import { matches } from '../../scripts/companion/runtime/contract.ts';
import { validateSourceOverrides } from '../../scripts/companion/runtime/source-overrides.ts';
const repository=()=>{const calls=[];return {calls,list:async()=>({ok:true,value:[]}),create:async(...args)=>{calls.push(args);return {ok:false,error:{code:'refused'}};},update:async()=>{throw Error('MUST_NOT_WRITE');},delete:async()=>{throw Error('MUST_NOT_WRITE');}};};
test('native note input with hidden accessors or symbols is rejected before parsing or repository calls',async()=>{
 let accessed=0;const hidden={requestId:'request'};Object.defineProperty(hidden,'values',{get(){accessed++;return {title:'Hidden'};}});
 const inner={requestId:'request',values:{}};Object.defineProperty(inner.values,'title',{get(){accessed++;return 'Hidden';}});
 for(const record of [hidden,inner,{requestId:'request',values:{title:'x'},[Symbol('secret')]:true},{requestId:'request',values:{title:'x',[Symbol('secret')]:true}}]){
  const repo=repository();let parsed=0;
  await assert.rejects(noteOperations(repo,'child',v=>{parsed++;return v;}).create(record),/NOTE_INPUT_INVALID/);
  assert.equal(parsed,0);assert.equal(repo.calls.length,0);
 }
 assert.equal(accessed,0);
});
test('adapter request ids match the canonical repository contract instead of failing after dispatch',async()=>{
 for(const requestId of ['with.dot','with_underscore','x'.repeat(101),'']){
  const repo=repository();await assert.rejects(noteOperations(repo,'child',v=>v).create({requestId,values:{title:'x'}}),/NOTE_REQUEST_ID_REQUIRED/);assert.equal(repo.calls.length,0);
 }
 const repo=repository();await assert.rejects(noteOperations(repo,'child',v=>v).create({requestId:'view:1-a',values:{title:'x'}}),/NOTE_CREATE_FAILED: refused/);assert.equal(repo.calls.length,1);
});
test('schema validation resolves only own properties, never inherited prototype members',()=>{
 for(const key of ['toString','valueOf','hasOwnProperty'])assert.equal(matches({[key]:'x'},{type:'object',properties:{},required:[]}),true,key);
 assert.equal(matches({toString:'x'},{type:'object',properties:{},required:[],additionalProperties:false}),false);
 assert.equal(matches({toString:'x'},{type:'object',properties:{toString:{type:'string'}},required:['toString'],additionalProperties:false}),true);
});
test('explicit undefined or null source providers are refused rather than falling back to a live adapter',()=>{
 const contracts={items:['list','save']};
 for(const invalid of [{items:undefined},{items:null},{items:'provider'}])assert.throws(()=>validateSourceOverrides(invalid,contracts),/SOURCE_OVERRIDE_INVALID/);
});
test('duplicate relationship ids stop generation instead of producing ambiguous write guards',async()=>{
 const { readFile }=await import('node:fs/promises');const { projectModel }=await import('../../scripts/companion/compiler/model.ts');
 const { relationshipDefinitions }=await import('../../scripts/companion/compiler/relationship-model.ts');
 const seed=JSON.parse(await readFile('docs/concepts/companion/companion-project.json','utf8'));const relations=seed.design.semantic.relationships;
 assert.ok(relations.length>0);assert.equal(relationshipDefinitions(projectModel(seed)).length,relations.length);
 relations.push({...structuredClone(relations[0]),key:'duplicate_identity_ref'});assert.throws(()=>relationshipDefinitions(projectModel(seed)),/Duplicate relationship id/);
});
