import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { checkRepository, e2eFacts, syncedProjectWorkflow } from '../../scripts/quality/check-repository.mjs';
import { checkName, e2eKinds, e2eOptIn, e2eScenarios, gateValue } from '../../scripts/quality/e2e-policy.mjs';
import { ciOperation } from '../../bin/adapters/framework/ci.ts';

// Owner request: end-to-end tests are opt-in in workflows and processes in general, and mandatory in the Release tier.
const root = fileURLToPath(new URL('../../', import.meta.url));
const workflowText = file => readFile(join(root, '.github/workflows', file), 'utf8');
const pure = "inputs.tier == 'release' || ((github.event.action != 'labeled' || github.event.label.name == 'e2e') && (inputs.e2e == true || contains(github.event.pull_request.labels.*.name, 'e2e')) && github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))";
const gates = "inputs.tier == 'release' || (github.event.action != 'labeled' && github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))";
const input = '        type: boolean\n        default: false\n';
/** A compliant fixture: a gate job, an e2e job and the opt-in on both inputs; each negative case changes one thing. */
const compliant = `name: Fixture
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review, labeled]
  workflow_call:
    inputs:
      tier:
        type: string
        default: integration
      e2e:
${input}  workflow_dispatch:
    inputs:
      e2e:
${input}permissions:
  contents: read
concurrency:
  group: fixture-\${{ github.ref }}\${{ github.event.action == 'labeled' && format('-label-{0}', github.event.label.name) || '' }}
jobs:
  gate:
    if: ${gates}
    runs-on: ubuntu-24.04
    steps:
      - run: npm run verify
  served:
    if: ${pure}
    runs-on: ubuntu-24.04
    steps:
      - run: npm run test:e2e
`;
const facts = text => e2eFacts(text, 'fixture.yml');

test('the classification names browser and real-host commands, and a no-browser flag excuses only its own line', () => {
  for (const [line, kind] of [['node "$QUALIFIED_NPM" run test:e2e', 'served UI in Chromium (Playwright)'], ['npm run ui:gallery', 'UI review gallery'],
    ['node "$QUALIFIED_NPM" run test:obsidian -- --allow-download journey-lens', 'real Obsidian host'], ['node scripts/testing/evidence-cli.mjs run native --allow-download', 'real Obsidian host'],
    ['node scripts/testing/evidence-cli.mjs run browser', 'served browser evidence'], ['"$PYTHON" -B tests/concepts/companion-mvp.browser.py', 'browser suite'],
    ['node node_modules/@playwright/test/cli.js install-deps chromium', 'browser provisioning'], ['python -m pip install playwright==1.57.0', 'browser provisioning'],
    ['node scripts/airship/qualify.mjs', 'browser acceptance of generated output'], ['node scripts/testing/qualify-angular-setup.mjs', 'browser acceptance of generated output'],
    ['node scripts/compiler/qualify-project-starters.mjs --starter "$id" --execute', 'browser acceptance of generated output'],
    ['node scripts/testing/qualify-project-handoff.mjs --starter quick-capture', 'cloud-session handoff with e2e']])
    assert.deepEqual(e2eKinds(line), [kind], line);
  for (const line of ['node "$QUALIFIED_NPM" run verify', 'node bin/app check --fast', 'node scripts/testing/qualify-angular-setup.mjs --no-browser', 'node "$QUALIFIED_NPM" run qualify:compiler -- --no-browser',
    'node scripts/compiler/qualify-project-starters.mjs --starter "$id" --execute --no-browser', 'node scripts/testing/qualify-project-handoff.mjs --skip-e2e', 'node scripts/testing/evidence-cli.mjs run runtime'])
    assert.deepEqual(e2eKinds(line), [], line);
  assert.deepEqual(e2eKinds('node scripts/compiler/qualify-storybook.mjs --no-browser\nnode scripts/compiler/qualify-storybook.mjs'), ['browser acceptance of generated output']);
});

test('every shipped e2e step is opt-in and mandatory in the release tier, and release.yml reaches each such workflow with tier release', async () => {
  const files = (await readdir(join(root, '.github/workflows'))).filter(file => file.endsWith('.yml')).sort(), e2e = [];
  // Synced projects--* copies follow their standalone project's own e2e model (check-repository leaves them out).
  for (const file of files.filter(name => !syncedProjectWorkflow(name))) if (facts(await workflowText(file)).e2e) e2e.push(file);
  assert.deepEqual(e2e, ['airship-compatibility.yml', 'angular-setup-acceptance.yml', 'candidate-qualification.yml', 'ci.yml', 'companion-concept-verification.yml',
    'compiler-qualification.yml', 'interactive-maker.yml', 'optional-storybook.yml', 'project-starter-qualification.yml', 'starter-distribution.yml']);
  for (const file of ['dev.yml', 'setup-compatibility.yml', 'application-docs.yml']) assert.equal(facts(await workflowText(file)).e2e, false, `${file} holds no e2e work`);
  // candidate-qualification is called without inputs, so its call tier defaults to release; every other call passes tier release.
  assert.equal(facts(await workflowText('candidate-qualification.yml')).callTierDefault, 'release');
  const release = facts(await workflowText('release.yml'));
  for (const file of e2e) assert.ok(release.calls.some(call => call.workflow === file), `release.yml calls ${file}`);
  assert.equal((await checkRepository(root)).status, 'passed');
});

test('ci.yml: real Obsidian is a pure e2e job, the served steps follow the opt-in and a label run never reports as CI result', async () => {
  const ci = parseDocument(await workflowText('ci.yml')).toJS();
  assert.equal(ci.jobs['real-obsidian'].if, pure);
  const served = ci.jobs['renamed-feature'].steps.find(step => /run test:e2e/.test(step.run ?? ''));
  assert.equal(served.if, e2eOptIn);
  const verify = ci.jobs['renamed-feature'].steps.find(step => /run verify -- --report-dir/.test(step.run ?? ''));
  for (const lookup of [e2eScenarios.readyPullRequest, e2eScenarios.labelledPullRequest, e2eScenarios.release, e2eScenarios.dispatchWithoutE2e])
    assert.equal(gateValue([verify.if], lookup), true, 'the complete verify never waits for the opt-in');
  assert.equal(gateValue([verify.if], e2eScenarios.e2eLabelAdded), false, 'the label run adds browser evidence only; the ready run verified the head');
  const result = ci.jobs['ci-result'];
  assert.equal(checkName(result, e2eScenarios.readyPullRequest), 'CI result');
  assert.equal(checkName(result, e2eScenarios.release), 'CI result');
  assert.equal(checkName(result, e2eScenarios.e2eLabelAdded), 'E2E result');
  assert.equal(gateValue([result.if], e2eScenarios.otherLabelAdded), false, 'another label starts no aggregator');
  for (const id of ['baseline', 'source-archive', 'framework-cli', 'starter', 'self-review']) assert.equal(gateValue([ci.jobs[id].if], e2eScenarios.e2eLabelAdded), false, `${id} skips the label run`);
  for (const id of ['renamed-feature', 'example-removal', 'generated-companion', 'real-obsidian']) assert.equal(gateValue([ci.jobs[id].if], e2eScenarios.e2eLabelAdded), true, `${id} runs for the label`);
});

test('negative: the checker fails each way e2e could run unasked, be skipped by release or rerun gates on a label', () => {
  assert.equal(facts(compliant).e2e, true);
  const failing = [
    [compliant.replace(`    if: ${pure}\n`, ''), /WORKFLOW_E2E_NOT_OPT_IN: served: npm run test:e2e/],
    [compliant.replace(`    if: ${pure}\n`, "    if: contains(github.event.pull_request.labels.*.name, 'e2e')\n"), /WORKFLOW_E2E_NOT_RELEASE_MANDATORY: served/],
    [compliant.replace(`    if: ${pure}\n`, "    if: inputs.tier == 'release'\n"), /WORKFLOW_E2E_OPT_IN_IGNORED: served/],
    [compliant.replace(`    if: ${pure}\n`, `    if: ${gates}\n`), /WORKFLOW_E2E_NOT_OPT_IN: served/],
    [compliant.replace(`    if: ${pure}\n`, `    if: ${gates}\n`).replace('      - run: npm run test:e2e\n', `      - run: npm run test:e2e\n        if: steps.x.outputs.y == 'true' || (${e2eOptIn})\n`), /WORKFLOW_E2E_NOT_OPT_IN: served/],
    [compliant.replace('      - run: npm run verify\n', '      - run: npm run verify\n      - uses: ./.github/actions/setup-qualified\n        with:\n          playwright: with-deps\n'), /WORKFLOW_E2E_NOT_OPT_IN: gate: \.\/\.github\/actions\/setup-qualified/],
    [compliant.replace(`  workflow_dispatch:\n    inputs:\n      e2e:\n${input}`, '  workflow_dispatch:\n'), /WORKFLOW_E2E_INPUT_MISSING: workflow_dispatch/],
    [compliant.replace(', labeled]', ']'), /WORKFLOW_E2E_LABEL_TRIGGER_MISSING/],
    [compliant.replace(/\$\{\{ github\.event\.action == 'labeled' &&[^\n]*\n/, '\n'), /WORKFLOW_LABEL_CANCELS_RUN/],
    [compliant.replace(`    if: ${gates}\n`, "    if: inputs.tier == 'release' || github.event.pull_request.draft != true\n"), /WORKFLOW_LABEL_RERUNS_GATES: another label reruns gate/],
    [compliant + `  result:\n    name: CI result\n    if: always() && (github.event.action != 'labeled' || github.event.label.name == 'e2e')\n    needs: [gate, served]\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo\n`, /WORKFLOW_LABEL_RERUNS_GATES: the e2e label reruns result/],
  ];
  for (const [text, code] of failing) assert.throws(() => facts(text), code);
  const renamed = compliant + `  result:\n    name: \${{ github.event.action == 'labeled' && 'E2E result' || 'CI result' }}\n    if: always() && (github.event.action != 'labeled' || github.event.label.name == 'e2e')\n    needs: [gate, served]\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo\n`;
  assert.equal(facts(renamed).e2e, true, 'an aggregator renamed for the label run passes');
  // A workflow without e2e work may listen to labels its own way (the Definition of Done re-reads the e2e label).
  const labelReader = compliant.slice(0, compliant.indexOf('  served:')).replace(/\$\{\{ github\.event\.action == 'labeled' &&[^\n]*\n/, '\n').replace(`    if: ${gates}\n`, '');
  assert.equal(facts(labelReader).e2e, false);
  const mixed = "inputs.tier == 'release' || ((github.event.action != 'labeled' || github.event.label.name == 'e2e') && github.event.pull_request.draft != true)";
  assert.throws(() => facts(compliant + `  lint:\n    if: ${mixed}\n    runs-on: ubuntu-24.04\n    steps:\n      - run: npm run lint\n`), /WORKFLOW_LABEL_RERUNS_GATES: the e2e label reruns lint, which has no e2e steps/);
});

test('negative: a workflow with e2e work that release.yml does not call with tier release fails the repository check', async t => {
  const fixture = await mkdtemp(join(tmpdir(), 'e2e-release-')); t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/styles']) await mkdir(join(fixture, path), { recursive: true });
  await writeFile(join(fixture, 'src/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(fixture, 'README.md'), '# Readme\n');
  await writeFile(join(fixture, '.github/workflows/fixture.yml'), compliant);
  const release = tier => `name: Release\non: workflow_dispatch\npermissions:\n  contents: read\njobs:\n  fixture:\n    uses: ./.github/workflows/fixture.yml\n${tier}`;
  await writeFile(join(fixture, '.github/workflows/release.yml'), release(''));
  await assert.rejects(checkRepository(fixture), /fixture\.yml: WORKFLOW_E2E_RELEASE_CALL_MISSING/);
  await writeFile(join(fixture, '.github/workflows/release.yml'), release('    with:\n      tier: integration\n'));
  await assert.rejects(checkRepository(fixture), /fixture\.yml: WORKFLOW_E2E_RELEASE_CALL_MISSING/);
  await writeFile(join(fixture, '.github/workflows/release.yml'), release('    with:\n      tier: release\n'));
  assert.equal((await checkRepository(fixture)).workflows, 2);
});

test('a local bin/app ci run never guesses the opt-in: e2e steps stay condition-unknown while their job gates run', async () => {
  const dry = (await ciOperation({ command: 'ci', args: [], options: { job: 'ci/renamed-feature' } }, { root, frameworkRoot: root })).data;
  const byName = name => dry.steps.find(step => step.name === name);
  assert.equal(byName('Verify the complete renamed and extended template').disposition, 'run');
  assert.equal(byName('Provision pinned Chromium and exercise served components').disposition, 'condition-unknown');
  const native = (await ciOperation({ command: 'ci', args: [], options: { job: 'ci/real-obsidian' } }, { root, frameworkRoot: root })).data;
  assert.match(native.notes.join('\n'), /Job condition "[^"]+" is not decidable locally/);
});
