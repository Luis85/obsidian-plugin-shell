import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { launchProcess } from '../../bin/presentation/wizards/process-launch.ts';
import { Back } from '../../bin/presentation/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'process-wizard-'));
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
const claim = () => ({ schemaVersion: 1, id: 'expense-claim', version: 1, title: 'Expense claim', purpose: 'Reimburse.', status: 'draft', owner: 'finance',
  roles: [{ id: 'employee', title: 'Employee' }, { id: 'finance', title: 'Finance' }],
  steps: [
    { id: 'claim', title: 'Submit claim', actor: 'employee', bind: 'claim', fields: [{ id: 'amount', kind: 'number', label: 'Amount', min: 0 }, { id: 'receipt', kind: 'boolean', label: 'Receipt attached?' }],
      next: [{ to: 'paid', when: { path: 'claim.amount', lte: 500 }, label: 'small' }, { to: 'approve' }] },
    { id: 'approve', title: 'Approve', actor: 'finance', outputs: ['ledger.entry'], next: [{ to: 'paid', when: { all: [{ path: 'ledger.entry', present: true }, { not: { path: 'ledger.entry', equals: 'none' } }] } }, { to: 'refused' }] },
    { id: 'paid', title: 'Pay', actor: 'finance', terminal: true, outcome: 'paid' },
    { id: 'refused', title: 'Refuse', actor: 'finance', terminal: true, outcome: 'refused' },
  ],
  rules: [
    { id: 'receipt-required', statement: 'Every claim has a receipt.', severity: 'block', steps: ['claim'], require: { path: 'claim.receipt', equals: true } },
    { id: 'large-claim', statement: 'Claims above 1000 are reviewed twice.', severity: 'warn', steps: ['claim'], require: { path: 'claim.amount', lte: 1000 } },
    { id: 'numbered', statement: 'Ledger entries are numbered.', severity: 'info', steps: ['approve'], require: { any: [{ path: 'ledger.entry', gt: 0 }, { path: 'ledger.entry', matches: 'A-*' }] } },
  ] });
async function seed(root) {
  await mkdir(join(root, 'configs/processes'), { recursive: true });
  await writeFile(join(root, 'configs/processes/expense-claim.json'), JSON.stringify(claim()));
  await writeFile(join(root, 'README.md'), '# Readme\n');
}
const saved = async (root, id) => JSON.parse(await readFile(join(root, 'configs/processes', id + '.json'), 'utf8'));
const options = root => ({ root, frameworkRoot });

test('process new authors roles, steps and rules through forms, re-asks bad lines and returns to steps on findings', async () => scratch(async root => {
  await writeFile(join(root, 'README.md'), '# Readme\n');
  const f = plain(['Leave request', 'Approve time off before it is taken.', 'active', '', '',
    'add', 'Employee', 'Asks for leave.', 'add', 'Manager', '', 'done', 'manager',
    'add', 'Request leave', 'employee', '', 'fields', 'days:number*:Days', 'request', '', 'no', 'decide', '',
    '', '', '', '', 'days:number:Days requested;reason:text*:Reason', '', '', '', '', '',
    'add', 'Decide', 'manager', '', 'fields', 'approved:boolean:Approve?', '', '', '', 'granted if approved equals true;denied', '',
    'add', 'Granted', 'manager', '', 'none', '', '', 'yes', 'granted', '',
    'add', 'Denied', 'manager', '', '', '', '', 'yes', '', '',
    'done',
    'add', 'Requests are at most 20 days.', 'block', '', 'steps', '1', '', '', 'request.cost lte 20', '',
    'add', 'Long leave is discussed first.', 'warn', 'Plan cover.', '', '1', 'request.days gt 10', '', 'request.reason length gte 10', 'See [[README]].',
    'done', 'done', 'edit-0', '', '', '', '', '', '', '', 'request.days lte 20', '', 'done', 'y']);
  const completion = await launchProcess(f.ui, { command: 'process', action: 'new', flags: {} }, options(root));
  assert.equal(completion, 'Process leave-request saved to configs/processes/leave-request.json. Next: node bin/app process check, then node bin/app process docs --name leave-request.\n');
  assert.ok(f.writes.some(text => text.includes('PROCESS_FIELD_LINE: days:number*:Days: * (required) applies to text, list and multi fields')));
  assert.ok(f.writes.some(text => text.includes('Rule requests-are-at-most-20-days reads request.cost, which no step collects')));
  const value = await saved(root, 'leave-request');
  assert.deepEqual([value.version, value.status, value.owner, value.roles.map(role => role.id)], [1, 'active', 'manager', ['employee', 'manager']]);
  assert.deepEqual(value.steps.map(step => [step.id, step.terminal ?? false, step.outcome]), [['request-leave', false, undefined], ['decide', false, undefined], ['granted', true, 'granted'], ['denied', true, undefined]]);
  assert.deepEqual(value.steps[0].fields, [{ id: 'days', kind: 'number', label: 'Days requested' }, { id: 'reason', kind: 'text', label: 'Reason', required: true }]);
  assert.deepEqual(value.steps[1].next, [{ to: 'granted', when: { path: 'approved', equals: true } }, { to: 'denied' }]);
  assert.deepEqual(value.rules[0], { id: 'requests-are-at-most-20-days', statement: 'Requests are at most 20 days.', severity: 'block', steps: ['request-leave'], require: { path: 'request.days', lte: 20 } });
  assert.deepEqual(value.rules[1], { id: 'long-leave-is-discussed-first', statement: 'Long leave is discussed first.', rationale: 'Plan cover.', severity: 'warn', steps: ['request-leave'],
    when: { path: 'request.days', gt: 10 }, require: { path: 'request.reason', length: true, gte: 10 }, doc: { text: 'See [[README]].' } });
  assert.equal(f.left(), 0);
}));

test('process edit keeps ids, JSON-only details and nested conditions while changing what was answered', async () => scratch(async root => {
  await seed(root);
  const f = plain(['', '', 'active', '', 'See [[README]].', '', '',
    'edit-0', '', '', 'Claim an expense.', '', 'amount:number:Amount (EUR);receipt:boolean:Receipt attached?;note:text:Note', '', '', '', '', 'Attach the receipt.',
    'edit-1', '', '', '', '', '', '', '', '', '',
    'remove', 'refused', 'n', 'done',
    'edit-1', '', '', '', '', '', '', '', 'claim.amount lte 800', '', 'edit-2', '', '', '', 'process', '', 'any', '', '', 'done', 'y']);
  await launchProcess(f.ui, { command: 'process', action: 'edit', flags: { name: 'expense-claim' } }, options(root));
  const value = await saved(root, 'expense-claim'), original = claim();
  assert.deepEqual([value.version, value.status, value.doc], [2, 'active', { text: 'See [[README]].' }]);
  assert.deepEqual(value.steps[0].fields, [{ id: 'amount', kind: 'number', label: 'Amount (EUR)', min: 0 }, { id: 'receipt', kind: 'boolean', label: 'Receipt attached?' }, { id: 'note', kind: 'text', label: 'Note' }]);
  assert.deepEqual([value.steps[0].description, value.steps[0].doc, value.steps[0].next], ['Claim an expense.', { text: 'Attach the receipt.' }, original.steps[0].next]);
  assert.deepEqual(value.steps.slice(1), original.steps.slice(1), 'an unchanged step, its nested transition condition and a declined removal stay identical');
  assert.deepEqual(value.rules[1].require, { path: 'claim.amount', lte: 800 });
  assert.deepEqual(value.rules[2], { id: 'numbered', statement: 'Ledger entries are numbered.', severity: 'info', require: original.rules[2].require }, 'scope widened; nested requirement kept');
  assert.deepEqual(value.rules[0], original.rules[0]);
  assert.ok(f.questions.includes('Version [2]: ') && f.questions.includes('Input fields (id:kind:Label) (separate with ;) [amount:number:Amount;receipt:boolean:Receipt attached?]: '));
  assert.ok(f.questions.includes('Next steps, first match wins (separate with ;) [paid if all(ledger.entry present, not(ledger.entry equals "none"));refused]: '));
  assert.ok(f.questions.includes('Requirement conditions (path operator value) (separate with ;) [ledger.entry gt 0;ledger.entry matches "A-*"]: '));
  assert.equal(f.left(), 0);
  const cancelled = plain([BACK]);
  assert.equal(await launchProcess(cancelled.ui, { command: 'process', action: 'edit', flags: { name: 'expense-claim' } }, options(root)), undefined);
  assert.deepEqual(cancelled.writes, ['Process authoring cancelled. Nothing was written.\n']);
  const declined = plain(['expense-claim', '', '', '', '', '', '', '', '', '', 'n']);
  assert.equal(await launchProcess(declined.ui, { command: 'process', action: 'edit', flags: {} }, options(root)), undefined);
  assert.equal((await saved(root, 'expense-claim')).version, 2, 'a declined review writes nothing');
}));

test('process run collects inputs, stops on block and unacknowledged warnings, and saves the audit trail after review', async () => scratch(async root => {
  await seed(root);
  const f = plain(['2000', 'no', 'retry', '', 'yes', 'n', 'retry', '', '', 'y', '"B-1"', 'yes', 'yes', '', 'y']);
  const completion = await launchProcess(f.ui, { command: 'process', action: 'run', flags: { name: 'expense-claim' } }, options(root));
  assert.equal(completion, 'Expense claim completed: paid.\n');
  const writes = f.writes.join('');
  for (const expected of ['Step: Submit claim (Employee)', 'This transition is blocked:\nBLOCK receipt-required: Every claim has a receipt.', 'WARN large-claim: Claims above 1000 are reviewed twice.',
    'INFO numbered: Ledger entries are numbered. (recorded)', 'Audit trail']) assert.ok(writes.includes(expected), expected);
  assert.ok(f.questions.includes('Acknowledge warning large-claim and continue? (y/N): ') && f.questions.includes('Value of ledger.entry (JSON or text): ') && f.questions.includes('Mark "Pay" as done? (y/N): '));
  const trail = JSON.parse(await readFile(join(root, 'process-runs/expense-claim.json'), 'utf8'));
  assert.deepEqual([trail.status, trail.outcome, trail.data, typeof trail.recordedAt], ['completed', 'paid', { claim: { amount: 2000, receipt: true }, ledger: { entry: 'B-1' } }, 'string']);
  assert.deepEqual(trail.trail.map(item => [item.step, item.transition?.to, item.rules.map(rule => rule.outcome).join(',')]),
    [['claim', undefined, 'violated,violated'], ['claim', undefined, 'passed,violated'], ['claim', 'approve', 'passed,acknowledged'], ['approve', 'paid', 'violated'], ['paid', undefined, '']]);
  assert.equal(f.left(), 0);
  const stopped = plain(['expense-claim', '120', 'no', 'stop', 'no']);
  assert.equal(await launchProcess(stopped.ui, { command: 'process', action: 'run', flags: {} }, options(root)), 'Stopped at Submit claim; the audit trail records why.\n');
  const warned = plain(['run', '1200', 'yes', 'n', 'stop', 'no']);
  assert.equal(await launchProcess(warned.ui, { command: 'process', action: '', flags: { name: 'expense-claim' } }, options(root)), 'Stopped at Submit claim; the audit trail records why.\n');
  assert.ok(warned.writes.join('').includes('"status": "needs-acknowledgement"'));
  const declined = plain(['200', 'yes', 'n', 'no']);
  assert.equal(await launchProcess(declined.ui, { command: 'process', action: 'run', flags: { name: 'expense-claim' } }, options(root)), 'Stopped before Pay was done.\n');
  assert.deepEqual(await readdir(join(root, 'process-runs')), ['expense-claim.json'], 'unsaved runs write nothing');
}));

test('run and edit refuse unknown or unhealthy processes before asking anything', async () => scratch(async root => {
  await seed(root);
  await writeFile(join(root, 'configs/processes/broken.json'), JSON.stringify({ ...claim(), id: 'broken', steps: [...claim().steps, { id: 'orphan', title: 'Orphan', actor: 'finance', terminal: true }] }));
  await writeFile(join(root, 'configs/processes/garbage.json'), '{"schemaVersion": 1}');
  await assert.rejects(() => launchProcess(plain([]).ui, { command: 'process', action: 'run', flags: { name: 'broken' } }, options(root)), /Process broken has findings/);
  await assert.rejects(() => launchProcess(plain([]).ui, { command: 'process', action: 'run', flags: { name: 'ghost' } }, options(root)), /Unknown process ghost/);
  await assert.rejects(() => launchProcess(plain([]).ui, { command: 'process', action: 'edit', flags: { name: 'garbage' } }, options(root)), /is not valid JSON for the process format/);
}));
