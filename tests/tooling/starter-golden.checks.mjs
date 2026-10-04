import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { parseBrowserStarter, configureBrowserStarter, exportBrowserStarter, starterProjection, STARTER_MAX_BYTES } from '../../bin/adapters/starters/browser.ts';
import { starterCoverage } from '../../bin/adapters/starters/coverage.ts';
import { parseDefinition, loadDefinitions } from '../../bin/adapters/starters/repository.ts';
import { validateDefinition } from '../../bin/adapters/starters/validation.ts';
import { parseJsonData, assertJsonData, assertDesignData } from '../../scripts/contracts/json-data.ts';
import { validateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { exportGoldenProject } from '../../scripts/concepts/export-golden-project.mjs';
import { authoringEvidence } from '../../scripts/companion-tools/authoring-evidence.mjs';
const root = new URL('../../', import.meta.url), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = await readFile(new URL('configs/starters/companion-plugin.json', root), 'utf8'), golden = parseBrowserStarter(text);
const showcase = parseBrowserStarter(await readFile(new URL('configs/starters/feature-showcase.json', root), 'utf8'));
const blank = parseBrowserStarter(await readFile(new URL('configs/starters/blank.json', root), 'utf8'));

test('golden definition is current v6 and retains the complete declared self-project', () => {
  assert.ok(Buffer.byteLength(text) > 1_000_000 && Buffer.byteLength(text) < STARTER_MAX_BYTES);
  const doc = validateAuthoringDocument(golden.generator.document), d = doc.design;
  assert.equal(doc.schemaVersion, 6); assert.equal(d.nodes.length, 28); assert.equal(d.visualDesigns.pages.length, 27);
  assert.equal(d.visualDesigns.components.length, 54); assert.equal(d.visualDesigns.revisions.length, 54);
  assert.equal(d.sitemap.routes.length, 23); assert.equal(d.sitemap.journeys.length, 3);
  assert.equal(doc.executable, false); assert.deepEqual(parseDefinition(Buffer.from(text)), golden);
});
test('browser and CLI accept identical starter bytes and independent identity configuration', () => {
  const copy = configureBrowserStarter(golden, hash(text), { id: 'another-companion', name: 'Another Companion' });
  assert.equal(copy.project.id, 'another-companion'); assert.equal(copy.project.name, 'Another Companion');
  assert.deepEqual(copy.design, golden.generator.document.design);
  copy.design.nodes[0].label = 'Edited'; assert.notEqual(copy.design.nodes[0].label, golden.generator.document.design.nodes[0].label);
  assert.deepEqual(copy.design.sitemap, golden.generator.document.design.sitemap); assert.equal(copy.executable, false);
});
test('converted example starters configure as project v6 documents', () => {
  const copy = configureBrowserStarter(blank, 'a'.repeat(64), { id: 'blank-copy', name: 'Blank Copy' });
  assert.equal(copy.schemaVersion, 6); assert.equal(copy.design.schema, 6); assert.equal(copy.project.id, 'blank-copy');
});
test('a starter embedding a retired v5 document is refused before configuration', () => {
  const retired = structuredClone(blank); retired.generator.document.schemaVersion = 5; retired.generator.document.design.schema = 5;
  assert.throws(() => configureBrowserStarter(retired, 'a'.repeat(64), {}), /STARTER_VERSION|project schema 6/);
});
test('future project versions and invalid v6 references fail before configuration', () => {
  const future = structuredClone(golden); future.generator.document.schemaVersion = 7; assert.throws(() => validateDefinition(future));
  const broken = structuredClone(golden); broken.generator.document.design.sitemap.routes[0].surface = 'missing'; assert.throws(() => validateDefinition(broken));
});
test('projection requires an actual hash-shaped identity and is an independent copy', () => {
  assert.throws(() => starterProjection(golden, 'unverified'), /SHA-256/);
  const entry = starterProjection(golden, hash(text)); entry.document.project.name = 'Edited';
  assert.notEqual(entry.document.project.name, golden.generator.document.project.name);
});
test('a file-only blueprint is not silently converted to a Companion model', async () => {
  const file = parseBrowserStarter(await readFile(new URL('configs/starters/webapp.json', root), 'utf8'));
  assert.throws(() => starterProjection(file, 'a'.repeat(64)), /file-only/);
  assert.equal(starterCoverage(file).modeled, null);
});
test('larger authored data does not increase request or approval limits', () => {
  assert.throws(() => parseJsonData(text), /JSON_DATA_INVALID/);
  assert.throws(() => assertJsonData({ text: 'x'.repeat(1_100_000) }), /JSON_DATA_INVALID/);
  assert.equal(assertDesignData({ text: 'x'.repeat(1_100_000) }), true);
  assert.throws(() => parseBrowserStarter(' '.repeat(STARTER_MAX_BYTES) + text), /4 MB/);
  assert.throws(() => parseBrowserStarter('é'.repeat(2_000_001)), /4 MB/);
});
test('inert data validation never invokes getters or toJSON and rejects unsafe keys', () => {
  let calls = 0; const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { calls++; return 'bad'; } });
  assert.throws(() => assertDesignData(accessor)); assert.equal(calls, 0);
  assert.throws(() => assertDesignData({ toJSON() { calls++; return {}; } })); assert.equal(calls, 0);
  assert.throws(() => parseBrowserStarter('{"__proto__":{"polluted":true}}')); assert.equal({}.polluted, undefined);
});
test('showcase covers every shipped visual category without pretending to be native acceptance', () => {
  const coverage = starterCoverage(showcase);
  assert.equal(coverage.modeled.complete, true);
  assert.deepEqual(Object.values(coverage.modeled.categories).map(c => c.expected.length), [22,10,7,5,3]);
  assert.deepEqual(coverage.unboundInteractions, []);
  assert.equal(coverage.nativeAcceptance, 'not-run'); assert.equal(coverage.behaviorAcceptance, 'not-run');
  assert.deepEqual(coverage.limitations, []);
});
test('removing a represented state causes model coverage failure', () => {
  const d = structuredClone(showcase);
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (value.state === 'loading') value.state = 'default';
      if (value.visibleIn) value.visibleIn = value.visibleIn.map(v => v === 'loading' ? 'default' : v);
      Object.values(value).forEach(walk);
    }
  };
  walk(d); const report = starterCoverage(d); assert.equal(report.modeled.complete, false);
  assert.ok(report.modeled.categories.states.missing.includes('loading'));
});
test('golden reports unresolved interactions rather than treating empty actions as functionality', () => {
  const report = starterCoverage(golden); assert.ok(report.unboundInteractions.length > 0);
  assert.equal(report.nativeAcceptance, 'not-run'); assert.deepEqual(report.shippedEditors, ['journey-lens']);
});
test('every first-run npm script exists in the generated devkit contract', async () => {
  const emitter = await readFile(new URL('bin/compiler/adapters/plugin-emitter.ts',root),'utf8');
  for (const definition of [golden,showcase]) {
    assert.ok(definition.firstRun.includes('build-preview'));
    const step = definition.processes.find(p => p.id === 'build-preview').steps[0];
    assert.deepEqual(step.args, ['run','build:clickdummy']); assert.ok(emitter.includes("scripts['build:clickdummy'] = "));
  }
});
async function qualificationFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'golden-qualification-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir,'configs/starters'), {recursive:true}); await writeFile(join(dir,'configs/starters/companion-plugin.json'),text);
  await mkdir(join(dir,'reports/companion-mvp'), {recursive:true}); const html='<!doctype html><title>Empty test build</title>';
  await writeFile(join(dir,'reports/companion-mvp/index.html'),html);
  await writeFile(join(dir,'reports/companion-mvp/build.json'),JSON.stringify({schema:1,startup:'empty-or-restored',html:hash(html)})); return dir;
}
test('explicit qualification export binds canonical starter, exact project bytes and empty build', async t => {
  const dir=await qualificationFixture(t); await exportGoldenProject(dir); await exportGoldenProject(dir,true);
  const receipt=await authoringEvidence(dir); assert.equal(receipt.projectSha256,hash(await readFile(join(dir,'reports/companion-mvp/companion-project.json'))));
  assert.equal((await loadDefinitions(dir)).length,1);
});
test('starter edits invalidate a qualification receipt, even if old project and HTML stay unchanged', async t => {
  const dir=await qualificationFixture(t);await exportGoldenProject(dir);
  await writeFile(join(dir,'configs/starters/companion-plugin.json'),text+' ');
  await assert.rejects(authoringEvidence(dir),/AUTHORING_EVIDENCE_CHANGED/);
});
test('qualification does not recreate a missing canonical starter from the legacy project file', async t => {
  const dir=await qualificationFixture(t);await rm(join(dir,'configs/starters/companion-plugin.json'));
  await assert.rejects(exportGoldenProject(dir),/GOLDEN_STARTER_REQUIRED/);
});

test('exporting an edited project preserves the full reviewed starter recipe and input defaults', () => {
  const supplied={id:'reviewed-copy',name:'Reviewed Copy'}, project=configureBrowserStarter(showcase,'b'.repeat(64),supplied);
  project.design.nodes[0].label='Edited workspace';project.project.name='Edited Copy';
  const exported=exportBrowserStarter(showcase,'b'.repeat(64),project,supplied);
  assert.deepEqual(exported.files,showcase.files);assert.deepEqual(exported.processes,showcase.processes);assert.deepEqual(exported.firstRun,showcase.firstRun);
  assert.equal(exported.generator.document.design.nodes[0].label,'Edited workspace');assert.equal(exported.inputs.find(input=>input.id==='name').default,'Edited Copy');
  const reimported=configureBrowserStarter(exported,'c'.repeat(64),{});assert.equal(reimported.project.name,'Edited Copy');
  assert.equal(reimported.design.nodes[0].label,'Edited workspace');assert.equal(reimported.executable,false);
  assert.notEqual(showcase.generator.document.design.nodes[0].label,'Edited workspace');
});
test('native starter configuration is declared in JSON and travels through browser customization', async () => {
  const source=parseBrowserStarter(await readFile(new URL('configs/starters/custom-file-view.json',root),'utf8'));
  assert.equal(source.inputs.find(input=>input.id==='extension').default,'folio');
  const customized=configureBrowserStarter(source,'d'.repeat(64),{id:'my-format',name:'My Format',extension:'sketch'});
  assert.equal(customized.design.nativeIntegrations.fileTypes[0].extension,'sketch');
  assert.throws(()=>configureBrowserStarter(source,'d'.repeat(64),{id:'my-format',name:'My Format',extension:'md'}));
});
