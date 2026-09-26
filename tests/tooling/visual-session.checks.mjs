import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { visualNodes } from '../../scripts/companion/visual/visual-ir.mjs';
import { visualSession, visualVisible, visualTransition, visualValue, visualRead, visualTestSource } from '../../scripts/companion/visual/visual-session.mjs';
const s = JSON.parse(await readFile('tests/fixtures/companion/visual-v5.json', 'utf8'));
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
