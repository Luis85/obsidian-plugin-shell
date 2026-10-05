import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { e2eScenarios, gateValue } from '../../scripts/quality/e2e-policy.mjs';
import { parseVerifyArgs, planSteps } from '../../scripts/quality/verify-plan.mjs';
import { verifySteps } from '../../scripts/quality/verify-steps.mjs';

// Owner-approved CI narrowing: each template-authoring job runs the gates its own claim needs, a push to main
// does not requalify the merge-ref tree, a label run adds browser evidence only, and dependency caches never
// replace an install. These checks pin the invariants that keep that narrowing honest.
const root = fileURLToPath(new URL('../../', import.meta.url));
const load = async path => {
  const document = parseDocument(await readFile(join(root, path), 'utf8'));
  assert.deepEqual(document.errors, [], path);
  return document.toJS();
};
const runs = job => job.steps.map(step => step.run ?? '').join('\n');
/** Arguments of each `run verify --` in a run text, without the shell redirection or pipe that follows them. */
const verifyLines = text => [...text.matchAll(/run verify -- ([^\n|]*)/g)].map(match => match[1].replace(/\s+\d?>.*$/, '').trim());
const templateJobs = ['renamed-feature', 'source-archive', 'example-removal'];
const lookup = values => path => Object.hasOwn(values, path) ? values[path] : /^(?:github|inputs)\./.test(path) ? '' : undefined;
const dispatch = lookup({ 'github.event_name': 'workflow_dispatch', 'inputs.tier': 'integration' });
/** Steps of a job that run in a scenario (an undecidable step condition counts as running). */
const active = (job, scenario) => job.steps.filter(step => gateValue([step.if], scenario) !== false);

test('renamed-feature keeps the complete Ubuntu verify that setup-compatibility\'s deferred qualified leg relies on', async () => {
  const ci = await load('.github/workflows/ci.yml'), job = ci.jobs['renamed-feature'];
  const complete = job.steps.filter(step => verifyLines(step.run ?? '').some(args => !/--only|--skip/.test(args)));
  assert.equal(complete.length, 1, 'exactly one complete verify');
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  for (const scenario of [e2eScenarios.readyPullRequest, e2eScenarios.release, dispatch])
    assert.equal(gateValue([job.if, complete[0].if], scenario), true, 'the complete verify runs wherever the job qualifies a head');
  assert.match(runs(job), /--defer-verify/, 'setup defers only because this verify follows');
});

test('example-removal and source-archive run targeted gates and the suites their claims depend on', async () => {
  const ci = await load('.github/workflows/ci.yml');
  const removal = active(ci.jobs['example-removal'], e2eScenarios.readyPullRequest).map(step => step.run ?? '').join('\n');
  const removalVerify = verifyLines(removal);
  assert.ok(removalVerify.length === 2 && removalVerify.every(args => /^--only /.test(args)), removalVerify.join('\n'));
  const targeted = parseVerifyArgs(removalVerify[1].split(/\s+/)).only;
  for (const id of ['build', 'typecheck', 'source', 'presentation', 'architecture', 'entities', 'events', 'maintainability', 'selected-core-coverage', 'artifacts', 'harness-build', 'baseline', 'maker-coverage-gate', 'suites-check'])
    assert.ok(targeted.includes(id), `the post-removal verify keeps ${id}`);
  assert.match(removal, /suites\.mjs native makers generator\b/, 'suites that own or assert example-removal state still run');
  assert.ok(removal.indexOf('examples:remove -- --yes') < removal.indexOf('run verify -- --only build,typecheck,entities,events,harness-build'), 'a cheap gate localizes a removal failure');
  assert.match(removal, /evidence-cli\.mjs run coverage/); assert.match(removal, /evidence-cli\.mjs run artifact/);
  assert.doesNotMatch(removal, /evidence-cli\.mjs run runtime/, 'the coverage session already runs every runtime test');
  const archive = runs(ci.jobs['source-archive']);
  assert.match(archive, /git archive --format=tar HEAD/); assert.match(archive, /GIT_CEILING_DIRECTORIES/);
  assert.match(archive, /run setup -- [^\n]*--defer-verify/);
  assert.match(archive, /run verify -- --only suites-check,build,typecheck,repository,projects,source,artifacts\b/);
  assert.match(archive, /evidence-cli\.mjs run runtime/, 'evidence identity without Git stays proven');
});

test('an e2e label run rebuilds only what the served steps need in both template-authoring jobs that hold e2e steps', async () => {
  const ci = await load('.github/workflows/ci.yml');
  for (const id of ['renamed-feature', 'example-removal']) {
    const label = active(ci.jobs[id], e2eScenarios.e2eLabelAdded).map(step => step.run ?? '').join('\n');
    assert.deepEqual([...new Set(verifyLines(label))], ['--only build,harness-build'], id);
    assert.doesNotMatch(label, /suites\.mjs (?!--)|evidence-cli\.mjs run (?:coverage|artifact|runtime)/, `${id} reruns no gate for the label`);
    assert.match(label, /run test:e2e|evidence-cli\.mjs run browser/, `${id} still adds browser evidence`);
  }
});

test('a push to main skips the template-authoring jobs and the Ubuntu showcase leg, which run on pull requests, dispatch and release', async () => {
  const ci = await load('.github/workflows/ci.yml');
  for (const id of templateJobs) {
    assert.equal(gateValue([ci.jobs[id].if], e2eScenarios.pushToMain), false, `${id} skips main pushes`);
    for (const scenario of [e2eScenarios.readyPullRequest, e2eScenarios.release, dispatch]) assert.equal(gateValue([ci.jobs[id].if], scenario), true, id);
    assert.ok(ci['jobs']['ci-result'].needs.includes(id), `CI result aggregates ${id}`);
  }
  const ubuntu = /fromJSON\(\((.+?)\) && '\["ubuntu-24\.04", "windows-latest"\]' \|\| '\["windows-latest"\]'\)/.exec(ci.jobs.showcase.strategy.matrix.os);
  assert.ok(ubuntu, 'the showcase matrix adds Ubuntu by one condition');
  assert.deepEqual([e2eScenarios.pushToMain, e2eScenarios.readyPullRequest, e2eScenarios.release, dispatch].map(scenario => gateValue([ubuntu[1]], scenario)), [false, false, true, true]);
  assert.equal(gateValue([ci.jobs.showcase.if], e2eScenarios.pushToMain), true, 'the Windows complete verify still runs on main');
  assert.match(ci.jobs['ci-result'].steps[0].run, /\.value\.result != "success" and \.value\.result != "skipped"/, 'a job skipped by its own condition counts as passing');
});

test('setup-compatibility keeps the only Node 24.15.0 complete verify on Ubuntu and a targeted Windows npm 12 leg', async () => {
  const workflow = await load('.github/workflows/setup-compatibility.yml'), job = workflow.jobs.setup;
  assert.deepEqual(job.strategy.matrix.include.map(row => [row.os, row.node, row.npm, row.verify, row.targeted ?? false]), [
    ['ubuntu-24.04', '24.15.0', '12.0.2', 'complete', false], ['windows-latest', '24.15.0', '12.0.2', 'deferred', true],
    ['ubuntu-24.04', '24.21.0', '11.19.1', 'deferred', false], ['windows-latest', '24.21.0', '11.19.1', 'deferred', false]]);
  const setup = job.steps.find(step => /run setup --/.test(step.run ?? ''));
  assert.match(setup.run, /if \(\$env:SETUP_VERIFY -eq 'deferred'\) \{ \$extra \+= '--defer-verify' \}/, 'only deferred rows skip setup\'s complete verify');
  const targeted = job.steps.find(step => step.if === 'matrix.targeted');
  assert.match(targeted.run, /run verify -- --only dependency-policy,build,typecheck,artifacts\n/);
  assert.match(targeted.run, /suites\.mjs setup\n/);
  assert.equal([...targeted.run.matchAll(/if \(\$LASTEXITCODE -ne 0\) \{ exit \$LASTEXITCODE \}/g)].length, 2, 'pwsh fails on either command');
  assert.ok(!job.steps.some(step => step.uses?.startsWith('actions/cache')), 'the install-policy rows stay cold');
});

test('every workflow verify --only list and suite name is real, so a renamed step or suite fails here instead of on a runner', async () => {
  const steps = verifySteps(), manifest = JSON.parse(await readFile(join(root, 'tests/suites.json'), 'utf8'));
  const suites = new Set(manifest.suites.map(suite => suite.name));
  let checked = 0;
  for (const file of (await readdir(join(root, '.github/workflows'))).filter(name => name.endsWith('.yml'))) {
    const text = await readFile(join(root, '.github/workflows', file), 'utf8');
    for (const args of verifyLines(text).filter(line => /--only|--skip/.test(line))) {
      assert.doesNotThrow(() => planSteps(steps, parseVerifyArgs(args.split(/\s+/))), `${file}: ${args}`); checked++;
    }
    for (const [, names] of text.matchAll(/scripts\/testing\/suites\.mjs ((?:[a-z:-]+ ?)+)/g))
      for (const name of names.trim().split(' ').filter(item => !item.startsWith('--'))) assert.ok(suites.has(name), `${file}: suite ${name}`);
  }
  assert.ok(checked >= 5, `${checked} targeted verify lines`);
});

test('dependency caches hold downloads only: no workflow caches node_modules, and fresh-install qualification stays cold', async () => {
  const action = await load('.github/actions/setup-qualified/action.yml');
  const workflows = [];
  for (const file of (await readdir(join(root, '.github/workflows'))).filter(name => name.endsWith('.yml'))) workflows.push([file, await load(`.github/workflows/${file}`)]);
  const caches = [['setup-qualified', action.runs.steps], ...workflows.flatMap(([file, data]) => Object.entries(data.jobs).map(([id, job]) => [`${file}/${id}`, job.steps ?? []]))]
    .flatMap(([where, steps]) => steps.filter(step => step.uses?.startsWith('actions/cache')).map(step => [where, step.with]));
  assert.ok(caches.length > 5);
  for (const [where, options] of caches) assert.doesNotMatch(String(options.path), /node_modules/, `${where} never restores installed dependencies`);
  const npm = caches.filter(([, options]) => /npm-cache|\.npm/.test(String(options.path)));
  assert.ok(npm.length >= 2, 'the npm download cache exists');
  for (const [where, options] of npm) assert.match(options.key, /^npm-download-\$\{\{ runner\.os \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}$/, where);
  const cache = action.runs.steps.find(step => step.uses?.startsWith('actions/cache') && /npm/.test(step.with.path));
  assert.equal(cache.if, "inputs.install == 'true' && inputs.npm-cache == 'true'");
  for (const file of ['candidate-qualification.yml', 'publish.yml', 'release-cut.yml']) {
    const [, data] = workflows.find(([name]) => name === file);
    const uses = Object.values(data.jobs).flatMap(job => job.steps ?? []).filter(step => step.uses === './.github/actions/setup-qualified' && step.with?.install === 'true');
    assert.ok(uses.length && uses.every(step => step.with['npm-cache'] === 'false'), `${file} installs cold`);
  }
});
