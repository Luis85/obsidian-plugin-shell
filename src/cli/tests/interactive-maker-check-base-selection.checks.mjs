import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { checkSteps, checkOperation } from '../adapters/framework/check.ts';
import { withRepo, git, repoRoot, write } from './support/check-plan-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const stepOf = (plan, id) => plan.steps.find(step => step.id === id);
const ids = plan => plan.steps.map(step => step.id);
const cli = (args, cwd = repoRoot) => {
  const out = spawnSync(process.execPath, [join(repoRoot, 'bin/app'), ...args], { cwd, encoding: 'utf8', timeout: 60000 });
  return { status: out.status, stdout: out.stdout };
};

test('--base diffs merge-base(<ref>, HEAD) to the working tree: committed, staged, unstaged and untracked files', () => withRepo({}, async dir => {
  const fork = git(dir, 'rev-parse', 'HEAD');
  await write(dir, { 'docs-main-only.md': 'x\n' }); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'main moves on');
  git(dir, 'checkout', '-q', '-b', 'feature', fork);
  await write(dir, { 'src/committed.ts': 'export {};\n' }); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'committed');
  await write(dir, { 'src/staged.ts': 'export {};\n' }); git(dir, 'add', 'src/staged.ts');
  await write(dir, { 'src/a.ts': 'export const a = 2;\n', 'src/untracked.ts': 'export {};\n' });
  const plan = await checkSteps(dir, true, undefined, 'main');
  assert.deepEqual(plan.changes.files, ['src/a.ts', 'src/committed.ts', 'src/staged.ts', 'src/untracked.ts']);
  assert.deepEqual([plan.changes.base.source, plan.changes.base.ref, plan.changes.base.requested, plan.changes.base.commit], ['option', 'main', 'main', fork], 'the merge-base, not the moved tip of main');
  assert.ok(!plan.changes.paths.includes('docs-main-only.md'), 'commits that only exist on the base are not part of the diff');
  assert.equal(stepOf(plan, 'test').args.at(-1), 'src/untracked.ts');
}));

test('the default base is the origin/main merge-base when that ref exists, else HEAD; an explicit unknown base is an error', () => withRepo({}, async dir => {
  const baseline = git(dir, 'rev-parse', 'HEAD');
  await write(dir, { 'src/first.ts': 'export {};\n' }); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'work');
  const head = await checkSteps(dir, true);
  assert.deepEqual([head.changes.base.source, head.changes.base.ref, head.changes.files], ['head', 'HEAD', []], 'after committing, HEAD alone selects nothing');
  assert.match(head.changes.base.note, /origin\/main does not exist/);
  git(dir, 'update-ref', 'refs/remotes/origin/main', baseline);
  const origin = await checkSteps(dir, true);
  assert.deepEqual([origin.changes.base.source, origin.changes.base.ref, origin.changes.base.commit, origin.changes.files], ['origin-main', 'origin/main', baseline, ['src/first.ts']]);
  const explicit = await checkSteps(dir, true, undefined, 'HEAD');
  assert.deepEqual([explicit.changes.base.source, explicit.changes.files], ['option', []]);
  await assert.rejects(checkSteps(dir, true, undefined, 'no-such-ref'), { code: 'BASE_NOT_FOUND' });
  await assert.rejects(checkSteps(dir, true, undefined, '--output=x'), { code: 'INVALID_OPTION' });
  await assert.rejects(checkOperation({ command: 'check', args: [], options: { base: 'HEAD' } }, { root: dir, frameworkRoot: repoRoot }), { code: 'INVALID_OPTION' });
}));

test('fast mode selects node --test and maker suites from manifest includes and rule sources, and runs maker only when it matches', () => withRepo({}, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 2;\n' });
  const none = await checkSteps(dir, true);
  assert.ok(!ids(none).includes('maker-tests'), 'the 321 s maker suite no longer runs unconditionally');
  assert.equal(stepOf(none, 'suites').skip, 'No changed path selects a node --test or maker suite.');
  assert.ok(ids(none).includes('maker-types'), 'the maker type-check stays');
  await write(dir, { 'tests/tooling/interactive-maker-new.checks.mjs': 'x\n', 'tests/e2e/shop.spec.ts': 'x\n', 'tests/runtime/shop.test.ts': 'x\n' });
  const tests = await checkSteps(dir, true);
  // maker is a Vitest suite verify runs in its maker-coverage-run step, so fast mode still runs it (once, as a suite step).
  assert.deepEqual(stepOf(tests, 'suites').args, ['maker'], 'e2e is a playwright suite and the runtime Vitest suite belongs to the related-test step');
  assert.deepEqual(tests.suites.map(suite => [suite.name, suite.reasons[0].kind, suite.reasons[0].detail]), [['maker', 'suite-include', 'tests/tooling/interactive-maker-*.checks.mjs']]);
  for (const path of ['src/cli/adapters/makers/plan.ts', 'scripts/makers/recipes.json']) {
    await write(dir, { [path]: 'x\n' });
    assert.ok(stepOf(await checkSteps(dir, true), 'suites').args.includes('maker'), path);
  }
  await write(dir, { 'templates/companion/x.ts': 'x\n', 'tests/tooling/project-generator-new.checks.mjs': 'x\n' });
  const generator = await checkSteps(dir, true);
  assert.deepEqual(stepOf(generator, 'suites').args, ['maker', 'generator']);
  assert.equal(generator.suites[1].reasons.some(reason => reason.kind === 'suite-source' && reason.detail === 'templates/**'), true);
  // The Dev tier keeps the same selection but leaves the suites to CI, reported as skipped rather than silently dropped.
  const dev = await checkSteps(dir, true, undefined, undefined, true);
  assert.deepEqual([stepOf(dev, 'suites').args, stepOf(dev, 'suites').skip, dev.suites.map(suite => suite.name)],
    [['maker', 'generator'], "--skip-suites: maker, generator run in CI's Integration tier, not here.", ['maker', 'generator']]);
  assert.deepEqual(ids(dev), ids(generator), 'only the suites step changes; typecheck, lint, eslint, related tests and maker types still run');
  assert.ok(ids(dev).filter(id => id !== 'suites').every(id => !stepOf(dev, id).skip || stepOf(generator, id).skip));
  const run = [];
  const outcome = await checkOperation({ command: 'check', args: [], options: { fast: true, 'skip-suites': true } }, { root: dir, frameworkRoot: repoRoot }, async (_context, entry, args) => { run.push([entry, ...args].join(' ')); return { exitCode: 0 }; });
  assert.ok(!run.some(command => command.startsWith('tooling/testing/suites.mjs')), 'no suite process is launched');
  assert.equal(outcome.data.steps.find(step => step.id === 'suites').status, 'skipped');
  await assert.rejects(checkOperation({ command: 'check', args: [], options: { 'skip-suites': true } }, { root: dir, frameworkRoot: repoRoot }), { code: 'INVALID_OPTION', message: /requires --fast/ });
}));

test('fast mode lints and runs eslint on changed files only, and falls back to the full roots when configuration changes', () => withRepo({}, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 2;\n', 'src/cli/tool.ts': 'export {};\n', 'docs/note.md': 'n\n' });
  const narrow = await checkSteps(dir, true);
  assert.deepEqual(stepOf(narrow, 'lint').args, ['src/a.ts', 'src/cli/tool.ts']);
  assert.deepEqual(stepOf(narrow, 'eslint').args, ['-c', 'configs/lint/eslint.config.mjs', '--no-warn-ignored', 'src/a.ts', 'src/cli/tool.ts', '--max-warnings', '0']);
  await write(dir, { 'configs/lint/extra.json': '{}\n' });
  const wide = await checkSteps(dir, true);
  assert.deepEqual(stepOf(wide, 'lint').args, []);
  assert.deepEqual(stepOf(wide, 'eslint').args, ['-c', 'configs/lint/eslint.config.mjs', 'src', '--max-warnings', '0']);
  assert.deepEqual(stepOf(wide, 'test').args.slice(0, 2), ['run', '--config']);
  assert.match(wide.changes.reason, /configs\/lint\/extra\.json/);
}));

test('without git the fast gate says so and runs every step unscoped, in JSON and human output', () => withRepo({}, async dir => {
  const missing = await checkSteps(dir, true, async () => null);
  assert.equal(missing.changes.source, 'unavailable'); assert.equal(missing.changes.base, null);
  assert.match(missing.changes.reason, /^git is unavailable or the repository has no commit, so the changed set cannot be computed; running every step unscoped/);
  assert.deepEqual(ids(missing), ['typecheck', 'lint', 'eslint', 'test', 'maker-types', 'maker-tests']);
  const outside = join(dir, '..', `bare-${process.pid}`);
  try {
    await write(outside, { 'src/a.ts': 'x\n' });
    const json = JSON.parse(cli(['check', '--fast', '--dry-run', '--json', '--root', outside]).stdout);
    assert.equal(json.data.changes.source, 'unavailable'); assert.match(json.data.changes.reason, /running every step unscoped/);
    assert.match(cli(['check', '--fast', '--dry-run', '--root', outside]).stdout, /Changes {2}git unavailable \(git is unavailable or the repository has no commit/);
  } finally { await rm(outside, { recursive: true, force: true }); }
}));
