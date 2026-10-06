import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { projectModel } from '../../src/cli/compiler/emitters/model.ts';
import { projectFiles } from '../support/project-render.mjs';
import { maintainerOnly } from '../../src/cli/compiler/emitters/framework-docs.ts';
import { frameworkOnlyPath, referenceDocPath, withBanner, rewriteDocReferences, maintainerScript, frameworkBanner } from '../../src/cli/compiler/emitters/framework-scope.ts';
import { clickdummyBuilderFiles } from '../../src/cli/compiler/emitters/clickdummy-builder-files.ts';
import { buildClickdummy } from '../../src/cli/adapters/framework/clickdummy.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { evaluateCondition } from '../../src/cli/domain/ci-expression.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const starter = JSON.parse(starterDocumentText('quick-capture'));
const files = new Map((await projectFiles(root, projectModel(structuredClone(starter.document ?? starter)))).map(entry => [entry.path, entry]));
const text = path => { const entry = files.get(path); assert.ok(entry, `missing ${path}`); return entry.content; };
const paths = [...files.keys()];
const scripts = JSON.parse(text('package.json')).scripts;

test('[GENERATOR-SCOPE-01] the framework backlog, PRDs, reviews, research, milestone plans and records are not copied', () => {
  const folders = ['docs/_archive', 'docs/tasks', 'docs/prds', 'docs/reviews', 'docs/research', 'docs/superpowers', 'docs/product', 'docs/requirements', 'docs/memory', 'docs/testing/evidence'];
  for (const folder of folders) assert.deepEqual(paths.filter(path => path.startsWith(folder + '/')), [], folder);
  // Archived records exist in the source tree, so their absence below is the scope policy, not a missing input.
  const archived = ['docs/_archive/development/RUNTIME-AUTHORING-PLAN.md', 'docs/_archive/development/ITERATION-FOUR-REVIEW.md', 'docs/_archive/development/ACCEPTANCE-CLOSURE-LEDGER.md',
    'docs/_archive/testing/ITERATION-FOUR.md', 'docs/_archive/testing/RUNTIME-AUTHORING.md', 'docs/_archive/testing/runtime-authoring-plan.json', 'docs/_archive/testing/FIRST-RUN.md'];
  for (const record of archived) {
    assert.ok(existsSync(join(root, record)), `source ${record}`);
    for (const path of [record, record.replace(/^docs\/_archive\//, 'docs/'), record.replace(/^docs\/_archive\//, 'docs/framework/')]) assert.ok(!files.has(path), path);
  }
  assert.deepEqual(paths.filter(path => /(?:^|\/)_archive(?:\/|$)/.test(path)), [], 'nothing under docs/_archive ships, relocated or not');
  assert.ok(paths.every(path => !/(?:^|\/)(?:ITERATION|PR\d+)-/.test(path) || !path.startsWith('docs/')), 'no iteration or pull-request record under docs/');
  // The one planning surface left is the product's own.
  assert.ok(files.has('docs/project-tasks/TEMPLATE.md')); assert.ok(files.has('BRIEF.md'));
});
test('[GENERATOR-SCOPE-02] the repository-specific prototype skill and its evidence are absent; only the click-dummy worker ships', () => {
  assert.deepEqual(paths.filter(path => path.includes('companion-prototype-design')), []);
  assert.ok(![...files.values()].some(file => !file.encoding && /Luis85\/obsidian-plugin-shell/.test(file.content) && /^(?:\.claude|\.agents)\//.test(file.path)));
  const skills = paths.filter(path => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(path)).map(path => path.split('/')[2]).sort();
  assert.deepEqual(skills, paths.filter(path => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(path)).map(path => path.split('/')[2]).sort());
  assert.ok(skills.length >= 4 && !skills.includes('companion-prototype-design'));
  const builder = paths.filter(path => path.startsWith('scripts/clickdummy/'));
  assert.ok(builder.includes('scripts/clickdummy/lib/build-worker.mjs'));
  for (const path of builder) for (const [, specifier] of text(path).matchAll(/from '(\.{1,2}\/[^']+)'/g))
    assert.ok(files.has(posix.normalize(posix.join(posix.dirname(path), specifier))), `${path} imports ${specifier}`);
  assert.ok(builder.length < 10);
  assert.deepEqual(clickdummyBuilderFiles([]), []);
  assert.throws(() => clickdummyBuilderFiles([{ path: '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs', content: "import './missing.mjs';", ownership: 'extension' }]), /GENERATOR_CLICKDUMMY_BUILDER_IMPORT/);
});
test('[GENERATOR-SCOPE-03] kept framework reference docs live under docs/framework/ behind the banner, links and mentions follow them', () => {
  const markdown = paths.filter(path => path.startsWith('docs/framework/') && path.endsWith('.md'));
  assert.ok(markdown.length > 30);
  // The banner is the first line, or the first line after YAML front matter.
  for (const path of markdown) assert.equal(text(path).replace(/^---\n[\s\S]*?\n---\n/, '').split('\n')[0], frameworkBanner, path);
  assert.match(frameworkBanner, /Framework reference — not this project's backlog or instructions; follow \.\/AGENTS\.md/);
  assert.ok(files.has('docs/framework/development/BUILD-A-FEATURE.md')); assert.ok(files.has('docs/framework/testing/OBSIDIAN-TEST-KIT.md'));
  // The release-candidate how-to ships as a product guide; the repository's own release records stay out.
  assert.ok(files.has('docs/framework/development/RELEASE-CANDIDATES.md'));
  for (const record of ['RELEASE-EXECUTION', 'RELEASE-REHEARSAL', 'RELEASE-OPERATION-PLANS', 'MAINTENANCE-AND-RELEASE'])
    assert.ok(existsSync(join(root, `docs/development/${record}.md`)) && !paths.some(path => path.endsWith(`/${record}.md`)), record);
  for (const old of ['docs/development/BUILD-A-FEATURE.md', 'docs/testing/OBSIDIAN-TEST-KIT.md', 'docs/architecture/EVENT-BUS.md']) assert.ok(!files.has(old), old);
  // Product-authored text and code comments name the relocated paths, and every named doc exists.
  const product = paths.filter(path => !files.get(path).encoding && files.get(path).ownership !== 'framework' && /\.(?:md|mdc|ts|mjs)$/.test(path));
  const mentioned = new Set();
  for (const path of product) for (const [mention] of text(path).matchAll(/docs\/[A-Za-z0-9_./-]+\.md/g)) mentioned.add(mention);
  assert.ok(mentioned.size >= 8);
  for (const mention of mentioned) assert.ok(files.has(mention) || mention.startsWith('docs/generated/'), `${mention} is mentioned but not generated`);
  assert.ok(![...mentioned].some(mention => /^docs\/(?:development|testing|architecture|tooling)\//.test(mention)));
});
test('[GENERATOR-SCOPE-04] scope helpers classify records, relocate guides and keep front matter first', () => {
  for (const record of ['docs/tasks/shell/x.md', 'docs/prds/a.md', 'docs/development/FOO-PLAN.md', 'docs/development/FOO-REVIEW-B.md', 'docs/development/ITERATION-TWO.md', 'docs/testing/2026-09-22-verification-record.md',
    'docs/testing/MVP-CLOSURE-STATUS.md', 'docs/testing/iteration-two-plan.json', '.claude/skills/companion-prototype-design/SKILL.md',
    'docs/_archive/development/compiler/IMPLEMENTATION.md', 'docs/_archive/testing/OBSIDIAN-TEST-KIT.md', 'docs/testing/FIRST-RUN.md', 'docs/testing/OPTIONAL-STORYBOOK.md',
    'docs/development/DELIVERY-PIPELINE.md', 'docs/development/DELIVER-A-CHANGE.md', 'docs/development/CUT-AND-PUBLISH-A-RELEASE.md', 'docs/development/WORKFLOWS.md', 'docs/increments/delivery-pipeline-and-hosting.md']) assert.equal(frameworkOnlyPath(record), true, record);
  for (const kept of ['docs/development/BUILD-A-FEATURE.md', 'docs/testing/OBSIDIAN-TEST-KIT.md', 'docs/testing/test-plan.json', 'docs/licenses/lucide.txt', 'docs/design/obsidian-tokens.json']) assert.equal(frameworkOnlyPath(kept), false, kept);
  assert.equal(referenceDocPath('docs/development/BUILD-A-FEATURE.md'), 'docs/framework/development/BUILD-A-FEATURE.md');
  // The release-candidate how-to is a product guide; real release records keep their exclusion.
  assert.equal(referenceDocPath('docs/development/RELEASE-CANDIDATES.md'), 'docs/framework/development/RELEASE-CANDIDATES.md');
  for (const record of ['docs/development/RELEASE-EXECUTION.md', 'docs/development/RELEASE-REHEARSAL.md', 'docs/development/RELEASE-OPERATION-PLANS.md', 'docs/development/RELEASE-CANDIDATES-PLAN.md',
    'docs/development/MAINTENANCE-AND-RELEASE.md']) assert.equal(frameworkOnlyPath(record), true, record);
  assert.equal(referenceDocPath('docs/testing/test-plan.json'), null); assert.equal(referenceDocPath('docs/tasks/a.md'), null); assert.equal(referenceDocPath('docs/_archive/testing/ITERATION-FOUR.md'), null); assert.equal(referenceDocPath('docs/x.md'), null);
  assert.equal(withBanner('# T\n'), `${frameworkBanner}\n\n# T\n`);
  assert.equal(withBanner(withBanner('# T\n')), `${frameworkBanner}\n\n# T\n`);
  assert.equal(withBanner('---\nid: x\n---\n# T\n'), `---\nid: x\n---\n${frameworkBanner}\n\n# T\n`);
  assert.equal(rewriteDocReferences('See `docs/testing/OBSIDIAN-TEST-KIT.md`, docs/tasks/a.md and docs/testing/test-plan.json.'),
    'See `docs/framework/testing/OBSIDIAN-TEST-KIT.md`, docs/tasks/a.md and docs/testing/test-plan.json.');
  for (const name of ['release:operate', 'test:compiler', 'qualify:compiler', 'memory', 'prototype:tools', 'companion:generate', 'test:makers', 'increment:new', 'dor', 'dod', 'acceptance:stubs']) assert.equal(maintainerScript(name), true, name);
  for (const name of ['check', 'test', 'build', 'verify:project', 'test:framework', 'test:suites', 'doctor', 'make', 'check:submission', 'test:obsidian', 'build:clickdummy']) assert.equal(maintainerScript(name), false, name);
});
test('[GENERATOR-SCOPE-05] the generated package.json advertises the product loop, not the framework maintainers\' scripts', () => {
  const names = Object.keys(scripts);
  assert.deepEqual(names.filter(maintainerScript), []);
  for (const name of ['release:operate', 'release:plan', 'test:compiler', 'qualify:compiler', 'prototype:tools', 'prototype:build', 'companion:generate', 'test:memory', 'memory', 'test:baseline']) assert.ok(!(name in scripts), name);
  for (const name of ['check', 'check:fast', 'check:submission', 'test', 'build', 'dev:obsidian', 'test:obsidian', 'build:clickdummy', 'verify:project', 'verify:artifacts', 'make', 'doctor']) assert.ok(scripts[name], name);
  assert.ok(names.length < 90, `${names.length} scripts`);
  // verify:artifacts is exactly what verify:project adds to check, so CI never runs a gate twice.
  assert.match(scripts['verify:artifacts'], /^npm run build && npm run test:ui-effects/);
  assert.ok(!/npm (?:run check|test)\b/.test(scripts['verify:artifacts']));
  for (const path of paths.filter(path => /^(?:README|AGENTS|CLAUDE)\.md$|^\.claude\/skills\//.test(path))) assert.doesNotMatch(text(path), /prototype:tools|companion-prototype-design/, path);
});
const workflow = path => parse(text(path));
const runs = job => job.steps.map(step => step.run ?? '').join('\n');
/** A generated workflow condition in one event: absent event and input fields are null (''), as on GitHub. */
const decide = (condition, values) => evaluateCondition(condition, { lookup: path => values[path] ?? (/^(?:github|inputs)\./.test(path) ? '' : undefined), success: true });
const pullRequest = { 'github.event_name': 'pull_request', 'github.event.action': 'synchronize' };
test('[GENERATOR-SCOPE-06] CI runs each gate once, adds the submission check and a separate e2e UI job: always on main, opt-in elsewhere', () => {
  const ci = workflow('.github/workflows/ci.yml');
  assert.deepEqual(Object.keys(ci.jobs), ['check', 'ui']);
  const check = runs(ci.jobs.check);
  assert.equal([...check.matchAll(/ run check$/gm)].length, 1);
  assert.ok(!/verify:project/.test(check) && !/ run test$| test$/m.test(check), 'tests do not run a second time');
  assert.match(check, / run verify:artifacts/); assert.match(check, / run check:submission/);
  // A fresh project has no manifest author yet, so the community-review mirror is advisory until the owner removes this.
  assert.equal(ci.jobs.check.steps.find(step => /check:submission/.test(step.run ?? ''))['continue-on-error'], true);
  const ui = ci.jobs.ui, body = runs(ui);
  // End-to-end is opt-in (label e2e, or the e2e input of a manual run) and mandatory on main, the project's Release tier.
  assert.equal(ci.jobs.check.if, undefined, 'the gates run on every event, a label run included, so no skipped check stands in for them');
  assert.ok(ci.on.pull_request.types.includes('labeled')); const input = ci.on.workflow_dispatch.inputs.e2e; assert.deepEqual([input.type, input.default], ['boolean', false]);
  assert.match(ci.concurrency.group, /github\.event\.label\.name/, 'a label run never cancels the full run');
  const labels = names => ({ ...pullRequest, 'github.event.pull_request.labels.*.name': names });
  assert.deepEqual([{ 'github.event_name': 'push' }, labels('e2e'), { 'github.event_name': 'workflow_dispatch', 'inputs.e2e': 'true' },
    { ...labels('e2e'), 'github.event.action': 'labeled', 'github.event.label.name': 'e2e' }].map(values => decide(ui.if, values)), [true, true, true, true]);
  assert.deepEqual([pullRequest, labels('docs'), { 'github.event_name': 'workflow_dispatch', 'inputs.e2e': 'false' },
    { ...labels('e2e'), 'github.event.action': 'labeled', 'github.event.label.name': 'docs' }].map(values => decide(ui.if, values)), [false, false, false, false]);
  assert.match(body, /playwright\/test\/cli\.js install --with-deps chromium/);
  assert.match(body, /run test:e2e/); assert.match(body, /run ui:gallery/);
  assert.ok(body.indexOf('install --with-deps chromium') < body.indexOf('run test:e2e'));
  assert.match(body, /GITHUB_STEP_SUMMARY/); assert.match(body, /evidence for human review, not acceptance/);
  const uploads = ui.steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
  assert.deepEqual(uploads.map(step => [step.with.name, step.with.path]), [['ui-review-gallery', 'reports/ui-gallery/'], ['ui-e2e-reports', 'reports/e2e/']]);
  for (const step of uploads) assert.equal(step.if, 'always()');
  // Each UI script is guarded: an absent script warns instead of silently passing as evidence.
  for (const script of ['test:e2e', 'ui:gallery']) assert.match(body, new RegExp(`scripts\\?\\.\\['${script}'\\][\\s\\S]*::warning::package\\.json has no ${script} script`));
});
test('[GENERATOR-SCOPE-07] real Obsidian runs on main and, opted in by label e2e or run-obsidian, on a pull request without weakening the download policy', () => {
  const real = workflow('.github/workflows/obsidian.yml'), job = real.jobs['real-obsidian'];
  assert.deepEqual(real.on.push, { branches: ['main'] }); assert.ok('workflow_dispatch' in real.on);
  assert.ok(real.on.pull_request.types.includes('labeled')); assert.ok(!('pull_request_target' in real.on));
  assert.equal(job.if, "github.event_name != 'pull_request' || contains(github.event.pull_request.labels.*.name, 'e2e') || contains(github.event.pull_request.labels.*.name, 'run-obsidian')");
  assert.deepEqual(['e2e', 'run-obsidian', 'docs'].map(name => decide(job.if, { ...pullRequest, 'github.event.pull_request.labels.*.name': name })), [true, true, false]);
  assert.deepEqual(real.permissions, { contents: 'read' }); assert.ok(!real.env && !job.env, 'the download opt-in is never workflow- or job-wide');
  const downloads = job.steps.filter(step => step.env?.OBSIDIAN_ALLOW_DOWNLOAD !== undefined);
  assert.deepEqual(downloads.map(step => step.env.OBSIDIAN_ALLOW_DOWNLOAD), ['1', '1']);
  assert.ok(job.steps.some(step => /run test:obsidian/.test(step.run ?? '')) && job.steps.some(step => step.uses?.startsWith('actions/cache@')));
  assert.ok(!/github\.event\.pull_request/.test(runs(job)), 'no pull-request data is interpolated into shell');
});
test('[GENERATOR-SCOPE-08] click-dummy build runs the skill worker in the framework and the shipped worker in a generated project', async () => {
  const run = async skillPresent => {
    const entries = [];
    const dependencies = { exists: async path => skillPresent || !path.includes('companion-prototype-design'),
      inspectDesign: async () => ({ model: { project: { name: 'Demo' } } }),
      runNode: async (_context, entry) => { entries.push(entry); return { exitCode: 0, signal: null, truncated: false, stdout: JSON.stringify({ status: 'built-not-browser-verified' }) }; } };
    await buildClickdummy({ command: 'clickdummy build', args: [], options: {} }, { root: '/project', frameworkRoot: '/project' }, dependencies);
    return entries;
  };
  assert.deepEqual(await run(true), ['.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs']);
  assert.deepEqual(await run(false), ['scripts/clickdummy/lib/build-worker.mjs']);
});
test('[GENERATOR-SCOPE-09] shipped framework tests never drive the shell entry a generated src/main.ts replaces; example removal lists only shipped files', async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('The framework entry tests and example ownership exist only while the reviewed example sources are present.'); return; }
  const drivesEntry = /\.onload\(|\.onunload\(|loadPlugin\(/, importsEntry = /from '(?:\.\.\/)+src\/main'/;
  const shipped = paths.filter(path => /^tests\/.*\.test\.ts$/.test(path) && importsEntry.test(text(path)));
  assert.ok(shipped.length >= 2, 'framework runtime tests still use the entry as a plain plugin instance');
  for (const path of shipped) assert.doesNotMatch(text(path), drivesEntry, `${path} drives the framework src/main.ts lifecycle`);
  assert.doesNotMatch(text('src/main.ts'), /ShellPlugin|registerView/);
  // The framework checkout keeps running its entry tests; the generator excludes exactly those files.
  const entryTests = ['tests/runtime/shell-entry-lifecycle.test.ts', 'tests/runtime/obsidian-test-kit-shell-entry.test.ts'];
  for (const path of entryTests) {
    assert.match(await readFile(join(root, path), 'utf8'), drivesEntry, path);
    assert.ok(!files.has(path), path); assert.equal(maintainerOnly(path), true, path);
  }
  const framework = JSON.parse(await readFile(join(root, 'scripts/examples/ownership.json'), 'utf8')).files.map(file => file.path);
  const ownership = JSON.parse(text('scripts/examples/ownership.json')).files;
  for (const path of entryTests) assert.ok(framework.includes(path), path);
  assert.deepEqual(ownership.map(file => file.path), framework.filter(path => !maintainerOnly(path)));
  // A listed file that is absent would make examples:remove report an edit conflict in every fresh project.
  for (const file of ownership) {
    if (file.sha256 !== null) assert.ok(files.has(file.path), `${file.path} is listed for example removal but not generated`);
    if (file.template) assert.ok(files.has('templates/examples/' + file.template), file.template);
  }
});
