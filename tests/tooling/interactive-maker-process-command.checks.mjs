import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { makerMain } from '../../bin/app.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
import { parseArguments } from '../../bin/adapters/commands.ts';
import { interactiveProcess, processCommand } from '../../bin/adapters/process-command.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'process-command-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function cli(argv) {
  const output = new PassThrough(), error = new PassThrough(), chunks = [];
  output.on('data', chunk => chunks.push(chunk));
  const code = await makerMain(argv, frameworkRoot, { input: Readable.from([]), output, error, env: {} });
  return { code, result: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
}
const definition = (extra = {}) => ({ schemaVersion: 1, id: 'expense-claim', version: 1, title: 'Expense claim', purpose: 'Reimburse approved expenses.', status: 'draft', owner: 'finance',
  roles: [{ id: 'employee', title: 'Employee' }, { id: 'finance', title: 'Finance' }],
  steps: [
    { id: 'claim', title: 'Submit claim', actor: 'employee', bind: 'claim', fields: [{ id: 'amount', kind: 'number', label: 'Amount', min: 0 }, { id: 'receipt', kind: 'boolean', label: 'Receipt attached?' }],
      next: [{ to: 'paid', when: { path: 'claim.amount', lte: 500 } }, { to: 'approve' }] },
    { id: 'approve', title: 'Approve', actor: 'finance', fields: [{ id: 'approved', kind: 'boolean', label: 'Approved?' }], next: [{ to: 'paid', when: { path: 'approved', equals: true } }, { to: 'refused' }] },
    { id: 'paid', title: 'Pay', actor: 'finance', terminal: true, outcome: 'paid' },
    { id: 'refused', title: 'Refuse', actor: 'finance', terminal: true, outcome: 'refused' },
  ],
  rules: [
    { id: 'receipt-required', statement: 'Every claim has a receipt.', severity: 'block', steps: ['claim'], require: { path: 'claim.receipt', equals: true } },
    { id: 'large-claim', statement: 'Claims above 1000 are reviewed twice.', severity: 'warn', steps: ['claim'], require: { path: 'claim.amount', lte: 1000 } },
  ], ...extra });
async function write(root, path, value) {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), typeof value === 'string' ? value : JSON.stringify(value));
}

test('process is a maker command: routed, parsed, listed in help and interactive only for new, edit, run or no action', async () => {
  assert.equal(routeArguments(['process', 'check']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'process']).args, ['process', '--help']);
  assert.deepEqual(parseArguments(['process', 'simulate', '--name', 'x', '--input', 'd.json', '--out', 'r.json', '--json'], []),
    { command: 'process', action: 'simulate', flags: Object.assign(Object.create(null), { name: 'x', input: 'd.json', out: 'r.json', json: true }) });
  const help = await cli(['process', '--help', '--json']);
  assert.match(help.result.data.help, /node bin\/app process simulate --name release-approval --input data\.json --json/);
  assert.ok(help.result.data.commands.includes('process'));
  for (const [action, expected] of [['', true], ['new', true], ['edit', true], ['run', true], ['check', false], ['simulate', false]])
    assert.equal(interactiveProcess({ command: 'process', action, flags: {} }), expected, action);
  assert.equal(interactiveProcess({ command: 'wizard', action: '', flags: {} }), false);
  for (const action of ['run', 'new', '']) {
    const refused = await cli(['process', ...action ? [action] : [], '--json']);
    assert.deepEqual([refused.code, refused.result.diagnostics[0].code], [1, 'PROCESS_COMMAND']);
    assert.match(refused.result.diagnostics[0].message, /interactive|run in a terminal/);
  }
  assert.match((await cli(['process', 'publish', '--json'])).result.diagnostics[0].message, /Use process list/);
});

test('agents save a process through a reviewed plan; findings and unknown keys plan nothing', async () => scratch(async root => {
  await write(root, 'input/claim.json', definition());
  const empty = await cli(['process', 'list', '--root', root, '--json']);
  assert.deepEqual([empty.code, empty.result.data.processes, empty.result.status], [0, [], 'ok']);
  const planned = await cli(['process', 'save', '--input', 'input/claim.json', '--root', root, '--json']);
  assert.deepEqual([planned.code, planned.result.status, planned.result.data.path, planned.result.data.changes[0].status], [0, 'planned', 'configs/processes/expense-claim.json', 'create']);
  await assert.rejects(() => readdir(join(root, 'configs/processes')), /ENOENT/);
  const stale = await cli(['process', 'save', '--input', 'input/claim.json', '--root', root, '--apply', 'f'.repeat(64), '--json']);
  assert.deepEqual([stale.code, stale.result.diagnostics[0].code], [1, 'MAKER_APPROVAL']);
  const applied = await cli(['process', 'save', '--input', 'input/claim.json', '--root', root, '--apply', planned.result.data.planHash, '--json']);
  assert.equal(applied.result.status, 'applied');
  const saved = await readFile(join(root, 'configs/processes/expense-claim.json'), 'utf8');
  assert.ok(saved.startsWith('{\n  "$schema": "../schemas/business-process.schema.json",\n  "schemaVersion": 1,\n  "id": "expense-claim",'));
  const shown = await cli(['process', 'show', '--name', 'expense-claim', '--root', root, '--json']);
  assert.deepEqual([shown.result.status, shown.result.data.process.rules.length, shown.result.data.summary.steps], ['ok', 2, 4]);
  await write(root, 'input/claim.json', definition({ version: 2, title: 'Expense claims' }));
  const update = await cli(['process', 'save', '--input', 'input/claim.json', '--root', root, '--json']);
  assert.equal(update.result.data.changes[0].status, 'update');
  await write(root, 'input/bad.json', definition({ steps: [...definition().steps, { id: 'orphan', title: 'Orphan', actor: 'finance', terminal: true }] }));
  const refused = await cli(['process', 'save', '--input', 'input/bad.json', '--root', root, '--json']);
  assert.deepEqual([refused.code, refused.result.diagnostics[0].code], [1, 'PROCESS_INVALID']);
  assert.match(refused.result.diagnostics[0].message, /Step orphan cannot be reached/);
  await write(root, 'input/unknown.json', { ...definition(), approvers: ['x'] });
  assert.equal((await cli(['process', 'save', '--input', 'input/unknown.json', '--root', root, '--json'])).result.diagnostics[0].code, 'MAKER_UNKNOWN_FIELD');
  assert.equal((await cli(['process', 'save', '--root', root, '--json'])).result.diagnostics[0].code, 'MAKER_INPUT_REQUIRED');
  assert.equal(JSON.parse(await readFile(join(root, 'configs/processes/expense-claim.json'), 'utf8')).version, 1, 'refused saves never wrote');
}));

test('simulate evaluates rules and transitions for agents and saves the audit trail only through a reviewed plan', async () => scratch(async root => {
  await write(root, 'configs/processes/expense-claim.json', definition());
  const simulate = async (data, acknowledge, extra = []) => {
    await write(root, 'run.json', { schemaVersion: 1, data, ...acknowledge ? { acknowledge } : {} });
    return cli(['process', 'simulate', '--name', 'expense-claim', '--input', 'run.json', '--root', root, ...extra, '--json']);
  };
  const paid = await simulate({ claim: { amount: 120, receipt: true } });
  assert.deepEqual([paid.result.status, paid.result.data.run.status, paid.result.data.run.outcome, paid.result.data.run.trail.map(item => item.step)], ['ok', 'completed', 'paid', ['claim', 'paid']]);
  const blocked = await simulate({ claim: { amount: 120, receipt: false } });
  assert.deepEqual([blocked.result.data.run.status, blocked.result.data.run.stoppedAt], ['blocked', 'claim']);
  assert.equal(blocked.result.data.run.message, 'BLOCK receipt-required: Every claim has a receipt.');
  const warned = await simulate({ claim: { amount: 2000, receipt: true }, approved: true });
  assert.equal(warned.result.data.run.status, 'needs-acknowledgement');
  const acknowledged = await simulate({ claim: { amount: 2000, receipt: true }, approved: false }, ['large-claim']);
  assert.deepEqual([acknowledged.result.data.run.status, acknowledged.result.data.run.outcome, acknowledged.result.data.run.trail[0].rules[1].outcome], ['completed', 'refused', 'acknowledged']);
  const invalid = await simulate({ claim: { amount: -5, receipt: true } });
  assert.equal(invalid.result.data.run.status, 'invalid-input');
  assert.match(invalid.result.data.run.trail[0].issues[0], /^claim\.amount: Amount: enter a number between 0 and/);
  const missing = await simulate({ approved: true });
  assert.deepEqual([missing.result.data.run.status, missing.result.data.run.message], ['blocked', 'BLOCK receipt-required: Every claim has a receipt. Missing data: claim.receipt.'], 'missing data fails closed');
  const planned = await simulate({ claim: { amount: 120, receipt: true } }, [], ['--out', 'runs/claim.json']);
  assert.deepEqual([planned.result.status, planned.result.data.run.status, planned.result.data.path], ['planned', 'completed', 'runs/claim.json']);
  await assert.rejects(() => readdir(join(root, 'runs')), /ENOENT/);
  const applied = await simulate({ claim: { amount: 120, receipt: true } }, [], ['--out', 'runs/claim.json', '--apply', planned.result.data.planHash]);
  assert.equal(applied.result.status, 'applied');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'runs/claim.json'), 'utf8')), planned.result.data.run);
  assert.match((await simulate({}, [], ['--out', 'runs/claim.txt'])).result.diagnostics[0].message, /--out <file\.json>/);
  await write(root, 'run.json', { data: {} });
  assert.equal((await cli(['process', 'simulate', '--name', 'expense-claim', '--input', 'run.json', '--root', root, '--json'])).result.diagnostics[0].code, 'PROCESS_SIMULATION');
  await write(root, 'run.json', { schemaVersion: 1, data: {}, acknowledge: ['x'], extra: true });
  assert.equal((await cli(['process', 'simulate', '--name', 'expense-claim', '--input', 'run.json', '--root', root, '--json'])).result.diagnostics[0].code, 'MAKER_UNKNOWN_FIELD');
  assert.equal((await cli(['process', 'simulate', '--name', 'expense-claim', '--root', root, '--json'])).result.diagnostics[0].code, 'MAKER_INPUT_REQUIRED');
  await assert.rejects(() => processCommand({ command: 'process', action: 'simulate', flags: { name: 'missing', input: 'run.json' } }, { root }), /Unknown process missing/);
}));

test('the repository example passes process check and its shipped inputs show block and warn outcomes', async () => {
  const checked = await cli(['process', 'check', '--root', frameworkRoot, '--json']);
  assert.deepEqual([checked.code, checked.result.status, checked.result.data.issues], [0, 'ok', 0]);
  assert.ok(checked.result.data.processes.some(item => item.id === 'release-approval'));
  const simulate = name => cli(['process', 'simulate', '--name', 'release-approval', '--input', `configs/processes/examples/${name}.json`, '--root', frameworkRoot, '--json']);
  const blocked = (await simulate('release-approval-blocked')).result.data.run, released = (await simulate('release-approval-released')).result.data.run;
  assert.deepEqual([blocked.status, blocked.stoppedAt, blocked.trail[1].rules.filter(rule => rule.outcome === 'violated').map(rule => rule.rule)],
    ['blocked', 'checks', ['required-checks-pass', 'coverage-floor', 'untested-scope-stated']]);
  assert.deepEqual([released.status, released.outcome, released.trail.flatMap(item => item.rules).filter(rule => rule.outcome === 'acknowledged').map(rule => rule.rule)],
    ['completed', 'released', ['dependency-audit', 'changelog-entry']]);
  const docs = await cli(['process', 'docs', '--name', 'release-approval', '--root', frameworkRoot, '--json']);
  assert.deepEqual([docs.result.status, docs.result.data.changes[0].status], ['planned', 'unchanged'], 'the shipped page matches its definition');
});
