import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/post-mvp-base-code.json'),'utf8'));
const template=await loadTemplateSnapshot(root);
const digest=value=>createHash('sha256').update(value).digest('hex');
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
