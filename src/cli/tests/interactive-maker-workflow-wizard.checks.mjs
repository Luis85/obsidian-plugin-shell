import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { launchTestWorkflow } from '../presentation/wizards/test-workflow-launch.ts';
import { parseTestWorkflowLocatorLine, testWorkflowDataFromView, testWorkflowDataView, testWorkflowLocatorLine, testWorkflowStepFromView, testWorkflowStepView } from '../presentation/test-workflow-editor.ts';
import { Back } from '#tui/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'workflow-wizard-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Plain prompts answer strictly in order; a missing answer fails the test instead of looping. */
function plain(lines) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question);
    if (!lines.length) throw Object.assign(new Error('No scripted line left for: ' + question), { code: 'CANCELLED' });
    const value = lines.shift(); if (value === BACK) throw new Back(); return value;
  } } };
}
const order = () => ({ schemaVersion: 1, id: 'order', title: 'Order', purpose: 'Order one item.', status: 'active', target: { kind: 'static', folder: 'site' }, timeoutMs: 3000,
  data: { values: { size: 'M', quantity: 2, gift: true } }, steps: [{ kind: 'goto', path: '/' }, { kind: 'fill', id: 'name', timeoutMs: 900, target: { label: 'Name' }, value: 'Ann' }] });
async function seed(root, value) {
  await mkdir(join(root, 'configs/tests/workflows'), { recursive: true }); await mkdir(join(root, 'site'), { recursive: true });
  await writeFile(join(root, 'site/index.html'), '<!doctype html><title>Shop</title>');
  if (value) await writeFile(join(root, 'configs/tests/workflows', value.id + '.json'), JSON.stringify(value));
}
const saved = async (root, id) => JSON.parse(await readFile(join(root, 'configs/tests/workflows', id + '.json'), 'utf8'));
const options = root => ({ root, frameworkRoot });

test('workflow new builds target, data and steps through forms, re-asks bad lines and saves the note with the definition', async () => scratch(async root => {
  await seed(root);
  const f = plain(['Sign in', 'Members reach their dashboard.', 'active', '', '', '',
    'static', 'site',
    'user.name=Ann;user.pin=1234', 'buyer=config:contacts-demo#nope',
    'user.name=Ann;user.pin=1234', 'buyer=config:contacts-demo#0',
    'add', 'goto', '', '/', '', '',
    'add', 'fill', 'Name "x"', '{{data.user.name}}', '', '',
    'fill', 'label "Name"', '{{data.user.name}}', '', 'Typed by hand',
    'add', 'expectTitle', '', 'Shop', 'contains', '',
    'add', 'screenshot', '', 'home-page', 'yes', 'testid "clock"', 'Home after sign-in', '', '',
    'done', 'y']);
  const completion = await launchTestWorkflow(f.ui, { command: 'workflow', action: 'new', flags: {} }, options(root));
  assert.equal(completion, 'Workflow sign-in saved to configs/tests/workflows/sign-in.json with its note docs/tests/workflows/sign-in.md. Next: node bin/app workflow run --name sign-in --json.\n');
  assert.ok(f.writes.some(text => text.includes('WORKFLOW_DATA_LINE')), 'a bad fake-data line is reported and the form asked again');
  assert.ok(f.writes.some(text => text.includes('WORKFLOW_LOCATOR_LINE')), 'a bad locator line is reported and the step asked again');
  assert.equal(f.left(), 0);
  const value = await saved(root, 'sign-in');
  assert.deepEqual(value.target, { kind: 'static', folder: 'site' });
  assert.deepEqual(value.data, { values: { user: { name: 'Ann', pin: '1234' } }, fakeData: { buyer: { config: 'contacts-demo', index: 0 } } });
  assert.deepEqual(value.steps, [{ kind: 'goto', path: '/' }, { kind: 'fill', note: 'Typed by hand', target: { label: 'Name' }, value: '{{data.user.name}}' }, { kind: 'expectTitle', text: 'Shop', match: 'contains' },
    { kind: 'screenshot', name: 'home-page', fullPage: true, mask: [{ testId: 'clock' }], caption: 'Home after sign-in' }]);
  assert.ok([...f.questions, ...f.writes].some(text => text.includes('Capture the full scrollable page?')), 'the step builder offers the screenshot options');
  assert.match(await readFile(join(root, 'docs/tests/workflows/sign-in.md'), 'utf8'), /^---\ntype: "TestWorkflow"\nid: "sign-in"/);
}));

test('workflow edit keeps untouched JSON details, and declining the review writes nothing', async () => scratch(async root => {
  await seed(root, order());
  const f = plain(['', '', '', '', '', '', '', '', '', '', 'edit-1', '', '', 'Bea', '', '', 'done', 'y']);
  await launchTestWorkflow(f.ui, { command: 'workflow', action: 'edit', flags: { name: 'order' } }, options(root));
  const value = await saved(root, 'order');
  assert.deepEqual(value.steps[1], { kind: 'fill', id: 'name', timeoutMs: 900, target: { label: 'Name' }, value: 'Bea' }, 'id and timeout survive an interactive edit');
  assert.deepEqual(value.data, { values: { size: 'M', quantity: 2, gift: true } }, 'unchanged value lines keep their JSON types');
  assert.equal(value.timeoutMs, 3000);
  const declined = plain(['edit', 'order', 'Renamed', '', '', '', '', '', '', '', '', '', 'done', 'n']);
  await launchTestWorkflow(declined.ui, { command: 'workflow', action: '', flags: {} }, options(root));
  assert.equal((await saved(root, 'order')).title, 'Order');
  assert.deepEqual(await readdir(join(root, 'configs/tests/workflows')), ['order.json']);
}));

test('the editor views translate locator lines, step inputs and data lines both ways', () => {
  for (const line of ['button "Save"', 'heading', 'label "Email" exact', 'form "Sign up" > button "Create \\"account\\"" #2', 'testid "x" > text "y" > placeholder "z"'])
    assert.equal(testWorkflowLocatorLine(parseTestWorkflowLocatorLine(line)), line);
  assert.deepEqual(parseTestWorkflowLocatorLine('list "Next" > listitem #3'), { role: 'listitem', nth: 2, within: { role: 'list', name: 'Next' } });
  for (const line of ['button Save', 'blink "x"', 'label', '"x"']) assert.throws(() => parseTestWorkflowLocatorLine(line), /WORKFLOW_LOCATOR_LINE|write an element|not an ARIA role|needs a quoted value/, line);
  assert.deepEqual(testWorkflowStepFromView({ kind: 'expectCount', target: 'row', input: '3', match: 'default', note: '' }), { kind: 'expectCount', target: { role: 'row' }, count: 3 });
  assert.deepEqual(testWorkflowStepFromView({ kind: 'fill', target: 'label "A"', input: '', match: 'default', note: '' }), { kind: 'fill', target: { label: 'A' }, value: '' });
  assert.deepEqual(testWorkflowStepFromView({ kind: 'waitFor', target: 'dialog', input: '', match: 'exact', note: '' }), { kind: 'waitFor', target: { role: 'dialog' } });
  assert.deepEqual(testWorkflowStepFromView({ kind: 'expectUrl', target: 'ignored', input: '/x', match: 'exact', note: '' }), { kind: 'expectUrl', path: '/x', match: 'exact' });
  assert.throws(() => testWorkflowStepFromView({ kind: 'teleport', target: '', input: '', match: 'default', note: '' }), /Unknown step kind/);
  assert.throws(() => testWorkflowStepFromView({ kind: 'click', target: '', input: '', match: 'default', note: '' }), /needs a target/);
  assert.deepEqual(testWorkflowStepView({ kind: 'press', key: 'Enter' }), { kind: 'press', target: '', input: 'Enter', match: 'default', fullPage: false, maskLines: [], caption: '', note: '' });
  assert.deepEqual(testWorkflowStepView(), { kind: 'click', target: '', input: '', match: 'default', fullPage: false, maskLines: [], caption: '', note: '' });
  const shot = { kind: 'screenshot', name: 'cart', target: { role: 'main' }, mask: [{ testId: 'a' }], caption: 'Cart' };
  assert.deepEqual(testWorkflowStepFromView(testWorkflowStepView(shot)), shot);
  const data = { values: { a: { b: 1 }, c: 'x' }, fakeData: { p: { entity: 'contact', seed: 7, index: 2 }, q: { config: 'contacts-demo', index: 0 } } };
  const view = testWorkflowDataView(data);
  assert.deepEqual(view, { valueLines: ['a.b=1', 'c=x'], fakeLines: ['p=entity:contact@7#2', 'q=config:contacts-demo#0'] });
  assert.deepEqual(testWorkflowDataFromView(view, data), data);
  assert.deepEqual(testWorkflowDataFromView({ valueLines: ['a.b=2'], fakeLines: ['p=entity:contact'] }, data), { values: { a: { b: '2' } }, fakeData: { p: { entity: 'contact', index: 0 } } });
  assert.equal(testWorkflowDataFromView({ valueLines: [], fakeLines: [] }), undefined);
  assert.throws(() => testWorkflowDataFromView({ valueLines: ['novalue'], fakeLines: [] }), /path=value/);
  assert.throws(() => testWorkflowDataFromView({ valueLines: [], fakeLines: ['q=config:contacts-demo@3#0'] }), /alias=config/);
});
