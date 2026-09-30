import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),template=await loadTemplateSnapshot(root);
const source=starterDocumentText('quick-capture');
test('browser output shares generated product code and packages an explicit offline build entry',async()=>{
  const plugin=await compileProject({source,template});const browser=await compileProject({source,template,outputKind:'clickdummy'});
  assert.equal(browser.status,'ok',JSON.stringify(browser.diagnostics));
  for(const file of plugin.artifacts.filter(file=>file.path.startsWith('src/generated/')))assert.equal(browser.artifacts.find(item=>item.path===file.path)?.content,file.content,file.path);
  const entry=browser.artifacts.find(file=>file.path==='harness/prototype/main.ts').content;
  const parsed=ts.transpileModule(entry,{fileName:'main.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  assert.ok(!parsed.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));
  assert.ok(!entry.includes("from 'obsidian'"));assert.match(entry,/import '\.\/clickdummy\.ts'/);
  const shared = browser.artifacts.find(file => file.path === 'harness/prototype/clickdummy.ts');
  assert.equal(shared.content, plugin.artifacts.find(file => file.path === shared.path).content);
  const sources = browser.artifacts.find(file => file.path.endsWith('/bootstrap/clickdummy-sources.ts'));
  assert.match(sources.content, /Synthetic read values/);
  assert.match(shared.content, /createClickdummySources/);assert.match(shared.content, /exportProject/);
  assert.match(shared.content, /designState/);assert.match(shared.content, /function reset/);
  assert.equal(browser.readiness.bundle,'not-run');assert.notEqual(browser.fingerprint,plugin.fingerprint);
  const pkg=JSON.parse(browser.artifacts.find(file=>file.path==='package.json').content);assert.equal(pkg.scripts['build:clickdummy'],'node scripts/compiler/build-clickdummy.mjs');
  for (const result of [plugin, browser]) {
    const generated = JSON.parse(result.artifacts.find(file => file.path === 'package.json').content);
    assert.equal(generated.devDependencies.typescript, ts.version);
    assert.match(generated.devDependencies.typescript, /^6\.\d+\.\d+$/);
    assert.equal(generated.scripts['typecheck:project'], 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project tsconfig.project.json');
  }
  assert.equal(pkg.scripts['typecheck:clickdummy'], 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project tsconfig.clickdummy.json');
});
test('compiled browser sources refuse an explicitly writable operation at runtime', async t => {
  const document = JSON.parse(source);
  const contract = document.design.dataSources.sources[0];
  const operation = contract.operations[0];
  operation.direction = 'both';
  const compiled = await compileProject({ source: JSON.stringify(document), template, outputKind: 'clickdummy' });
  assert.equal(compiled.status, 'ok', JSON.stringify(compiled.diagnostics));
  const dir = await mkdtemp(join(tmpdir(), 'compiler-write-refusal-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sourceRoot = compiled.model.sourceRoot;
  for (const file of compiled.artifacts) {
    if (!file.path.startsWith(sourceRoot + '/') || !file.path.endsWith('.ts') || !/(?:application\/|domain\/contract|clickdummy-sources)/.test(file.path)) continue;
    await mkdir(dirname(join(dir, file.path)), { recursive: true });
    await writeFile(join(dir, file.path), file.content);
  }
  await writeFile(join(dir, 'package.json'), '{"type":"module"}');
  const { createClickdummySources } = await import(pathToFileURL(join(dir, sourceRoot, 'bootstrap/clickdummy-sources.ts')).href);
  const services = createClickdummySources();
  await assert.rejects(services[contract.slug][operation.slug](undefined), /NOT_IMPLEMENTED: Clickdummy has no business-write adapter/);
});
test('origin maps retain normalized entity IDs and actual generated Vue line locations',async()=>{
  const compiled=await compileProject({source,sourceName:'quick.json',template});
  const origins=JSON.parse(compiled.artifacts.find(file=>file.path==='design/compiler-origins.json').content);
  const mapped=origins.artifacts.filter(file=>file.lines.length);
  assert.ok(mapped.length);for(const file of mapped){const artifact=compiled.artifacts.find(a=>a.path===file.path);for(const entry of file.lines){assert.ok(artifact.content.split('\n')[entry.line-1].includes('data-design-node'));assert.equal(entry.source.document,'normalized');assert.equal(entry.source.file,'quick.json');}}
});
test('pure rendering never schedules a runtime provider, timer or network call',async()=>{
  const fetch=globalThis.fetch,timer=globalThis.setTimeout;
  globalThis.fetch=()=>{throw new Error('unexpected network');};globalThis.setTimeout=()=>{throw new Error('unexpected timer');};
  try{const result=await compileProject({source,template});assert.equal(result.status,'ok',JSON.stringify(result.diagnostics));}
  finally{globalThis.fetch=fetch;globalThis.setTimeout=timer;}
});

test('v6 authoring routes survive compiler analysis, emission and both output targets', async () => {
  const document = structuredClone(JSON.parse(source));
  const surface = document.design.nodes.find(node => !['group','action','modal'].includes(node.kind));
  document.design.sitemap = { schema: 1, routes: [{ id: 'compiler-route', surface: surface.id, path: '/capture/:recordId' }], journeys: [] };
  const text = JSON.stringify(document);
  for (const outputKind of ['obsidian-plugin', 'clickdummy']) {
    const result = await compileProject({ source: text, template, outputKind });
    assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
    assert.deepEqual(result.model.document, document);
    assert.deepEqual(JSON.parse(result.artifacts.find(file => file.path === 'design/project.json').content), document);
    assert.match(result.artifacts.find(file => file.path === 'harness/prototype/clickdummy.ts').content, /capture\/:recordId/);
    assert.ok(result.artifacts.some(file => file.path === 'tsconfig.sitemap.json'));
    assert.ok(result.artifacts.some(file => file.path === 'tsconfig.authoring.json'));
  }
  assert.equal(JSON.stringify(document), text);
});
test('typed authoring validation failures are schema diagnostics, never internal compiler defects', async () => {
  for (const mutate of [
    document => { document.schemaVersion = document.design.schema = 7; },
    document => { document.design.sitemap = { schema: 1, routes: [{ id: 'bad', surface: 'absent', path: '/bad' }], journeys: [] }; },
  ]) {
    const document = structuredClone(JSON.parse(source)); mutate(document);
    const result = await compileProject({ source: JSON.stringify(document), template });
    assert.equal(result.status, 'failed'); assert.deepEqual(result.artifacts, []);
    assert.ok(result.diagnostics.some(item => item.code === 'COMPILER_SCHEMA_INVALID'), JSON.stringify(result.diagnostics));
    assert.ok(result.diagnostics.every(item => item.code !== 'COMPILER_INTERNAL_ERROR'));
  }
});
