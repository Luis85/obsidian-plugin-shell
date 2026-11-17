import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { ciScope, parseScopeArguments, readScopeConfig } from '../quality/ci-scope.mjs';
import { e2eScenarios, gateValue } from '../quality/e2e-policy.mjs';
import { matchesAny } from '../../src/cli/tooling/delivery/paths.mjs';

// Owner decision: pull requests run the core shell gate; generator and starter qualification runs when a pull request
// changes a generator input, and always outside pull requests (nightly, dispatch, release).
const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = join(root, 'tooling/quality/ci-scope.mjs');
const config = readScopeConfig();
const load = async path => {
  const document = parseDocument(await readFile(join(root, path), 'utf8'));
  assert.deepEqual(document.errors, [], path);
  return document.toJS();
};
const generatorJobs = ['example-removal', 'generated-companion', 'starter'];
const scoped = (scenario, generators) => path => path === 'needs.scope.outputs.generators' ? generators : scenario(path);

test('a pull request is in scope only when a changed file is a generator input; every other event and an unreadable diff are in scope', () => {
  const pr = changed => ciScope({ event: 'pull_request', changed, config });
  assert.deepEqual(pr(['src/plugin/main.ts', 'tooling/release/cut.mjs', 'docs/development/WORKFLOWS.md']), { generators: false, matched: [], reason: 'none of 3 changed file(s) is a generator input' });
  for (const input of ['templates/companion/devkit/README.md', 'src/cli/compiler/index.ts', 'configs/starters/blank.json', 'package-lock.json', '.github/workflows/ci.yml', 'tooling/setup.mjs'])
    assert.equal(pr(['src/plugin/main.ts', input]).generators, true, input);
  assert.deepEqual(pr(['src/plugin/main.ts', 'src/cli/compiler/index.ts']).matched, ['src/cli/compiler/index.ts']);
  assert.equal(pr([]).generators, false, 'an empty diff changes no generator input');
  assert.equal(pr(null).generators, true, 'a diff that cannot be read fails toward running more');
  for (const event of ['push', 'schedule', 'workflow_dispatch', 'workflow_call', ''])
    assert.equal(ciScope({ event, changed: [], config }).generators, true, event);
});

test('negative: arguments and the config are strict', async t => {
  assert.deepEqual(parseScopeArguments(['--event', 'pull_request', '--files-from', 'x.txt']), { event: 'pull_request', filesFrom: 'x.txt' });
  for (const args of [['--bogus', 'x'], ['--event'], ['--event', '--files-from'], ['--event', 'a', '--event', 'b']]) assert.throws(() => parseScopeArguments(args), Error, args.join(' '));
  const folder = await mkdtemp(join(tmpdir(), 'ci-scope-config-')); t.after(() => rm(folder, { recursive: true, force: true }));
  execFileSync('mkdir', ['-p', join(folder, 'configs/quality')]);
  for (const body of [{ generators: [], workflows: ['a.yml'] }, { generators: ['x/**'] }, { generators: [' x'], workflows: ['a.yml'] }]) {
    await writeFile(join(folder, 'configs/quality/ci-scope.json'), JSON.stringify(body));
    assert.throws(() => readScopeConfig(folder), /CI_SCOPE_CONFIG_INVALID/);
  }
});

test('the command reads the merge commit\'s diff, prints its decision and writes the step output', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'ci-scope-git-')); t.after(() => rm(folder, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: folder, encoding: 'utf8' });
  git('init', '--quiet'); await writeFile(join(folder, 'README.md'), 'a\n'); git('add', '.'); git('commit', '--quiet', '-m', 'base');
  execFileSync('mkdir', ['-p', join(folder, 'src/plugin')]); await writeFile(join(folder, 'src/plugin/main.ts'), 'x\n'); git('add', '.'); git('commit', '--quiet', '-m', 'core change');
  const output = join(folder, 'output.txt'), env = { ...process.env, GITHUB_OUTPUT: output, GITHUB_EVENT_NAME: 'pull_request' };
  const run = args => spawnSync(process.execPath, [cli, ...args], { cwd: folder, encoding: 'utf8', env });
  const core = run([]);
  assert.equal(core.status, 0, core.stderr); assert.match(core.stdout, /^generators=false\nreason: none of 1 changed file\(s\) is a generator input/);
  assert.equal(await readFile(output, 'utf8'), 'generators=false\n');
  await writeFile(join(folder, 'files.txt'), 'src/plugin/main.ts\ntemplates/a.md\n');
  const input = run(['--files-from', join(folder, 'files.txt')]);
  assert.match(input.stdout, /^generators=true\nreason: 1 of 2 changed file\(s\) are generator inputs\n  templates\/a\.md\n/);
  assert.equal(await readFile(output, 'utf8'), 'generators=false\ngenerators=true\n');
  git('checkout', '--quiet', '--orphan', 'lonely'); git('commit', '--quiet', '-m', 'no parent');
  assert.match(run([]).stdout, /^generators=true\nreason: changed files could not be read/, 'a commit without a parent cannot be diffed');
  assert.match(run(['--event', 'schedule']).stdout, /^generators=true\nreason: schedule event/);
  assert.equal(run(['--bogus']).status, 1);
});

test('every generator input exists, and each path-filtered workflow triggers on exactly those inputs', async () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const pattern of config.generators) assert.ok(tracked.some(path => matchesAny([pattern], path)), `${pattern} matches a tracked file`);
  for (const file of config.workflows) {
    const workflow = await load(`.github/workflows/${file}`);
    assert.deepEqual(workflow.on.pull_request.paths, [...config.generators, '!projects/**'], file);
    assert.equal(workflow.on.pull_request['paths-ignore'], undefined, file);
  }
});

test('ci.yml gates the generator jobs on the scope job, keeps them for the e2e label, and CI result fails when the scope job fails', async () => {
  const ci = await load('.github/workflows/ci.yml'), scope = ci.jobs.scope;
  assert.equal(scope.outputs.generators, '${{ steps.scope.outputs.generators }}');
  const checkout = scope.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with['fetch-depth'], 2, 'the merge commit and its base parent');
  assert.equal(scope.steps.find(step => step.id === 'scope').run, 'node tooling/quality/ci-scope.mjs');
  assert.ok(!scope.steps.some(step => /npm|ci --/.test(step.run ?? '')), 'no install');
  assert.equal(gateValue([scope.if], e2eScenarios.e2eLabelAdded), false, 'a label run has no scope job');
  assert.ok(ci.jobs['ci-result'].needs.includes('scope'));
  for (const id of generatorJobs) {
    const job = ci.jobs[id];
    assert.equal(job.needs, 'scope', id);
    assert.equal(gateValue([job.if], scoped(e2eScenarios.readyPullRequest, 'false')), false, `${id} skips a pull request without generator inputs`);
    assert.equal(gateValue([job.if], scoped(e2eScenarios.readyPullRequest, 'true')), true, `${id} runs for generator inputs`);
    assert.equal(gateValue([job.if], scoped(e2eScenarios.release, '')), true, `${id} runs in the release tier`);
    assert.equal(gateValue([job.if], scoped(e2eScenarios.pushToMain, 'true')), false, `${id} skips main pushes`);
  }
  for (const id of ['example-removal', 'generated-companion'])
    assert.equal(gateValue([ci.jobs[id].if], scoped(e2eScenarios.e2eLabelAdded, '')), true, `${id} keeps its e2e steps on the label run`);
});

test('nightly.yml runs every night and calls CI and every Release-tier workflow except Candidate qualification, with tier integration', async () => {
  const nightly = await load('.github/workflows/nightly.yml'), release = await load('.github/workflows/release.yml');
  assert.deepEqual(Object.keys(nightly.on).sort(), ['schedule', 'workflow_dispatch']);
  assert.match(nightly.on.schedule[0].cron, /^\d+ \d+ \* \* \*$/, 'daily');
  assert.deepEqual(nightly.permissions, { contents: 'read', checks: 'read' });
  const calls = workflow => Object.values(workflow.jobs).filter(job => job.uses).map(job => job.uses.replace('./.github/workflows/', ''));
  assert.deepEqual(calls(nightly).sort(), calls(release).filter(file => file !== 'candidate-qualification.yml').sort());
  for (const job of Object.values(nightly.jobs)) assert.deepEqual(job.with, { tier: 'integration' }, job.uses);
});
