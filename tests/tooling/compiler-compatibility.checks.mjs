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
const visualDelta=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/visual-runtime-delta.json'),'utf8'));
const collectionDelta=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/self-project-collection-delta.json'),'utf8'));
const liveTemplate=await loadTemplateSnapshot(root);
const baselineInputs=JSON.parse(await readFile(join(root,'tests/fixtures/compiler/template-inputs.json'),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
// Note repositories now bind leases to record ID AND revision. Reverse only this
// independently pinned security delta when comparing with untouched PR5 goldens.
const noteRuntimeDelta=Object.freeze({
  before:'4a8c2fd59b1bea492e31d24ba7daef0d6e5ef58b4b66a4efa94f7634c41aa8fe',
  after:'ca98f2d7690ce8a53e0b994621815d30e355801688d668abdf02294699786ef1',
});
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
// Newest reviewed layer: it may change only these shared runtime/test files and each case's
// generated definition suite, and add only the local icon test setup and bounded suite parts.
assert.equal(visualDelta.schemaVersion,1);
assert.deepEqual(visualDelta.cases.map(item=>item.source),baseline.cases.map(item=>item.source));
assert.deepEqual(visualDelta.shared.map(item=>item.path).sort(),[
  '{sourceRoot}/domain/visual/visual-ir.d.mts','{sourceRoot}/domain/visual/visual-ir.mjs',
  '{testRoot}/ui-bootstrap.mjs','{testRoot}/visual-runtime.test.ts',
].sort());
const visualAddition=/^\{testRoot\}\/(?:ui-bootstrap\.mjs|visual\/definitions-\d+\.test\.ts)$/;
for(const change of visualDelta.shared) assert.equal(change.before===null,change.path==='{testRoot}/ui-bootstrap.mjs',change.path);
for(const item of visualDelta.cases) for(const change of item.files){
  assert.match(change.path,/^\{testRoot\}\/visual\/definitions(?:-\d+)?\.test\.ts$/);
  assert.equal(change.before===null,change.path!=='{testRoot}/visual/definitions.test.ts',change.path);
}
const visualAdded=source=>[...visualDelta.shared,...visualDelta.cases.find(item=>item.source===source).files].filter(change=>change.before===null).length;
// Owner-approved self-project Test recipe collection (d10a96e): ONE case gets a reviewed replacement
// input pin and exact new output hashes; every other case keeps its original input pin unchanged.
const collectionCase=baseline.cases.filter(item=>item.source===collectionDelta.source);
assert.equal(collectionDelta.schemaVersion,1);assert.equal(collectionCase.length,1);
assert.equal(collectionDelta.input.before,collectionCase[0].inputSha256);assert.notEqual(collectionDelta.input.after,collectionDelta.input.before);
const collectionPaths=collectionDelta.files.map(file=>file.path);
assert.equal(new Set(collectionPaths).size,collectionPaths.length);
assert.ok(collectionDelta.files.every(file=>file.before!==file.after&&/^[0-9a-f]{64}$/.test(file.after)));
const layeredPaths=[...previewDelta.shared,...scenarioDelta.shared].map(item=>item.path).concat(['harness/prototype/clickdummy.ts','harness/prototype/clickdummy-scenarios.ts','{sourceRoot}/bootstrap/mount.ts','{sourceRoot}/application/note-operations.ts']);
assert.ok(collectionPaths.every(path=>!layeredPaths.includes(path)),'collection delta stays disjoint from earlier layers');
const collectionAdded=source=>source===collectionDelta.source?collectionDelta.files.filter(file=>file.before===null).length:0;
const reviewedInputSha256=expected=>expected.source===collectionDelta.source?collectionDelta.input.after:expected.inputSha256;
/** Check the exact reviewed collection bytes, then reverse them to the pre-collection output of the original input. */
function beforeCollection(hashes,model,source) {
  if(source!==collectionDelta.source) return;
  for(const change of collectionDelta.files){
    const path=change.path.replace('{sourceRoot}',model.sourceRoot).replace('{testRoot}',model.testRoot);
    assert.equal(hashes.get(path),change.after,'reviewed self-project collection output: '+path);
    if(change.before===null) hashes.delete(path); else hashes.set(path,change.before);
  }
}
/** The visual layer is reversed first, so on a shared path its `before` must be the collection layer's
 * reviewed `after`. A collection-added path may later change (it is counted once, as a collection
 * addition); a visual addition must be absent from the collection layer's output entirely. */
function assertVisualOverCollection(visual,collection) {
  const prior=new Map(collection.files.map(file=>[file.path,file]));
  for(const change of [...visual.shared,...visual.cases.find(item=>item.source===collection.source).files]){
    if(!prior.has(change.path)) continue;
    assert.notEqual(change.before,null,'visual addition collides with the collection layer: '+change.path);
    assert.equal(change.before,prior.get(change.path).after,'visual layer chains onto the collection output: '+change.path);
  }
}
assertVisualOverCollection(visualDelta,collectionDelta);
/** Reverse only the two reviewed Nuxt UI bootstrap insertions from f0ede074 in both native and preview mounts.
 * Both insertions must occur exactly once; all remaining bytes still face the original goldens. */
function beforeUiBootstrap(source) {
  const changes = [
    ["import ui from '@nuxt/ui/vue-plugin';\n", ''],
    ['app.use(pinia); app.use(ui);', 'app.use(pinia);'],
  ];
  for (const [after, before] of changes) {
    assert.equal(source.split(after).length, 2, 'reviewed UI bootstrap output');
    source = source.replace(after, before);
  }
  return source;
}
/** Check the exact new bytes, then reverse only the reviewed browser deltas to the unchanged historical digest. */
function historicalBytes(selected,model,source) {
  const hashes=new Map(selected.map(file=>[file.path,digest(['harness/prototype/clickdummy.ts',model.sourceRoot+'/bootstrap/mount.ts'].includes(file.path)?beforeUiBootstrap(file.content):file.content)]));
  // Reverse newest first: visual (PR54) -> collection (PR5) -> scenario -> preview -> note lease.
  const visual=visualDelta.cases.find(item=>item.source===source);assert.ok(visual);
  for(const change of [...visualDelta.shared,...visual.files]){
    const path=change.path.replace('{sourceRoot}',model.sourceRoot).replace('{testRoot}',model.testRoot);
    assert.equal(hashes.get(path),change.after,'reviewed visual runtime output: '+path);
    if(change.before===null){assert.match(change.path,visualAddition);hashes.delete(path);}
    else hashes.set(path,change.before);
  }
  beforeCollection(hashes,model,source);
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
  // An exact, separately reviewed note-runtime security change is compatible
  // with the frozen pre-collection product baseline. Any other output must
  // still match the original historical SHA-256 aggregate unchanged.
  const noteRuntimePath=model.sourceRoot+'/application/note-operations.ts';
  if(hashes.has(noteRuntimePath)){
    assert.equal(hashes.get(noteRuntimePath),noteRuntimeDelta.after,'reviewed note lease runtime output: '+noteRuntimePath);
    hashes.set(noteRuntimePath,noteRuntimeDelta.before);
  }
  return [...hashes].sort(([a],[b])=>a<b?-1:a>b?1:0);
}
for(const expected of baseline.cases){
  test('matches original PR5 bytes plus the reviewed host bootstrap and preview deltas: '+expected.source,async()=>{
    const source=await readFile(join(root,expected.source),'utf8');assert.equal(digest(source),reviewedInputSha256(expected),'pinned baseline input bytes');const result=await compileProject({source,template});
    assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));const model=result.model;
    const selected=result.artifacts.filter(file=>file.path.startsWith(model.sourceRoot+'/')||file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path));
    // AIR-01 adds one browser entry. Verify its complete bytes separately; all historical
    // product files must still match the independently captured baseline without rebasing it.
    const previews=selected.filter(file=>file.path==='harness/prototype/index.html');
    assert.equal(previews.length,1);
    assert.equal(previews[0].content,`<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source preview</title></head>
<body class="theme-dark"><main id="prototype-app" class="ps--${model.project.id}" data-plugin-ui="${model.project.id}"></main>
<script type="module" src="/harness/prototype/clickdummy.ts"></script></body></html>
`);
    const preserved=selected.filter(file=>file!==previews[0]);
    assert.equal(selected.length,expected.files+3+visualAdded(expected.source)+collectionAdded(expected.source));
    assert.equal(digest(JSON.stringify(historicalBytes(preserved,model,expected.source))),expected.sha256);
  });
}
test('note lease compatibility delta refuses unreviewed generated runtime changes',async()=>{
  const expected=baseline.cases.find(item=>item.source.endsWith('/knowledge-collection.companion.json'));assert.ok(expected);
  const source=await readFile(join(root,expected.source),'utf8');
  const result=await compileProject({source,template});assert.equal(result.status,'ok');
  const noteRuntimePath=result.model.sourceRoot+'/application/note-operations.ts';
  const selected=result.artifacts.filter(file=>file.path.startsWith(result.model.sourceRoot+'/')||
    file.path.startsWith(result.model.testRoot+'/')||file.path.startsWith('harness/prototype/')||
    ['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path))
    .filter(file=>file.path!=='harness/prototype/index.html');
  assert.equal(selected.filter(file=>file.path===noteRuntimePath).length,1,'fixture must emit a note repository');
  const changed=selected.map(file=>file.path===noteRuntimePath?
    {...file,content:file.content+'// unreviewed runtime edit\n'}:file);
  assert.throws(()=>historicalBytes(changed,result.model,expected.source),/reviewed note lease runtime output/);
});

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

for(const [starter,path] of [['blank','{sourceRoot}/domain/visual/visual-ir.mjs'],['blank','{testRoot}/ui-bootstrap.mjs'],
  ['blank','{testRoot}/visual-runtime.test.ts'],['daily-journal','{testRoot}/visual/definitions.test.ts'],['daily-journal','{testRoot}/visual/definitions-2.test.ts']]){
  test('visual runtime delta rejects changed or missing reviewed bytes: '+starter+' '+path,async()=>{
    const expected=baseline.cases.find(item=>item.source.endsWith('/'+starter+'.companion.json'));assert.ok(expected);
    const source=await readFile(join(root,expected.source),'utf8');
    const result=await compileProject({source,template});assert.equal(result.status,'ok');
    const target=path.replace('{sourceRoot}',result.model.sourceRoot).replace('{testRoot}',result.model.testRoot);
    assert.equal(result.artifacts.filter(file=>file.path===target).length,1,'fixture must emit '+target);
    const changed=result.artifacts.map(file=>file.path===target?{...file,content:file.content+'// unexpected change\n'}:file);
    assert.throws(()=>historicalBytes(changed,result.model,expected.source),/reviewed visual runtime output/);
    assert.throws(()=>historicalBytes(result.artifacts.filter(file=>file.path!==target),result.model,expected.source),/reviewed visual runtime output/);
  });
}

test('visual runtime delta leaves an undeclared extra suite part in the historical digest',async()=>{
  const expected=baseline.cases.find(item=>item.source.endsWith('/daily-journal.companion.json'));assert.ok(expected);
  const source=await readFile(join(root,expected.source),'utf8');
  const result=await compileProject({source,template});assert.equal(result.status,'ok');const model=result.model;
  const preserved=result.artifacts.filter(file=>(file.path.startsWith(model.sourceRoot+'/')||file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||
    ['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path))&&file.path!=='harness/prototype/index.html');
  assert.equal(digest(JSON.stringify(historicalBytes(preserved,model,expected.source))),expected.sha256);
  const extra=[...preserved,{path:model.testRoot+'/visual/definitions-3.test.ts',content:'// unreviewed suite part\n'}];
  assert.notEqual(digest(JSON.stringify(historicalBytes(extra,model,expected.source))),expected.sha256);
});

for(const target of ['harness/prototype/clickdummy.ts','{sourceRoot}/bootstrap/mount.ts']) for(const insertion of ["import ui from '@nuxt/ui/vue-plugin';\n", 'app.use(pinia); app.use(ui);']){
  test('host bootstrap delta rejects changed initialization: '+target+' '+insertion.trim(),async()=>{
    const expected=baseline.cases[0],source=await readFile(join(root,expected.source),'utf8');
    const result=await compileProject({source,template});
    const changed=result.artifacts.map(file=>file.path===target.replace('{sourceRoot}',result.model.sourceRoot)?{...file,content:file.content.replace(insertion,'/* missing UI bootstrap */')}:file);
    assert.throws(()=>historicalBytes(changed,result.model,expected.source),/reviewed UI bootstrap output/);
  });
}

test('collection delta replaces only the reviewed self-project input pin',()=>{
  for(const expected of baseline.cases) assert.equal(reviewedInputSha256(expected),
    expected.source===collectionDelta.source?collectionDelta.input.after:expected.inputSha256);
  assert.equal(baseline.cases.filter(item=>reviewedInputSha256(item)!==item.inputSha256).length,1);
});

const collectionCompile=(async()=>{
  const source=await readFile(join(root,collectionDelta.source),'utf8');
  const result=await compileProject({source,template});assert.equal(result.status,'ok');
  const model=result.model,files=result.artifacts.filter(file=>file.path.startsWith(model.sourceRoot+'/')||
    file.path.startsWith(model.testRoot+'/')||file.path.startsWith('harness/prototype/')||
    ['src/main.ts','src/bootstrap/features.ts','design/project.json','design/traceability.json'].includes(file.path))
    .filter(file=>file.path!=='harness/prototype/index.html');
  return {model,files,target:path=>path.replace('{sourceRoot}',model.sourceRoot).replace('{testRoot}',model.testRoot)};
})();
for(const path of ['src/bootstrap/features.ts','design/project.json','{sourceRoot}/infrastructure/sources/test-recipes.ts']){
  test('collection delta rejects unreviewed bytes: '+path,async()=>{
    const {model,files,target}=await collectionCompile;
    const changed=files.map(file=>file.path===target(path)?{...file,content:file.content+'// unreviewed change\n'}:file);
    assert.throws(()=>historicalBytes(changed,model,collectionDelta.source),/reviewed self-project collection output/);
  });
  test('collection delta rejects a missing reviewed file: '+path,async()=>{
    const {model,files,target}=await collectionCompile;
    const missing=files.filter(file=>file.path!==target(path));assert.equal(missing.length,files.length-1);
    assert.throws(()=>historicalBytes(missing,model,collectionDelta.source),/reviewed self-project collection output/);
  });
}
test('collection delta does not absorb an undeclared extra generated file',async()=>{
  const {model,files}=await collectionCompile;
  assert.equal(digest(JSON.stringify(historicalBytes(files,model,collectionDelta.source))),collectionCase[0].sha256);
  const extra=[...files,{path:model.sourceRoot+'/application/test-recipes/unreviewed.ts',content:'export {};\n'}];
  assert.notEqual(digest(JSON.stringify(historicalBytes(extra,model,collectionDelta.source))),collectionCase[0].sha256);
});
test('visual layer must chain onto the reviewed collection output',()=>{
  const selfCase=delta=>delta.cases.find(item=>item.source===collectionDelta.source);
  const stale=structuredClone(visualDelta),suite=selfCase(stale).files.find(file=>file.path==='{testRoot}/visual/definitions.test.ts');
  suite.before=collectionDelta.files.find(file=>file.path===suite.path).before;
  assert.throws(()=>assertVisualOverCollection(stale,collectionDelta),/visual layer chains onto the collection output/);
  const readded=structuredClone(visualDelta);
  selfCase(readded).files.push({path:'{sourceRoot}/application/test-recipes/service.ts',before:null,after:'0'.repeat(64)});
  assert.throws(()=>assertVisualOverCollection(readded,collectionDelta),/visual addition collides with the collection layer/);
});
for(const path of ['{testRoot}/visual/definitions.test.ts','{testRoot}/visual/definitions-19.test.ts']){
  test('self-project visual layer rejects changed or missing reviewed bytes: '+path,async()=>{
    const {model,files,target}=await collectionCompile;
    assert.equal(files.filter(file=>file.path===target(path)).length,1,'fixture must emit '+target(path));
    const changed=files.map(file=>file.path===target(path)?{...file,content:file.content+'// unreviewed change\n'}:file);
    assert.throws(()=>historicalBytes(changed,model,collectionDelta.source),/reviewed visual runtime output/);
    assert.throws(()=>historicalBytes(files.filter(file=>file.path!==target(path)),model,collectionDelta.source),/reviewed visual runtime output/);
  });
}
