const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { result } from '../../bin/adapters/framework/contracts.ts';
import { processPlan, starterProcessOperation, completeDefinition } from '../../bin/adapters/starters/processes.ts';
import { definitionProjectPlan, receiptFile } from '../../bin/adapters/starters/project.ts';
import { code, fileStarter, request, workspace } from './starters-fixture.mjs';

// Reviewed starter processes (processes.ts): the receipt-bound plan, explicit trust, ordered execution and first-run completion.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = fileStarter();
const definition = fileStarter({
  files: [...base.files, { path: 'sub/tool.mjs', content: "import { appendFile } from 'node:fs/promises';\nawait appendFile('../order.txt', 'nested\\n');\n" },
    { path: 'tools/fail.mjs', content: 'process.exitCode = 7;\n' }],
  processes: [...base.processes,
    { id: 'nested', label: 'Nested', description: 'Runs in a sub folder.', dependsOn: ['hello'], steps: [{ runner: 'node', script: 'tool.mjs', args: [], cwd: 'sub', timeout: 10000 }] },
    { id: 'fail', label: 'Fail', description: 'Exits with 7.', dependsOn: ['hello'], steps: [{ runner: 'node', script: 'tools/fail.mjs', args: [], cwd: '.', timeout: 10000 }] }],
});
async function generated(context, options = {}) {
  const planned = await definitionProjectPlan(request('new', ['product'], { starter: 'note-pack', ...options }), context,
    { directory: join(context.root, 'product'), vault: context.root, target: 'product' }, context.frameworkRoot);
  await applyFilePlan(planned.plan);
  return { planned, directory: join(context.root, 'product') };
}
const order = directory => readFile(join(directory, 'order.txt'), 'utf8');
const run = (context, options) => starterProcessOperation(request('starters run', [], options), context);

test('the process plan orders dependencies and binds the receipt, package files and scripts', () => workspace(async context => {
  const { directory } = await generated(context);
  const plan = await processPlan(directory, ['nested', 'again']);
  assert.deepEqual(plan.processes.map(process => process.id), ['hello', 'nested', 'again']);
  const receipt = await readFile(join(directory, receiptFile)), hashOf = async path => sha(await readFile(join(directory, path)));
  assert.deepEqual(plan.sources, [
    { path: '.npmrc', sha256: null }, { path: receiptFile, sha256: sha(receipt) }, { path: 'package-lock.json', sha256: null }, { path: 'package.json', sha256: await hashOf('package.json') },
    { path: 'sub/.npmrc', sha256: null }, { path: 'sub/package-lock.json', sha256: null }, { path: 'sub/package.json', sha256: null },
    { path: 'sub/tool.mjs', sha256: await hashOf('sub/tool.mjs') }, { path: 'tools/hello.mjs', sha256: await hashOf('tools/hello.mjs') }]);
  const { planHash, effects, ...binding } = plan;
  assert.deepEqual([binding.directory, binding.receiptSha256, binding.requested], [directory, sha(receipt), ['nested', 'again']]);
  assert.equal(planHash, sha(JSON.stringify(binding)));
  assert.equal(effects, 'Trusted project code may write files, install dependencies, access the network, or launch a local preview. Not a sandbox.');
  for (const requested of [[], ['hello', 'hello'], Array.from({ length: 33 }, (_, index) => 'p' + index), ['absent']]) assert.equal(await code(processPlan(directory, requested)), 'STARTER_PROCESS');
  assert.equal(await code(processPlan(directory, ['Bad'])), 'STARTER_INVALID');
}, [definition]));

test('the process plan refuses unsupported receipts and linked project folders', () => workspace(async context => {
  const { directory } = await generated(context), receipt = JSON.parse(await readFile(join(directory, receiptFile), 'utf8'));
  await writeFile(join(directory, receiptFile), JSON.stringify({ ...receipt, schemaVersion: 2 }));
  assert.equal(await code(processPlan(directory, ['hello'])), 'STARTER_VERSION');
  await writeFile(join(directory, receiptFile), JSON.stringify({ ...receipt, extra: true }));
  assert.equal(await code(processPlan(directory, ['hello'])), 'STARTER_INVALID');
  assert.equal(await code(processPlan(join(context.root, 'absent'), ['hello'])), 'STARTER_DIRECTORY');
}, [definition]));

test('starters run plans by default and executes only with --yes and --trust-processes', () => workspace(async context => {
  const { directory } = await generated(context), progress = [];
  context.progress = message => progress.push(message);
  assert.equal(await code(run(context, { project: 'product' })), 'STARTER_PROCESS');
  const planned = await run(context, { project: 'product', process: 'nested' });
  assert.equal(planned.status, 'planned');
  assert.equal(planned.data.requires, '--yes --trust-processes --apply <planHash>; without --apply, --yes trusts the state at run time and cannot detect changes since this review');
  assert.equal((await run(context, { project: 'product', process: 'nested', yes: true, 'dry-run': true })).status, 'planned');
  assert.equal(await code(run(context, { project: 'product', process: 'nested', yes: true })), 'STARTER_TRUST');
  const bound = await run(context, { project: 'product', process: 'nested', yes: true, 'trust-processes': true, apply: planned.data.planHash });
  assert.deepEqual(bound.data, { completed: [{ process: 'hello', step: 1, exitCode: 0, signal: null, truncated: false }, { process: 'nested', step: 1, exitCode: 0, signal: null, truncated: false }],
    execution: 'completed', automaticRetry: false, publication: 'not-authorized', review: 'bound to the --apply plan hash' });
  assert.equal(await order(directory), 'product\nnested\n');
  assert.deepEqual(progress, ['\n> Hello: node tools/hello.mjs product\n', '\n> Nested: node tool.mjs \n']);
  assert.equal(await code(run(context, { project: 'product', process: 'nested', yes: true, 'trust-processes': true, apply: 'stale' })), 'PLAN_STALE');
  const unbound = await run(context, { project: 'product', process: 'hello', yes: true, 'trust-processes': true });
  assert.equal(unbound.data.review, 'unbound: planned and run in one step; changes before this run were not compared with an earlier review');
  assert.equal(await order(directory), 'product\nnested\nproduct\n');
}, [definition]));

test('npm steps run through the selected npm and failures keep completed effects', () => workspace(async context => {
  const { directory } = await generated(context);
  const npm = await run(context, { project: 'product', process: 'again', yes: true, 'trust-processes': true });
  assert.deepEqual(npm.data.completed.map(step => [step.process, step.exitCode]), [['hello', 0], ['again', 0]]);
  assert.equal(await order(directory), 'product\nnpm\n');
  await assert.rejects(run(context, { project: 'product', process: 'fail', yes: true, 'trust-processes': true }), error => {
    assert.equal(error.code, 'PROCESS_FAILED');
    assert.equal(error.message, 'Process exited with 7; inspect stderr. Completed effects are preserved.');
    assert.deepEqual({ ...error.details, failure: error.details.failure.execution.exitCode }, { written: true, directory, completed: [{ process: 'hello', step: 1, exitCode: 0, signal: null, truncated: false }],
      failure: 7, automaticRetry: false, effects: 'preserved-or-uncertain; not rolled back' });
    return true;
  });
  for (const thrown of [new Error('progress broke'), 'not an error']) {
    context.progress = () => { throw thrown; };
    await assert.rejects(run(context, { project: 'product', process: 'hello', yes: true, 'trust-processes': true }), error => error.code === 'STARTER_PROCESS_FAILED'
      && error.message === (thrown instanceof Error ? thrown.message : 'Starter process failed.') && error.details.failure === null && error.details.completed.length === 0);
  }
  // A script removed after review fails before any process starts, without progress output.
  context.progress = undefined; await rm(join(directory, 'tools/hello.mjs'));
  await assert.rejects(run(context, { project: 'product', process: 'hello', yes: true, 'trust-processes': true }), error => error.code === 'STARTER_PROCESS_FAILED'
    && error.message.startsWith('ENOENT') && error.details.completed.length === 0);
}, [definition]));

test('first-run completion reports unwritten plans, runs reviewed processes and refuses changed files', () => workspace(async context => {
  const outcome = (planned, status = 'applied') => result('new', { summary: planned.summary, planHash: 'h' }, status);
  const first = await generated(context, { run: 'hello', yes: true, 'trust-processes': true }), done = outcome(first.planned);
  const unwritten = await completeDefinition(outcome(first.planned, 'planned'), request('new', [], {}), context);
  assert.deepEqual(unwritten.data, { summary: first.planned.summary, planHash: 'h', written: false, next: 'No files or processes changed. Review and apply the plan to create the project.' });
  assert.equal(await code(completeDefinition(done, request('new', [], {}), context)), 'STARTER_TRUST');
  const completed = await completeDefinition(done, request('new', [], { 'trust-processes': true }), context);
  assert.deepEqual([completed.data.written, completed.data.processes.completed.map(step => step.process), completed.data.nextSteps], [true, ['hello'], ['Open Product']]);
  await writeFile(join(first.directory, 'tools/hello.mjs'), '// edited\n');
  assert.equal(await code(completeDefinition(done, request('new', [], { 'trust-processes': true }), context)), 'PLAN_STALE');
  const receipt = JSON.parse(await readFile(join(first.directory, receiptFile), 'utf8'));
  await writeFile(join(first.directory, receiptFile), JSON.stringify({ ...receipt, nextSteps: ['changed'] }));
  assert.equal(await code(completeDefinition(done, request('new', [], { 'trust-processes': true }), context)), 'PLAN_STALE');
  await rm(first.directory, { recursive: true });
  const idle = await generated(context);
  assert.deepEqual((await completeDefinition(outcome(idle.planned), request('new', [], {}), context)).data,
    { summary: idle.planned.summary, planHash: 'h', written: true, nextSteps: ['Open Product'] });
}, [definition]));
