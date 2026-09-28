import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/post-mvp-base-code.json'),'utf8'));
const previewDelta=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/preview-host-delta.json'),'utf8'));
const scenarioDelta=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/scenario-preview-delta.json'),'utf8'));
const liveTemplate=await loadTemplateSnapshot(root);
const baselineInputs=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/template-inputs.json'),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
// Output goldens bind BOTH the project and original framework composition. A renamed,
// maker-extended or example-removed consumer is not that original template input.
assert.equal(baselineInputs.sourceCommit,baseline.sourceCommit);
assert.deepEqual(baselineInputs.files.map(file=>file.path),['src/bootstrap/features.ts']);
for(const file of baselineInputs.files) assert.equal(digest(file.content),file.sha256);
function templateWith(registry) {
  const files=liveTemplate.frameworkFiles.map(file=>file.path==='src/bootstrap/features.ts'?{...file,content:registry}:file);
  const texts=new Map(files.map(file=>[file.path,file.content]));
  return {...liveTemplate,frameworkFiles:files,fingerprint:digest(JSON.stringify(files)),
    text:path=>texts.has(path)?texts.get(path):liveTemplate.text(path)};
}
const template=templateWith(baselineInputs.files[0].content);
assert.equal(previewDelta.originalSourceCommit,baseline.sourceCommit);
assert.deepEqual(previewDelta.cases.map(item=>item.source),baseline.cases.map(item=>item.source));
assert.deepEqual(previewDelta.shared.map(item=>item.path).sort(),[
  'harness/prototype/clickdummy-host.ts','harness/prototype/clickdummy.css','{sourceRoot}/presentation/components/ClickdummyPreview.vue',
].sort());
assert.equal(scenarioDelta.schemaVersion,1);
assert.deepEqual(scenarioDelta.cases.map(item=>item.source),baseline.cases.map(item=>item.source));
assert.deepEqual(scenarioDelta.shared.map(item=>item.path).sort(),[
  'harness/prototype/clickdummy-host.ts',
  '{sourceRoot}/presentation/context/clickdummy.ts','{sourceRoot}/presentation/components/ClickdummyPreview.vue',
  '{sourceRoot}/presentation/composables/use-visual.ts',
].sort());
for(const item of scenarioDelta.cases) assert.deepEqual(item.files.map(file=>file.path).sort(),[
  'harness/prototype/clickdummy-scenarios.ts','harness/prototype/clickdummy.ts',
].sort());
/** Check the exact new bytes, then reverse only the reviewed browser delta to the unchanged historical digest. */
function historicalBytes(selected,model,source) {
  const hashes=new Map(selected.map(file=>[file.path,digest(file.content)]));
  const scenario=scenarioDelta.cases.find(item=>item.source===source);assert.ok(scenario);
  for(const change of [...scenarioDelta.shared,...scenario.files]){
    const path=change.path.replace('{sourceRoot}',model.sourceRoot);
    assert.equal(hashes.get(path),change.after,'reviewed scenario output: '+path);
    if(change.before===null){assert.equal(path,'harness/prototype/clickdummy-scenarios.ts');hashes.delete(path);}
    else hashes.set(path,change.before);
  }
  const entry=previewDelta.cases.find(item=>item.source===source);
  assert.ok(entry);
  const changes=[...previewDelta.shared,{path:'harness/prototype/clickdummy.ts',before:entry.before,after:entry.after}];
  for(const change of changes){
    const path=change.path.replace('{sourceRoot}',model.sourceRoot);
    assert.equal(hashes.get(path),change.after,'reviewed preview output: '+path);
    if(change.before===null){assert.equal(path,'harness/prototype/clickdummy-host.ts');hashes.delete(path);}
    else hashes.set(path,change.before);
  }
  return [...hashes].sort(([a],[b])=>a<b?-1:a>b?1:0);
}
for(const expected of baseline.cases){
  test('matches original PR5 bytes plus the exact reviewed preview-only delta: '+expected.source,async()=>{
    const source=await readFile(join(root,expected.source),'utf8');assert.equal(digest(source),expected.inputSha256,'pinned baseline input bytes');const result=await compileProject({source,template});
    assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));const model=result.model;
    const selected=result.artifacts.filter(file=>file.path.startsWith(model.sourceRoot+'/')||file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path));
    assert.equal(selected.length,expected.files+2);assert.equal(digest(JSON.stringify(historicalBytes(selected,model,expected.source))),expected.sha256);
  });
}
test('same frozen snapshot stays deterministic while telemetry changes',async()=>{
  const source=await readFile(join(root,baseline.cases[0].source),'utf8');const events=[];
  const first=await compileProject({source,template},{onEvent:e=>events.push(e)});const again=await compileProject({source,template});
  assert.equal(first.fingerprint,again.fingerprint);assert.deepEqual(first.artifacts,again.artifacts);assert.ok(events.length);
});

test('live consumer registry still reaches generated output; the fixed input is only a test fixture',async()=>{
  const source=await readFile(join(root,baseline.cases[0].source),'utf8');
  const retained='// consumer-owned registration context\n'+baselineInputs.files[0].content;
  const result=await compileProject({source,template:templateWith(retained)});
  assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));
  assert.equal(result.artifacts.find(file=>file.path==='src/bootstrap/features.ts').content,retained);
  assert.notEqual(result.fingerprint,(await compileProject({source,template})).fingerprint);
});

test('preview delta rejects changed new output rather than masking it with historical hashes',async()=>{
  const expected=baseline.cases[0],source=await readFile(join(root,expected.source),'utf8');
  const result=await compileProject({source,template});
  const changed=result.artifacts.map(file=>file.path==='harness/prototype/clickdummy.css'?{...file,content:file.content+'// unreviewed change\n'}:file);
  assert.throws(()=>historicalBytes(changed,result.model,expected.source),/reviewed preview output/);
});

for(const path of ['harness/prototype/clickdummy-host.ts','harness/prototype/clickdummy-scenarios.ts','{sourceRoot}/presentation/composables/use-visual.ts']){
  test('scenario delta rejects unreviewed new bytes: '+path,async()=>{
    const expected=baseline.cases[0],source=await readFile(join(root,expected.source),'utf8');
    const result=await compileProject({source,template});
    const target=path.replace('{sourceRoot}',result.model.sourceRoot);
    const changed=result.artifacts.map(file=>file.path===target?{...file,content:file.content+'// unexpected change\n'}:file);
    assert.throws(()=>historicalBytes(changed,result.model,expected.source),/reviewed scenario output/);
  });
}
