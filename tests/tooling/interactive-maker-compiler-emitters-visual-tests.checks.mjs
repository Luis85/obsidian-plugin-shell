const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { visualTests, visualRendered, visualFixtureProps } from '../../src/cli/compiler/emitters/visual-tests.ts';
import { visualSpecs } from '../../src/cli/compiler/emitters/visual-model.ts';
import { visualSources } from '../../src/cli/compiler/emitters/visual-ports.ts';
import { richVisualDocument, model, recorder } from './compiler-emitters-fixture.mjs';

// Generated UI suites (visual-tests.ts) and the source/mapping checks of visual-ports.ts.
const rich = () => { const m = model(richVisualDocument()); return { m, specs: visualSpecs(m) }; };
const generate = (m, specs) => { const out = recorder(); visualTests(m, specs, out.add); return out; };
const blocks = text => text.split('\ndescribe(').slice(1).map(block => 'describe(' + block);
const nuxt = (id, entryId, extra = {}) => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: {}, slots: {}, events: [], ...extra });
const click = (id, actions) => [{ id, event: 'click', label: 'Run ' + id, notes: '', acceptance: '', actions }];

test('every definition gets per-state visibility, scenario and natively dispatched interaction cases', () => {
  const { m, specs } = rich(), out = generate(m, specs);
  assert.deepEqual([...out.files.keys()], ['tests/project/visual/definitions.test.ts']);
  const text = out.text('tests/project/visual/definitions.test.ts'), cases = blocks(text);
  // The generated suite opts into the DOM environment on its first line (a docblock this check must not repeat verbatim).
  assert.match(text.split('\n')[0], /^\/\/ @vitest-[a-z]+ happy-dom$/);
  assert.deepEqual(text.split('\n').slice(1, 8), ["import { describe, it, expect, vi } from 'vitest';", "import { mount, flushPromises } from '@vue/test-utils';",
    'import Subject0 from "../../../src/generated/presentation/components/details/vp-8.vue";', 'import Subject1 from "../../../src/generated/presentation/components/details/vp-15.vue";',
    'import Subject2 from "../../../src/generated/presentation/components/library/project-json-review.vue";',
    'import { visualKey, type VisualContext } from "../../../src/generated/presentation/composables/use-visual.ts";', 'import type { VisualRequest } from "../../../src/generated/domain/visual-runtime.ts";']);
  assert.ok(text.includes('  const runs = Array.from({ length: 5 }, () => vi.fn(async (_input?: unknown) => ({ ok: true })));\n'));
  assert.deepEqual(cases.map(block => block.split('\n')[2].replace(/", (async )?\(\) => \{$/, '').replace('it("', '')), [
    ...['default', 'loading', 'empty', 'error', 'disabled'].map(state => `renders declared ${state} visibility including hidden ancestors`), '[vi-14] dispatches the designed change interaction',
    ...['default', 'loading', 'empty', 'error', 'disabled'].map(state => `renders declared ${state} visibility including hidden ancestors`), 'scenario Filled renders its state and visibility',
    '[vi-19] dispatches the designed click interaction', '[vi-82] dispatches the designed change interaction', '[vi-88, vi-89] dispatches the designed click interaction',
    '[vi-95] dispatches the designed focus interaction', '[vi-97] dispatches the designed click interaction', '[vi-99] dispatches the designed keydown interaction',
    ...['default', 'loading', 'empty', 'error', 'disabled'].map(state => `renders declared ${state} visibility including hidden ancestors`), 'scenario Narrow review renders its state and visibility',
    '[vi-7] dispatches the designed click interaction', '[vi-73] dispatches the designed click interaction']);
  const group = id => cases.find(block => block.includes(`it("[${id}`)).split('\n').map(line => line.trim());
  const save = group('vi-88');
  for (const line of ['await fill(wrapper.findAllComponents({ name: "Input" }), "vn-81", "0");', 'await fill(wrapper.findAllComponents({ name: "Textarea" }), "vn-86", "{\\"fixture\\":true}");', 'f.reset();',
    'expect(f.runs[3]).toHaveBeenCalledWith({"title":"fixture","count":0,"done":true,"origin":"fixture"});', 'expect(f.runs[4]).toHaveBeenCalledWith(undefined);',
    "expect(wrapper.attributes('data-design-state')).toBe(\"empty\");", "expect(marked(wrapper.element, \"vn-83\").getAttribute('aria-checked')).toBe(\"true\");"])
    assert.ok(save.includes(line), line);
  const effects = group('vi-82');
  assert.ok(effects.includes('expect(marked(wrapper.element, "vn-80").value).toBe("Typed");') && effects.includes('expect(marked(wrapper.element, "vn-80").contains(document.activeElement)).toBe(true);'));
  assert.ok(!effects.some(line => line.startsWith('await fill(')));
  assert.ok(group('vi-99').includes('const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...{}, designState: "error" }, global: { provide: { [visualKey as symbol]: f.context } } });'));
  assert.ok(group('vi-95').includes('expect(f.handle.mock.calls.map(([request]) => request.interactionId)).toEqual(["vi-95"]);'));
  const emits = group('vi-73');
  for (const line of ['expect(wrapper.emitted("select")?.at(-1)).toEqual(["fixture"]);', 'expect(wrapper.emitted("amount")).toBeUndefined();', 'expect(wrapper.emitted("raw")?.at(-1)).toEqual([{"any":true}]);',
    'expect(wrapper.emitted("cancel")?.at(-1)).toEqual([undefined]);', 'expect(wrapper.emitted("flag")?.at(-1)).toEqual([false]);'])
    assert.ok(emits.includes(line), line);
  const loading = cases.find(block => block.includes('Subject1') && block.includes('renders declared loading'));
  assert.ok(loading.includes('    for (const id of ["vn-18","vn-80","vn-81","vn-83","vn-84","vn-85","vn-86","vn-87"]) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);'));
  assert.equal(generate(m, []).files.size, 0);
});

test('rendered nodes and fixture props follow what the definition itself renders', () => {
  const { specs } = rich(), page = specs[1];
  const rendered = visualRendered(page.root);
  assert.deepEqual(rendered.filter(entry => !entry.marked).map(entry => entry.node.id), ['vn-102']);
  assert.ok(rendered.some(entry => entry.node.id === 'vn-94') && !rendered.some(entry => entry.node.id === 'vn-103'));
  assert.deepEqual(visualRendered(specs[2].template).map(entry => entry.node.id), ['vn-2', 'vn-3', 'vn-4', 'vn-6', 'vn-5', 'vn-100', 'vn-101', 'vn-70', 'vn-74', 'vn-72']);
  assert.deepEqual(visualFixtureProps(specs[2]), { title: 'fixture', busy: false, count: 0, label: 'fixture', open: false });
  assert.deepEqual(visualFixtureProps(page), {});
});

test('control fixtures mirror typed raw input and skip values the control would refuse', () => {
  const { m, specs } = rich(), page = specs[1];
  const controls = [nuxt('c1', 'u-input', { control: { kind: 'date' } }), nuxt('c2', 'u-input', { control: { kind: 'datetime-local' } }), nuxt('c3', 'u-textarea', { control: { kind: 'json-file' } }),
    nuxt('c4', 'u-checkbox', { control: { kind: 'date' } }), nuxt('c5', 'u-textarea', { control: { kind: 'markdown-editor' } }), nuxt('c6', 'u-input'), nuxt('c7', 'u-switch'),
    nuxt('c8', 'u-input', { control: { kind: 'number', maxBytes: 1 } })];
  const button = nuxt('b1', 'u-button', { events: click('vi-1', [{ kind: 'source', sourceId: 'ds-source-60', operationId: 'ds-operation-61', input: { kind: 'object', fields: { title: { kind: 'draft', nodeId: 'c1' }, origin: { kind: 'event' } } } }]) });
  const spec = { ...page, scenarios: [], root: [...controls, button] };
  const text = generate(m, [spec]).text('tests/project/visual/definitions.test.ts');
  for (const line of ['"c1", "2026-01-01"', '"c2", "2026-01-01T12:30"', '"c3", "{\\"fixture\\":true}"', '"c5", "fixture"', '"c6", "fixture"', '"c7", true'])
    assert.ok(text.includes(line + ');'), line);
  assert.ok(text.includes('"c8", "0");') && !text.includes('"c4", '));
  assert.ok(!text.includes('f.runs[3]).toHaveBeenCalledWith'));
});

test('long suites split into bounded files and an oversized single case is refused', () => {
  const { m, specs } = rich();
  const many = Array.from({ length: 12 }, (_, i) => ({ ...specs[1], id: 'vp-copy-' + i }));
  const out = generate(m, many);
  assert.deepEqual([...out.files.keys()], ['tests/project/visual/definitions.test.ts', ...Array.from({ length: out.files.size - 1 }, (_, i) => `tests/project/visual/definitions-${i + 2}.test.ts`)]);
  assert.ok(out.files.size > 2);
  for (const [, entry] of out.files) assert.ok(entry.content.split('\n').length <= 400);
  const second = out.text('tests/project/visual/definitions-2.test.ts');
  const imported = [...second.matchAll(/^import (Subject\d+) from "\.\.\/\.\.\/\.\.\/src\/generated\/presentation\/components\/details\/vp-copy-\d+\.vue";$/gm)].map(match => match[1]);
  assert.ok(imported.length > 0 && !imported.includes('Subject0'));
  assert.deepEqual([...new Set([...second.matchAll(/^const Subject = (Subject\d+);$/gm)].map(match => match[1]))], imported);
  const wide = { ...specs[1], scenarios: [], root: [...Array.from({ length: 420 }, (_, i) => nuxt('w' + i, 'u-input', { control: { kind: 'text' } })),
    nuxt('go', 'u-button', { events: click('vi-go', [{ kind: 'source', sourceId: 'ds-source-60', operationId: 'ds-operation-62', input: { kind: 'none' } }]) })] };
  assert.throws(() => generate(m, [wide]), { message: 'VISUAL_TEST_TOO_LARGE: Split this definition interaction into smaller reviewed steps.' });
});

test('visual source references must exist, be readable and match their declared schemas', () => {
  const { m, specs } = rich(), page = specs[1];
  const check = (root, scenarios = []) => () => visualSources(m, [{ ...page, root, scenarios }]);
  const text = value => ({ id: 't1', kind: 'text', role: 'p', value: { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', ...value } });
  const where = 'VISUAL_INVALID: Page "Component library" / t1: ';
  assert.throws(check([text({ operationId: 'ds-operation-404', field: '' })]), { message: where + 'unknown source operation ds-source-1/ds-operation-404.' });
  assert.throws(check([text({ sourceId: 'ds-source-60', operationId: 'ds-operation-61', field: '' })]), { message: where + 'ds-source-60/ds-operation-61 is write-only and cannot be read.' });
  for (const field of ['0.missing', '__proto__', '0.title.x', 'a b', 'title'])
    assert.throws(check([text({ field })]), { message: where + `field ${JSON.stringify(field)} is not in the output of ds-source-1/ds-operation-6.` }, field);
  assert.deepEqual(check([text({ field: '0.title' })])().map(use => use.operation.id), ['ds-operation-6']);
  assert.throws(check([], [{ id: 's1', name: 'Bad', state: 'default', width: 'wide', values: {}, bindings: [{ sourceId: 'ds-source-1', operationId: 'ds-operation-6', value: 'x' }] }]),
    { message: 'VISUAL_INVALID: Page "Component library" scenario "Bad": fixture for ds-source-1/ds-operation-6 does not match its output.' });
  const source = (operationId, input) => [nuxt('b1', 'u-button', { events: click('vi-1', [{ kind: 'source', sourceId: 'ds-source-60', operationId, input }]) })];
  const at = 'VISUAL_INVALID: Page "Component library" / b1 → Run vi-1: ';
  assert.throws(check(source('ds-operation-62', { kind: 'value', value: 1 })), { message: at + 'ds-source-60/ds-operation-62 takes no input, so map none.' });
  assert.throws(check(source('ds-operation-61', { kind: 'none' })), { message: at + 'ds-source-60/ds-operation-61 requires an input mapping.' });
  assert.throws(check(source('ds-operation-61', { kind: 'value', value: { title: 1 } })), { message: at + 'literal input violates the input of ds-source-60/ds-operation-61.' });
  assert.throws(check(source('ds-operation-61', { kind: 'object', fields: { count: { kind: 'value', value: 1 } } })), { message: at + 'mapped input omits required fields of ds-source-60/ds-operation-61.' });
  assert.throws(check(source('ds-operation-61', { kind: 'object', fields: { title: { kind: 'value', value: 'a' }, extra: { kind: 'value', value: 1 } } })), { message: at + 'mapped input has fields ds-source-60/ds-operation-61 does not declare.' });
  check(source('ds-operation-61', { kind: 'value', value: { title: 'a' } }))();
  const hidden = [nuxt('b1', 'u-button', { visibleIn: ['loading'], events: click('vi-1', []) })];
  assert.throws(check(hidden), { message: 'VISUAL_INVALID: Page "Component library" / b1: interaction source has no enabled visible state.' });
});

test('component emits must agree with their declared payload contract', () => {
  const { m, specs } = rich(), component = specs[2];
  const emit = (event, payload) => () => visualSources(m, [{ ...component, scenarios: [], template: [nuxt('b1', 'u-button', { name: 'Emitter', events: click('vi-1', [{ kind: 'emit', event, payload }]) })] }]);
  const at = 'VISUAL_INVALID: Component "ProjectJsonReview" / Emitter → Run vi-1: ';
  assert.throws(emit('cancel', { kind: 'value', value: 'x' }), { message: at + 'emit cancel payload presence does not match its void contract.' });
  assert.throws(emit('select', { kind: 'none' }), { message: at + 'emit select payload presence does not match its string contract.' });
  assert.throws(emit('amount', { kind: 'value', value: 'x' }), { message: at + 'emit amount literal is not a number.' });
  emit('raw', { kind: 'value', value: 'anything' })(); emit('undeclared', { kind: 'value', value: 1 })();
  emit('select', { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: '0.id' })();
  assert.throws(emit('select', { kind: 'object', fields: { a: { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: 'nope' } } }),
    { message: at + 'field "nope" is not in the output of ds-source-1/ds-operation-6.' });
});
