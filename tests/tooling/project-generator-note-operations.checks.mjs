import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteOperations } from '../../scripts/companion/runtime/note-operations.ts';
function fixture() {
 const calls=[],snap={id:'one',revision:1,values:{title:'Original'}};
 const success=value=>({ok:true,value});
 const repository={list:async()=>success([snap]),create:async(values,id)=>{calls.push(['create',values,id]);return success({...snap,revision:2,values});},update:async(snapshot,values,permit)=>{calls.push(['update',snapshot,values,permit.active()]);return success({...snapshot,revision:3,values});},delete:async(snapshot,permit)=>{calls.push(['delete',snapshot,permit.active()]);return success(undefined);}};
 const parse=value=>{if(!value||typeof value.title!=='string')throw Error('INVALID');return value;};
 return {calls,snap,repository,port:noteOperations(repository,'record',parse)};
}
test('runtime leases reject unknown revisions and preserve canonical snapshot identity',async()=>{
 const {calls,port,snap}=fixture();await assert.rejects(port.update({id:'one',revision:1,values:{title:'Changed'}}),/STALE/);assert.equal(calls.length,0);
 assert.deepEqual(await port.list(),[{record:{id:'one',type:'record',title:'Original'},revision:1}]);
 await assert.rejects(port.delete({id:'another',revision:1}),/STALE/);
 const updated=await port.update({id:'one',revision:1,values:{title:'Changed'}});assert.equal(calls[0][1],snap);assert.equal(calls[0][3],true);
 assert.equal(updated.record.title,'Changed');await assert.rejects(port.delete({id:'one',revision:1}),/STALE/);
 await port.delete({id:'one',revision:3});assert.equal(calls.at(-1)[0],'delete');await assert.rejects(port.delete({id:'one',revision:3}),/STALE/);
});
test('native operation validation and cancellation prevent mutation calls',async()=>{
 const {port,calls}=fixture();const signal=AbortSignal.abort();
 await assert.rejects(port.create({values:{title:'Draft'},requestId:'create-1'},signal),/ABORTED/);
 await assert.rejects(port.create({values:{},requestId:'create-1'}),/INVALID/);
 await assert.rejects(port.create({values:{title:'Draft'},requestId:''}),/REQUEST/);
 let accessed=false;await assert.rejects(port.create({get values(){accessed=true;return {title:'bad'};}}),/INPUT/);
 assert.equal(accessed,false);assert.equal(calls.length,0);
});
test('repository failures are failures, not success receipts or automatic retries',async()=>{
 const {port,repository,calls}=fixture();repository.create=async()=>({ok:false,error:{code:'uncertain'}});
 await assert.rejects(port.create({values:{title:'Draft'},requestId:'request-1'}),/uncertain/);
 assert.equal(calls.length,0);
});
