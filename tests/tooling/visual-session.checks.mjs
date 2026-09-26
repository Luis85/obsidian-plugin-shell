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
