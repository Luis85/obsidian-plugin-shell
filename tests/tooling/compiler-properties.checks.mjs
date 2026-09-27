import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { referenceDiagnostics } from '../../scripts/compiler/domain/references.ts';
import { artifactCollector, validateArtifacts, canonicalJson } from '../../scripts/compiler/domain/artifacts.ts';
const file=path=>({path,content:'data',ownership:'managed',producer:'p'});
test('property: valid navigation chains and precisely located missing parents',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:100}),fc.string({maxLength:100}), (count,label)=>{
    const nodes=Array.from({length:count},(_,index)=>({id:'id-'+index,slug:'node-'+index,label,parent:index?'id-'+(index-1):null}));
    const document={design:{nodes,links:[],library:[]}};assert.deepEqual(referenceDiagnostics(document,'p.json'),[]);
    nodes.at(-1).parent='missing';const [error]=referenceDiagnostics(document,'p.json');assert.equal(error.source.jsonPointer,`/design/nodes/${count-1}/parent`);
  }),{seed:20260927,numRuns:250});
});
test('property: output collisions never silently replace content; canonical keys ignore insertion order',()=>{
  fc.assert(fc.property(fc.integer({min:1,max:10000}),fc.string(),(id,content)=>{
    const path='src/file-'+id+'.ts',collector=artifactCollector([file(path)]);
    assert.throws(()=>collector.add({...file(path),content}));assert.throws(()=>validateArtifacts([file(path),file(path.toUpperCase())]));
    assert.equal(canonicalJson({z:content,a:id}),canonicalJson({a:id,z:content}));
  }),{seed:20260927,numRuns:250});
});
