import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { visualNodes } from '../companion/visual/visual-ir.mjs';
import { visualSession, visualVisible, visualTransition, visualValue, visualRead, visualTestSource } from '../companion/visual/visual-session.mjs';
const s = JSON.parse(await readFile('tests/fixtures/companion/visual-store.json', 'utf8'));
const page = s.pages[0], byName = n => visualNodes(page.root).find(x => x.name === n);
test('visibility follows state, ancestors, toggles and narrow hiding', () => {
  const session = visualSession();
  assert.equal(visualVisible(page, session, byName('Customer table').id), true);
  assert.equal(visualVisible(page, session, byName('Empty').id), false);
  assert.equal(visualVisible(page, visualSession(page.scenarios[0]), byName('Empty').id), true);
  const hidden = { ...session, hidden: { [byName('Content').id]: true } }; assert.equal(visualVisible(page, hidden, byName('Title').id), false);
});
test('transitions apply every action in order without mutating the input', () => {
  const reset = byName('Reset'), before = visualSession({ id: 'x', name: 'x', state: 'error', width: 'wide', values: {}, bindings: [] }); const frozen = JSON.stringify(before);
  const next = visualTransition(page, before, reset.id, reset.events[0].id);
  assert.equal(next.state, 'default'); assert.equal(next.hidden[byName('Empty').id], true); assert.equal(JSON.stringify(before), frozen);
  const link = byName('Settings link'); assert.equal(visualTransition(page, visualSession(), link.id, link.events[0].id).navigation, 'node-settings');
  assert.throws(() => visualTransition(page, visualSession(), link.id, link.events[1].id), /IMPLEMENTATION_REQUIRED: Unimplemented/);
  assert.throws(() => visualTransition(page, { ...visualSession(), state: 'loading' }, link.id, link.events[0].id), /not enabled/);
  const search = byName('Customer search'); assert.deepEqual(visualTransition(page, visualSession(), search.id, search.events[0].id).requests, [{ sourceId: 'customers', operationId: 'list', interactionId: search.events[0].id }]);
});
test('values resolve literals, props, state and fixture bindings safely', () => {
  const session = visualSession(page.scenarios[0]);
  assert.deepEqual(visualValue(session, byName('Customer table').props.data), []);
  assert.equal(visualValue(session, { kind: 'prop', name: 'q' }, { q: 'x' }), 'x');
  assert.equal(visualRead({ a: { b: 1 } }, 'a.b'), 1); assert.equal(visualRead({}, '__proto__.polluted'), undefined);
});
test('generated model tests run green and count todos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'visual-session-')); const file = join(dir, 'model.checks.mjs');
  await writeFile(file, visualTestSource(page));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) });
  assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /# todo 1/); assert.match(run.stdout, /# pass [1-9]/);
});
test('emit action without payload', () => {
  const def = { id: 'vp-emit', name: 'EmitTest', root: [{ id: 'vn-btn', kind: 'element', tag: 'button', name: 'Button', attrs: {}, children: [], events: [{ id: 'vi-1', label: 'click', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'void' } }] }] }] };
  const next = visualTransition(def, visualSession(), 'vn-btn', 'vi-1');
  assert.deepEqual(next.emitted, [{ name: 'search', source: 'vn-btn' }]);
});
test('emit action with value payload', () => {
  const def = { id: 'vp-emit', name: 'EmitTest', root: [{ id: 'vn-btn', kind: 'element', tag: 'button', name: 'Button', attrs: {}, children: [], events: [{ id: 'vi-1', label: 'click', actions: [{ kind: 'emit', event: 'search', payload: { kind: 'value', value: 'test' } }] }] }] };
  const next = visualTransition(def, visualSession(), 'vn-btn', 'vi-1');
  assert.deepEqual(next.emitted, [{ name: 'search', source: 'vn-btn', payload: 'test' }]);
});
test('focus action on visible target sets focused', () => {
  const def = { id: 'vp-focus', name: 'FocusTest', root: [{ id: 'vn-btn', kind: 'element', tag: 'button', name: 'Button', attrs: {}, children: [], events: [{ id: 'vi-1', label: 'click', actions: [{ kind: 'focus', nodeId: 'vn-input' }] }] }, { id: 'vn-input', kind: 'element', tag: 'input', attrs: {}, children: [], events: [] }] };
  const next = visualTransition(def, visualSession(), 'vn-btn', 'vi-1');
  assert.equal(next.focused, 'vn-input');
});
test('focus action on hidden target throws', () => {
  const def = { id: 'vp-focus', name: 'FocusTest', root: [{ id: 'vn-btn', kind: 'element', tag: 'button', name: 'Button', attrs: {}, children: [], events: [{ id: 'vi-1', label: 'click', actions: [{ kind: 'focus', nodeId: 'vn-hidden' }] }] }, { id: 'vn-hidden', kind: 'element', tag: 'input', attrs: {}, children: [], events: [], visibleIn: ['empty'] }] };
  assert.throws(() => visualTransition(def, visualSession(), 'vn-btn', 'vi-1'), /hidden/);
});
test('narrow hiding makes node invisible when width is narrow', () => {
  const def = { id: 'vp-narrow', name: 'NarrowTest', root: [{ id: 'vn-elem', kind: 'element', tag: 'div', attrs: {}, children: [], events: [], layout: { ui: { narrow: { hidden: true } } } }] };
  const wideSession = visualSession();
  assert.equal(visualVisible(def, wideSession, 'vn-elem'), true);
  const narrowSession = { ...wideSession, width: 'narrow' };
  assert.equal(visualVisible(def, narrowSession, 'vn-elem'), false);
});
test('error message names the element', () => {
  const link = byName('Settings link');
  assert.throws(() => visualTransition(page, { ...visualSession(), state: 'loading' }, link.id, link.events[0].id), /Settings link/);
});
test('error message format is VISUAL_INVALID with definition and element', () => {
  const def = { id: 'vp-err', name: 'ErrorTest', root: [{ id: 'vn-btn', kind: 'element', tag: 'button', name: 'TestBtn', attrs: {}, children: [], events: [{ id: 'vi-1', label: 'click', actions: [] }] }] };
  try {
    visualTransition(def, visualSession(), 'vn-btn', 'vi-missing');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.match(err.message, /^VISUAL_INVALID: (?!VISUAL_INVALID)/);
    assert.match(err.message, /ErrorTest/);
    assert.match(err.message, /TestBtn/);
  }
});
/** Runs one generated model-test file and returns node --test's TAP output and exit status. */
async function runGenerated(source) {
  const dir = await mkdtemp(join(tmpdir(), 'visual-session-generated-')), file = join(dir, 'model.checks.mjs'); await writeFile(file, source);
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) });
}
const vsEffects = () => ({ id: 'vp-effects', name: 'Effects', notes: '', scenarios: [], root: [
  { id: 'vn-1', kind: 'element', tag: 'button', name: 'Reset', attrs: {}, children: [], events: [{ id: 'vi-1', event: 'click', label: 'Reset to default', notes: '', acceptance: '', actions: [{ kind: 'set-state', state: 'default' }] }] },
  { id: 'vn-2', kind: 'element', tag: 'button', name: 'Toggle', attrs: {}, children: [], events: [{ id: 'vi-2', event: 'click', label: 'Hide panel', notes: '', acceptance: '', actions: [{ kind: 'toggle', nodeId: 'vn-3' }, { kind: 'focus', nodeId: 'vn-1' }] }] },
  { id: 'vn-3', kind: 'element', tag: 'div', name: 'Panel', attrs: {}, children: [], events: [] },
  { id: 'vn-4', kind: 'element', tag: 'div', name: 'Other', attrs: {}, children: [], events: [] },
] });
test('generated model tests accept idempotent effects such as a reset to the current state', async () => {
  const source = visualTestSource(vsEffects());
  assert.match(source, /assert\.equal\(next\.state, "default"\);/); assert.match(source, /assert\.equal\(next\.hidden\["vn-3"\] === true, true\);/); assert.match(source, /assert\.equal\(next\.focused, "vn-1"\);/);
  const run = await runGenerated(source);
  assert.equal(run.status, 0, run.stdout + run.stderr); assert.match(run.stdout, /# pass 2/); assert.match(run.stdout, /# fail 0/);
});
test('generated model tests fail when the embedded transition or action target is wrong', async () => {
  const source = visualTestSource(vsEffects());
  for (const [label, from, to] of [
    ['state transition ignores set-state', 'if (a.kind === \'set-state\') next.state = a.state;', 'if (a.kind === \'set-state\') next.state = \'error\';'],
    ['toggle is a no-op', 'next.hidden[a.nodeId] = !next.hidden[a.nodeId];', 'void a;'],
    ['toggle targets another element', '{"kind":"toggle","nodeId":"vn-3"}', '{"kind":"toggle","nodeId":"vn-4"}'],
  ]) {
    assert.ok(source.includes(from), label);
    const run = await runGenerated(source.replace(from, to));
    assert.notEqual(run.status, 0, label); assert.match(run.stdout, /# fail [1-9]/, label);
  }
});
