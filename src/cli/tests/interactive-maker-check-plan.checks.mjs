import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { renderHuman } from '../presentation/terminal/terminal-render.ts';
import { checkPlanOperation } from '../adapters/framework/check-plan.ts';
import { ruleHits } from '../adapters/framework/check-selection.ts';
import { loadToolkit, loadWorkflows, parseDurations, parseGateRules, parseWorkflow, workflowTrigger } from '../adapters/framework/gate-sources.ts';
import { withRepo, git, repoRoot, write } from './support/check-plan-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const plan = async (dir, options = {}) => (await checkPlanOperation({ command: 'check', args: [], options: { plan: true, ...options } }, { root: dir, frameworkRoot: repoRoot })).data;
const gateIds = data => data.gates.map(gate => gate.id);
const gateOf = (data, id) => data.gates.find(gate => gate.id === id);

test('a runtime change requires check, production coverage and the final verify, with the reason for each', () => withRepo({}, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 2;\n' });
  const data = await plan(dir);
  assert.deepEqual([data.gate, data.mode, data.verify, data.execution], ['check', 'plan', 'not-run', 'not-run']);
  assert.deepEqual(gateIds(data), ['check', 'coverage-production', 'verify']);
  assert.equal(gateOf(data, 'check').command, 'node bin/app check --fast');
  assert.deepEqual(gateOf(data, 'coverage-production').why, [{ kind: 'change-type', detail: 'rule runtime-source: src/**', paths: ['src/a.ts'], count: 1 }]);
  assert.equal(gateOf(data, 'verify').command, 'npm run verify'); assert.equal(data.gates.at(-1).id, 'verify');
  assert.deepEqual(gateOf(data, 'verify').ci.map(ci => [ci.workflow, ci.runs, ci.via]), [['ci', true, 'always']]);
  assert.ok(gateOf(data, 'check').steps.some(step => step.id === 'eslint'), 'the check gate lists the exact fast steps');
  assert.deepEqual(data.flags, []); assert.deepEqual(data.classification, ['runtime-source']);
}));

test('presentation and event changes add their own gates; an explicit base is repeated in the check command', () => withRepo({}, async dir => {
  await write(dir, { 'src/presentation/components/Panel.vue': '<template />\n', 'src/application/events.ts': 'export {};\n' });
  const data = await plan(dir, { base: 'HEAD' });
  assert.deepEqual(gateIds(data), ['check', 'coverage-production', 'check-presentation', 'events-check', 'verify']);
  assert.equal(gateOf(data, 'check').command, 'node bin/app check --fast --base HEAD');
  assert.deepEqual([data.base.source, data.base.ref], ['option', 'HEAD']);
  assert.equal(gateOf(data, 'events-check').command, 'npm run events:check');
}));

test('suites join test includes, rule sources and path-filtered workflows, with duration, prerequisites and CI coverage', () => withRepo({}, async dir => {
  await write(dir, { 'templates/companion/page.ts': 'x\n', 'tests/e2e/shop.spec.ts': 'x\n', 'tests/tooling/gates.checks.mjs': 'x\n' });
  const data = await plan(dir);
  const generator = gateOf(data, 'suite:generator');
  assert.equal(generator.command, 'node tooling/testing/suites.mjs generator');
  assert.deepEqual(generator.why.map(why => [why.kind, why.detail]), [['suite-source', 'templates/**'], ['rule', 'rule generator-inputs'], ['workflow-paths', 'starter-flow pull_request paths: templates/**']]);
  assert.equal(generator.estimateSeconds, 187, 'measured value from docs/testing/TEST-SUITES.md');
  assert.deepEqual(generator.ci.map(ci => [ci.workflow, ci.runs, ci.via]), [['ci', true, 'always'], ['starter-flow', true, 'paths']]);
  assert.equal(generator.viaCheck, true);
  assert.equal(gateOf(data, 'suite:quality').estimateSeconds, null, 'unmeasured suites report null');
  const e2e = gateOf(data, 'suite:e2e');
  assert.deepEqual([e2e.prerequisites, e2e.needs, e2e.viaCheck, e2e.required], [['chromium'], ['browser'], false, true]);
  assert.deepEqual([generator.levels, e2e.levels, gateOf(data, 'suite:quality').levels], [['integration', 'unit'], ['e2e'], []], 'test-pyramid levels from the manifest');
  assert.ok(data.notes.some(note => /golden snapshots.*kit integrity/.test(note)), 'generator inputs note the snapshot regeneration');
  assert.deepEqual(data.workflows.filter(item => item.via === 'paths').map(item => item.workflow), ['starter-flow']);
  assert.equal(data.estimate.seconds, 187); assert.equal(data.estimate.complete, false);
}));

test('a suite selected only by a workflow filter is optional locally; a clean tree needs only the final gate', () => withRepo({}, async dir => {
  await write(dir, { 'scripts/starters/render.ts': 'x\n' });
  const data = await plan(dir);
  assert.equal(gateOf(data, 'suite:e2e').required, false, 'CI runs it through starter-flow, but nothing local selected it');
  assert.equal(gateOf(data, 'suite:generator').required, true);
  assert.deepEqual(gateIds(await withRepo({}, clean => plan(clean))), ['verify']);
}));

test('workflow and dependency-manifest changes carry notes; threshold changes carry the owner-review flag', () => withRepo({}, async dir => {
  await write(dir, { '.github/workflows/ci.yml': 'name: CI\non:\n  pull_request:\njobs: {}\n# changed\n', 'package.json': '{"scripts":{"verify":"x"}}\n', 'configs/quality/thresholds.json': '{}\n' });
  const data = await plan(dir);
  assert.ok(data.notes.some(note => /^CI workflow changed: it cannot run locally/.test(note)));
  assert.ok(data.notes.some(note => /^Dependency manifest changed/.test(note)));
  assert.deepEqual(data.flags.map(flag => [flag.code, flag.message]), [['THRESHOLD_CHANGE', 'threshold change: requires owner review']]);
  assert.deepEqual(data.flags[0].paths, ['configs/quality/thresholds.json']);
  assert.ok(gateOf(data, 'suite:quality'), 'a threshold change selects the quality suite');
}));

test('a documentation-only diff requires only the documentation checks and the final verify', () => withRepo({}, async dir => {
  await write(dir, { 'docs/guide.md': 'new\n', 'README.md': 'changed\n' });
  const absent = await plan(dir);
  assert.deepEqual(gateIds(absent), ['check-repository', 'verify'], 'check:docs-launchers is skipped while package.json has no such script');
  assert.deepEqual(absent.classification, ['docs-only']); assert.ok(absent.notes.some(note => /Documentation-only diff/.test(note)));
  await write(dir, { 'package.json': JSON.stringify({ scripts: { verify: 'node verify.mjs', 'check:docs-launchers': 'y' } }) });
  assert.ok(!(await plan(dir)).classification.includes('docs-only'), 'package.json is not documentation');
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'scripts');
  await write(dir, { 'docs/more.md': 'x\n' });
  assert.deepEqual(gateIds(await plan(dir, { base: 'HEAD' })), ['check-repository', 'docs-launchers', 'verify']);
}));

test('without git the plan reports it and requires the full check', () => withRepo({}, async dir => {
  const out = spawnSync(process.execPath, [join(repoRoot, 'bin/app'), 'check', '--plan', '--json', '--root', join(dir, '.git/..')], { encoding: 'utf8', env: { ...process.env, PATH: join(process.execPath, '..') } });
  const parsed = JSON.parse(out.stdout);
  assert.deepEqual([parsed.protocolVersion, parsed.command, parsed.status], [1, 'check', 'planned']);
  assert.equal(parsed.data.changes.source, 'unavailable');
  assert.deepEqual(parsed.data.gates.map(gate => gate.command), ['node bin/app check']);
  assert.equal(parsed.diagnostics[0].code, 'GIT_UNAVAILABLE'); assert.match(parsed.diagnostics[0].message, /git is unavailable/);
}));

test('the CLI prints a compact plan table and rejects --plan with --fast', () => withRepo({}, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 3;\n', 'configs/quality/thresholds.json': '{}\n' });
  const run = (...args) => spawnSync(process.execPath, [join(repoRoot, 'bin/app'), 'check', ...args, '--root', dir], { encoding: 'utf8' });
  const human = run('--plan').stdout;
  assert.match(human, /^check: planned$/m); assert.match(human, /^ {2}# +Gate +Command +Est +CI +Because$/m);
  assert.match(human, /^ {2}1 +check +node bin\/app check --fast /m); assert.match(human, /threshold change: requires owner review/);
  assert.match(human, /^Next: npm run verify$/m);
  const rejected = JSON.parse(run('--plan', '--fast', '--json').stdout);
  assert.equal(rejected.status, 'failed'); assert.equal(rejected.diagnostics[0].code, 'INVALID_OPTION');
}));

test('prerequisite names classify as browser, native or python needs', () => withRepo({}, async dir => {
  await write(dir, { 'tests/tooling/native-new.checks.mjs': 'x\n', 'tests/tooling/memory-new.checks.mjs': 'x\n', 'tests/e2e/shop.spec.ts': 'x\n' });
  const data = await plan(dir);
  assert.deepEqual([gateOf(data, 'suite:native').needs, gateOf(data, 'suite:memory').needs, gateOf(data, 'suite:e2e').needs], [['native'], ['python'], ['browser']]);
}));

test('a generated project plans the fast check and its own verify, and unavailable git plans the unscoped full check', () => withRepo({ '.companion/generation.json': '{}', 'configs/types/tsconfig.project.json': '{}' }, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 4;\n' });
  const data = await plan(dir);
  assert.equal(data.scope, 'generated-project');
  assert.deepEqual(data.gates.map(gate => [gate.id, gate.command]), [['check', 'node bin/app check --fast'], ['verify', 'npm run verify:project']]);
  const unavailable = await checkPlanOperation({ command: 'check', args: [], options: { plan: true } }, { root: dir, frameworkRoot: repoRoot }, async () => null);
  assert.deepEqual(unavailable.data.gates.map(gate => gate.command), ['node bin/app check']);
  assert.deepEqual(unavailable.diagnostics.map(item => [item.code, item.severity]), [['GIT_UNAVAILABLE', 'warning']]);
  const text = renderHuman(unavailable, { color: false, unicode: false }).text;
  assert.match(text, /Changes {2}git unavailable \(git is unavailable/); assert.match(text, /^Next: node bin\/app check$/m);
}));

test('the human plan view lists gates, flags and notes in one aligned table', () => withRepo({}, async dir => {
  await write(dir, { 'src/a.ts': 'export const a = 5;\n', 'configs/quality/thresholds.json': '{}\n' });
  const result = await checkPlanOperation({ command: 'check', args: [], options: { plan: true } }, { root: dir, frameworkRoot: repoRoot });
  const text = renderHuman(result, { color: false, unicode: false }).text;
  assert.match(text, /^ {2}Scope {4}shell-repository, plan \(nothing was run; not verify\)$/m);
  assert.match(text, /^ {2}Base {5}main \(head|^ {2}Base {5}HEAD \(head/m);
  assert.match(text, /^ {2}# +Gate +Command +Est +CI +Because$/m);
  assert.match(text, /^ {2}1 +check +node bin\/app check --fast +- +- +src\/a\.ts -> rule runtime-source: src\/\*\*/m);
  assert.match(text, /\[warn\] threshold change: requires owner review \(configs\/quality\/thresholds\.json\)/);
  assert.match(text, /^Next: npm run verify$/m);
}));

test('workflow paths: filters follow GitHub order, negation, anchors, paths-ignore and manual-only triggers', async () => {
  const toolkit = await loadToolkit(repoRoot);
  const parse = async text => parseWorkflow('w', text);
  const filtered = await parse('name: W\non:\n  pull_request:\n    paths: &p\n      - "**/*.ts"\n      - "!docs/**"\n      - docs/keep/**\n  push:\n    paths: *p\njobs: {}\n');
  assert.deepEqual(filtered.events.push, { paths: ['**/*.ts', '!docs/**', 'docs/keep/**'] });
  const trigger = paths => workflowTrigger(toolkit, filtered, paths);
  assert.deepEqual([trigger(['src/a.ts']).runs, trigger(['src/a.ts']).via], [true, 'paths']);
  assert.equal(trigger(['docs/x.ts']).runs, false, 'a later negation excludes the path');
  assert.equal(trigger(['docs/keep/x.ts']).runs, true, 'a later positive pattern re-includes it');
  assert.equal(trigger(['README.md']).via, 'no-match');
  const ignore = await parse('name: W\non:\n  pull_request:\n    paths-ignore: ["docs/**"]\njobs: {}\n');
  assert.deepEqual([workflowTrigger(toolkit, ignore, ['docs/a.md']).runs, workflowTrigger(toolkit, ignore, ['docs/a.md', 'src/a.ts']).runs], [false, true]);
  const manual = await parse('name: W\non: [workflow_dispatch]\njobs: {}\n');
  assert.deepEqual(workflowTrigger(toolkit, manual, ['src/a.ts']), { runs: false, event: 'workflow_dispatch', via: 'manual-only' });
  const bare = await parse('name: W\non: pull_request\njobs: {}\n');
  assert.equal(workflowTrigger(toolkit, bare, ['x']).via, 'always');
  assert.equal(await parse('name: [unclosed'), null);
  const catchAll = await parse('name: W\non:\n  push:\n    paths: ["**", "!docs/**"]\njobs: {}\n');
  assert.equal(workflowTrigger(toolkit, catchAll, ['src/a.ts']).via, 'always', 'a catch-all filter is not path-specific');
  const releaseBranches = await parse("name: W\non:\n  push:\n    branches: ['release/**']\n  workflow_dispatch:\njobs: {}\n");
  assert.deepEqual(workflowTrigger(toolkit, releaseBranches, ['src/a.ts']), { runs: false, event: 'push', via: 'manual-only' }, 'a release-branch push is not a diff trigger');
  const mainBranch = await parse('name: W\non:\n  push:\n    branches: [main]\njobs: {}\n');
  assert.deepEqual([mainBranch.events.push, workflowTrigger(toolkit, mainBranch, ['src/a.ts']).via], [{ branches: ['main'] }, 'always']);
});

test('the shipped workflows parse, the durations table is read, and the gate rules reference real suites and gates', async () => {
  const workflows = await loadWorkflows(repoRoot);
  assert.ok(workflows.length >= 15); assert.ok(workflows.every(workflow => Object.keys(workflow.events).length > 0), 'every workflow has a trigger');
  assert.deepEqual(workflows.find(workflow => workflow.stem === 'setup-compatibility').events.pull_request.paths.slice(0, 2), ['package.json', 'package-lock.json']);
  assert.deepEqual(parseDurations('| `a` | x | y | z | none | tooling | 91 s |\n| `b:c` | x | y | z | none | tooling | not measured |\n| `d` | 4 s |'), { a: 91 });
  const rules = parseGateRules(JSON.parse(await readFile(join(repoRoot, 'configs/quality/gate-rules.json'), 'utf8')));
  const toolkit = await loadToolkit(repoRoot), manifest = await toolkit.manifest();
  const names = new Set(manifest.suites.map(suite => suite.name)), known = new Set(workflows.map(workflow => workflow.stem));
  for (const name of [...Object.keys(rules.suiteSources), ...rules.rules.flatMap(rule => rule.suites)]) assert.ok(names.has(name), `suite ${name} exists in tests/suites.json`);
  for (const gate of Object.values(rules.gates)) for (const workflow of gate.workflows) assert.ok(known.has(workflow), `workflow ${workflow} exists`);
  assert.equal(rules.final.at(-1), 'verify');
  for (const bad of [null, { schemaVersion: 2 }, { schemaVersion: 1, gates: {}, suiteSources: {}, docsOnly: { gates: ['missing'] }, docsGlobs: [], final: [] }])
    assert.throws(() => parseGateRules(bad), { code: 'GATE_RULES_INVALID' });
});

test('CI composite actions join workflow files in the workflows change-type rule and its quality suite', async () => {
  const rules = parseGateRules(JSON.parse(await readFile(join(repoRoot, 'configs/quality/gate-rules.json'), 'utf8')));
  const toolkit = await loadToolkit(repoRoot);
  const paths = ['.github/actions/setup-qualified/action.yml', '.github/workflows/ci.yml', '.github/CODEOWNERS'];
  const hits = ruleHits(toolkit, rules, paths).filter(hit => hit.rule.id === 'workflows');
  assert.deepEqual(hits.map(hit => [hit.paths, hit.rule.suites]), [[paths.slice(0, 2), ['quality']]]);
});
