import assert from 'node:assert/strict';
import { computeUiStatus } from '../../bin/domain/ui-status.ts';
import { readDefinitions, readInteractions, readJourneys } from '../../bin/domain/ui-status-input.ts';
import { scanStub, scanAcceptanceTest, scanSpec, mentions } from '../../bin/domain/ui-status-source.ts';
import { summarizeE2e, summarizeGallery } from '../../bin/domain/ui-status-evidence.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const STUB = 'export const execute = async () => { throw new NotImplementedError("vp-1", "vi-1"); };\n';
const DONE = 'export const execute = async () => ({ saved: true });\n';
const TODO = "import { it } from 'vitest';\nit.todo('[vi-1] capture');\n";
const REAL = "import { it, expect } from 'vitest';\nit('[vi-1] capture', () => { expect(1).toBe(1); });\n";
const absent = { state: 'absent' };
const project = { design: { nodes: [{ id: 'node-2', label: 'Capture inbox' }], library: [{ id: 'card', name: 'Card' }],
  sitemap: { journeys: [{ id: 'j1', name: 'Capture', steps: [{ id: 's1', surface: 'node-2' }, { id: 's2', surface: 'node-2' }] }] } } };
const traceability = (interactions = []) => ({
  definitions: [{ id: 'vp-1', kind: 'page', ownerId: 'node-2', component: 'a.vue' }, { id: 'vc-2', kind: 'component', libraryId: 'card', component: 'b.vue' }],
  interactions,
});
const hook = (id, extra = {}) => ({ id, definitionId: 'vp-1', nodeId: 'vn-1', label: id, event: 'click', verification: 'business-todo',
  implementation: `src/${id}.ts`, test: `tests/${id}.test.ts`, ...extra });
function status({ interactions, files = {}, specs = [], e2e = absent, gallery = absent, journeys = project } = {}) {
  const trace = traceability(interactions);
  return computeUiStatus({ sources: { traceability: 'present', project: 'present' }, definitions: readDefinitions(trace, project),
    interactions: readInteractions(trace), journeys: readJourneys(journeys), files, specs, e2e, gallery });
}
const byId = (report, id) => report.interactions.find(item => item.id === id);

test('generated stubs and todo tests are todo, never implemented', () => {
  const report = status({ interactions: [hook('vi-1')], files: { 'src/vi-1.ts': STUB, 'tests/vi-1.test.ts': TODO } });
  const item = byId(report, 'vi-1');
  assert.equal(item.state, 'todo');
  assert.deepEqual(item.reasons, ['stub-throws-not-implemented', 'test-has-todo']);
  assert.equal(report.surfaces[0].state, 'todo');
  assert.equal(report.behaviorAcceptance, 'not-run');
  assert.match(report.proof, /no test was executed/);
});
test('implemented requires a stub that no longer throws and a test without todo that has a runnable case', () => {
  const report = status({ interactions: [hook('vi-1')], files: { 'src/vi-1.ts': DONE, 'tests/vi-1.test.ts': REAL } });
  assert.equal(byId(report, 'vi-1').state, 'implemented');
  assert.equal(report.surfaces[0].state, 'implemented');
  assert.deepEqual(report.totals.interactions, { total: 1, generated: 0, todo: 0, implemented: 1 });
});
test('half-done work stays todo: implemented stub with todo test, or real test with throwing stub', () => {
  const report = status({ interactions: [hook('vi-1'), hook('vi-2')], files: {
    'src/vi-1.ts': DONE, 'tests/vi-1.test.ts': TODO, 'src/vi-2.ts': STUB, 'tests/vi-2.test.ts': REAL } });
  assert.deepEqual([byId(report, 'vi-1').reasons, byId(report, 'vi-2').reasons], [['test-has-todo'], ['stub-throws-not-implemented']]);
});
test('missing, empty and skipped files are todo with explicit reasons', () => {
  const report = status({ interactions: [hook('vi-1'), hook('vi-2'), hook('vi-3')], files: {
    'src/vi-1.ts': null, 'tests/vi-1.test.ts': null,
    'src/vi-2.ts': DONE, 'tests/vi-2.test.ts': '// nothing here\n',
    'src/vi-3.ts': DONE, 'tests/vi-3.test.ts': "it.skip('[vi-3] later', () => {});\n" } });
  assert.deepEqual(byId(report, 'vi-1').reasons, ['stub-missing', 'test-missing']);
  assert.deepEqual(byId(report, 'vi-2').reasons, ['test-has-no-active-case']);
  assert.deepEqual(byId(report, 'vi-3').reasons, ['test-has-skipped']);
  assert.equal(byId(report, 'vi-1').stub.exists, false);
});
test('mixed surfaces: one pending interaction keeps the surface todo; ui-effect-only surfaces are generated', () => {
  const effect = hook('vi-9', { verification: 'executable-ui-effect', implementation: null, test: null });
  const mixed = status({ interactions: [hook('vi-1'), hook('vi-2'), effect], files: {
    'src/vi-1.ts': DONE, 'tests/vi-1.test.ts': REAL, 'src/vi-2.ts': STUB, 'tests/vi-2.test.ts': TODO } });
  assert.deepEqual(mixed.surfaces[0].interactions, { total: 3, generated: 1, todo: 1, implemented: 1 });
  assert.equal(mixed.surfaces[0].state, 'todo');
  assert.equal(mixed.surfaces[1].state, 'generated', 'a surface without interactions has nothing implemented');
  const only = status({ interactions: [effect] });
  assert.equal(only.surfaces[0].state, 'generated');
  assert.equal(byId(only, 'vi-9').state, 'generated');
});
test('navigation interactions with only an acceptance test follow that test', () => {
  const nav = hook('vi-5', { verification: 'navigation', implementation: null });
  assert.equal(byId(status({ interactions: [nav], files: { 'tests/vi-5.test.ts': TODO } }), 'vi-5').state, 'todo');
  assert.equal(byId(status({ interactions: [nav], files: { 'tests/vi-5.test.ts': REAL } }), 'vi-5').state, 'implemented');
});
test('an unlinked business hook is todo because absence of files proves nothing', () => {
  const orphan = hook('vi-6', { implementation: null, test: null });
  const item = byId(status({ interactions: [orphan] }), 'vi-6');
  assert.deepEqual([item.state, item.reasons], ['todo', ['hook-not-linked']]);
});
test('optional W12b fields are read when present and ignored when absent', () => {
  const plain = status({ interactions: [hook('vi-1')], files: { 'src/vi-1.ts': DONE, 'tests/vi-1.test.ts': REAL } });
  assert.equal('declared' in byId(plain, 'vi-1'), false);
  assert.equal('declaredAcceptance' in plain.surfaces[0], false);
  const trace = { definitions: [{ id: 'vp-1', kind: 'page', ownerId: 'node-2', acceptance: { mode: 'journey', status: 'not-run' } }],
    interactions: [hook('vi-1', { testIds: ['a', 7, 'b'], evidence: [{ kind: 'screenshot' }, 'bad'] })] };
  const report = computeUiStatus({ sources: { traceability: 'present', project: 'absent' }, definitions: readDefinitions(trace, null),
    interactions: readInteractions(trace), journeys: [], files: {}, specs: [], e2e: absent, gallery: absent });
  assert.deepEqual(report.interactions[0].declared, { testIds: ['a', 'b'], evidence: [{ kind: 'screenshot' }] });
  assert.deepEqual(report.surfaces[0].declaredAcceptance, { mode: 'journey', status: 'not-run' });
});
test('the producer surfaces[] block attaches acceptance, testIds and evidence to its definition', () => {
  const trace = { definitions: [{ id: 'vp-1', kind: 'page', ownerId: 'node-2' }, { id: 'vp-3', kind: 'page', ownerId: 'node-9' }, { id: 'vp-4', kind: 'page', ownerId: 'node-8' }],
    surfaces: [{ id: 'node-2', definitionIds: ['vp-1'], acceptance: { themes: ['dark'] }, testIds: ['vitest:x#y', 4], evidence: [{ kind: 'gallery', path: 'a.png' }] },
      { id: 'node-9', definitionIds: [], acceptance: null, testIds: [], evidence: [] }, 'junk'], interactions: [] };
  const report = computeUiStatus({ sources: { traceability: 'present', project: 'absent' }, definitions: readDefinitions(trace, null),
    interactions: [], journeys: [], files: {}, specs: [], e2e: absent, gallery: absent });
  const [first, byOwner, none] = report.surfaces;
  assert.deepEqual(first.declaredAcceptance, { themes: ['dark'] });
  assert.deepEqual(first.declared, { testIds: ['vitest:x#y'], evidence: [{ kind: 'gallery', path: 'a.png' }] });
  assert.deepEqual(byOwner.declared, { testIds: [], evidence: [] }, 'matched by owner node id; empty lists are kept as declared');
  assert.equal('declared' in none, false);
});
test('specs link by whole interaction id, and journeys count steps with a literal [journey/step] title', () => {
  const specs = [
    { path: 'tests/e2e/journeys/j1.spec.ts', text: "import { test } from '@playwright/test';\ntest('[j1/s1] opens the inbox', async () => {});\n// test('[j1/s2] commented out', async () => {});\n" },
    { path: 'tests/e2e/ui-quality.spec.ts', text: "test('quality vi-10 and vp-1', async () => {});\n" },
  ];
  const report = status({ interactions: [hook('vi-1'), hook('vi-10')], specs });
  assert.deepEqual(byId(report, 'vi-1').specs, [], 'vi-1 must not match vi-10');
  assert.deepEqual(byId(report, 'vi-10').specs, ['tests/e2e/ui-quality.spec.ts']);
  assert.deepEqual(report.surfaces[0].specs, ['tests/e2e/ui-quality.spec.ts']);
  const [journey] = report.journeys;
  assert.deepEqual([journey.steps, journey.stepsWithSpec, journey.coverage], [2, 1, 'partial']);
  assert.equal(journey.details[0].spec, 'tests/e2e/journeys/j1.spec.ts');
  assert.deepEqual(report.totals.journeys, { total: 1, steps: 2, stepsWithSpec: 1 });
});
test('journeys without any matching title are none; fully matched are complete', () => {
  assert.equal(status().journeys[0].coverage, 'none');
  const text = "test('[j1/s1] a', () => {});\ntest(`[j1/s2] b`, () => {});\n";
  assert.equal(status({ specs: [{ path: 'x.spec.ts', text }] }).journeys[0].coverage, 'complete');
  assert.deepEqual(status({ journeys: {} }).journeys, []);
});
test('input readers drop malformed entries, duplicates and unknown kinds', () => {
  const definitions = readDefinitions({ definitions: [null, { id: 'a', kind: 'weird' }, { id: 'p', kind: 'page' }, { id: 'p', kind: 'page' }, { kind: 'page' }] }, undefined);
  assert.deepEqual(definitions.map(item => [item.id, item.label]), [['p', 'p']]);
  assert.deepEqual(readInteractions({ interactions: [{ id: 'x' }, { definitionId: 'p' }, { id: 'i', definitionId: 'p' }, { id: 'i', definitionId: 'p' }] }).map(item => item.id), ['i']);
  assert.deepEqual(readInteractions(null), []);
  assert.deepEqual(readJourneys({ design: { sitemap: { journeys: [{ id: 'j', steps: [{ id: 's' }, {}, null] }, {}] } } }), [{ id: 'j', name: 'j', steps: [{ id: 's', surface: '' }] }]);
  assert.equal(readDefinitions({ definitions: [{ id: 'c', kind: 'component', libraryId: 'card' }] }, project)[0].label, 'Card');
});
test('source scans ignore comments but keep strings, and ids match on whole identifiers', () => {
  assert.equal(scanStub('// throw new NotImplementedError()\n/* throw new NotImplementedError() */\nexport const a = 1;').throwsNotImplemented, false);
  assert.equal(scanStub('const m = "// not a comment"; throw new NotImplementedError("a");').throwsNotImplemented, true);
  assert.equal(scanStub("const a = 'x // y'; // tail\nthrow new NotImplementedError('a');").throwsNotImplemented, true, 'a // inside a string is code, so the throw after it counts');
  assert.equal(scanStub('const t = "unterminated').throwsNotImplemented, false);
  assert.equal(scanStub('/* open throw new NotImplementedError()').throwsNotImplemented, false);
  assert.equal(scanStub(String.raw`const s = 'it\'s'; // throw new NotImplementedError()`).throwsNotImplemented, false, 'an escaped quote does not end the string early');
  const facts = scanAcceptanceTest("// it.todo('a')\nit.todo('b');\ntest.skip('c', () => {});\ntest('d', () => {});\nit.each([1])('e', () => {});\nx.it('f');");
  assert.deepEqual(facts, { todo: 1, skipped: 1, active: 2 });
  assert.equal(mentions('see vi-1, vi-10', 'vi-1'), true);
  assert.equal(mentions('see vi-10', 'vi-1'), false);
  assert.equal(mentions('a.b', 'a.b'), true);
  assert.equal(mentions('anything', ''), false);
  const spec = scanSpec({ path: 'a.spec.ts', text: "test.describe('group', () => { test.only(\"one\", () => {}); test(`two ${x}`, () => {}); });" });
  assert.deepEqual(spec.titles, ['group', 'one']);
});
test('e2e evidence summarises a Playwright JSON report without promoting it to acceptance', () => {
  const value = { suites: [{ file: 'tests/e2e/ui-quality.spec.ts', specs: [
    { title: '[vi-1] ok on vp-1 @ 390px dark', ok: true, tests: [{ projectName: 'chromium-light-1280', status: 'expected' }] },
    { title: 'vi-2 broken', ok: false, tests: [{ projectName: 'chromium', status: 'unexpected' }] },
    { title: 'skipped', tests: [{ status: 'skipped' }] }, { title: 'bare ok', ok: true }] },
    { suites: [{ specs: [{ title: 'nested', ok: false }] }] }] };
  const summary = summarizeE2e({ state: 'present', value }, ['vi-1', 'vi-2', 'vp-1']);
  assert.deepEqual([summary.specs, summary.passed, summary.failed, summary.skipped], [5, 2, 2, 1]);
  assert.deepEqual(summary.themes, ['dark', 'light']);
  assert.deepEqual(summary.widths, [390, 1280]);
  assert.deepEqual(summary.passedIds, ['vi-1', 'vp-1']);
  assert.deepEqual(summarizeE2e({ state: 'invalid' }, []).state, 'invalid');
  assert.equal(summarizeE2e({ state: 'present', value: 'nope' }, []).specs, 0);
  const labels = summarizeE2e({ state: 'present', value: { suites: [{ specs: [{ title: 'Dark and LIGHT w768 1280x800 @390 5000px 12px 3000px', ok: true }] }] } }, []);
  assert.deepEqual([labels.themes, labels.widths], [['dark', 'light'], [390, 768, 1280, 3000]]);
});
test('gallery evidence reads entries, top-level lists and reports unrecognised shapes honestly', () => {
  const entries = [{ surfaceId: 'vp-1', theme: 'dark', width: 390 }, { surfaceId: 'vp-1', theme: 'light', viewport: { width: '1280' } }, 'junk'];
  const index = summarizeGallery({ state: 'present', value: { schemaVersion: 1, entries } });
  assert.deepEqual([index.recognized, index.entries, index.surfaces, index.themes, index.widths], [true, 2, ['vp-1'], ['dark', 'light'], [390, 1280]]);
  const loose = summarizeGallery({ state: 'present', value: { themes: ['dark', 3], widths: [768, 'x'] } });
  assert.deepEqual([loose.recognized, loose.themes, loose.widths], [false, ['dark'], [768]]);
  assert.equal(summarizeGallery({ state: 'present', value: [{ id: 'x' }] }).surfaces[0], 'x');
  assert.equal(summarizeGallery({ state: 'absent' }).state, 'absent');
  const report = status({ interactions: [hook('vi-1')], gallery: { state: 'present', value: { entries: [{ surfaceId: 'node-2', theme: 'dark', width: 390 }] } } });
  assert.deepEqual(report.evidence.surfacesWithoutGalleryEntry, ['vc-2'], 'owner node ids count as covered; the component has no capture');
  assert.deepEqual(status({ gallery: { state: 'present', value: {} } }).evidence.surfacesWithoutGalleryEntry, []);
});
