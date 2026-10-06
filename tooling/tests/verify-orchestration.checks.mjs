import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseVerifyArgs, planSteps, UsageError } from '../quality/verify-plan.mjs';
import { runPlan } from '../quality/verify-run.mjs';
import { outputTail, renderMarkdown } from '../quality/verify-report.mjs';
import { runVerifyCli } from '../quality/verify-cli.mjs';
import { verifySteps } from '../quality/verify-steps.mjs';
import { matcher, toolingGroups } from '../../src/cli/tooling/testing/suite-manifest.mjs';
import { suiteInventory } from '../testing/evidence-identity.mjs';

// Fake table: build <- typecheck <- types-report; lint and docs are independent of everything.
const fake = (id, needs = []) => ({ id, entry: `${id}.mjs`, args: [], needs, display: `${id}.mjs` });
const table = [fake('build'), fake('lint'), fake('typecheck', ['build']), fake('types-report', ['typecheck']), fake('docs')];
const plan = (options = {}) => planSteps(table, options);
const sink = () => { let text = ''; return { write: chunk => { text += chunk; }, text: () => text }; };
/** Executor double: records executed ids, fails the ones named, writes step output. */
function executor(failing = {}) {
  const executed = [];
  const execute = async (step, write) => {
    executed.push(step.id);
    write(`output of ${step.id}\n`);
    if (failing[step.id]) { write(`\u001b[31merror: ${step.id} exploded\u001b[0m\n`); throw Object.assign(new Error(failing[step.id]), { exitCode: 3 }); }
  };
  return { execute, executed };
}
const statuses = outcomes => Object.fromEntries(outcomes.map(item => [item.id, item.status]));

test('[VERIFY-ARGS] parses flags and both value spellings and rejects unknown input', () => {
  assert.deepEqual(parseVerifyArgs([]), { json: false, keepGoing: false, list: false, help: false, only: [], skip: [], reportDir: 'reports/verify' });
  const parsed = parseVerifyArgs(['--json', '--keep-going', '--only', 'a,b', '--only=c', '--skip=d', '--report-dir', 'out', '--list']);
  assert.deepEqual({ ...parsed }, { json: true, keepGoing: true, list: true, help: false, only: ['a', 'b', 'c'], skip: ['d'], reportDir: 'out' });
  for (const bad of [['--bogus'], ['--only'], ['--only', '--json'], ['--only='], ['--json=1'], ['positional']])
    assert.throws(() => parseVerifyArgs(bad), UsageError, bad.join(' '));
});

test('[VERIFY-SELECTION] --only adds transitive dependencies; --skip excludes; unknown ids list the valid ones', () => {
  const only = plan({ only: ['types-report'] });
  assert.deepEqual(only.filter(item => item.action === 'run').map(item => item.step.id), ['build', 'typecheck', 'types-report']);
  assert.deepEqual(only.filter(item => item.added).map(item => item.step.id), ['build', 'typecheck']);
  assert.deepEqual(plan({ skip: ['lint'] }).filter(item => item.action === 'skip').map(item => item.step.id), ['lint']);
  assert.throws(() => plan({ only: ['nope'] }), error => error instanceof UsageError && /Unknown step id in --only: nope\. Valid ids: build, lint, typecheck, types-report, docs\./.test(error.message));
  assert.throws(() => plan({ skip: ['x', 'y'] }), /Unknown step ids in --skip: x, y/);
});

test('[VERIFY-RUN] fail-fast stops at the first failure and reports the rest not-run without running them', async () => {
  const { execute, executed } = executor({ lint: 'lint failed' });
  const outcomes = await runPlan(plan(), { execute });
  assert.deepEqual(executed, ['build', 'lint']);
  assert.deepEqual(statuses(outcomes), { build: 'passed', lint: 'failed', typecheck: 'not-run', 'types-report': 'not-run', docs: 'not-run' });
  assert.match(outcomes[2].reason, /lint failed.*--keep-going/);
  assert.equal(outcomes[1].exitCode, 3);
});

test('[VERIFY-RUN] --keep-going runs independent steps and skips transitive dependents with the reason', async () => {
  const { execute, executed } = executor({ build: 'build broke' });
  const outcomes = await runPlan(plan(), { execute, keepGoing: true });
  assert.deepEqual(executed, ['build', 'lint', 'docs']);
  assert.deepEqual(statuses(outcomes), { build: 'failed', lint: 'passed', typecheck: 'skipped', 'types-report': 'skipped', docs: 'passed' });
  assert.equal(outcomes[2].reason, 'dependency build did not pass');
  assert.equal(outcomes[3].reason, 'dependency typecheck did not pass');
  assert.equal(outcomes[2].exitCode, null);
});

test('[VERIFY-RUN] captures an ANSI-free output tail only for failures and a --skip does not block dependents', async () => {
  const { execute, executed } = executor({ lint: 'lint failed' });
  const outcomes = await runPlan(plan({ skip: ['build'] }), { execute, keepGoing: true, tail: outputTail });
  assert.deepEqual(executed, ['lint', 'typecheck', 'types-report', 'docs']);
  assert.deepEqual(statuses(outcomes), { build: 'skipped', lint: 'failed', typecheck: 'passed', 'types-report': 'passed', docs: 'passed' });
  assert.equal(outcomes[0].reason, 'excluded by --skip');
  assert.equal(outcomes[1].outputTail, 'output of lint\nerror: lint exploded');
  assert.equal(outcomes[2].outputTail, undefined);
});

test('[VERIFY-RUN] cancellation leaves later steps not-run and never starts them', async () => {
  const { execute, executed } = executor();
  let cancelled = false;
  const outcomes = await runPlan(plan(), { execute: async (step, write) => { await execute(step, write); cancelled = true; }, keepGoing: true, isCancelled: () => cancelled });
  assert.deepEqual(executed, ['build']);
  assert.ok(outcomes.slice(1).every(item => item.status === 'not-run' && item.reason === 'cancelled'));
});

test('[VERIFY-TAIL] keeps 60 lines, strips ANSI and bounds characters', () => {
  const text = Array.from({ length: 100 }, (_, index) => `\u001b[32mline ${index}\u001b[0m`).join('\r\n');
  const lines = outputTail(text).split('\n');
  assert.equal(lines.length, 60);
  assert.equal(lines[0], 'line 40');
  assert.ok(!outputTail(text).includes('\u001b'));
  assert.equal(outputTail('x'.repeat(10000)).length, 6000);
});

async function cli(t, argv, failing = {}, env = {}) {
  const root = await mkdtemp(join(tmpdir(), 'verify-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const out = sink(), err = sink(), { execute, executed } = executor(failing);
  const code = await runVerifyCli({ argv, steps: table, execute, env, root, stdout: out, stderr: err });
  return { root, code, executed, stdout: out.text(), stderr: err.text() };
}

test('[VERIFY-JSON] --json prints one versioned result on stdout, keeps step output on stderr and mirrors it to summary.json', async t => {
  const run = await cli(t, ['--json', '--keep-going'], { build: 'build broke' });
  const result = JSON.parse(run.stdout);
  assert.equal(run.code, 1);
  assert.deepEqual(Object.keys(result), ['protocolVersion', 'command', 'status', 'data', 'diagnostics']);
  assert.equal(result.protocolVersion, 1); assert.equal(result.command, 'verify'); assert.equal(result.status, 'failed');
  assert.equal(result.data.mode, 'keep-going'); assert.equal(result.data.complete, true);
  assert.deepEqual(result.data.summary, { total: 5, passed: 2, failed: 1, skipped: 2, notRun: 0, durationMs: result.data.summary.durationMs });
  const [build, , typecheck] = result.data.steps;
  assert.deepEqual(Object.keys(build).sort(), ['command', 'durationMs', 'exitCode', 'id', 'outputTail', 'reason', 'status']);
  assert.equal(build.outputTail, 'output of build\nerror: build exploded');
  assert.equal(typecheck.status, 'skipped');
  assert.equal(result.diagnostics[0].code, 'VERIFY_FAILED');
  assert.match(result.diagnostics[0].next, /npm run verify -- --only build --keep-going/);
  assert.match(run.stderr, /output of lint/);
  assert.deepEqual(JSON.parse(await readFile(join(run.root, 'reports/verify/summary.json'), 'utf8')), result);
});

test('[VERIFY-MARKDOWN] summary.md tabulates step, status, duration and the first failing lines, escaping table syntax', async t => {
  const run = await cli(t, [], { lint: 'a | b <broken>' });
  const markdown = await readFile(join(run.root, 'reports/verify/summary.md'), 'utf8');
  assert.match(markdown, /^## npm run verify: FAILED\n/);
  assert.match(markdown, /\| Step \| Status \| Duration \| Detail \|/);
  assert.match(markdown, /\| `build` \| passed \| \d+ ms \| {2}\|/);
  assert.match(markdown, /\| `lint` \| failed \| \d+ ms \| error: lint exploded \|/);
  assert.match(markdown, /\| `typecheck` \| not-run \| 0 ms \| not reached: lint failed/);
  assert.match(markdown, /<details><summary>lint: last output<\/summary>/);
  assert.ok(markdown.includes('output of lint'));
  const rendered = renderMarkdown({ status: 'failed', diagnostics: [], data: { mode: 'fail-fast', complete: true, summary: { passed: 0, failed: 1, skipped: 0, notRun: 0, durationMs: 61000 },
    steps: [{ id: 'x', status: 'failed', durationMs: 61000, reason: 'a|b<c>', outputTail: 'plain' }] } });
  assert.match(rendered, /\| `x` \| failed \| 1 min 01 s \| plain \|/);
  assert.match(renderMarkdown({ status: 'failed', diagnostics: [], data: { mode: 'fail-fast', complete: true, summary: { passed: 0, failed: 1, skipped: 0, notRun: 0, durationMs: 5 },
    steps: [{ id: 'y', status: 'failed', durationMs: 5, reason: 'a|b<c>' }] } }), /\| a\\\|b&lt;c&gt; \|/);
});

test('[VERIFY-SUMMARY] GITHUB_STEP_SUMMARY receives the Markdown appended and is never truncated', async t => {
  const root = await mkdtemp(join(tmpdir(), 'verify-summary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'step-summary.md');
  for (const failing of [{}, { docs: 'docs failed' }]) {
    const out = sink(), err = sink(), { execute } = executor(failing);
    await runVerifyCli({ argv: ['--report-dir', 'rep'], steps: table, execute, env: { GITHUB_STEP_SUMMARY: file }, root, stdout: out, stderr: err });
  }
  const text = await readFile(file, 'utf8');
  assert.equal(text.match(/^## npm run verify:/gm).length, 2);
  assert.match(text, /PASSED[\s\S]*FAILED/);
  assert.equal(await readFile(join(root, 'rep/summary.md'), 'utf8') + '\n', text.slice(text.indexOf('## npm run verify: FAILED')) , 'second report equals the last appended block');
});

test('[VERIFY-SUMMARY] an absolute --report-dir is used as given, never re-rooted under the repository', async t => {
  const root = await mkdtemp(join(tmpdir(), 'verify-root-')), elsewhere = await mkdtemp(join(tmpdir(), 'verify-abs-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(elsewhere, { recursive: true, force: true })]));
  const { execute } = executor({});
  await runVerifyCli({ argv: ['--report-dir', elsewhere], steps: table, execute, env: {}, root, stdout: sink(), stderr: sink() });
  assert.match(await readFile(join(elsewhere, 'summary.md'), 'utf8'), /## npm run verify: PASSED/);
  await assert.rejects(readFile(join(root, elsewhere, 'summary.md'), 'utf8'), { code: 'ENOENT' });
});

test('[VERIFY-SUMMARY] unwritable report locations warn but never change the verdict', async t => {
  const root = await mkdtemp(join(tmpdir(), 'verify-unwritable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const out = sink(), err = sink(), { execute } = executor();
  const code = await runVerifyCli({ argv: [], steps: table, execute, env: { GITHUB_STEP_SUMMARY: join(root, 'missing/dir/file.md') }, root: join(root, 'x\0bad'), stdout: out, stderr: err });
  assert.equal(code, 0);
  assert.match(err.text(), /warning: Could not write reports\/verify/);
  assert.match(err.text(), /warning: Could not append to GITHUB_STEP_SUMMARY/);
});

test('[VERIFY-PARTIAL] a green --only run is labelled partial and omits unselected steps from the outcomes', async t => {
  const run = await cli(t, ['--only', 'typecheck', '--json']);
  const result = JSON.parse(run.stdout);
  assert.equal(run.code, 0); assert.equal(result.status, 'ok'); assert.equal(result.data.complete, false);
  assert.deepEqual(run.executed, ['build', 'typecheck']);
  assert.deepEqual(result.data.selection, { only: ['typecheck'], skip: [], addedDependencies: ['build'], unselected: ['lint', 'types-report', 'docs'] });
  assert.equal(result.diagnostics[0].code, 'PARTIAL_RUN');
  const text = await cli(t, ['--skip', 'docs']);
  assert.match(text.stderr, /not a complete verify verdict/);
  assert.doesNotMatch(text.stdout, /verification passed/);
});

test('[VERIFY-LIST] --list prints ids and commands without executing or writing reports', async t => {
  const run = await cli(t, ['--list', '--only', 'typecheck']);
  assert.equal(run.code, 0); assert.deepEqual(run.executed, []);
  assert.match(run.stdout, /^build +build\.mjs\ntypecheck +typecheck\.mjs {2}\(needs: build\)\n$/);
  await assert.rejects(readFile(join(run.root, 'reports/verify/summary.json')), { code: 'ENOENT' });
  const json = JSON.parse((await cli(t, ['--list', '--json'])).stdout);
  assert.equal(json.status, 'planned'); assert.equal(json.data.steps.length, 5);
});

test('[VERIFY-USAGE] invalid options exit 2 with the valid ids, as text or as a failed JSON envelope', async t => {
  const text = await cli(t, ['--skip', 'nope']);
  assert.equal(text.code, 2); assert.deepEqual(text.executed, []);
  assert.match(text.stderr, /Unknown step id in --skip: nope\. Valid ids: build, lint/);
  const json = JSON.parse((await cli(t, ['--json', '--only', 'nope'])).stdout);
  assert.equal(json.status, 'failed'); assert.equal(json.data, null); assert.equal(json.diagnostics[0].code, 'INVALID_ARGUMENT');
  assert.match(json.diagnostics[0].next, /--list/);
});

test('[VERIFY-TABLE] the real step table has unique ids, forward-only dependencies and an evidence-mode tooling step', () => {
  for (const mode of ['0', '1']) {
    const steps = verifySteps({ SHELL_EVIDENCE_TOOLING: mode }), seen = new Set();
    for (const step of steps) {
      assert.ok(!seen.has(step.id), `duplicate id ${step.id}`);
      for (const need of step.needs) assert.ok(seen.has(need), `${step.id} needs ${need}, which must be an earlier step`);
      seen.add(step.id);
    }
    const tooling = steps.find(step => step.id === 'tooling');
    assert.equal(tooling.kind === 'tooling-suites', mode === '0');
    assert.deepEqual(steps.find(step => step.id === 'analyzer').needs, ['build']);
  }
});

/** Every Vitest `run` step of the default verify table, with a matcher for the test files its config includes. */
async function vitestRunSteps() {
  const steps = verifySteps({}).filter(step => step.entry === 'node_modules/vitest/vitest.mjs' && step.args[0] === 'run');
  return Promise.all(steps.map(async step => {
    const config = (await import(pathToFileURL(resolve(step.args[step.args.indexOf('--config') + 1])).href)).default.test;
    return { id: step.id, match: matcher({ include: config.include, exclude: config.exclude ?? [] }) };
  }));
}
test('[VERIFY-ONCE] default verify runs every tooling test file exactly once; the maker files only in maker-coverage-run', async () => {
  const runs = new Map((await suiteInventory(process.cwd(), 'tooling')).map(path => [path, []]));
  for (const { name, files } of await toolingGroups(process.cwd())) for (const file of files) runs.get(file)?.push(`tooling:${name}`);
  for (const step of await vitestRunSteps()) for (const [file, owners] of runs) if (step.match(file)) owners.push(step.id);
  assert.deepEqual([...runs].filter(([, owners]) => owners.length !== 1), [], 'a tooling file runs zero or several times in one verify');
  const maker = [...runs].filter(([file]) => /^tests\/tooling\/interactive-maker-[^/]*\.checks\.mjs$/.test(file));
  assert.ok(maker.length > 100, `maker files: ${maker.length}`);
  assert.deepEqual([...new Set(maker.flatMap(([, owners]) => owners))], ['maker-coverage-run']);
});

test('[VERIFY-ENTRY] the real npm entry lists steps and rejects unknown ids without running any gate', () => {
  const list = spawnSync(process.execPath, ['scripts/quality/verify.mjs', '--list', '--json'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(list.status, 0, list.stderr);
  const steps = JSON.parse(list.stdout).data.steps.map(step => step.id);
  assert.deepEqual(steps, verifySteps().map(step => step.id));
  const bad = spawnSync(process.execPath, ['scripts/quality/verify.mjs', '--only', 'nope'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Valid ids: suites-check, /);
});
