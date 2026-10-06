import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorkflow, loadWorkflows, parseWorkflowText, withLocalActions, workflowParser } from '../../bin/adapters/framework/ci-workflows.ts';
import { ciOperation } from '../../bin/adapters/framework/ci.ts';
import { expandLocalActions, localActionName, normalizeAction, referencedActions } from '../../bin/domain/ci-composite.ts';
import { summarizeWorkflow } from '../../bin/domain/ci-listing.ts';
import { planJob } from '../../bin/domain/ci-plan.ts';
import { jobRefusals } from '../../bin/domain/ci-safety.ts';
import { renderHuman } from '../../bin/presentation/terminal/terminal-render.ts';
const { test, after } = await (process.env.VITEST ? import('vitest').then(module => ({ test: module.test, after: module.afterAll })) : import('node:test'));
const root = fileURLToPath(new URL('../../', import.meta.url));
const parseDocument = await workflowParser();
const parse = await import('yaml').then(module => module.parse);
const created = [];
after(() => Promise.all(created.map(dir => rm(dir, { recursive: true, force: true }))));
const caller = (withBlock, extra = '') => parseWorkflowText('caller.yml', `name: Caller
on: push
jobs:
  work:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: sub
        shell: sh
    steps:
      - uses: actions/checkout@v4
      - id: tool
        uses: ./.github/actions/tool
${withBlock}${extra}      - run: echo after
`, parseDocument);
const action = `name: Tool
inputs:
  mode:
    default: plain
  flags:
    default: '--quiet'
  token:
    required: false
runs:
  using: composite
  steps:
    - id: probe
      shell: bash
      run: echo "value=1" >> "$GITHUB_OUTPUT"
    - if: inputs.mode == 'full'
      shell: bash
      env:
        FLAGS: \${{ inputs.flags }}
        PROBE: \${{ steps.probe.outputs.value }}
      run: tool "$FLAGS" \${{ inputs.mode }}
    - uses: actions/cache@v5
      with:
        key: k-\${{ steps.probe.outputs.value }}
    - uses: some/vendor-action@v1
`;
const plan = (workflow, environment) => planJob(workflow, workflow.jobs[0], { localOs: 'Linux', selector: {}, ...(environment ? { environment } : {}) });
const expand = (workflow, data = parse(action)) => expandLocalActions(workflow, new Map([['tool', normalizeAction('.github/actions/tool/action.yml', data)]]));

test('only ./.github/actions/<name> folders are local actions; dot names and other paths are not', () => {
  assert.equal(localActionName('./.github/actions/setup-qualified'), 'setup-qualified');
  assert.equal(localActionName('./.github/actions/setup-qualified/'), 'setup-qualified');
  for (const uses of ['./.github/actions/..', './.github/actions/.', './.github/actions/a/b', './tools/action', 'actions/checkout@v4', undefined]) assert.equal(localActionName(uses), undefined, String(uses));
  assert.deepEqual(referencedActions(caller('')), ['tool']);
});
test('a composite action expands in place: renumbered steps, scoped ids, inputs only in env and conditions', () => {
  const workflow = expand(caller('        with:\n          mode: full\n')), steps = workflow.jobs[0].steps;
  assert.deepEqual(steps.map(step => [step.index, step.workflowStep, step.kind, step.composite?.actionStep]),
    [[1, 1, 'setup', undefined], [2, 2, 'run', 1], [3, 2, 'run', 2], [4, 2, 'setup', 3], [5, 2, 'external', 4], [6, 3, 'run', undefined]]);
  assert.equal(steps[1].id, 'tool--probe');
  assert.equal(steps[2].env.PROBE, '${{ steps.tool--probe.outputs.value }}');
  assert.equal(steps[3].inputs.key, 'k-${{ steps.tool--probe.outputs.value }}');
  assert.deepEqual(steps[2].composite.inputs, { mode: 'full', flags: '--quiet', token: '' });
  const planned = plan(workflow).steps;
  assert.deepEqual(planned[2].condition, { expression: "inputs.mode == 'full'", result: 'true' });
  assert.equal(planned[2].env.FLAGS, '--quiet');
  // Input text in run: is not substituted, so it stays an unresolved expression instead of being spliced into the shell.
  assert.equal(planned[2].command, 'tool "$FLAGS" ${{ inputs.mode }}');
  assert.ok(planned[2].unresolved.includes('inputs.mode'));
  // Job run defaults do not apply inside the action; the action's own shell does.
  assert.deepEqual([planned[1].shell, planned[1].workingDirectory, planned[5].shell, planned[5].workingDirectory], ['bash', '.', 'sh', 'sub']);
  assert.deepEqual(planned[2].action, { uses: './.github/actions/tool', step: 2 });
  const summary = summarizeWorkflow(workflow).jobs[0];
  assert.deepEqual(summary.steps, { total: 6, run: 3, setup: 2, external: 1 });
  assert.deepEqual(summary.actions, ['./.github/actions/tool']);
  assert.match(summary.reasons.join('\n'), /step 5 uses some\/vendor-action@v1 \(external, skipped\)/);
});
test('defaults apply when the caller omits an input; an unknown caller value leaves the condition unknown', () => {
  const plain = plan(expand(caller(''))).steps[2];
  assert.equal(plain.disposition, 'skip-condition');
  const unknown = plan(expand(caller("        with:\n          mode: ${{ runner.os == 'Linux' && 'full' || '' }}\n"))).steps[2];
  assert.deepEqual([unknown.disposition, unknown.condition.result], ['condition-unknown', 'unknown']);
  // A caller value that is a plain context path resolves in the caller's context.
  const contextual = plan(expand(caller('        with:\n          flags: ${{ github.sha }}\n          mode: full\n')), path => path === 'github.sha' ? 'abc' : undefined).steps[2];
  assert.equal(contextual.env.FLAGS, 'abc');
});
test('the calling step condition and env reach every nested step and are evaluated in the caller context', () => {
  const workflow = expand(caller('        if: runner.os == \'Windows\'\n        env:\n          OUTER: ${{ inputs.mode }}\n        with:\n          mode: full\n'));
  const planned = plan(workflow).steps;
  assert.equal(planned[1].disposition, 'skip-condition');
  assert.equal(planned[2].condition.expression, "(runner.os == 'Windows') && (inputs.mode == 'full')");
  // OUTER belongs to the caller, where inputs are the workflow's own (none here): it is not resolved from the action.
  assert.equal(planned[1].env.OUTER, '${{ inputs.mode }}');
});
test('secrets in effective inputs and publishing action folders refuse execution', () => {
  const secret = expand(caller('        with:\n          token: ${{ secrets.NPM_TOKEN }}\n'));
  assert.match(jobRefusals(secret, secret.jobs[0]).join('\n'), /step 2 references secrets/);
  const defaulted = parse(action); defaulted.inputs.token.default = '${{ github.token }}';
  const fromDefault = expand(caller(''), defaulted);
  assert.ok(jobRefusals(fromDefault, fromDefault.jobs[0]).length > 0, 'a secret default is a refusal too');
  const publishing = expandLocalActions(parseWorkflowText('p.yml', 'on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/deploy-site\n', parseDocument),
    new Map([['deploy-site', normalizeAction('a.yml', parse(action))]]));
  assert.match(jobRefusals(publishing, publishing.jobs[0]).join('\n'), /comes from the publishing action \.\/\.github\/actions\/deploy-site/);
});
test('undeclared inputs, non-composite and missing actions stay external with the reason', () => {
  const undeclared = expand(caller('        with:\n          colour: red\n')).jobs[0].steps[1];
  assert.equal(undeclared.kind, 'external'); assert.match(undeclared.note, /declares no input colour/);
  const node = normalizeAction('n.yml', { runs: { using: 'node24', main: 'index.js' } });
  const nodeStep = expandLocalActions(caller(''), new Map([['tool', node]])).jobs[0].steps[1];
  assert.match(nodeStep.note, /runs "node24", not a composite action/);
  const missing = expandLocalActions(caller(''), new Map()).jobs[0].steps[1];
  assert.match(missing.note, /\.github\/actions\/tool has no action\.yml/);
  assert.equal(plan(expandLocalActions(caller(''), new Map())).steps[1].note, missing.note);
});
test('invalid composite actions fail loudly instead of guessing', () => {
  assert.throws(() => normalizeAction('a.yml', { runs: { using: 'composite', steps: [] } }), error => error.code === 'CI_ACTION_INVALID');
  assert.throws(() => normalizeAction('a.yml', { runs: { using: 'composite', steps: [{ run: 'echo' }] } }), /without the required shell/);
  assert.throws(() => normalizeAction('a.yml', { inputs: { 'bad name': {} }, runs: { using: 'composite', steps: [{ run: 'echo', shell: 'bash' }] } }), /input name/);
  assert.throws(() => normalizeAction('a.yml', { runs: { using: 'composite', steps: [{ run: 'a', uses: 'b', shell: 'bash' }] } }), /exactly one of run or uses/);
});
async function fixture(files) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-ci-composite-')));
  created.push(dir);
  for (const [path, text] of Object.entries(files)) { await mkdir(join(dir, path, '..'), { recursive: true }); await writeFile(join(dir, path), text); }
  return dir;
}
const callerText = 'on: push\njobs:\n  work:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/tool\n        with:\n          mode: full\n';
test('the adapter reads action.yml or action.yaml bounded and refuses invalid or linked action files', async () => {
  const yml = await fixture({ '.github/workflows/w.yml': callerText, '.github/actions/tool/action.yml': action });
  const { workflow } = await loadWorkflow(yml, 'w');
  assert.deepEqual(workflow.jobs[0].steps.map(step => step.kind), ['run', 'run', 'setup', 'external']);
  const yaml = await fixture({ '.github/workflows/w.yml': callerText, '.github/actions/tool/action.yaml': action });
  assert.equal((await loadWorkflows(yaml))[0].jobs[0].steps.length, 4);
  const missing = await fixture({ '.github/workflows/w.yml': callerText });
  assert.match((await loadWorkflow(missing, 'w')).workflow.jobs[0].steps[0].note, /has no action\.yml/);
  const broken = await fixture({ '.github/workflows/w.yml': callerText, '.github/actions/tool/action.yml': 'runs: [unclosed\n' });
  await assert.rejects(loadWorkflow(broken, 'w'), error => error.code === 'CI_ACTION_INVALID' && /action\.yml/.test(error.message));
  const large = await fixture({ '.github/workflows/w.yml': callerText, '.github/actions/tool/action.yml': `# ${'x'.repeat(262_145)}\n` });
  await assert.rejects(loadWorkflow(large, 'w'), error => error.code === 'INPUT_LIMIT');
  if (process.platform !== 'win32') {
    const linked = await fixture({ '.github/workflows/w.yml': callerText, 'elsewhere/tool/action.yml': action });
    await symlink(join(linked, 'elsewhere'), join(linked, '.github/actions'));
    await assert.rejects(loadWorkflow(linked, 'w'));
  }
  const workflowOnly = parseWorkflowText('w.yml', callerText, parseDocument);
  assert.equal((await withLocalActions(yml, workflowOnly, parseDocument)).jobs[0].steps.length, 4);
});
test('jobs that call this repository\'s setup-qualified action are reproducible and resolve its install input', async () => {
  const listed = await ciOperation({ command: 'ci', args: [], options: { list: true } }, { root, frameworkRoot: root }), listing = listed.data;
  assert.match(renderHuman(listed, { color: false, unicode: false }).text, /compiler-qualification\/contracts +\$\{\{ matrix\.os \}\}; matrix os \(computed\); \d+ run steps; expands \.\/\.github\/actions\/setup-qualified; reproducible; executable/);
  const jobs = listing.workflows.flatMap(item => item.jobs).filter(job => job.actions.includes('./.github/actions/setup-qualified'));
  assert.ok(jobs.length >= 10, `${jobs.length} jobs use setup-qualified`);
  const privileged = new Set(['release-cut/cut', 'publish/publish']);
  for (const job of jobs.filter(item => !privileged.has(item.reference))) assert.ok(job.reproducible, `${job.reference}: ${job.reasons.join('; ')}`);
  for (const job of jobs.filter(item => privileged.has(item.reference))) assert.ok(!job.reproducible && job.reasons.some(reason => /deployment environment/.test(reason)), `${job.reference} stays behind its release environment`);
  const definition = await readFile(join(root, '.github/actions/setup-qualified/action.yml'), 'utf8');
  assert.match(definition, /INSTALL_FLAGS: \$\{\{ inputs\.install-flags \}\}/, 'the action passes inputs through env');
  const dry = (await ciOperation({ command: 'ci', args: [], options: { job: 'compiler-qualification/contracts', matrix: 'os=ubuntu-24.04' } }, { root, frameworkRoot: root })).data;
  const install = dry.steps.find(step => step.env.INSTALL_FLAGS !== undefined);
  assert.deepEqual([install.disposition, install.env.INSTALL_FLAGS, install.action.uses], ['run', '--no-fund', './.github/actions/setup-qualified']);
  assert.equal(dry.steps.find(step => step.env.PLAYWRIGHT_MODE !== undefined).disposition, 'condition-unknown');
});
