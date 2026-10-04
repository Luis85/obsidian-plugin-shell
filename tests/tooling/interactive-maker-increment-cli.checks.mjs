import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { commands, parameterKinds, parseCliArguments, validateRequest } from '../../bin/adapters/framework/catalog.ts';
import { commandHelp, groups } from '../../bin/adapters/framework/help-text.ts';
import { incrementCommands } from '../../bin/adapters/framework/increment-catalog.ts';
import { buildModel } from '../../scripts/documentation/render.mjs';
import { exitCode } from '../../bin/adapters/framework-cli.ts';
import { interactiveRun } from '../../bin/presentation/terminal/cli-interactive.ts';
import { guidedIncrement } from '../../bin/presentation/terminal/increment-terminal.ts';
import { createWorkspace, planThenApply, readyFragment } from '../support/increment-workspace.mjs';

const fails = (outcome, code) => { assert.equal(outcome.status, 'failed', JSON.stringify(outcome)); assert.equal(outcome.diagnostics[0].code, code, outcome.diagnostics[0].message); return outcome; };
async function inWorkspace(options, body) {
  const ws = createWorkspace(options);
  try { await body(ws); } finally { ws.remove(); }
}

test('the increment, pr and issue commands parse without colliding with existing commands or option kinds', () => {
  const ids = commands.map(command => command.id);
  assert.equal(new Set(ids).size, ids.length);
  const kinds = new Map();
  for (const command of commands) for (const [name, kind] of Object.entries(command.options)) {
    assert.ok(!kinds.has(name) || kinds.get(name) === kind, `--${name} is ${kinds.get(name)} elsewhere but ${kind} in ${command.id}`);
    kinds.set(name, kind);
  }
  assert.deepEqual(parseCliArguments(['increment', 'new', 'delivery', '--title', 'Delivery', '--no-issue', '--switch']),
    { command: 'increment new', args: ['delivery'], options: { title: 'Delivery', 'no-issue': true, switch: true } });
  assert.deepEqual(parseCliArguments(['pr', 'task', 'set', 'delivery-1', 'T-2', '--status', 'done']), { command: 'pr task set', args: ['delivery-1', 'T-2'], options: { status: 'done' } });
  assert.deepEqual(parseCliArguments(['increment', 'check', 'delivery', '--gate', 'done']).command, 'increment check');
  assert.deepEqual(parseCliArguments(['issue', 'ac', 'add', 'delivery', 'AC-1']).args, ['delivery', 'AC-1']);
  assert.throws(() => parseCliArguments(['pr', 'publish', 'delivery-1', '--title', 'x']), error => error.code === 'INVALID_OPTION');
  assert.throws(() => parseCliArguments(['increment', 'status', 'a', 'b', 'c']), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => validateRequest({ command: 'pr sync', args: ['x'], options: { 'plan-out': 'x.json', prefer: 7 } }), error => error.code === 'INVALID_OPTION');
});

test('every new command has usage, examples, a group and documented options; remote commands offer no --plan-out', () => {
  const group = groups.find(item => item.id === 'increments');
  assert.deepEqual(group.commands, incrementCommands.map(command => command.id));
  for (const command of incrementCommands) {
    const help = commandHelp(command);
    assert.equal(help.group, 'increments'); assert.ok(help.usage.startsWith(`node bin/app ${command.id}`), command.id); assert.ok(help.examples.length, command.id);
    for (const name of Object.keys(command.options)) assert.ok(help.optionHelp[name]?.description, `${command.id} --${name}`);
  }
  for (const id of ['pr publish', 'pr sync']) {
    const help = commandHelp(commands.find(command => command.id === id));
    assert.equal(commands.find(command => command.id === id).effect, 'remote');
    assert.ok(help.optionHelp.apply && help.optionHelp.yes && help.optionHelp['dry-run']); assert.equal(help.optionHelp['plan-out'], undefined);
  }
  assert.deepEqual(commandHelp(commands.find(command => command.id === 'increment ac set')).optionHelp.status.values, ['open', 'done']);
  assert.deepEqual(commandHelp(commands.find(command => command.id === 'pr list')).optionHelp.status.values, ['New', 'Draft', 'Ready', 'Merged', 'Closed']);
  assert.equal(commandHelp(commands.find(command => command.id === 'prototypes status')).optionHelp.status.values.join(), 'draft,review,approved,archived', 'other commands keep their docs');
  const model = buildModel(commands, commandHelp, parameterKinds, groups, '0.0.0', {});
  assert.equal(model.commands.find(command => command.id === 'pr publish').effect, 'remote');
});

test('exit codes: 2 only for failed results whose data says uncertain', () => {
  const outcome = (status, data = null) => ({ protocolVersion: 1, command: 'pr publish', status, data, diagnostics: [] });
  assert.deepEqual([outcome('ok'), outcome('planned'), outcome('applied'), outcome('unchanged')].map(exitCode), [0, 0, 0, 0]);
  assert.equal(exitCode(outcome('failed', { uncertain: true, step: 'create' })), 2);
  assert.equal(exitCode(outcome('failed', { uncertain: false })), 1);
  assert.equal(exitCode(outcome('blocked', { uncertain: true })), 1);
  assert.equal(exitCode(outcome('cancelled')), 130);
});

test('the interactive run confirms a planned remote preview and applies exactly the reviewed hash', async () => {
  const calls = [];
  const execute = async request => { calls.push(request.options); return { protocolVersion: 1, command: request.command, status: request.options.apply ? 'applied' : 'planned', data: { planHash: 'a'.repeat(64) }, diagnostics: [] }; };
  const outcome = await interactiveRun({ command: 'pr publish', args: ['x'], options: {} }, { root: '.', frameworkRoot: '.' }, { execute, confirm: async () => true, render: () => undefined });
  assert.equal(outcome.status, 'applied'); assert.deepEqual(calls[1], { apply: 'a'.repeat(64), yes: true });
  const declined = await interactiveRun({ command: 'pr sync', args: ['x'], options: {} }, { root: '.', frameworkRoot: '.' }, { execute, confirm: async () => false, render: () => undefined });
  assert.equal(declined.status, 'cancelled');
});

test('the terminal interview asks only for missing answers and produces the headless options', async () => {
  const asked = [], answers = ['Delivery pipeline', 'Luis', 'L', '', 'n', ''];
  const prompt = async question => { asked.push(question); return answers.shift(); };
  const request = await guidedIncrement({ command: 'increment new', args: ['delivery'], options: {} }, prompt);
  assert.deepEqual(request.options, { title: 'Delivery pipeline', owner: 'Luis', size: 'L', 'no-issue': true });
  assert.equal(asked.length, 6);
  const flagged = await guidedIncrement({ command: 'increment new', args: ['delivery'], options: { title: 'T', owner: 'O', size: 'S', e2e: 'none', issue: true, 'no-branch': true } }, async () => assert.fail('nothing to ask'));
  assert.deepEqual(flagged.options, { title: 'T', owner: 'O', size: 'S', e2e: 'none', issue: true, 'no-branch': true });
  const change = await guidedIncrement({ command: 'pr new', args: ['delivery'], options: {} }, async question => /Title/.test(question) ? 'Change' : 'no');
  assert.deepEqual(change.options, { title: 'Change', 'no-branch': true });
  const unchanged = { command: 'increment list', args: [], options: {} };
  assert.equal(await guidedIncrement(unchanged, async () => assert.fail()), unchanged);
  await assert.rejects(guidedIncrement({ command: 'increment new', args: ['x'], options: {} }, async () => ''), error => error.code === 'INCREMENT_INPUT_INVALID');
  await assert.rejects(guidedIncrement({ command: 'increment new', args: ['x'], options: { title: 'T' } }, async question => /Size/.test(question) ? 'XL' : ''), error => error.code === 'INCREMENT_INPUT_INVALID');
});

test('increment check runs the real Definition of Ready: blocked with the refinement brief, then ok once refined', () => inWorkspace({ delivery: true }, async ws => {
  await planThenApply(ws, 'increment new', ['draft'], { title: 'Draft', 'no-branch': true });
  const blocked = await ws.run('increment check', ['draft']);
  assert.equal(blocked.status, 'blocked', JSON.stringify(blocked.diagnostics)); assert.equal(exitCode(blocked), 1);
  assert.equal(blocked.data.source, 'definition-of-ready'); assert.equal(blocked.data.status, 'not-ready');
  assert.ok(blocked.data.refinement.questions.length > 0); assert.ok(blocked.diagnostics.every(item => item.code === 'INCREMENT_NOT_READY'));
  ws.write('handoff.md', readyFragment);
  await planThenApply(ws, 'increment new', ['delivery'], { owner: 'Luis', input: 'handoff.md', 'no-branch': true });
  const ready = await ws.run('increment check', ['delivery'], { gate: 'ready', base: 'main' });
  assert.equal(ready.status, 'ok', JSON.stringify(ready.diagnostics)); assert.equal(ready.data.handoff, 'docs/increments/delivery.md');
  fails(await ws.run('increment check', ['delivery'], { gate: 'later' }), 'INVALID_OPTION');
  const done = await ws.run('increment check', ['delivery'], { gate: 'done' });
  assert.equal(done.status, 'blocked'); assert.equal(done.data.gate, 'done'); assert.ok(Array.isArray(done.data.generated.paths));
}));

test('without delivery.json the Ready check is structural and the Done gate is unavailable', () => inWorkspace({ delivery: false }, async ws => {
  await planThenApply(ws, 'increment new', ['draft'], { title: 'Draft', 'no-branch': true });
  const structural = await ws.run('increment check', ['draft']);
  assert.equal(structural.status, 'blocked'); assert.equal(structural.data.source, 'structural');
  fails(await ws.run('increment check', ['draft'], { gate: 'done' }), 'INCREMENT_GATES_UNAVAILABLE');
  fails(await ws.run('increment complete', ['draft']), 'INCREMENT_GATES_UNAVAILABLE');
}));

test('increment complete plans the Definition of Done outputs and blocks while rules fail or pull requests are open', () => inWorkspace({ delivery: true }, async ws => {
  ws.write('handoff.md', readyFragment);
  await planThenApply(ws, 'increment new', ['delivery'], { owner: 'Luis', input: 'handoff.md', 'no-branch': true });
  await planThenApply(ws, 'increment status', ['delivery', 'Ready']);
  await planThenApply(ws, 'increment status', ['delivery', 'In progress']);
  fails(await ws.run('increment complete', ['delivery']), 'INCREMENT_OPEN_PULL_REQUESTS');
  ws.write('docs/pull-requests/delivery-kickoff.md', ws.read('docs/pull-requests/delivery-kickoff.md').replace('status: New', 'status: Merged'));
  const blocked = await ws.run('increment complete', ['delivery']);
  assert.equal(blocked.status, 'blocked', JSON.stringify(blocked.diagnostics));
  assert.ok(blocked.data.conflicts.some(conflict => conflict.startsWith('DOD-02')), blocked.data.conflicts.join('\n'));
  assert.equal(blocked.data.summary.statusAfter, 'Done'); assert.ok(blocked.data.changes.some(change => change.path === 'docs/increments/delivery.md'));
  fails(await ws.run('increment complete', ['delivery'], { yes: true }), 'PLAN_CONFLICT');
  assert.match(ws.read('docs/increments/delivery.md'), /^status: In progress$/m);
}));
