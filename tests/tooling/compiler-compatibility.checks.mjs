import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/post-mvp-base-code.json'),'utf8'));
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
for(const expected of baseline.cases){
  test('matches independently captured post-MVP PR5 product bytes: '+expected.source,async()=>{
    const source=await readFile(join(root,expected.source),'utf8');assert.equal(digest(source),expected.inputSha256,'pinned baseline input bytes');const result=await compileProject({source,template});
    assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));const model=result.model;
    const selected=result.artifacts.filter(file=>file.path.startsWith(model.sourceRoot+'/')||file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path));
    assert.equal(selected.length,expected.files);assert.equal(digest(JSON.stringify(selected.map(file=>[file.path,digest(file.content)]))),expected.sha256);
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
