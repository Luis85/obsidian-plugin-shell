import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runCompiler } from '../../bin/compiler/application/pipeline.ts';
import { artifactCollector, validateArtifacts, canonicalJson } from '../../bin/compiler/domain/artifacts.ts';
import { diagnostic, CompilerError, orderedDiagnostics } from '../../bin/compiler/domain/diagnostics.ts';
import { referenceDiagnostics } from '../../bin/compiler/domain/references.ts';
import { dependencyReadiness } from '../../bin/compiler/adapters/dependencies.ts';

const artifact = (path, content = 'safe') => ({path, content, ownership:'managed', producer:'fixture'});
const template = Object.freeze({fingerprint:'fixture',frameworkFiles:[],skillFiles:[],text(){throw new Error('unexpected template read');}});
const hash = value => createHash('sha256').update(value).digest('hex');
const ports = overrides => ({validate:value=>value,resolve:()=>{},lower:()=>[],
  emit:async()=>[artifact('src/main.ts')],dependencies:()=>({ready:true,diagnostics:[]}),hash,...overrides});
const request = {source:'{}',template};

test('pure compilation has explicit phases, deterministic output and honest not-run verification',async()=>{
  const events=[];const first=await runCompiler(request,ports(),{onEvent:e=>events.push(e)});
  assert.equal(first.status,'ok');assert.equal(first.readiness.bundle,'not-run');assert.equal(first.readiness.tests,'not-run');
  assert.equal(first.readiness.productAcceptance,'not-inferred');assert.equal(first.readiness.generation,'completed');
  assert.deepEqual(events.filter(e=>e.event==='completed').map(e=>e.phase),['parse','validate','resolve','lower','emit']);
  assert.deepEqual(first,await runCompiler(request,ports()));assert.equal(request.source,'{}');
});
test('analysis does not emit or inspect a template',async()=>{
  const result=await runCompiler({source:'{}'},ports({emit:()=>{throw new Error('must not emit');}}));
  assert.equal(result.status,'ok');assert.deepEqual(result.artifacts,[]);assert.equal(result.fingerprint,null);assert.equal(result.readiness.generation,'not-run');
});
test('invalid syntax, target and oversized input produce stable errors without artifacts',async()=>{
  for(const [input,code] of [[{source:'{',template},'COMPILER_JSON_INVALID'],[{...request,outputKind:'other'},'COMPILER_SCHEMA_INVALID'],
    [{source:' '.repeat(4_000_001)},'COMPILER_INPUT_LIMIT']]){
    const result=await runCompiler(input,ports());assert.equal(result.status,'failed');assert.equal(result.diagnostics[0].code,code);assert.deepEqual(result.artifacts,[]);
  }
});
test('cancellation before compilation and after a phase never returns writeable artifacts',async()=>{
  for(const after of [false,true]){
    const controller=new AbortController();if(!after)controller.abort();
    const result=await runCompiler(request,ports(),{signal:controller.signal,onEvent:e=>{if(after&&e.phase==='validate')controller.abort();}});
    assert.equal(result.status,'cancelled');assert.equal(result.diagnostics[0].code,'COMPILER_CANCELLED');assert.deepEqual(result.artifacts,[]);
  }
});
test('unknown failures remain internal and debug causes are opt-in, never ordinary report fields',async()=>{
  const error=new Error('private local path and secret');let debug;
  const result=await runCompiler(request,ports({emit:async()=>{throw error;}}),{onFailure:e=>{debug=e;}});
  assert.equal(debug,error);assert.equal(result.diagnostics[0].code,'COMPILER_INTERNAL');assert.ok(!JSON.stringify(result).includes('secret'));
});
test('typed failures retain their diagnostic without matching English strings',async()=>{
  const detail=diagnostic('COMPILER_TEMPLATE_INVALID','emit','Missing trusted template');
  const result=await runCompiler(request,ports({emit:async()=>{throw new CompilerError(detail);}}));
  assert.deepEqual(result.diagnostics,[detail]);
});
test('independent bad references and duplicates report original JSON pointers together',async()=>{
  const source=JSON.stringify({design:{nodes:[{id:'first',slug:'same',parent:'missing'},{id:'second',slug:'same',parent:null}],library:[],links:[]}});
  const result=await runCompiler({...request,source,sourceName:'example.json'},ports());
  assert.deepEqual(new Set(result.diagnostics.map(d=>d.code)),new Set(['COMPILER_REFERENCE_MISSING','COMPILER_DUPLICATE_ID']));
  assert.ok(result.diagnostics.every(d=>d.source.file==='example.json'&&d.source.jsonPointer.startsWith('/design/nodes/')));
  assert.equal(result.readiness.generation,'failed');assert.deepEqual(result.artifacts,[]);
});
test('path collection rejects case collisions, unsafe paths and file/descendant overlap',()=>{
  for(const files of [[artifact('a.ts'),artifact('A.ts')],[artifact('../a')],[artifact('CON')],[artifact('file'),artifact('file/child')]])assert.throws(()=>validateArtifacts(files),CompilerError);
  const collector=artifactCollector([{...artifact('x'),producer:undefined}]);assert.throws(()=>collector.add({...artifact('x'),producer:undefined}),CompilerError);
  const overlays=artifactCollector([{...artifact('x'),producer:'framework'}]);overlays.add(artifact('x','override'),'framework');
  assert.equal(overlays.get('x').content,'override');assert.throws(()=>overlays.add(artifact('x','accidental')),CompilerError);
});
test('output enumeration order is normalized without changing semantic array order',async()=>{
  const a=await runCompiler(request,ports({emit:async()=>[artifact('a'),artifact('b')]}));
  const b=await runCompiler(request,ports({emit:async()=>[artifact('b'),artifact('a')]}));
  assert.equal(a.fingerprint,b.fingerprint);assert.equal(canonicalJson({z:1,a:[2,1]}),'{'+'"a":[2,1],"z":1}');
});
test('dependency status blocks locked installation when declarations are unresolved',()=>{
  const files=[artifact('package.json',JSON.stringify({dependencies:{sample:'1.2.3'}})),artifact('package-lock.json',JSON.stringify({packages:{'':{dependencies:{} }}}))];
  const pending=dependencyReadiness(files);assert.equal(pending.ready,false);assert.equal(pending.diagnostics[0].code,'COMPILER_DEPENDENCY_RESOLUTION_REQUIRED');
  files[1].content=JSON.stringify({packages:{'':{dependencies:{sample:'1.2.3'}},'node_modules/sample':{version:'1.2.3'}}});
  assert.equal(dependencyReadiness(files).ready,true);
});
test('diagnostic limits are explicit and stable',()=>{
  const values=Array.from({length:105},(_,i)=>diagnostic('COMPILER_SCHEMA_INVALID','validate',String(i)));
  const result=orderedDiagnostics(values);assert.equal(result.length,100);assert.equal(result.at(-1).code,'COMPILER_DIAGNOSTICS_TRUNCATED');
});
test('bounded graph variations keep valid references valid and name injected defects',()=>{
  for(let count=1;count<=80;count++){
    const nodes=Array.from({length:count},(_,i)=>({id:'n'+i,slug:'node-'+i,parent:i?'n'+(i-1):null}));
    const document={design:{nodes,library:[],links:[]}};assert.deepEqual(referenceDiagnostics(document,'p.json'),[]);
    nodes.at(-1).parent='missing';assert.equal(referenceDiagnostics(document,'p.json')[0].code,'COMPILER_REFERENCE_MISSING');
  }
});
