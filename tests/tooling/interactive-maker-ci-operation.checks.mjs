import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ciOperation } from '../../bin/adapters/framework/ci.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { renderHuman } from '../../bin/presentation/terminal/terminal-render.ts';
import { terminalStyle } from '../../bin/presentation/terminal/terminal-style.ts';
const { test, after } = await (process.env.VITEST ? import('vitest').then(module => ({ test: module.test, after: module.afterAll })) : import('node:test'));
const root = fileURLToPath(new URL('../../', import.meta.url));
const posix = process.platform !== 'win32';
// Execution is refused for a job whose runner OS differs from this machine, so executing fixtures target the host's runner.
const hostRunner = { linux: 'ubuntu-latest', darwin: 'macos-latest', win32: 'windows-latest' }[process.platform] ?? 'ubuntu-latest';
const hostOs = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' }[process.platform] ?? 'Linux';
// The Linux runner becomes the host's; on Windows the two runners swap so the matrix keeps two distinct operating systems.
const onHost = text => text.replace(/ubuntu-latest|windows-latest/g, os => os === 'ubuntu-latest' ? hostRunner : hostRunner === 'windows-latest' ? 'ubuntu-latest' : os);
const pwshAvailable = spawnSync('pwsh', ['--version'], { encoding: 'utf8' }).status === 0;
const created = [];
after(() => Promise.all(created.map(dir => rm(dir, { recursive: true, force: true }))));
async function project(workflows) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-ci-test-')));
  created.push(dir);
  await mkdir(join(dir, '.github/workflows'), { recursive: true }); await mkdir(join(dir, 'sub'));
  for (const [name, text] of Object.entries(workflows)) await writeFile(join(dir, '.github/workflows', name), text);
  return dir;
}
const request = (options, command = 'ci') => ({ command, args: [], options });
const run = (dir, options) => ciOperation(request(options), { root: dir, frameworkRoot: root });
function cli(args, cwd = root) {
  const output = spawnSync(process.execPath, [join(root, 'bin/app'), ...args], { cwd, encoding: 'utf8', timeout: 120000 });
  return { exit: output.status, stdout: output.stdout, stderr: output.stderr };
}
const fake = `name: Fake build
on:
  push:
    branches: [main]
  pull_request:
    paths: ['src/**']
env:
  WORKFLOW_LEVEL: wf
jobs:
  build:
    name: Build / \${{ matrix.os }} / \${{ matrix.flavor }}
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        flavor: [a, b]
    env:
      JOB_LEVEL: \${{ matrix.flavor }}
    defaults:
      run:
        working-directory: sub
    steps:
      - uses: actions/checkout@v4
      - uses: some/external-action@v1
        with:
          x: 1
      - name: Export values
        id: export
        run: |
          echo "FROM_ENV=exported" >> "$GITHUB_ENV"
          echo "token=abc123" >> "$GITHUB_OUTPUT"
      - name: Use exports
        env:
          STEP_LEVEL: \${{ steps.export.outputs.token }}
        run: |
          test "$FROM_ENV" = exported
          test "$STEP_LEVEL" = abc123
          test "$JOB_LEVEL" = a
          pwd > "$GITHUB_WORKSPACE/pwd.txt"
          echo "$WORKFLOW_LEVEL" > "$GITHUB_WORKSPACE/wf.txt"
      - name: Windows only
        if: runner.os == 'Windows'
        run: exit 9
      - name: Unknown event
        if: github.event_name == 'push'
        run: exit 9
      - name: Fails
        run: |
          echo before-failure
          exit 3
      - name: Never reached
        run: echo done > "$GITHUB_WORKSPACE/never.txt"
`;
const select = { job: 'fake/build', matrix: 'os=ubuntu-latest,flavor=a' };
test('list reports workflows, jobs, triggers, filters and local reproducibility without running anything', async () => {
  const dir = await project({ 'fake.yml': fake, 'external.yml': 'name: Ext\non: workflow_dispatch\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: docker/build-push-action@v5\n      - run: echo hi\n' });
  const { data, status } = await run(dir, { list: true });
  assert.equal(status, 'ok');
  assert.deepEqual(data.workflows.map(item => item.stem), ['external', 'fake']);
  const build = data.workflows[1].jobs[0];
  assert.deepEqual([build.reference, build.executable, build.matrix], ['fake/build', true, { axes: ['os', 'flavor'], combinations: 4, computed: false }]);
  assert.deepEqual(build.steps, { total: 8, run: 6, setup: 1, external: 1 }); assert.equal(build.reproducible, false, 'the external action makes the job not fully reproducible');
  assert.deepEqual(data.workflows[1].triggers, ['push', 'pull_request']);
  assert.deepEqual(data.workflows[1].filters, [{ event: 'push', branches: ['main'] }, { event: 'pull_request', paths: ['src/**'] }]);
});
test('a job with an external action is marked not reproducible and the action is skipped with a note', async () => {
  const dir = await project({ 'external.yml': 'name: Ext\non: workflow_dispatch\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: docker/build-push-action@v5\n      - run: echo hi\n' });
  const listed = (await run(dir, { list: true })).data.workflows[0].jobs[0];
  assert.equal(listed.reproducible, false); assert.match(listed.reasons[0], /docker\/build-push-action.*external, skipped/);
  const plan = await run(dir, { job: 'external/j' });
  assert.equal(plan.status, 'planned');
  assert.deepEqual(plan.data.steps.map(step => [step.kind, step.disposition, step.status]), [['external', 'external', 'skipped'], ['run', 'run', 'not-run']]);
  assert.match(plan.data.notes.join('\n'), /external action step\(s\) are skipped: docker\/build-push-action/);
});
test('dry run prints exact ordered commands with literal env, working directory, conditions and verbatim unresolved expressions', async () => {
  const dir = await project({ 'fake.yml': onHost(fake) });
  const before = await readdir(dir);
  const { data, status } = await run(dir, { ...select, matrix: onHost(select.matrix) });
  const windowsHost = process.platform === 'win32';
  assert.equal(status, 'planned'); assert.equal(data.mode, 'dry-run'); assert.equal(data.execution, 'not-run');
  assert.equal(data.name, `Build / ${hostRunner} / a`); assert.equal(data.runsOn, hostRunner); assert.deepEqual(data.matrix, { mode: 'selected', available: 4, combination: { os: hostRunner, flavor: 'a' } });
  assert.deepEqual(data.steps.map(step => [step.index, step.disposition]), [[1, 'setup'], [2, 'external'], [3, 'run'], [4, 'run'], [5, windowsHost ? 'run' : 'skip-condition'], [6, 'condition-unknown'], [7, 'run'], [8, 'run']]);
  const use = data.steps[3];
  assert.match(use.command, /^test "\$FROM_ENV" = exported\ntest "\$STEP_LEVEL" = abc123\n/);
  assert.deepEqual(use.env, { WORKFLOW_LEVEL: 'wf', JOB_LEVEL: 'a', STEP_LEVEL: '${{ steps.export.outputs.token }}' });
  assert.deepEqual(use.unresolved, ['steps.export.outputs.token']); assert.equal(use.workingDirectory, 'sub'); assert.equal(use.shell, 'bash');
  assert.deepEqual(data.steps[4].condition, { expression: "runner.os == 'Windows'", result: windowsHost ? 'true' : 'false' }); assert.equal(data.steps[5].condition.result, 'unknown');
  assert.equal(data.steps[5].status, 'skipped'); assert.match(data.steps[5].reason, /cannot be settled locally/);
  // The job targets this machine's runner OS, so it is executable wherever a POSIX shell exists.
  if (posix) { assert.equal(data.executable, true); assert.match(data.next, new RegExp(`^node bin/app ci --job fake/build --matrix os=${hostRunner},flavor=a --execute$`)); }
  assert.deepEqual(await readdir(dir), before, 'a dry run writes nothing'); await assert.rejects(access(join(dir, 'pwd.txt')));
});
test('matrix selection: explicit, defaulted to this machine, no match, ambiguous and expression-computed', async () => {
  const dir = await project({ 'fake.yml': fake, 'computed.yml': 'name: C\non: push\njobs:\n  j:\n    runs-on: ${{ matrix.os }}\n    strategy:\n      matrix:\n        os: ${{ fromJSON(\'["ubuntu-latest"]\') }}\n    steps:\n      - run: echo ${{ matrix.os }}\n' });
  const defaulted = (await run(dir, { job: 'fake/build' })).data;
  assert.equal(defaulted.matrix.mode, 'default'); assert.equal(defaulted.matrix.combination.os, process.platform === 'linux' ? 'ubuntu-latest' : defaulted.matrix.combination.os);
  assert.match(defaulted.notes[0], /4 combinations; defaulted to/);
  await assert.rejects(run(dir, { job: 'fake/build', matrix: 'os=macos-latest' }), error => error.code === 'CI_MATRIX_NO_MATCH');
  await assert.rejects(run(dir, { job: 'fake/build', matrix: 'flavor=a' }), error => error.code === 'CI_MATRIX_AMBIGUOUS');
  await assert.rejects(run(dir, { job: 'fake/build', matrix: 'nonsense' }), error => error.code === 'CI_MATRIX_SELECTOR');
  await assert.rejects(run(dir, { job: 'computed/j' }), error => error.code === 'CI_MATRIX_UNRESOLVED' && /--matrix os=<value>/.test(error.message));
  const computed = (await run(dir, { job: 'computed/j', matrix: 'os=ubuntu-latest' })).data;
  assert.equal(computed.steps[0].command, 'echo ubuntu-latest'); assert.deepEqual(computed.unresolved, []);
});
test('usage errors and unknown workflows or jobs fail with suggestions', async () => {
  const dir = await project({ 'fake.yml': fake });
  for (const options of [{}, { list: true, job: 'fake/build' }, { list: true, execute: true }, { list: true, matrix: 'a=b' }]) await assert.rejects(run(dir, options), error => error.code === 'CI_USAGE');
  await assert.rejects(run(dir, { job: 'fake' }), error => error.code === 'CI_JOB_REFERENCE');
  await assert.rejects(run(dir, { job: 'fak/build' }), error => error.code === 'CI_WORKFLOW_UNKNOWN' && /Did you mean fake/.test(error.message));
  await assert.rejects(run(dir, { job: 'fake/buid' }), error => error.code === 'CI_JOB_UNKNOWN' && /Did you mean build/.test(error.message));
  assert.deepEqual((await run(await project({}), { list: true })).data.workflows, []);
});
test('execute is refused for secrets, publication, deployment, wrong runner OS, unresolved inputs and missing shells; nothing runs', async () => {
  // A runner OS that differs from this machine (and is still in the fake matrix), so the refusal holds on every host.
  const foreign = process.platform === 'win32' ? 'ubuntu-latest' : 'windows-latest';
  const danger = (id, body, head = '', runner = 'ubuntu-latest') => `  ${id}:\n    runs-on: ${runner}\n${head}    steps:\n      - run: touch ran-${id}.txt\n${body}`;
  const dir = await project({ 'danger.yml': 'name: Danger\non: push\njobs:\n' + [
    danger('secret', '      - run: echo "${{ secrets.TOKEN }}"\n'), danger('publish', '      - run: npm publish\n'), danger('push', '      - run: git push origin HEAD\n'),
    danger('release', '      - run: echo hi\n'), danger('deploy', '      - run: echo hi\n', '    environment: production\n'),
    danger('inputs', '      - run: echo ${{ inputs.version }}\n'), danger('windows', '      - run: echo hi\n', '', foreign),
    ...(pwshAvailable ? [] : [danger('shell', '      - run: Write-Host hi\n        shell: pwsh\n')]) ].join(''), 'fake.yml': fake });
  const ids = ['secret', 'publish', 'push', 'release', 'deploy', 'inputs', 'windows', ...(pwshAvailable ? [] : ['shell'])];
  const patterns = { secret: /refused: step 2 references secrets/, publish: /refused: step 2 runs npm publish/, push: /runs git push/, release: /named as a release/, deploy: /deployment environment/,
    inputs: /unresolved expressions.*inputs\.version/, windows: new RegExp(`targets ${foreign} but this machine is`), shell: /needs pwsh/ };
  for (const id of ids) {
    const plan = await run(dir, { job: `danger/${id}` });
    assert.equal(plan.status, 'planned', `${id} dry run is still available`); assert.equal(plan.data.executable, false);
    const refused = await run(dir, { job: `danger/${id}`, execute: true });
    assert.equal(refused.status, 'blocked', id); assert.equal(refused.data.execution, 'refused'); assert.match(refused.data.blockers.join('\n'), patterns[id], id);
    assert.equal(refused.diagnostics[0].code, 'CI_EXECUTE_REFUSED'); assert.ok(refused.data.steps.every(step => step.status !== 'passed'));
    await assert.rejects(access(join(dir, `ran-${id}.txt`)), `${id} ran nothing`);
  }
  const windows = await run(dir, { ...select, matrix: `os=${foreign},flavor=a`, execute: true });
  assert.equal(windows.status, 'blocked'); assert.match(windows.data.blockers[0], new RegExp(`targets ${foreign}`));
  const listed = (await run(dir, { list: true })).data.workflows.find(item => item.stem === 'danger').jobs;
  assert.deepEqual(listed.filter(item => !item.executable).map(item => item.id).sort(), ['deploy', 'publish', 'push', 'release', 'secret']);
});
test('execute runs run steps in order with env files, working directory and conditions, and stops at the first failure', { skip: !posix }, async () => {
  const dir = await project({ 'fake.yml': onHost(fake) });
  const progress = [];
  const outcome = await ciOperation(request({ ...select, matrix: onHost(select.matrix), execute: true }), { root: dir, frameworkRoot: root, progress: text => progress.push(text) });
  assert.equal(outcome.status, 'failed'); assert.equal(outcome.data.mode, 'execute'); assert.equal(outcome.data.execution, 'executed');
  assert.deepEqual(outcome.data.steps.map(step => [step.index, step.status]), [[1, 'skipped'], [2, 'skipped'], [3, 'passed'], [4, 'passed'], [5, 'skipped'], [6, 'skipped'], [7, 'failed'], [8, 'not-run']]);
  assert.match(outcome.data.steps[1].reason, /Not reproducible locally/); assert.match(outcome.data.steps[4].reason, /is false on this machine/); assert.match(outcome.data.steps[5].reason, /cannot be settled locally/);
  const failed = outcome.data.steps[6];
  assert.equal(failed.exitCode, 3); assert.equal(failed.code, 'PROCESS_FAILED'); assert.match(failed.outputTail, /^before-failure$/); assert.equal(typeof failed.durationMs, 'number');
  assert.equal(outcome.data.steps[7].reason, 'stopped after step 7 failed');
  assert.deepEqual(outcome.data.summary, { passed: 2, failed: 1, skipped: 4, notRun: 1, durationMs: outcome.data.summary.durationMs });
  assert.equal(outcome.diagnostics[0].code, 'CI_JOB_FAILED'); assert.match(outcome.diagnostics[0].next, new RegExp(`--matrix os=${hostRunner},flavor=a --execute$`));
  assert.equal((await readFile(join(dir, 'pwd.txt'), 'utf8')).trim(), join(dir, 'sub'), 'step ran in the default working directory');
  assert.equal((await readFile(join(dir, 'wf.txt'), 'utf8')).trim(), 'wf'); await assert.rejects(access(join(dir, 'never.txt')));
  assert.deepEqual(progress.filter(line => !line.startsWith('ci: step')), [], 'child output is captured, not streamed');
});
test('a passing job reports ok with per-step durations; a timeout stops the step', { skip: !posix }, async () => {
  const dir = await project({ 'ok.yml': onHost('name: Ok\non: push\njobs:\n  quick:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo one\n      - run: echo "$CI $RUNNER_OS" > ran.txt\n        shell: bash\n  slow:\n    runs-on: ubuntu-latest\n    steps:\n      - run: sleep 20\n      - run: echo after > after.txt\n') });
  const ok = await run(dir, { job: 'ok/quick', execute: true });
  assert.equal(ok.status, 'ok'); assert.deepEqual(ok.data.summary, { passed: 2, failed: 0, skipped: 1, notRun: 0, durationMs: ok.data.summary.durationMs }); assert.deepEqual(ok.diagnostics, []);
  assert.equal((await readFile(join(dir, 'ran.txt'), 'utf8')).trim(), `true ${hostOs}`);
  const timed = await run(dir, { job: 'ok/slow', execute: true, timeout: '400' });
  assert.equal(timed.status, 'failed'); assert.equal(timed.data.steps[0].code, 'TIMEOUT'); assert.equal(timed.data.steps[1].status, 'not-run');
  await assert.rejects(access(join(dir, 'after.txt')));
});
test('a working directory outside the project fails the step instead of running there', { skip: !posix }, async () => {
  const dir = await project({ 'escape.yml': onHost('name: E\non: push\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - run: touch escaped.txt\n        working-directory: ../\n') });
  const outcome = await run(dir, { job: 'escape/j', execute: true });
  assert.equal(outcome.status, 'failed'); assert.equal(outcome.data.steps[0].code, 'CI_WORKING_DIRECTORY');
});
test('the CLI exposes the command through the versioned JSON protocol and a readable terminal view', { skip: !posix }, async () => {
  const dir = await project({ 'fake.yml': onHost(fake) });
  const listed = cli(['ci', '--list', '--json', '--root', dir]);
  assert.equal(listed.exit, 0); assert.equal(listed.stdout.trim().split('\n').length, 1, listed.stderr);
  const parsed = JSON.parse(listed.stdout);
  assert.deepEqual([parsed.protocolVersion, parsed.command, parsed.status, parsed.data.summary.jobs], [1, 'ci', 'ok', 1]);
  const dry = cli(['ci', '--job', 'fake/build', '--matrix', `os=${hostRunner},flavor=a`, '--root', dir]);
  assert.equal(dry.exit, 0); assert.match(dry.stdout, /^ci: planned$/m); assert.match(dry.stdout, /^ {8}\$ pwd > "\$GITHUB_WORKSPACE\/pwd\.txt"$/m);
  assert.match(dry.stdout, /unresolved: \$\{\{ steps\.export\.outputs\.token \}\}/); assert.match(dry.stdout, new RegExp(`^Next: node bin/app ci --job fake/build --matrix os=${hostRunner},flavor=a --execute$`, 'm'));
  const failed = cli(['ci', '--job', 'fake/build', '--matrix', `os=${hostRunner},flavor=a`, '--execute', '--json', '--root', dir]);
  assert.equal(failed.exit, 1); const result = JSON.parse(failed.stdout); assert.equal(result.status, 'failed'); assert.equal(result.data.steps[6].exitCode, 3);
  const human = cli(['ci', '--job', 'fake/build', '--matrix', `os=${hostRunner},flavor=a`, '--execute', '--root', dir]);
  assert.equal(human.exit, 1); assert.match(human.stdout, /--- step 7 \(PROCESS_FAILED\) last output ---\n {2}before-failure/); assert.match(human.stdout, /Summary {2}2 passed, 1 failed, 4 skipped, 1 not run in /);
  const bad = cli(['ci', '--json', '--root', dir]);
  assert.equal(bad.exit, 1); assert.equal(JSON.parse(bad.stdout).diagnostics[0].code, 'CI_USAGE');
});
test('the real repository lists every workflow and plans a real job as a dry run', async () => {
  const listed = await ciOperation(request({ list: true }), { root, frameworkRoot: root });
  const files = (await readdir(join(root, '.github/workflows'))).filter(name => /\.ya?ml$/.test(name));
  assert.equal(listed.data.workflows.length, files.length); assert.ok(listed.data.summary.jobs >= files.length);
  const ci = listed.data.workflows.find(item => item.stem === 'ci');
  assert.ok(ci.jobs.some(item => item.id === 'baseline' && item.reference === 'ci/baseline' && item.reproducible));
  const plan = await ciOperation(request({ job: 'ci/baseline', matrix: 'os=ubuntu-24.04' }), { root, frameworkRoot: root });
  assert.equal(plan.status, 'planned'); assert.equal(plan.data.execution, 'not-run'); assert.equal(plan.data.runsOn, 'ubuntu-24.04');
  assert.ok(plan.data.steps.some(step => step.disposition === 'run' && step.command.includes('verify-baseline.mjs')));
});
test('the command is catalogued with its options and routed through the shared operation entry point', async () => {
  const parsed = parseCliArguments(['ci', '--job', 'ci/baseline', '--matrix', 'os=ubuntu-24.04', '--execute']);
  assert.deepEqual([parsed.command, parsed.options.job, parsed.options.matrix, parsed.options.execute], ['ci', 'ci/baseline', 'os=ubuntu-24.04', true]);
  assert.throws(() => parseCliArguments(['ci', '--jobs', 'x']), error => error.code === 'INVALID_OPTION');
  const outcome = await executeOperation(request({ job: 'ci/baseline', matrix: 'os=ubuntu-24.04', 'dry-run': true }), { root, frameworkRoot: root });
  assert.equal(outcome.status, 'planned');
  const help = await executeOperation({ command: 'help', args: ['ci'], options: {} }, { root, frameworkRoot: root });
  assert.match(help.data.commands[0].usage, /--job <workflow-file-stem>\/<job-id>/); assert.match(help.data.commands[0].optionHelp.job.description, /ci --list/);
});
test('terminal views show listings, dry-run commands, refusals and execution results from the same result', { skip: !posix }, async () => {
  const dir = await project({ 'fake.yml': onHost(fake), 'danger.yml': onHost('name: D\non: push\njobs:\n  secret:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ${{ secrets.T }}\n'), 'ext.yml': onHost('name: E\non:\n  schedule:\n    - cron: "1 2 * * 3"\n  push:\n    paths-ignore: [docs/**]\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: x/y@v1\n') });
  const hostSelect = { ...select, matrix: onHost(select.matrix) };
  const style = terminalStyle({});
  const listing = renderHuman(await run(dir, { list: true }), style).text;
  assert.match(listing, /^ {2}Jobs {7}3 \(1 reproducible, 2 executable\)$/m); assert.match(listing, /fake\/build +\$\{\{ matrix\.os \}\}; matrix os,flavor x4; 6 run steps; not fully reproducible \(1 reason\(s\)\); executable/);
  assert.match(listing, /danger\/secret .*execute refused/); assert.match(listing, /schedule 1 2 \* \* 3; push: 1 ignored paths/); assert.match(listing, /^Next: node bin\/app ci --job danger\/secret$/m);
  const dry = renderHuman(await run(dir, hostSelect), style);
  assert.equal(dry.diagnosticsShown, true); assert.match(dry.text, new RegExp(`^ {2}Matrix {3}os=${hostRunner},flavor=a \\(selected\\)$`, 'm')); assert.match(dry.text, /^ {8}in sub with bash; env WORKFLOW_LEVEL=wf JOB_LEVEL=a$/m);
  assert.match(dry.text, /\[condition-unknown\] Unknown event\n {8}condition "github\.event_name == 'push'" cannot be settled locally/);
  const refused = renderHuman(await run(dir, { job: 'danger/secret', execute: true }), style).text;
  assert.match(refused, /^ci: blocked$/m); assert.match(refused, /\[warn\] --execute would be refused: refused: step 1 references secrets/); assert.match(refused, /^Next: node bin\/app ci --job danger\/secret$/m);
  const executed = renderHuman(await run(dir, { ...hostSelect, execute: true }), style).text;
  assert.match(executed, /^--- step 7 \(PROCESS_FAILED\) last output ---$/m); assert.match(executed, /\[ok\] +3\. \[run\] Export values +\d+ms$/m); assert.match(executed, /\[FAIL\] +7\. \[run\] Fails +\d+ms {2}exit 3$/m);
  assert.match(executed, new RegExp(`^Next: node bin/app ci --job fake/build --matrix os=${hostRunner},flavor=a --execute$`, 'm'));
  const quoted = renderHuman(await run(dir, { job: 'fake/build', matrix: `os=${hostRunner},flavor=b`, execute: true, 'dry-run': true }), style);
  assert.match(quoted.text, /^ci: planned$/m, '--dry-run wins over --execute');
});
