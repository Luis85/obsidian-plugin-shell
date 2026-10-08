// Compiler: per-surface UX acceptance obligations, test ids and evidence placeholders in design/visual-traceability.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../compiler/emitters/model.ts';
import { projectFiles } from './support/project-render.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const starter = async name => JSON.parse(await readFile(new URL(`../../../configs/starters/${name}.json`, import.meta.url), 'utf8')).generator.document;
const render = async document => new Map((await projectFiles(root, projectModel(document))).map(entry => [entry.path, entry.content]));
const traceOf = files => JSON.parse(files.get('design/visual-traceability.json'));
const ux = files => [...files.keys()].filter(path => path.startsWith('src/plugin/tests/project/ux-acceptance/'));

test('surfaces with an acceptance block get one countable it.todo per state, keyboard step, focus return and width', async () => {
  const files = await render(await starter('feature-showcase'));
  assert.deepEqual(ux(files), ['src/plugin/tests/project/ux-acceptance/forms.test.ts', 'src/plugin/tests/project/ux-acceptance/overlays.test.ts']);
  const lines = path => files.get(path).split('\n').filter(line => line.startsWith('it.todo('));
  assert.equal(lines('src/plugin/tests/project/ux-acceptance/forms.test.ts').length, 5 + 6 + 1);
  assert.deepEqual(lines('src/plugin/tests/project/ux-acceptance/overlays.test.ts'), [
    'it.todo("[node-6] Dialogs and drawers: renders the default state");',
    'it.todo("[node-6] Dialogs and drawers: keyboard step 1 reaches Open Example dialog");',
    'it.todo("[node-6] Dialogs and drawers: keyboard step 2 reaches Close Example dialog");',
    'it.todo("[node-6] Dialogs and drawers: keyboard step 3 reaches Open Example drawer");',
    'it.todo("[node-6] Dialogs and drawers: keyboard step 4 reaches Close Example drawer");',
    'it.todo("[node-6] Dialogs and drawers: returns focus to the invoking control on close");',
    'it.todo("[node-6] Dialogs and drawers: stays usable at 360px width");',
  ]);
  assert.match(files.get('src/plugin/tests/project/ux-acceptance/forms.test.ts'), /reaches vn-36"\);/);
  assert.match(files.get('src/plugin/tests/project/ux-acceptance/forms.test.ts'), /stays usable at 360px width/);
});
test('traceability carries the resolved block, covering test ids and an empty evidence placeholder per surface and interaction', async () => {
  const trace = traceOf(await render(await starter('feature-showcase')));
  const forms = trace.surfaces.find(s => s.id === 'node-2'), overlays = trace.surfaces.find(s => s.id === 'node-6'), home = trace.surfaces.find(s => s.id === 'node-1');
  assert.deepEqual(forms.acceptance, { states: ['default', 'loading', 'empty', 'error', 'disabled'], keyboardPath: ['vn-36', 'vn-39', 'vn-42', 'vn-45', 'vn-54', 'vn-69'], focusReturn: false, minWidth: 360, themes: ['light', 'dark'], notes: 'Tab order follows the visual order of the controls; every control keeps a visible focus ring.' });
  assert.deepEqual(overlays.acceptance, { states: ['default'], keyboardPath: ['Open Example dialog', 'Close Example dialog', 'Open Example drawer', 'Close Example drawer'], focusReturn: true, minWidth: 360, themes: ['light', 'dark'], notes: '' });
  assert.equal(home.acceptance, null);
  for (const entry of [...trace.surfaces, ...trace.interactions]) {
    assert.deepEqual(entry.evidence, []);
    assert.ok(Array.isArray(entry.testIds) && new Set(entry.testIds).size === entry.testIds.length);
  }
  assert.deepEqual(overlays.definitionIds, ['vp-6']);
  assert.ok(overlays.testIds.includes('vitest:src/plugin/tests/project/ux-acceptance/overlays.test.ts#[node-6] Dialogs and drawers: returns focus to the invoking control on close'));
  assert.ok(overlays.testIds.includes('vitest:src/plugin/tests/project/navigation.test.ts#[edge-15] Open Dialogs and drawers'));
  assert.ok(overlays.testIds.includes('vitest:visual-definitions:vp-6 Dialogs and drawers > renders declared loading visibility including hidden ancestors'));
  assert.deepEqual(overlays.testIds.filter(id => id.startsWith('ui-quality:')), ['ui-quality:node-6:light', 'ui-quality:node-6:dark']);
  const journeyIds = trace.surfaces.flatMap(s => s.testIds.filter(id => id.startsWith('journey:')));
  assert.ok(journeyIds.length > 0 && journeyIds.every(id => /^journey:[^/]+\/[^/]+$/.test(id)), JSON.stringify(journeyIds));
  const navigation = trace.interactions.find(i => i.id === 'vi-12');
  assert.deepEqual(navigation.testIds, [
    'vitest:src/plugin/tests/project/acceptance/vi-12.test.ts#[vi-12] Form controls — The configured UI effect is observable without a backend.',
    'vitest:visual-definitions:vp-1 Feature showcase > [vi-12] dispatches the designed click interaction',
    'vitest:src/plugin/tests/project/navigation.test.ts#[edge-11] Open Form controls',
  ]);
});
test('every titled test id that names a generated file refers to a title the generated file contains', async () => {
  const files = await render(await starter('feature-showcase')), trace = traceOf(files);
  const ids = [...trace.surfaces, ...trace.interactions].flatMap(entry => entry.testIds).filter(id => id.startsWith('vitest:src/plugin/tests/'));
  assert.ok(ids.length > 40);
  for (const id of ids) {
    const [path, title] = id.slice('vitest:'.length).split('#');
    const source = files.get(path);
    assert.ok(source, 'missing generated file ' + path);
    assert.ok(source.includes(JSON.stringify(title).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e')) || source.includes(title), 'missing title ' + id);
  }
});
test('a project without any block gets no UX acceptance files, null acceptance and ui-quality ids for both themes', async () => {
  const files = await render(await starter('quick-capture')), trace = traceOf(files);
  assert.deepEqual(ux(files), []);
  assert.ok(trace.surfaces.length > 0 && trace.surfaces.every(s => s.acceptance === null));
  const page = trace.surfaces.find(s => s.definitionIds.length > 0);
  assert.deepEqual(page.testIds.filter(id => id.startsWith('ui-quality:')), [`ui-quality:${page.id}:light`, `ui-quality:${page.id}:dark`]);
  assert.deepEqual(trace.surfaces.find(s => s.definitionIds.length === 0)?.testIds.filter(id => id.startsWith('ui-quality:')) ?? [], []);
});
test('adding a block changes only the block-bearing outputs; unrelated generated files stay byte-identical', async () => {
  const bare = await starter('quick-capture'), declared = structuredClone(bare);
  const surface = declared.design.nodes.find(node => !['group', 'action'].includes(node.kind));
  surface.acceptance = { states: ['empty'], keyboardPath: ['Add'] };
  const [before, after] = [await render(bare), await render(declared)];
  // Only project-specific outputs are compared: framework files are shared with concurrent kit changes.
  const own = path => /^(src\/plugin\/tests\/project|src\/plugin\/generated|design)\//.test(path);
  const changed = [...after.keys()].filter(path => own(path) && before.get(path) !== after.get(path)).sort();
  assert.deepEqual(changed, ['design/project.json', 'design/visual-traceability.json', `src/plugin/tests/project/ux-acceptance/${surface.slug}.test.ts`]);
  assert.deepEqual([...before.keys()].filter(path => own(path) && !after.has(path)), []);
  assert.equal(traceOf(after).surfaces.find(s => s.id === surface.id).acceptance.minWidth, 360);
});
test('traceability output is deterministic across renders', async () => {
  const document = await starter('feature-showcase');
  assert.equal((await render(document)).get('design/visual-traceability.json'), (await render(structuredClone(document))).get('design/visual-traceability.json'));
});
