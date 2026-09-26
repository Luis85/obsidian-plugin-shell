import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile, readdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runCheckSteps, checkSteps, checkOperation, outputTail } from '../../scripts/framework/check.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
async function scratch(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-check-')));
  t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}
function cli(args, env = process.env) {
  const output = spawnSync(process.execPath, [join(root, 'shell.mjs'), ...args, '--json'], { cwd: root, encoding: 'utf8', timeout: 60000, env });
  assert.equal(output.stdout.trim().split('\n').length, 1, output.stderr);
  return { exit: output.status, result: JSON.parse(output.stdout) };
}
function git(cwd, ...args) {
  const output = spawnSync('git', ['-c', 'user.email=check@example.invalid', '-c', 'user.name=Check', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
}
test('every step runs after a failure and failures keep their exit code and output tail', async t => {
  const dir = await scratch(t);
  await writeFile(join(dir, 'pass.mjs'), `console.log('fine');`);
  await writeFile(join(dir, 'fail.mjs'), `for (let i = 0; i < 100; i++) console.log('noise ' + i); console.error('\\u001b[31mAssertionError: expected 2\\u001b[0m'); process.exitCode = 3;`);
  await writeFile(join(dir, 'later.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync('later-ran', 'yes');`);
  const progress = [];
  const outcomes = await runCheckSteps([
    { id: 'first', display: 'node pass.mjs', entry: 'pass.mjs', args: [] },
    { id: 'broken', display: 'node fail.mjs', entry: 'fail.mjs', args: [] },
    { id: 'skipped', display: 'skipped', entry: 'missing.mjs', args: [], skip: 'No changed source files since HEAD.' },
    { id: 'missing', display: 'node missing.mjs', entry: 'missing.mjs', args: [] },
    { id: 'last', display: 'node later.mjs', entry: 'later.mjs', args: [] },
  ], { root: dir, frameworkRoot: root, progress: text => progress.push(text) }, 10000);
  assert.deepEqual(outcomes.map(step => [step.id, step.status]), [['first', 'passed'], ['broken', 'failed'], ['skipped', 'skipped'], ['missing', 'failed'], ['last', 'passed']]);
  assert.ok((await readdir(dir)).includes('later-ran'), 'the step after a failure still ran');
  const broken = outcomes[1];
  assert.equal(broken.exitCode, 3); assert.equal(broken.code, 'PROCESS_FAILED');
  assert.match(broken.outputTail, /AssertionError: expected 2$/); assert.doesNotMatch(broken.outputTail, /\u001b/);
  assert.ok(!broken.outputTail.includes('noise 30\n'), 'only the tail is retained');
  assert.equal(outcomes[3].code, 'TOOL_MISSING'); assert.equal(outcomes[3].exitCode, null);
  assert.equal(outcomes[2].reason, 'No changed source files since HEAD.');
  assert.ok(progress.every(line => line.startsWith('check: ')), 'child output is captured, not streamed');
  assert.equal(outputTail('a\nb\nc', 2), 'b\nc');
});
test('check without installed tools fails every step honestly and points to install', async t => {
  const dir = await scratch(t);
  const { exit, result } = cli(['check', '--root', dir]);
  assert.equal(exit, 1); assert.equal(result.status, 'failed');
  assert.equal(result.data.gate, 'check'); assert.equal(result.data.verify, 'not-run'); assert.equal(result.data.scope, 'shell-repository');
  assert.deepEqual(result.data.steps.map(step => [step.id, step.status, step.code]), [['typecheck', 'failed', 'TOOL_MISSING'], ['lint', 'failed', 'TOOL_MISSING'], ['eslint', 'failed', 'TOOL_MISSING'], ['test', 'failed', 'TOOL_MISSING']]);
  assert.deepEqual(result.data.summary.failed, 4);
  assert.equal(result.diagnostics[0].code, 'CHECK_FAILED'); assert.equal(result.diagnostics[0].next, 'node shell.mjs install --yes');
  const human = spawnSync(process.execPath, [join(root, 'shell.mjs'), 'check', '--root', dir], { encoding: 'utf8', timeout: 60000 });
  assert.equal(human.status, 1);
  assert.match(human.stdout, /^ {2}\[FAIL\] typecheck {2}vue-tsc --noEmit +\d+ms$/m);
  assert.match(human.stdout, /^ {2}Summary {2}0 passed, 4 failed, 0 skipped in /m);
  assert.match(human.stdout, /^Next: node shell\.mjs install --yes$/m);
});
test('scope detection selects project-suite steps in a generated project', async t => {
  const dir = await scratch(t);
  const shell = await checkSteps(dir, false);
  assert.deepEqual(shell.steps.map(step => [step.id, step.entry, step.args.join(' ')]), [
    ['typecheck', 'node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'], ['lint', 'scripts/quality/lint-source.mjs', ''],
    ['eslint', 'node_modules/eslint/bin/eslint.js', 'src --max-warnings 0'], ['test', 'node_modules/vitest/vitest.mjs', 'run']]);
  await mkdir(join(dir, '.companion')); await writeFile(join(dir, '.companion/generation.json'), '{}'); await writeFile(join(dir, 'tsconfig.project.json'), '{}');
  const project = await checkSteps(dir, false);
  assert.equal(project.scope, 'generated-project');
  assert.deepEqual(project.steps.map(step => [step.id, step.args.join(' ')]), [
    ['typecheck', '--noEmit --project tsconfig.project.json'], ['eslint', 'src --max-warnings 0'], ['test', 'run --config vitest.project.config.mjs']]);
  const { exit, result } = cli(['check', '--root', dir, '--dry-run']);
  assert.equal(exit, 0); assert.equal(result.status, 'planned'); assert.equal(result.data.execution, 'not-run');
  assert.deepEqual(result.data.steps.map(step => step.status), ['not-run', 'not-run', 'not-run']);
  assert.deepEqual((await readdir(dir)).sort(), ['.companion', 'tsconfig.project.json']);
});
test('fast mode runs tests related to changed and untracked source files only', async t => {
  const dir = await scratch(t);
  await mkdir(join(dir, 'src')); await writeFile(join(dir, 'src/a.ts'), 'export const a = 1;\n'); await writeFile(join(dir, 'src/gone.ts'), 'x');
  await writeFile(join(dir, 'README.md'), 'readme');
  git(dir, 'init', '-q'); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'initial');
  const clean = await checkSteps(dir, true);
  assert.deepEqual(clean.changes, { source: 'git', files: [] });
  assert.equal(clean.steps[1].skip, 'No changed source files since HEAD.');
  await writeFile(join(dir, 'src/a.ts'), 'export const a = 2;\n'); await unlink(join(dir, 'src/gone.ts'));
  await writeFile(join(dir, 'src/View.vue'), '<template />'); await writeFile(join(dir, 'README.md'), 'changed docs');
  await mkdir(join(dir, 'node_modules/pkg'), { recursive: true }); await writeFile(join(dir, 'node_modules/pkg/index.js'), '');
  const changed = await checkSteps(dir, true);
  assert.deepEqual(changed.changes.files, ['src/View.vue', 'src/a.ts']);
  assert.deepEqual(changed.steps.map(step => step.id), ['typecheck', 'test']);
  assert.deepEqual(changed.steps[1].args, ['related', '--run', '--passWithNoTests', 'src/View.vue', 'src/a.ts']);
  const nested = await checkSteps(join(dir, 'src'), true);
  assert.deepEqual(nested.changes.files, ['View.vue', 'a.ts'], 'paths are relative to the checked root');
});
test('fast mode falls back to the full suite without git or with too many changes', async t => {
  const dir = await scratch(t);
  const missing = await checkSteps(dir, true, async () => null);
  assert.equal(missing.changes.source, 'unavailable'); assert.match(missing.changes.reason, /full suite/);
  assert.deepEqual(missing.steps[1].args, ['run']);
  const names = Array.from({ length: 201 }, (_, index) => `f${index}.ts`);
  for (const name of names) await writeFile(join(dir, name), '');
  const many = await checkSteps(dir, true, async (_, args) => args[0] === 'diff' ? names.join('\n') : '');
  assert.equal(many.changes.files.length, 201); assert.match(many.changes.reason, /more than 200/);
  assert.deepEqual(many.steps[1].args, ['run']);
  const nodeOnly = { ...process.env, PATH: dirname(process.execPath) };
  const { exit, result } = cli(['check', '--fast', '--dry-run', '--root', dir], nodeOnly);
  assert.equal(exit, 0); assert.equal(result.data.mode, 'fast');
  assert.equal(result.data.changes.source, 'unavailable'); assert.equal(result.data.steps[1].command, 'vitest run');
});
test('cancellation skips remaining steps and reports cancelled', async t => {
  const dir = await scratch(t);
  const controller = new AbortController(); controller.abort();
  const outcome = await checkOperation({ command: 'check', args: [], options: {} }, { root: dir, frameworkRoot: root, signal: controller.signal });
  assert.equal(outcome.status, 'cancelled');
  assert.ok(outcome.data.steps.every(step => step.status === 'skipped' && step.reason === 'cancelled'));
});
