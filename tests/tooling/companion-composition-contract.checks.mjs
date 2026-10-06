// The shared composition contract stays live: visual validation, the page canvas, generated runtime styles and the
// executable UI-effect model. Fixtures are small synthetic documents; the design system is the golden self-project's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compositionDefaultUI, compositionLiteral, compositionSession, compositionStyle, compositionTestSource, compositionTheme, compositionTransition,
  compositionVisible, validateCompositionDesignSystem, validateCompositionEffect, validateCompositionNode, validateCompositionScenarios, validateCompositionUI } from '../../scripts/companion/composition-contract.mjs';
import { selfProject } from '../support/starter-documents.mjs';

const system = selfProject().design.designSystem;
const states = ['default', 'loading', 'empty', 'error', 'disabled'];
const node = (id, kind, parentId = null, extra = {}) => ({ id, kind, label: id, parentId, layout: 'stack', visibleIn: [...states], ...extra });
/** A region holding a button, an input, a checkbox and a select, with one interaction per effect type plus navigation. */
function documentFixture() {
  const nodes = [node('root', 'region'), node('go', 'button', 'root'), node('name', 'input', 'root'), node('done', 'checkbox', 'root'),
    node('mode', 'select', 'root', { options: ['list', 'board'] }), node('panel', 'region', 'root', { ui: { ...compositionDefaultUI(), narrow: { layout: 'stack', columns: 1, hidden: true } } })];
  const edge = (id, effect, target, extra = {}) => ({ id, label: 'Interaction ' + id, source: 'go', target, ...(effect ? { effect } : {}), ...extra });
  return { nodes, edges: [edge('e-state', { type: 'state', value: 'empty' }, 'root'), edge('e-toggle', { type: 'toggle', value: true }, 'panel'),
    edge('e-value', { type: 'value', value: 'board' }, 'mode'), edge('e-focus', { type: 'focus', value: true }, 'name'),
    edge('e-emit', { type: 'emit', value: 'saved', payload: 3 }, 'root'), edge('e-nav', null, 'root', { targetSurfaceId: 'node-2' }), edge('e-todo', null, 'root')],
    scenarios: [{ id: 'empty-state', name: 'Empty', state: 'empty', width: 'narrow', values: { name: 'x' }, bindings: [] }] };
}

test('default layout values validate; CSS, geometry and unknown narrow rules are refused', () => {
  validateCompositionUI(compositionDefaultUI());
  for (const [name, alter] of [['CSS injection', ui => ui.tokens.color = 'red;url(x)'], ['negative padding', ui => ui.padding = -1],
    ['infinite width', ui => ui.width = Infinity], ['unknown responsive rule', ui => ui.narrow.media = '@import'], ['unknown field', ui => ui.css = 'x'],
    ['inverted width range', ui => { ui.minWidth = 900; ui.maxWidth = 100; }]]) {
    const ui = compositionDefaultUI(); alter(ui);
    assert.throws(() => validateCompositionUI(ui), /COMPOSITION_INVALID/, name);
  }
});
test('node declarations bound slots, options and permitted content', () => {
  validateCompositionNode(node('slot', 'slot', null, { slotCapacity: 'one', slotKinds: ['text', 'button'] }));
  for (const [name, value] of [['capacity on a region', node('r', 'region', null, { slotCapacity: 'one' })], ['unknown slot content', node('s', 'slot', null, { slotKinds: ['script'] })],
    ['unsafe slot name', node('c', 'component', null, { slotName: '__proto__' })], ['too many options', node('m', 'select', null, { options: Array(31).fill('a') })]]) {
    assert.throws(() => validateCompositionNode(value), /COMPOSITION_INVALID/, name);
  }
});
test('effects are literal, typed against their target and never both navigation and a local effect', () => {
  const doc = documentFixture();
  for (const edge of doc.edges) validateCompositionEffect(edge, doc);
  for (const [name, alter] of [['ambiguous effect', e => e.targetSurfaceId = 'page'], ['unknown effect', e => e.effect.type = 'eval'],
    ['unknown state', e => e.effect.value = 'accepted'], ['object value', e => e.effect.value = {}]]) {
    const edge = structuredClone(doc.edges[0]); alter(edge);
    assert.throws(() => validateCompositionEffect(edge, doc), /COMPOSITION_INVALID/, name);
  }
  assert.throws(() => validateCompositionEffect({ ...doc.edges[3], target: 'root' }, doc), /focusable target/);
  assert.throws(() => validateCompositionEffect({ ...doc.edges[2], effect: { type: 'value', value: 'grid' } }, doc), /declared option/);
});
test('scenarios reference local elements with JSON-only fixture values', () => {
  const doc = documentFixture(); validateCompositionScenarios(doc);
  for (const [name, alter] of [['dangling element', s => s.values.notAnElement = 'bad'], ['unsafe key', s => s.bindings = [{ sourceId: 'src', operationId: 'op', value: JSON.parse('{"__proto__":{}}') }]],
    ['unknown width', s => s.width = 'phone'], ['duplicate binding', s => s.bindings = [{ sourceId: 'a', operationId: 'b', value: 1 }, { sourceId: 'a', operationId: 'b', value: 2 }]]]) {
    const copy = structuredClone(doc); alter(copy.scenarios[0]);
    assert.throws(() => validateCompositionScenarios(copy), /COMPOSITION_INVALID/, name);
  }
  assert.throws(() => compositionLiteral(new Date()), /JSON fixture values/);
});
test('typed layout resolves tokens and narrow semantics without mutating authored geometry', () => {
  const n = node('grid', 'region', null, { layout: 'grid', ui: { ...compositionDefaultUI(), columns: 3, tokens: { ...compositionDefaultUI().tokens, gap: 'md' } } });
  const before = JSON.stringify(n), token = system.spacing.find(t => t.id === 'md');
  assert.equal(compositionStyle(n, system).gridTemplateColumns, 'repeat(3, minmax(0, 1fr))');
  assert.equal(compositionStyle(n, system, true).flexDirection, 'column'); assert.equal(compositionStyle(n, system, true).gridTemplateColumns, 'repeat(1, minmax(0, 1fr))');
  assert.equal(compositionStyle(n, system).gap, token.value + token.unit); assert.equal(JSON.stringify(n), before);
  for (const color of system.colors) {
    assert.equal(compositionTheme(system, false)['--composition-color-' + color.id], color.light);
    assert.equal(compositionTheme(system, true)['--composition-color-' + color.id], color.dark);
  }
  validateCompositionDesignSystem(system);
  const unsafe = structuredClone(system); unsafe.colors[0].light = 'url(javascript:x)';
  assert.throws(() => validateCompositionDesignSystem(unsafe), /COMPOSITION_INVALID/);
});
test('every declared UI effect and navigation transitions without modifying the design or the input session', () => {
  const doc = documentFixture(), expected = { 'e-state': s => s.state === 'empty', 'e-toggle': s => s.hidden.panel === true, 'e-value': s => s.values.mode === 'board',
    'e-focus': s => s.focused === 'name', 'e-emit': s => s.emitted[0].name === 'saved' && s.emitted[0].payload === 3, 'e-nav': s => s.navigation === 'node-2' };
  for (const [id, check] of Object.entries(expected)) {
    const session = compositionSession(), before = JSON.stringify([doc, session]);
    assert.ok(check(compositionTransition(doc, session, id)), id); assert.equal(JSON.stringify([doc, session]), before, id);
  }
  assert.throws(() => compositionTransition(doc, compositionSession(), 'e-todo'), /IMPLEMENTATION_REQUIRED/);
  const scenario = compositionSession(doc.scenarios[0]); assert.deepEqual([scenario.state, scenario.width, scenario.values], ['empty', 'narrow', { name: 'x' }]);
});
test('hidden ancestors, narrow exclusion and disabled states prevent UI dispatch', () => {
  const doc = documentFixture(), source = doc.nodes.find(n => n.id === 'go'), session = compositionSession();
  session.state = 'disabled'; assert.throws(() => compositionTransition(doc, session, 'e-state'), /not enabled and visible/);
  session.state = 'default'; session.hidden.root = true;
  assert.equal(compositionVisible(doc, session, source), false); assert.throws(() => compositionTransition(doc, session, 'e-state'));
  assert.equal(compositionVisible(doc, { state: 'default', width: 'narrow' }, doc.nodes.find(n => n.id === 'panel')), false);
});
test('generated standalone UI-effect suite executes assertions and fails under a negative control', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'composition-tests-')), env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  try {
    const path = join(dir, 'effects.checks.mjs'), source = compositionTestSource(documentFixture());
    assert.match(source, /test\.todo\("Business implementation: Interaction e-todo"\)/);
    await writeFile(path, source);
    const good = spawnSync(process.execPath, ['--test', path], { encoding: 'utf8', env }); assert.equal(good.status, 0, good.stdout + good.stderr);
    await writeFile(path, source.replace('next.focused = edge.target', 'next.focused = "wrong"'));
    const bad = spawnSync(process.execPath, ['--test', path], { encoding: 'utf8', env }); assert.notEqual(bad.status, 0); assert.match(bad.stdout, /fail [1-9]/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
