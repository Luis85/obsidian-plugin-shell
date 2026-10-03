import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectModel } from '../../bin/compiler/emitters/model.ts';
import { visualSpecs } from '../../bin/compiler/emitters/visual-model.ts';
import { clickdummyCode } from '../../bin/compiler/emitters/clickdummy-code.ts';
import { clickdummyScenariosCode } from '../../bin/compiler/emitters/clickdummy-scenarios-code.ts';
import { starterDocument } from '../support/starter-documents.mjs';
const document = starterDocument('quick-capture');
const model = projectModel(document);
function emit(m = model) { let source; clickdummyScenariosCode(m, (path, content) => { assert.equal(path, 'harness/prototype/clickdummy-scenarios.ts'); source = content; }); return source; }
async function load(t, source = emit()) {
  const root = await mkdtemp(join(tmpdir(), 'preview-scenarios-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'scenarios.mts'); await writeFile(path, source);
  return import(pathToFileURL(path).href);
}
test('emitted scenario choices retain canonical identity, name, state and width for every page', async t => {
  const { scenariosForSurface } = await load(t);
  for (const spec of visualSpecs(model).filter(item => item.kind === 'page')) {
    assert.deepEqual(scenariosForSurface(spec.ownerId), spec.scenarios.map(s => ({
      id: s.id, definition: spec.id, surface: spec.ownerId, name: s.name, state: s.state, width: s.width,
    })));
  }
  assert.deepEqual(scenariosForSurface('missing'), []);
});
test('scenario lookup cannot use a choice from another surface or an unknown identifier', async t => {
  const { scenariosForSurface, resolveScenario } = await load(t), first = scenariosForSurface('node-2')[0];
  assert.ok(first); assert.deepEqual(resolveScenario('node-2', first.id), first);
  assert.equal(resolveScenario('node-2', ''), null);
  for (const [surface, id] of [['node-3', first.id], ['missing', first.id], ['node-2', 'absent']]) {
    assert.throws(() => resolveScenario(surface, id), /^Error: PREVIEW_SCENARIO_UNAVAILABLE$/);
  }
});
test('returned scenario metadata is detached and cannot poison later previews', async t => {
  const { scenariosForSurface, resolveScenario } = await load(t), original = scenariosForSurface('node-2');
  const changed = scenariosForSurface('node-2'); changed[0].name = 'Caller edit'; changed.length = 0;
  const selected = resolveScenario('node-2', original[0].id); selected.surface = 'different';
  assert.deepEqual(scenariosForSurface('node-2'), original);
});
test('empty starters have no invented sample scenarios and require no runtime dependencies', async t => {
  const blank = projectModel(starterDocument('blank'));
  const source = emit(blank), api = await load(t, source);
  assert.deepEqual(api.scenariosForSurface('any'), []); assert.equal(api.resolveScenario('any', ''), null);
  assert.doesNotMatch(source, /\bimport\b|\bfetch\s*\(/);
});
test('metadata emission is deterministic, escaped, independent of folders and contains no fixture values', async t => {
  const source = emit(); assert.equal(source, emit());
  assert.equal(source, emit({ ...model, sourceRoot: 'application/custom' }));
  assert.doesNotMatch(source, /"bindings"|"values"|"sourceId"|"operationId"/);
  const copy = structuredClone(document), name = '</script> "Review" & 日本語';
  copy.design.visualDesigns.pages[0].scenarios[0].name = name;
  const unsafeName = emit(projectModel(copy)); assert.doesNotMatch(unsafeName, /<\/script>/);
  const api = await load(t, unsafeName); assert.equal(api.scenariosForSurface('node-2')[0].name, name);
});
test('generated selector and per-frame context feed only the matching visual definition', () => {
  const files = new Map(); clickdummyCode(model, (path, content) => files.set(path, content));
  const entry = files.get('harness/prototype/clickdummy.ts'), view = files.get(model.sourceRoot + '/presentation/components/ClickdummyPreview.vue');
  assert.match(entry, /const selection = ref<PreviewScenario \| null>\(null\)/);
  assert.match(entry, /resolveScenario\(navigation.current, id\)/);
  assert.match(entry, /selection.value\?\.definition === definition \? selection.value.id : undefined/);
  assert.match(entry, /watch\(\(\) => navigation.current, \(\) =>/);
  assert.match(entry, /selection.value = null; state.value = 'default'/);
  assert.match(view, /<label for="clickdummy-scenario">Authored scenario<\/label>/);
  assert.match(view, /:disabled="!model.scenarios\(\).length"/);
  assert.match(view, /model.selectScenario\(/); assert.match(view, /model.state.value \+ '\/' \+ model.scenario\(\)/);
  assert.match(view, /no data is saved/);
  assert.match(entry, /inheritedReadOnly \|\| selection.value !== null/);
  assert.match(entry, /mountFrame\(target, surface, scenarioReadOnly\)/);
  assert.match(entry, /openModal: frameOpenModal/);
});
