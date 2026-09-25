import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectRelationships, assertRelationshipMutation } from '../../scripts/companion/runtime/relationships.ts';
import { createRelationshipSession, protectNoteRelationships } from '../../scripts/companion/runtime/relationship-session.ts';
const rule={id:'parent',source:'child',target:'parent',key:'parent_ref',sourceCard:'0..*',targetCard:'1',onDelete:'restrict'};
const parent={entity:'parent',id:'p',path:'Parents/one.md',values:{title:'Parent'}};
const child={entity:'child',id:'c',path:'Children/one.md',values:{title:'Child',parent_ref:'[[Parents/one]]'}};
test('relationship graph resolves canonical wikilinks/ids and refuses dangling targets and restrict deletes',()=>{
 assert.deepEqual(inspectRelationships([rule],[parent,child]),[]);
 assert.deepEqual(inspectRelationships([rule],[parent,{...child,values:{parent_ref:'p'}}]),[]);
 assert.deepEqual(inspectRelationships([rule],[parent,{...child,values:{parent_ref:'[[Parents/one.md|Parent]]'}}]),[]);
 assert.throws(()=>assertRelationshipMutation([rule],[parent,child],{mode:'delete',record:parent}),/VIOLATION/);
 assert.doesNotThrow(()=>assertRelationshipMutation([rule],[parent,child],{mode:'delete',record:child}));
 for(const value of ['missing','[[../Parents/one]]','[[one]]','[[Parents/one#heading]]',null,{}])assert.ok(inspectRelationships([rule],[parent,{...child,values:{parent_ref:value}}]).length>0);
});
test('required, maximum, inverse cardinality and duplicate aliases are distinct constraint failures',()=>{
 assert.ok(inspectRelationships([rule],[parent,{...child,values:{}}]).some(f=>f.code==='cardinality'));
 const many={...rule,targetCard:'1..*'};
 assert.ok(inspectRelationships([many],[parent,{...child,values:{parent_ref:['p','[[Parents/one]]']}}]).some(f=>f.code==='duplicate-target'));
 assert.ok(inspectRelationships([{...rule,sourceCard:'0..1'}],[parent,child,{...child,id:'d',path:'Children/two.md'}]).some(f=>f.code==='inverse-cardinality'));
 assert.ok(inspectRelationships([{...rule,sourceCard:'1..*'}],[parent]).some(f=>f.code==='inverse-cardinality'));
 assert.throws(()=>inspectRelationships([{...rule,onDelete:'cascade'}],[parent,child]),/POLICY_UNSUPPORTED/);
});
test('graph validation is immutable and does not execute accessors or accept duplicate records',()=>{
 const before=JSON.stringify([parent,child]);assertRelationshipMutation([rule],[parent,child],{mode:'update',record:{...child,values:{parent_ref:'p'}}});assert.equal(JSON.stringify([parent,child]),before);
 let called=false;assert.throws(()=>inspectRelationships([rule],[parent,{...child,values:{get parent_ref(){called=true;return 'p';}}}]),/ACCESSOR/);assert.equal(called,false);
 assert.throws(()=>inspectRelationships([rule],[parent,parent]),/DUPLICATE/);
 assert.throws(()=>assertRelationshipMutation([rule],[parent,child],{mode:'create',record:child}),/STALE/);
});
test('one session serializes cross-source preflight and mutation; cancellation never commits',async()=>{
 const records=[parent];let writes=0;
 const session=createRelationshipSession([rule],async()=>records);
 const create=session.run({mode:'create',record:child},async()=>{await Promise.resolve();records.push(child);writes++;},()=>true);
 const remove=session.run({mode:'delete',record:parent},async()=>{records.splice(0,1);writes++;},()=>true);
 await create;await assert.rejects(remove,/VIOLATION/);assert.equal(writes,1);
 await assert.rejects(session.run({mode:'delete',record:child},async()=>{writes++;},()=>false),/ABORTED/);assert.equal(writes,1);
});
test('relationship wrapper preserves canonical creation plans and duplicate request results',async()=>{
 const records=[parent];let commits=0;const plan={entity:'child',id:'c',path:'Children/one.md'};
 const repo={list:async()=>({ok:true,value:[]}),prepare:()=>({ok:true,value:plan}),discard:()=>true,commit:async()=>{commits++;records.push(child);return {ok:true,value:child};},update:async()=>{throw Error('UNUSED');},delete:async()=>{throw Error('UNUSED');}};
 const port=protectNoteRelationships(repo,createRelationshipSession([rule],async()=>records));
 const first=await port.create(child.values,'same-request');assert.equal(first.ok,true);assert.deepEqual(await port.create(child.values,'same-request'),first);assert.equal(commits,1);
});
test('uncertain canonical commits keep their original request and are never discarded or retried',async()=>{
 let commits=0,discards=0;const plan={entity:'child',id:'c',path:'Children/one.md'};
 const repo={list:async()=>({ok:true,value:[]}),prepare:()=>({ok:true,value:plan}),discard:()=>{discards++;return true;},commit:async()=>{commits++;throw Error('uncertain-write');},update:async()=>{},delete:async()=>{}};
 const port=protectNoteRelationships(repo,createRelationshipSession([rule],async()=>[parent]));
 await assert.rejects(port.create(child.values,'request'),/uncertain/);await assert.rejects(port.create(child.values,'request'),/uncertain/);assert.equal(commits,1);assert.equal(discards,0);
});
