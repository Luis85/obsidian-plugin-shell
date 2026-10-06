import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflows, parseWorkflowText, workflowParser } from '../../src/cli/adapters/framework/ci-workflows.ts';
import { evaluateCondition, substitute } from '../../src/cli/domain/ci-expression.ts';
import { chooseCombination, expandMatrix, parseMatrixSelector, summarizeMatrix } from '../../src/cli/domain/ci-matrix.ts';
import { installsDependencies, jobRefusals, runnerOs } from '../../src/cli/domain/ci-safety.ts';
import { parseCommandFile, shellInvocation } from '../../src/cli/domain/ci-shell.ts';
import { summarizeWorkflow } from '../../src/cli/domain/ci-listing.ts';
import { setupActions } from '../../src/cli/domain/ci-workflow.ts';
import { executionBlockers, planJob, skipReason } from '../../src/cli/domain/ci-plan.ts';
import { e2eFacts, syncedProjectWorkflow } from '../../scripts/quality/check-repository.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
const root = fileURLToPath(new URL('../../', import.meta.url));
const parseDocument = await workflowParser();
const workflow = text => parseWorkflowText('sample.yml', text, parseDocument);
const job = (body, extra = '') => workflow(`name: Sample\non: push\n${extra}jobs:\n  work:\n${body}`).jobs[0];

test('every real workflow in .github/workflows parses into jobs with steps and classified actions', async () => {
  const names = (await readdir(join(root, '.github/workflows'))).filter(name => /\.ya?ml$/.test(name));
  const workflows = await loadWorkflows(root);
  assert.equal(workflows.length, names.length);
  // 17 since the retired native source handoff workflow was removed with the schema 5 concept data and
  // shell-cli-manual.yml folded into application-docs.yml (its contracts were a subset of that workflow).
  assert.ok(workflows.length >= 17, 'the repository keeps its qualification workflows');
  for (const item of workflows) {
    assert.ok(item.jobs.length > 0, `${item.file} has jobs`);
    assert.ok(item.triggers.length > 0, `${item.file} has triggers`);
    for (const entry of item.jobs) {
      // A job that calls a reusable workflow (release.yml) has no steps of its own and is never reproducible locally.
      const calls = entry.blockers.includes('calls a reusable workflow');
      assert.ok(calls ? entry.steps.length === 0 : entry.steps.length > 0, `${item.file}/${entry.id} has steps unless it calls a workflow`);
      for (const step of entry.steps) {
        if (step.uses) assert.equal(step.kind, setupActions.includes(step.uses.split('@')[0]) ? 'setup' : 'external');
        else assert.equal(step.kind, 'run');
      }
    }
  }
});
test('ci.yml exposes its known jobs, triggers and resolved YAML anchors', async () => {
  const ci = (await loadWorkflows(root)).find(item => item.stem === 'ci');
  const ids = ci.jobs.map(entry => entry.id);
  for (const id of ['baseline', 'showcase', 'framework-cli']) assert.ok(ids.includes(id), `ci.yml job ${id}`);
  for (const trigger of ['pull_request', 'push', 'workflow_dispatch']) assert.ok(ci.triggers.includes(trigger));
  const showcase = ci.jobs.find(entry => entry.id === 'showcase');
  assert.match(showcase.steps[0].uses, /^actions\/checkout@/, '*checkout alias resolves to the anchored step');
  assert.ok(showcase.matrix, 'showcase carries a matrix expression');
  const summary = summarizeWorkflow(ci).jobs.find(entry => entry.id === 'showcase');
  assert.equal(summary.reference, 'ci/showcase'); assert.equal(summary.matrix.computed, true);
});
test('the CI result job aggregates every ci.yml gate job and nothing informational', async () => {
  const ci = (await loadWorkflows(root)).find(item => item.stem === 'ci');
  const result = ci.jobs.find(entry => entry.id === 'ci-result');
  // A run started by adding the e2e label reports as "E2E result", never as the required check (qualification-e2e-opt-in).
  assert.equal(result.name, "${{ github.event.action == 'labeled' && 'E2E result' || 'CI result' }}");
  assert.equal(result.condition, "always() && (github.event.action != 'labeled' || github.event.label.name == 'e2e')");
  const gates = ci.jobs.map(entry => entry.id).filter(id => !['ci-result', 'security-audit'].includes(id));
  assert.deepEqual([...result.needs].sort(), gates.sort(), 'a new ci.yml job must join the required CI result check');
  assert.ok(!result.needs.includes('security-audit'), 'the informational audit never blocks the required check');
  assert.match(result.steps.map(step => step.run ?? '').join('\n'), /select\(\.value\.result != "success" and \.value\.result != "skipped"\)[\s\S]*exit 1/);
  const hold = result.steps.find(step => step.env?.HEAD_REF === '${{ github.head_ref }}');
  assert.match(hold?.run ?? '', /release\/\*\)[\s\S]*check_name=Release%20result[\s\S]*!= success[\s\S]*exit 1/, 'a release pull request is green only after its Release result succeeded');
});
test('application-docs owns the folded command-handbook checks and site build', async () => {
  const docs = (await loadWorkflows(root)).find(item => item.stem === 'application-docs');
  assert.deepEqual(docs.jobs.map(entry => entry.id), ['qualify', 'site']);
  for (const trigger of ['pull_request', 'workflow_dispatch']) assert.ok(docs.triggers.includes(trigger));
  const qualify = docs.jobs[0].steps.map(step => step.run ?? '').join('\n');
  assert.match(qualify, /manual\.mjs --check/); assert.doesNotMatch(qualify, /manual\.mjs(?! --check)\b/, 'CI never regenerates the handbook before checking it');
  assert.ok(qualify.indexOf('manual.mjs --check') < qualify.indexOf(' ci --ignore-scripts'), 'the handbook check runs before any dependency install');
  assert.deepEqual(docs.jobs[1].needs, ['qualify']);
  assert.match(docs.jobs[1].steps.map(step => step.run ?? '').join('\n'), / ci --prefix tooling\/documentation /);
});
test('schedules, path filters and branches are listed per workflow', async () => {
  const all = await loadWorkflows(root);
  assert.ok(all.some(item => item.schedules.length > 0 && item.triggers.includes('schedule')), 'a scheduled workflow exists');
  assert.ok(all.some(item => item.filters.some(filter => filter.paths?.length)), 'a path-filtered workflow exists');
  const sample = workflow('name: S\non:\n  push:\n    branches: [main]\n    paths: ["src/**"]\n    paths-ignore: ["docs/**"]\n  schedule:\n    - cron: "1 2 * * 3"\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n');
  assert.deepEqual(sample.triggers, ['push', 'schedule']); assert.deepEqual(sample.schedules, ['1 2 * * 3']);
  assert.deepEqual(sample.filters, [{ event: 'push', branches: ['main'], paths: ['src/**'], pathsIgnore: ['docs/**'] }]);
});
test('unsupported or malformed workflow syntax fails loudly with a code', () => {
  const rejects = (text, code, pattern) => assert.throws(() => workflow(text), error => error.code === code && pattern.test(error.message));
  rejects('name: X\njobs:\n  a:\n    steps: []\n', 'CI_UNSUPPORTED', /on/);
  rejects('name: X\non: push\non: pull_request\njobs: {}\n', 'CI_WORKFLOW_INVALID', /key|duplicate/i);
  rejects('name: X\non: push\njobs:\n  a:\n    steps:\n      - name: both\n        run: echo\n        uses: actions/checkout@v4\n', 'CI_UNSUPPORTED', /exactly one/);
  rejects('name: X\non: push\njobs:\n  a:\n    steps: nope\n', 'CI_UNSUPPORTED', /steps/);
  rejects('name: X\non: push\njobs:\n  a:\n    steps:\n      - run: [echo]\n', 'CI_UNSUPPORTED', /string/);
  rejects('name: X\non: [push\n', 'CI_WORKFLOW_INVALID', /./);
});
test('expressions resolve only literal context paths and report everything else', () => {
  const lookup = path => ({ 'matrix.os': 'ubuntu-latest', 'runner.os': 'Linux' })[path];
  assert.deepEqual(substitute('on ${{ matrix.os }} / ${{ runner.os }}', lookup), { text: 'on ubuntu-latest / Linux', unresolved: [] });
  const open = substitute('${{ github.sha }} ${{ fromJSON(matrix.os) }} ${{ github.sha }}', lookup);
  assert.equal(open.text, '${{ github.sha }} ${{ fromJSON(matrix.os) }} ${{ github.sha }}');
  assert.deepEqual(open.unresolved, ['github.sha', 'fromJSON(matrix.os)']);
});
test('conditions are settled three-valued: true, false or unknown', () => {
  const options = { lookup: path => ({ 'runner.os': 'Linux', 'matrix.starter': 'cli' })[path], success: true };
  const cases = [
    ["runner.os == 'Linux'", true], ["runner.os == 'Windows'", false], ["runner.os != 'Windows'", true], ['always()', true], ['success()', true], ['failure()', false],
    ['${{ !cancelled() }}', true], ["${{ !cancelled() && runner.os == 'Linux' }}", true], ["!cancelled() && runner.os == 'Windows'", false],
    ["matrix.starter != 'cli'", false], ["github.event_name == 'push'", undefined], ["${{ inputs.draft_snapshot != '' }}", undefined],
    ["github.event_name == 'push' && runner.os == 'Windows'", false], ["github.event_name == 'push' || runner.os == 'Linux'", true],
    ["(runner.os == 'Linux' || runner.os == 'macOS') && matrix.starter == 'cli'", true], ["contains(runner.os, 'Lin')", true], ["format(runner.os, 'Lin')", undefined],
    ["runner.os == 'Linux' &&", undefined], ["runner.os ==", undefined], ["'it''s' == 'IT''S'", true], ['', undefined],
  ];
  for (const [expression, expected] of cases) assert.equal(evaluateCondition(expression, options), expected, expression);
  assert.equal(evaluateCondition('failure()', { ...options, success: false }), true);
});
test('matrix expansion honours axes, exclude and include; selection is explicit or fails', () => {
  const raw = { os: ['a', 'b'], node: [20, 22], exclude: [{ os: 'b', node: 20 }], include: [{ os: 'a', extra: 'x' }, { os: 'c', node: 24 }] };
  const all = expandMatrix(raw, {});
  assert.deepEqual(all, [{ os: 'a', node: '20', extra: 'x' }, { os: 'a', node: '22', extra: 'x' }, { os: 'b', node: '22' }, { os: 'c', node: '24' }]);
  assert.deepEqual(expandMatrix({ include: [{ group: 1, ids: 'a b' }, { group: 2, ids: 'c' }] }, {}), [{ group: '1', ids: 'a b' }, { group: '2', ids: 'c' }]);
  assert.deepEqual(expandMatrix(undefined, {}), [{}]);
  assert.deepEqual(summarizeMatrix(raw), { axes: ['os', 'node', 'extra'], combinations: 4, computed: false });
  assert.deepEqual(chooseCombination(all, { os: 'b' }, raw, () => false), { combination: { os: 'b', node: '22' }, available: 4, mode: 'selected' });
  assert.equal(chooseCombination(all, {}, raw, combo => combo.os === 'b').combination.os, 'b');
  assert.equal(chooseCombination(all, {}, raw, () => false).mode, 'default');
  assert.deepEqual(chooseCombination([{}], {}, undefined, () => true), { combination: {}, available: 1, mode: 'none' });
  assert.throws(() => chooseCombination(all, { os: 'z' }, raw, () => true), error => error.code === 'CI_MATRIX_NO_MATCH' && /Available: os=a,node=20,extra=x/.test(error.message));
  assert.throws(() => chooseCombination(all, { os: 'a' }, raw, () => true), error => error.code === 'CI_MATRIX_AMBIGUOUS');
});
test('matrices computed by expressions need an explicit selector and never guess', () => {
  assert.throws(() => expandMatrix({ os: '${{ fromJSON(x) }}' }, {}), error => error.code === 'CI_MATRIX_UNRESOLVED' && /--matrix os=<value>/.test(error.message));
  assert.deepEqual(expandMatrix({ os: '${{ fromJSON(x) }}', n: [1, 2] }, { os: 'linux' }), [{ os: 'linux', n: '1' }, { os: 'linux', n: '2' }]);
  assert.throws(() => expandMatrix('${{ fromJSON(x) }}', {}), error => error.code === 'CI_MATRIX_UNRESOLVED');
  assert.deepEqual(expandMatrix('${{ fromJSON(x) }}', { a: 'b' }), [{ a: 'b' }]);
  assert.deepEqual(summarizeMatrix({ os: '${{ fromJSON(x) }}' }), { axes: ['os'], combinations: null, computed: true });
  assert.deepEqual(parseMatrixSelector('os=ubuntu-latest, group = 2,ids=a=b'), { os: 'ubuntu-latest', group: '2', ids: 'a=b' });
  for (const bad of ['', 'os', '=x', ',']) assert.throws(() => parseMatrixSelector(bad), error => error.code === 'CI_MATRIX_SELECTOR');
});
test('safety rules refuse secrets, publication and deployment but allow rehearsals and read-only git', () => {
  const refused = run => { const sample = workflow(`name: S\non: push\njobs:\n  work:\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${JSON.stringify(run)}\n`); return jobRefusals(sample, sample.jobs[0]); };
  for (const command of ['npm publish --access public', 'pnpm publish', 'git push origin main', 'git tag v1.0.0', 'gh release create v1', 'gh api repos/x/y -X POST', 'docker push img',
    'node bin/app release operate --input a.json --execute', 'node scripts/release/cli.mjs --authorize abc', 'echo ${{ secrets.TOKEN }}', 'curl -H "Authorization: ${{ github.token }}" x']) {
    assert.ok(refused(command).length > 0, command);
  }
  for (const command of ['git tag --list', 'git tag -l "v*"', 'git show-ref refs/tags/v1', 'node "$QUALIFIED_NPM" run release:rehearse -- --commit abc', 'node bin/app framework pack --yes']) {
    assert.deepEqual(refused(command), [], command);
  }
  assert.match(job('    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n        env:\n          T: ${{ secrets.NPM_TOKEN }}\n').steps[0].env.T, /secrets/);
  const sample = workflow('name: S\non: push\nenv:\n  K: ${{ secrets.K }}\njobs:\n  work:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n');
  assert.match(jobRefusals(sample, sample.jobs[0]).join(), /secrets/);
  const named = workflow('name: S\non: push\njobs:\n  publish-site:\n    runs-on: ubuntu-latest\n    environment: production\n    services: {db: {image: x}}\n    steps:\n      - uses: softprops/action-gh-release@v1\n');
  const reasons = jobRefusals(named, named.jobs[0]).join('\n');
  for (const part of [/deployment environment/, /service containers/, /publishing action/, /release, publish or deploy/]) assert.match(reasons, part);
  const rehearsal = workflow('name: S\non: push\njobs:\n  rehearsal:\n    name: Release rehearsal\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n');
  assert.match(jobRefusals(rehearsal, rehearsal.jobs[0]).join(), /named as a release/, 'release in a job name is conservative');
});
test('runner OS detection, shell invocation and command-file parsing mirror the hosted runner', () => {
  assert.deepEqual(['ubuntu-24.04', 'windows-latest', 'macos-latest', 'self-hosted', '${{ matrix.os }}'].map(runnerOs), ['Linux', 'Windows', 'macOS', null, null]);
  assert.deepEqual(shellInvocation('bash', false, 'x').args, ['-e', '-c', 'x']);
  assert.deepEqual(shellInvocation('bash', true, 'x').args, ['--noprofile', '--norc', '-eo', 'pipefail', '-c', 'x']);
  assert.equal(shellInvocation('pwsh', true, 'x').file, 'pwsh'); assert.match(shellInvocation('pwsh', true, 'x').args.at(-1), /\$ErrorActionPreference = 'stop'\nx\n/);
  assert.equal(shellInvocation('cmd', true, 'x'), null); assert.equal(shellInvocation('bash {0}', true, 'x'), null);
  assert.deepEqual(parseCommandFile('A=1\nB=two=2\nnoise\nC<<EOF\nline1\nline2\nEOF\nD=4\n'), { A: '1', B: 'two=2', C: 'line1\nline2', D: '4' });
});
test('condition grammar edge cases stay unknown instead of throwing or guessing', () => {
  const options = { lookup: path => ({ 'runner.os': 'Linux' })[path], success: true };
  const unknown = ["runner.os == 'Linux'  junk", "(runner.os == 'Linux'", 'foo()', 'contains(runner.os)', "runner.os == 'unterminated", 'a b', '== 1', '()', '&& true'];
  for (const expression of unknown) assert.equal(evaluateCondition(expression, options), undefined, expression);
  const cases = [["runner.os == 'Linux'  ", true], ['1 == 1', true], ['-1 == 1', false], ['null == \'\'', true], ['true && true', true], ['false || false', false], ['!false', true], ['!true', false],
    ['!github.x', undefined], ['github.x && true', undefined], ['github.x || false', undefined], ['github.x && false', false], ['github.x || true', true], ["github.x == 'a' || github.y != 'b'", undefined],
    ['!!runner.os', true], ["'' && true", false], ["'x' && true", true], ['cancelled()', false], ["runner.os != github.x", undefined], ['true == true', true]];
  for (const [expression, expected] of cases) assert.equal(evaluateCondition(expression, options), expected, expression);
});
test('string search functions settle on two known arguments and stay unknown otherwise', () => {
  const lookup = path => ({ 'github.head_ref': 'release/1.2.0', 'inputs.tier': 'integration', 'github.event.pull_request.draft': 'false' })[path];
  const options = { lookup, success: true };
  const cases = [["startsWith(github.head_ref, 'release/')", true], ["!startsWith(github.head_ref, 'Release/')", false], ["endsWith(github.head_ref, '.0')", true], ["contains(github.head_ref, 'feature')", false],
    ["STARTSWITH(github.head_ref, 'x') || inputs.tier == 'integration'", true], ["startsWith(github.unknown, 'release/')", undefined], ["startsWith(github.unknown, 'x') && false", false],
    ["inputs.tier == 'release' || (github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))", false],
    // An object filter (`labels.*.name`) is a context path: unknown here, so it decides nothing unless another operand does.
    ["contains(github.event.pull_request.labels.*.name, 'e2e')", undefined], ["inputs.tier == 'integration' || contains(github.event.pull_request.labels.*.name, 'e2e')", true],
    ["startsWith(github.head_ref)", undefined], ["startsWith(github.head_ref, 'a', 'b')", undefined], ["fromJSON(github.head_ref, 'a')", undefined], ["startsWith(github.head_ref, 'a'", undefined], ["startsWith(, 'a')", undefined]];
  for (const [expression, expected] of cases) assert.equal(evaluateCondition(expression, options), expected, expression);
});
// Dev and the Definition of Ready/Done checks run on every pull request event with their own conditions; they are
// not Integration workflows, so the release tier reports them through aliases instead of calling them. Synced
// projects--* copies belong to standalone projects and follow their own CI, never the shell's tiers; the projects-only
// required checks report those same checks for a pull request that changes only projects/**.
const ownTier = ['dev', 'definition-of-ready', 'definition-of-done', 'projects-required-checks'];
test('every pull-request workflow runs its jobs only on ready, non-release pull requests unless called with tier release', async () => {
  const workflows = await loadWorkflows(root), parse = await workflowParser();
  const tiered = "inputs.tier == 'release' || (";
  const gated = workflows.filter(item => item.triggers.includes('pull_request') && !ownTier.includes(item.stem) && !syncedProjectWorkflow(item.file));
  assert.ok(gated.length >= 13, 'every integration workflow is listed');
  for (const item of gated) {
    const text = await readFile(join(root, '.github/workflows', item.file), 'utf8'), data = parse(text).toJS();
    // Only a workflow holding opt-in e2e steps listens to `labeled`, so adding the e2e label starts its e2e run.
    const e2e = e2eFacts(text, item.file).e2e;
    assert.deepEqual(data.on.pull_request.types, ['opened', 'synchronize', 'reopened', 'ready_for_review', ...(e2e ? ['labeled'] : [])], item.file);
    assert.equal(data.on.workflow_call.inputs.tier.default, 'integration', item.file);
    assert.deepEqual(data.on.workflow_dispatch.inputs.tier.options, ['integration', 'release'], item.file);
    for (const job of item.jobs.filter(entry => entry.id !== 'ci-result')) {
      assert.ok(job.condition, `${item.file}/${job.id} is gated`);
      const local = planJob(item, job, { localOs: 'Linux', selector: typeof job.matrix?.os === 'string' ? { os: 'ubuntu-24.04' } : {} });
      // A local run is a ready pull-request update without a known e2e opt-in: gates run, pure e2e jobs stay undecided.
      if (job.condition.startsWith(tiered) && !/github\.event_name/.test(job.condition)) assert.equal(local.jobCondition.result, /inputs\.e2e == true/.test(job.condition) ? 'unknown' : 'true', `${item.file}/${job.id} for a local ready pull request`);
      const release = evaluateCondition(job.condition, { lookup: path => ({ 'inputs.tier': 'release', 'github.event_name': 'push', 'github.head_ref': '' })[path], success: true });
      const draft = evaluateCondition(job.condition, { lookup: path => ({ 'inputs.tier': '', 'github.event_name': 'pull_request', 'github.event.pull_request.draft': 'true', 'github.head_ref': 'feature' })[path], success: true });
      const releasePullRequest = evaluateCondition(job.condition, { lookup: path => ({ 'inputs.tier': '', 'github.event_name': 'pull_request', 'github.event.pull_request.draft': 'false', 'github.head_ref': 'release/1.2.0' })[path], success: true });
      assert.deepEqual([draft, releasePullRequest], [false, false], `${item.file}/${job.id} skips drafts and release heads`);
      if (!['security-audit', 'self-review'].includes(job.id)) assert.equal(release, true, `${item.file}/${job.id} runs in the release tier`);
    }
  }
});
test('the release tier calls every gated pull-request workflow and candidate qualification, and Release result requires each call', async () => {
  const workflows = await loadWorkflows(root), parse = await workflowParser();
  const release = parse(await readFile(join(root, '.github/workflows/release.yml'), 'utf8')).toJS();
  const calls = Object.entries(release.jobs).filter(([, job]) => job.uses);
  const expected = workflows.filter(item => item.triggers.includes('pull_request') && !ownTier.includes(item.stem) && !syncedProjectWorkflow(item.file)).map(item => item.file).concat('candidate-qualification.yml').sort();
  assert.deepEqual(calls.map(([, job]) => job.uses.replace('./.github/workflows/', '')).sort(), expected);
  for (const [id, job] of calls) {
    assert.deepEqual(job.needs, 'metadata', id); assert.equal(job.secrets, undefined, id);
    if (id !== 'candidate-qualification') assert.deepEqual(job.with, { tier: 'release' }, id);
  }
  const result = release.jobs['release-result'];
  assert.equal(result.name, 'Release result'); assert.equal(result.if, 'always()');
  const aliases = { 'dev-checks': 'Dev checks', 'ci-result': 'CI result', 'definition-of-ready': 'Definition of Ready', 'definition-of-done': 'Definition of Done' };
  assert.deepEqual([...result.needs].sort(), Object.keys(release.jobs).filter(id => id !== 'release-result' && !(id in aliases)).sort());
  // The release pull request reports the required checks from the release tier, never as a skipped pass.
  for (const [id, name] of Object.entries(aliases)) {
    const alias = release.jobs[id];
    assert.deepEqual([alias.name, alias.if, alias.needs], [name, 'always()', 'release-result'], id);
    assert.match(alias.steps[0].run, /test "\$RELEASE_RESULT" = success/); assert.equal(alias.steps[0].env.RELEASE_RESULT, '${{ needs.release-result.result }}');
  }
  assert.match(result.steps[0].run, /select\(\.value\.result != "success"\)[\s\S]*exit 1/);
  assert.match(release.jobs.metadata.steps.map(step => step.run ?? '').join('\n'), /branch\.mjs verify --version "\$VERSION"/);
  assert.ok(!Object.values(release.jobs).some(job => job.permissions), 'the release tier stays read-only');
});
test('workflow normalization accepts the documented shapes and rejects the rest', () => {
  assert.deepEqual(workflow('name: A\non: push\njobs: {}\n').triggers, ['push']);
  assert.deepEqual(workflow('name: A\non: [push, pull_request]\njobs: {}\n').triggers, ['push', 'pull_request']);
  const nulls = workflow('on:\n  pull_request:\n  workflow_dispatch:\njobs: {}\n');
  assert.deepEqual([nulls.name, nulls.triggers, nulls.filters], ['sample', ['pull_request', 'workflow_dispatch'], []]);
  const full = workflow(`name: Full
on: push
env:
  NUM: 3
  FLAG: true
jobs:
  reusable:
    uses: ./.github/workflows/other.yml
  main:
    name: Main \${{ matrix.k }}
    needs: reusable
    if: github.event_name != 'push'
    runs-on: [self-hosted, linux]
    strategy:
      matrix:
        k: [1]
    defaults:
      run:
        shell: sh
        working-directory: sub
    container: node:24
    steps:
      - uses: actions/cache@v4
      - id: named
        run: echo hi
      - if: false
        run: echo never
`);
  assert.deepEqual(full.env, { NUM: '3', FLAG: 'true' });
  assert.deepEqual(full.jobs[0].blockers, ['calls a reusable workflow']); assert.deepEqual(full.jobs[0].steps, []);
  const main = full.jobs[1];
  assert.deepEqual([main.needs, main.runsOn, main.shell, main.workingDirectory, main.blockers], [['reusable'], '["self-hosted","linux"]', 'sh', 'sub', ['runs in a container']]);
  const plan = planJob(full, main, { localOs: 'Linux', selector: {} });
  assert.deepEqual(plan.steps.map(step => [step.id, step.name, step.disposition]), [['step-1', 'actions/cache@v4', 'setup'], ['named', 'echo hi', 'run'], ['step-3', 'echo never', 'skip-condition']]);
  assert.deepEqual([plan.name, plan.steps[1].shell, plan.steps[1].shellExplicit, plan.steps[1].workingDirectory, plan.steps[1].env, plan.jobCondition.result], ['Main 1', 'sh', true, 'sub', { NUM: '3', FLAG: 'true' }, 'unknown']);
  assert.match(skipReason(plan.steps[2]), /"false" is false on this machine/); assert.match(skipReason(plan.steps[0]), /Setup action/);
  assert.deepEqual(executionBlockers(plan, () => true), ['refused: the job runs in a container']);
  assert.match(executionBlockers({ ...plan, runsOn: '', runnerOs: null }, () => true).join(), /an unknown runner/);
  assert.match(executionBlockers({ ...plan, steps: [{ ...plan.steps[1], unresolved: ['inputs.x', 'inputs.x'] }] }, () => false).join(), /inputs\.x$/);
  for (const [text, pattern] of [['name: A\non: push\njobs:\n  a:\n    env: x\n', /env must be a mapping/], ['name: A\non: push\njobs:\n  a:\n    needs: [1, {a: b}]\n', /must be a string/],
    ['name: A\non: push\njobs: [a]\n', /jobs must be a mapping/], ['name: A\non: [1, {a: b}]\njobs: {}\n', /must be a string/], ['name: A\non:\n  schedule: daily\njobs: {}\n', /cron entries/],
    ['name: A\non:\n  schedule:\n    - cron: [1]\njobs: {}\n', /cron/], ['name: A\non:\n  push:\n    paths: [1, {a: b}]\njobs: {}\n', /must be a string/], ['name: A\non:\n  push:\n    paths: {a: b}\njobs: {}\n', /string or a list/],
    ['[]\n', /must be a mapping/], ['name: A\non: push\njobs:\n  a:\n    steps:\n      - [x]\n', /must be a mapping/]]) {
    assert.throws(() => workflow(text), error => error.code === 'CI_UNSUPPORTED' && pattern.test(error.message), text);
  }
});
test('matrix and shell edge cases fail loudly or fall back predictably', () => {
  assert.deepEqual(expandMatrix({ node: 20 }, {}), [{ node: '20' }]);
  assert.deepEqual(expandMatrix({ include: [{ cfg: { a: 1 } }] }, {}), [{ cfg: '{"a":1}' }]);
  assert.deepEqual(expandMatrix({ os: ['a'], exclude: [{ os: 'a' }] }, {}), [{}], 'excluding every combination leaves one empty combination');
  assert.deepEqual(expandMatrix({ os: ['a', 'b'], include: [{ extra: 1 }, { extra: 2 }] }, {}), [{ os: 'a', extra: '2' }, { os: 'b', extra: '2' }]);
  for (const bad of ['plain', ['a'], 7]) assert.throws(() => expandMatrix(bad, {}), error => error.code === 'CI_UNSUPPORTED', String(bad));
  assert.throws(() => expandMatrix({ include: 'x' }, {}), error => error.code === 'CI_UNSUPPORTED');
  assert.throws(() => summarizeMatrix({ include: 'x' }), error => error.code === 'CI_UNSUPPORTED');
  assert.deepEqual(summarizeMatrix('${{ fromJSON(x) }}'), { axes: [], combinations: null, computed: true });
  assert.deepEqual(summarizeMatrix(undefined), { axes: [], combinations: null, computed: false });
  const many = Array.from({ length: 14 }, (_, index) => ({ n: String(index) }));
  assert.throws(() => chooseCombination(many, { n: 'x' }, {}, () => true), error => / \| \.\.\.\.$/.test(error.message));
  assert.throws(() => chooseCombination([{}, { a: '1' }], { a: '2' }, {}, () => true), error => /\(none\) \| a=1/.test(error.message));
  assert.deepEqual(shellInvocation('sh', false, 'x'), { file: 'sh', args: ['-e', '-c', 'x'], display: 'sh -e' });
  assert.equal(shellInvocation('powershell', false, 'x').file, 'pwsh'); assert.deepEqual(shellInvocation('python', true, 'print(1)').args, ['-c', 'print(1)']);
  assert.deepEqual(parseCommandFile('A<<EOF\nunterminated\nB=1\n'), {}, 'an unterminated block is dropped, like the runner');
});
test('dependency installs into the checkout are recognised, isolated prefixes are not', () => {
  for (const command of ['npm ci', 'npm ci --no-fund', 'npm install', 'set -e\nnode "$QUALIFIED_NPM" ci --no-fund', 'cd x && npm i', 'node /x/npm-cli.js install']) assert.equal(installsDependencies(command), true, command);
  for (const command of ['npm install --prefix "$RUNNER_TEMP/npm" --ignore-scripts npm@11', 'npm run build', 'node scripts/setup.mjs', 'npm --prefix tooling/documentation run build']) assert.equal(installsDependencies(command), false, command);
});
