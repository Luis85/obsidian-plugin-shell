import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { excludesProjects, scopePath, scopeWorkflow, syncedName } from '../../scripts/projects/workflows.mjs';
import { checkProjects, syncWorkflows } from '../../scripts/projects/projects.mjs';
import { frameworkProjectFolder } from '../../bin/compiler/domain/template-inputs.ts';
import { included } from '../../bin/adapters/framework/distribution.ts';
import { maintainerOnly } from '../../bin/compiler/emitters/framework-docs.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { inspectWorkflow } from '../../scripts/quality/check-repository.mjs';

const repository = resolve(import.meta.dirname, '../..');
const pin = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const node = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const upload = 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a';
const workflow = (steps, extra = '') => `name: CI\non:\n  pull_request:\n  push:\n    branches: [main]\npermissions:\n  contents: read\nconcurrency:\n  group: ci-\${{ github.ref }}\n  cancel-in-progress: true\n${extra}jobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ${pin}\n        with:\n          persist-credentials: false\n${steps}`;
const code = run => { try { run(); return 'scoped'; } catch (error) { return error.code ?? error.message; } };

test('[PROJECTS-01] scopePath moves relative paths into the project and keeps absolute, home and variable paths', () => {
  const folder = 'projects/demo';
  assert.equal(scopePath('.nvmrc', folder), 'projects/demo/.nvmrc');
  assert.equal(scopePath('./reports/e2e/', folder), 'projects/demo/reports/e2e/');
  assert.equal(scopePath('.', folder), 'projects/demo');
  assert.equal(scopePath('!dist/**', folder), '!projects/demo/dist/**');
  for (const kept of ['/tmp/x', '~/.cache/ms-playwright', '$RUNNER_TEMP/npm', '${{ runner.temp }}/x']) assert.equal(scopePath(kept, folder), kept);
  assert.throws(() => scopePath('../shell/src', folder), /PROJECT_WORKFLOW_PATH_ESCAPES/);
});

test('[PROJECTS-02] a project workflow is scoped to its folder, isolated from shell concurrency and passes the security floor', () => {
  const steps = `      - uses: ${node}\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n          cache-dependency-path: package-lock.json\n      - run: npm ci\n      - run: npm test\n        working-directory: app\n      - uses: ${upload}\n        with:\n          name: reports\n          path: |\n            reports/e2e/\n            !reports/e2e/tmp\n          retention-days: 7\n      - name: Key\n        run: echo "\${{ hashFiles('package-lock.json', '**/*.ts') }}"\n`;
  const scoped = scopeWorkflow(workflow(steps), { project: 'demo', file: 'ci.yml' });
  const data = parse(scoped);
  assert.match(scoped, /^# Generated from projects\/demo\/\.github\/workflows\/ci\.yml/);
  assert.equal(data.name, 'demo: CI');
  for (const event of ['push', 'pull_request']) assert.deepEqual(data.on[event].paths, ['projects/demo/**', '.github/workflows/projects--demo--ci.yml']);
  assert.deepEqual(data.on.push.branches, ['main']);
  assert.equal(data.concurrency.group, 'projects-demo-ci-${{ github.ref }}');
  assert.equal(data.defaults.run['working-directory'], 'projects/demo');
  const [, setup, , test, artifact, key] = data.jobs.check.steps;
  assert.deepEqual(setup.with, { 'node-version-file': 'projects/demo/.nvmrc', cache: 'npm', 'cache-dependency-path': 'projects/demo/package-lock.json' });
  assert.equal(test['working-directory'], 'projects/demo/app');
  assert.equal(artifact.with.path, 'projects/demo/reports/e2e/\n!projects/demo/reports/e2e/tmp');
  assert.equal(artifact.with['retention-days'], 7);
  assert.match(key.run, /hashFiles\('projects\/demo\/package-lock\.json', 'projects\/demo\/\*\*\/\*\.ts'\)/);
  assert.equal(scopeWorkflow(workflow(steps), { project: 'demo', file: 'ci.yml' }), scoped, 'deterministic');
});

test('[PROJECTS-03] existing path filters are moved under the project and download-artifact gets an explicit path', () => {
  const text = `name: Docs\non:\n  push:\n    paths-ignore: ['docs/**']\n  pull_request:\n    paths: ['src/**']\n  schedule:\n    - cron: '0 1 * * 1'\npermissions:\n  contents: read\njobs:\n  get:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093\n        with:\n          name: bundle\n`;
  const data = parse(scopeWorkflow(text, { project: 'demo', file: 'docs.yaml' }));
  assert.deepEqual(data.on.push.paths, ['projects/demo/**', '.github/workflows/projects--demo--docs.yml', '!projects/demo/docs/**']);
  assert.equal(data.on.push['paths-ignore'], undefined);
  assert.deepEqual(data.on.pull_request.paths, ['projects/demo/src/**', '.github/workflows/projects--demo--docs.yml']);
  assert.deepEqual(data.on.schedule, [{ cron: '0 1 * * 1' }]);
  assert.equal(data.jobs.get.steps[0].with.path, 'projects/demo');
  assert.equal(syncedName('demo', 'docs.yaml'), 'projects--demo--docs.yml');
});

test('[PROJECTS-04] constructs that cannot be scoped faithfully are refused, never guessed', () => {
  const scope = text => code(() => scopeWorkflow(text, { project: 'demo', file: 'ci.yml' }));
  assert.equal(scope(workflow('').replace('  pull_request:\n', '  pull_request_target:\n') + '      - run: echo\n'), 'PROJECT_WORKFLOW_PRIVILEGED_TRIGGER');
  assert.equal(scope(workflow('      - uses: ./.github/actions/setup\n')), 'PROJECT_WORKFLOW_LOCAL_ACTION');
  assert.equal(scope(workflow(`      - uses: ${pin}\n        with:\n          path: sub\n          persist-credentials: false\n`)), 'PROJECT_WORKFLOW_UNSCOPED_INPUT');
  assert.equal(scope(workflow('      - uses: someone/tool@0123456789abcdef0123456789abcdef01234567\n        with:\n          config-file: tool.json\n')), 'PROJECT_WORKFLOW_UNSCOPED_INPUT');
  assert.equal(scope(workflow('      - run: cd "$GITHUB_WORKSPACE"\n')), 'PROJECT_WORKFLOW_WORKSPACE_REFERENCE');
  assert.equal(scope(workflow('      - &x\n        run: echo\n      - *x\n')), 'PROJECT_WORKFLOW_ALIAS');
  assert.equal(scope(workflow('      - run: echo\n').replace('jobs:\n  check:\n', 'jobs:\n  call:\n    uses: ./.github/workflows/other.yml\n  check:\n')), 'PROJECT_WORKFLOW_REUSABLE_JOB');
  assert.equal(scope(workflow('      - uses: actions/setup-node@v6\n')), 'PROJECT_WORKFLOW_SECURITY_FLOOR');
  assert.equal(scope(workflow('      - run: echo\n').replace('permissions:\n  contents: read\n', '')), 'PROJECT_WORKFLOW_SECURITY_FLOOR');
});

test('[PROJECTS-05] shell workflows must exclude projects/ explicitly on push and pull_request', () => {
  assert.equal(excludesProjects("on:\n  pull_request:\n    paths-ignore: ['projects/**']\n  workflow_dispatch:\n"), true);
  assert.equal(excludesProjects("on:\n  push:\n    paths: ['**', '!docs/**', '!projects/**']\n"), true);
  assert.equal(excludesProjects("on:\n  workflow_dispatch:\n  schedule:\n    - cron: '1 1 * * 1'\n"), true);
  assert.equal(excludesProjects('on: [push, pull_request]\n'), false);
  assert.equal(excludesProjects("on:\n  pull_request:\n    paths: ['!projects/**', '**']\n"), false);
  assert.equal(excludesProjects("on:\n  pull_request:\n    paths-ignore: ['projects/**']\n  push:\n"), false);
});

test('[PROJECTS-06] only projects/<name> is a generator target inside the framework checkout', () => {
  for (const within of ['projects/companion', 'projects/a1-b2', 'projects\\demo']) assert.equal(frameworkProjectFolder(within), true, within);
  for (const within of ['projects', 'projects/', 'projects/a/b', 'projects/A', 'projects/a--b', 'projects/-a', 'src/projects/a', '../projects/a']) assert.equal(frameworkProjectFolder(within), false, within);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'projects-boundary-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  await put('.github/workflows/shell.yml', `name: Shell\non:\n  pull_request:\n    paths-ignore: ['projects/**']\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`);
  await put('.github/dependabot.yml', 'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /projects/demo\n    schedule:\n      interval: weekly\n');
  await put('docs/concepts/demo/index.html', '<!doctype html>');
  await put('configs/starters/demo.json', '{}');
  await put('projects/README.md', '# Projects\n');
  for (const file of ['package-lock.json', 'README.md', 'AGENTS.md']) await put(`projects/demo/${file}`, '{}');
  await put('projects/demo/.nvmrc', '24.21.0\n');
  await put('projects/demo/package.json', JSON.stringify({ name: 'demo', devDependencies: { typescript: '6.0.3' } }));
  await put('projects/demo/tsconfig.json', '{ "extends": "./configs/tsconfig.base.json" }');
  await put('projects/demo/workbench.project.json', JSON.stringify({ schemaVersion: 1, name: 'demo', title: 'Demo', prototypes: [{ path: 'docs/concepts/demo' }], origin: { starter: 'configs/starters/demo.json' } }));
  await put('projects/demo/.github/workflows/ci.yml', workflow('      - run: npm ci\n'));
  return { root, put };
}

test('[PROJECTS-07] sync writes scoped copies, check passes, and drift, orphans and isolation gaps fail', async t => {
  const { root, put } = await fixture(t);
  assert.match((await checkProjects(root)).failures.join('\n'), /PROJECT_WORKFLOW_NOT_SYNCED: \.github\/workflows\/projects--demo--ci\.yml/);
  assert.deepEqual(await syncWorkflows(root), { status: 'passed', written: ['projects--demo--ci.yml'], removed: [], failures: [] });
  assert.deepEqual((await syncWorkflows(root)).written, [], 'idempotent');
  const passed = await checkProjects(root);
  assert.equal(passed.status, 'passed', passed.failures.join('\n'));
  assert.deepEqual(passed.projects, [{ name: 'demo', title: 'Demo', prototypes: ['docs/concepts/demo'], workflows: ['ci.yml'] }]);

  const copy = join(root, '.github/workflows/projects--demo--ci.yml');
  await writeFile(copy, (await readFile(copy, 'utf8')).replace('npm ci', 'npm install'));
  await put('.github/workflows/projects--gone--ci.yml', 'name: x\n');
  await put('.github/workflows/leaky.yml', 'name: Leaky\non: [pull_request]\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n');
  const failures = (await checkProjects(root)).failures.join('\n');
  assert.match(failures, /PROJECT_WORKFLOW_DRIFT: \.github\/workflows\/projects--demo--ci\.yml/);
  assert.match(failures, /PROJECT_WORKFLOW_ORPHAN: \.github\/workflows\/projects--gone--ci\.yml/);
  assert.match(failures, /SHELL_WORKFLOW_NOT_ISOLATED: \.github\/workflows\/leaky\.yml/);
  assert.doesNotMatch(failures, /shell\.yml/);

  const synced = await syncWorkflows(root);
  assert.deepEqual([synced.written, synced.removed], [['projects--demo--ci.yml'], ['projects--gone--ci.yml']]);
  assert.deepEqual((await readdir(join(root, '.github/workflows'))).sort(), ['leaky.yml', 'projects--demo--ci.yml', 'shell.yml']);
});

test('[PROJECTS-08] manifest, prototype links, standalone toolchain and dependabot coverage are enforced', async t => {
  const { root, put } = await fixture(t);
  await syncWorkflows(root);
  await put('projects/demo/workbench.project.json', JSON.stringify({ schemaVersion: 1, name: 'other', title: '', prototypes: [{ path: 'docs/concepts/missing' }, { path: 'src/x' }, { path: 'docs/concepts/../../x' }], origin: { starter: 'nope.json' } }));
  await put('projects/demo/package.json', JSON.stringify({ name: 'demo', workspaces: ['a'], dependencies: { shell: 'file:../..', local: 'link:./x' } }));
  await put('projects/demo/tsconfig.build.json', '{ "extends": "../../tsconfig.json" }');
  await rm(join(root, 'projects/demo/AGENTS.md'));
  await put('projects/Bad/README.md', '');
  await put('projects/stray.txt', '');
  await put('.github/dependabot.yml', 'version: 2\nupdates: []\n');
  const failures = (await checkProjects(root)).failures.join('\n');
  for (const expected of ['PROJECT_MANIFEST_NAME', 'PROJECT_MANIFEST_TITLE', 'PROJECT_PROTOTYPE_MISSING: docs/concepts/missing', 'prototypes[1].path', 'prototypes[2].path', 'PROJECT_ORIGIN_STARTER',
    'missing AGENTS.md', 'declares workspaces', 'dependencies.shell points outside', 'dependencies.local points outside', 'tsconfig.build.json extends', 'PROJECT_NAME: projects/Bad', 'PROJECT_NOT_A_FOLDER: projects/stray.txt', 'PROJECT_DEPENDABOT_MISSING']) {
    assert.ok(failures.includes(expected), `${expected} in\n${failures}`);
  }
  await rm(join(root, 'projects/demo/workbench.project.json'));
  assert.match((await checkProjects(root)).failures.join('\n'), /PROJECT_MANIFEST_MISSING: projects\/demo\/workbench\.project\.json/);
});

const FEATURES_BASE = 'filters: file.inFolder("Features")\nviews:\n  - type: cards\n    name: Cards\n    order: [file.name, summary]\n';
const siteManifest = site => JSON.stringify({ schemaVersion: 1, name: 'demo', title: 'Demo', prototypes: [], site });
const featuresEntry = { name: 'features', base: 'vault/Site/Features.base', view: 'Cards', vault: 'vault' };
const snapshotCollections = root => executeOperation({ command: 'site collections', args: ['projects/demo'], options: { yes: true } }, { root, frameworkRoot: repository });

test('[PROJECTS-12] a site project may list no prototype but needs a known template and valid Bases collections whose .base exists', async t => {
  const { root, put } = await fixture(t);
  await syncWorkflows(root);
  await put('vault/Site/Features.base', FEATURES_BASE);
  await put('vault/Features/Search.md', '---\nsummary: Finds notes\n---\n');
  await put('projects/demo/workbench.project.json', siteManifest({ template: 'product-page', collections: [featuresEntry] }));
  assert.equal((await snapshotCollections(root)).status, 'applied');
  const passed = await checkProjects(root);
  assert.equal(passed.status, 'passed', passed.failures.join('\n'));
  assert.deepEqual(passed.projects[0], { name: 'demo', title: 'Demo', prototypes: [], site: 'product-page', workflows: ['ci.yml'] });
  await put('projects/demo/workbench.project.json', siteManifest({ template: 'blog', collections: [{ name: 'Features', base: 'vault/Site/Missing.base', view: '' }, { name: 'faq', base: 'faq.md', view: 'All' }, { name: 'faq', base: '../x.base', view: 'All' }] }));
  const failures = (await checkProjects(root)).failures.join('\n');
  for (const expected of ['SITE_TEMPLATE: site.template must be one of product-page, project-page, documentation', 'site.collections[0].name', 'site.collections[0].view', 'SITE_COLLECTION_BASE_MISSING: vault/Site/Missing.base',
    'site.collections[1].base must be a normalized repository path ending in .base', 'site.collections[2].base', 'SITE_COLLECTION_DUPLICATE: site.collections[2].name "faq"'])
    assert.ok(failures.includes(expected), `${expected} in\n${failures}`);
  await put('projects/demo/workbench.project.json', siteManifest('product-page'));
  assert.match((await checkProjects(root)).failures.join('\n'), /SITE_MANIFEST: site must be an object/);
  await put('projects/demo/workbench.project.json', JSON.stringify({ schemaVersion: 1, name: 'demo', title: 'Demo', prototypes: 'none', site: { template: 'documentation', collections: [] } }));
  assert.match((await checkProjects(root)).failures.join('\n'), /PROJECT_MANIFEST_PROTOTYPES: prototypes must be a list/);
  await put('projects/demo/workbench.project.json', JSON.stringify({ schemaVersion: 1, name: 'demo', title: 'Demo', prototypes: [] }));
  assert.match((await checkProjects(root)).failures.join('\n'), /PROJECT_MANIFEST_PROTOTYPES: list at least one prototype/, 'a non-site project still implements a prototype');
});

test('[PROJECTS-14] each listed collection needs a readable .base with its view and a current, untouched snapshot; orphans fail', async t => {
  const { root, put } = await fixture(t);
  await syncWorkflows(root);
  const failures = async () => (await checkProjects(root)).failures.join('\n');
  const snapshot = 'projects/demo/src/data/collections/features.collection.json', fix = 'run node bin/app site collections projects/demo --yes';
  await put('vault/Features/Search.md', '---\nsummary: Finds notes\n---\n');
  await put('projects/demo/workbench.project.json', siteManifest({ template: 'product-page', collections: [featuresEntry] }));
  await put('vault/Site/Features.base', 'views: []\n');
  assert.match(await failures(), /SITE_COLLECTION_BASE_INVALID: collection features \(vault\/Site\/Features\.base\): The \.base file declares no views/);
  await put('vault/Site/Features.base', FEATURES_BASE.replace('Cards', 'Gallery'));
  assert.match(await failures(), /SITE_COLLECTION_VIEW_UNKNOWN: collection features \(vault\/Site\/Features\.base\): No view "Cards"\. Views: Gallery/);
  await put('vault/Site/Features.base', FEATURES_BASE);
  assert.ok((await failures()).includes(`SITE_COLLECTION_MISSING: ${snapshot} does not exist; ${fix}`));
  await put(snapshot, '{"records": []}\n');
  assert.ok((await failures()).includes(`SITE_COLLECTION_MISSING: ${snapshot} was not written by node bin/app site collections; move it out of`));
  await rm(join(root, snapshot));
  assert.equal((await snapshotCollections(root)).status, 'applied');
  assert.equal((await checkProjects(root)).status, 'passed');
  await put('vault/Site/Features.base', `${FEATURES_BASE}# edited\n`);
  assert.ok((await failures()).includes(`SITE_COLLECTION_STALE: ${snapshot} was made from another version of vault/Site/Features.base or another view; ${fix}`));
  assert.equal((await snapshotCollections(root)).status, 'applied');
  const text = await readFile(join(root, snapshot), 'utf8');
  await put(snapshot, text.replace('Finds notes', 'Finds everything'));
  assert.match(await failures(), /SITE_COLLECTION_EDITED: .*features\.collection\.json was edited by hand/);
  await put(snapshot, text);
  await put('projects/demo/src/data/collections/old.collection.json', text);
  await put('projects/demo/src/data/collections/old.json', JSON.stringify({ schemaVersion: 1, generatedBy: 'node bin/app site collections', records: [] }));
  await put('projects/demo/src/data/collections/stray.collection.json', '{}');
  await put('projects/demo/src/data/collections/notes.json', '{}');
  const orphans = await failures();
  for (const name of ['old.collection.json', 'old.json', 'stray.collection.json']) assert.match(orphans, new RegExp(`SITE_COLLECTION_ORPHAN: projects/demo/src/data/collections/${name.replace('.', '\\.')} belongs to no listed collection`));
  assert.doesNotMatch(orphans, /notes\.json/, 'a file the site never loads is not an orphan');
  await rm(join(root, 'projects/demo/src/data/collections/stray.collection.json'));
  assert.equal((await snapshotCollections(root)).status, 'applied', 'site collections removes its own orphans');
  const passed = await checkProjects(root);
  assert.equal(passed.status, 'passed', passed.failures.join('\n'));
});

test('[PROJECTS-13] a site rendered by site new meets the projects contract, including the synced workflow security floor', async t => {
  const root = await mkdtemp(join(tmpdir(), 'projects-site-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  const created = await executeOperation({ command: 'site new', args: ['projects/acme'], options: { template: 'project-page', yes: true } }, { root, frameworkRoot: repository });
  assert.equal(created.status, 'applied');
  await put('.github/workflows/shell.yml', "name: Shell\non:\n  pull_request:\n    paths-ignore: ['projects/**']\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n");
  await put('.github/dependabot.yml', 'version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /projects/acme\n    schedule:\n      interval: weekly\n');
  assert.deepEqual((await syncWorkflows(root)).written, ['projects--acme--ci.yml']);
  const checked = await checkProjects(root);
  assert.equal(checked.status, 'passed', checked.failures.join('\n'));
  assert.deepEqual(checked.projects, [{ name: 'acme', title: 'Acme', prototypes: [], site: 'project-page', workflows: ['ci.yml'] }]);
  assert.equal(inspectWorkflow(await readFile(join(root, '.github/workflows/projects--acme--ci.yml'), 'utf8')).jobs, 1);
});

test('[PROJECTS-09] sync refuses to write anything while one project workflow cannot be scoped', async t => {
  const { root, put } = await fixture(t);
  await put('projects/demo/.github/workflows/bad.yml', workflow('      - uses: ./.github/actions/x\n'));
  const result = await syncWorkflows(root);
  assert.equal(result.status, 'failed');
  assert.match(result.failures.join('\n'), /bad\.yml: PROJECT_WORKFLOW_LOCAL_ACTION/);
  assert.deepEqual((await readdir(join(root, '.github/workflows'))).sort(), ['shell.yml']);
});

test('[PROJECTS-10] this checkout: every project is standalone, linked to its prototypes and synced, and every shell workflow is isolated', async () => {
  const result = await checkProjects(repository);
  assert.equal(result.status, 'passed', result.failures.join('\n'));
  // Source archives export-ignore projects/ (.gitattributes); there the shell must still pass with no projects at all.
  const archived = !existsSync(join(repository, 'projects', 'companion'));
  assert.equal(archived || result.projects.some(project => project.name === 'companion' && project.prototypes.includes('docs/concepts/companion')), true);
  if (archived) assert.deepEqual([result.projects, result.syncedWorkflows], [[], []]);
});

test('[PROJECTS-11] the projects tooling, boundary workflow and synced copies never reach a framework kit or a generated project', () => {
  for (const path of ['scripts/projects/projects.mjs', 'scripts/projects/workflows.mjs', 'tests/tooling/projects-boundary.checks.mjs', '.github/workflows/projects-boundary.yml', '.github/workflows/projects-required-checks.yml',
    '.github/workflows/projects--companion--ci.yml',
    '.github/workflows/site-templates.yml', 'scripts/testing/qualify-site-templates.mjs', 'tests/tooling/site-templates-qualification.checks.mjs', 'tests/fixtures/sites/vault/Site/Features.base']) {
    assert.equal(included(path), false, `kit: ${path}`);
    assert.equal(maintainerOnly(path), true, `generated project: ${path}`);
  }
  assert.equal(included('.github/workflows/project-starter-qualification.yml'), true, 'a shell workflow named project-* is not a synced copy');
  assert.equal(included('templates/sites/catalog.json'), true, 'the site templates themselves ship with the site commands');
});

test('[PROJECTS-15] a .base edit re-runs the boundary check, so a stale site snapshot fails in CI', async () => {
  const on = parse(await readFile(join(repository, '.github/workflows/projects-boundary.yml'), 'utf8')).on;
  for (const event of ['pull_request', 'push']) assert.ok(on[event].paths.includes('**/*.base'), event);
});

test('[PROJECTS-REQUIRED-01] a projects-only pull request reports the required checks; a mixed one only under another name', async t => {
  const text = await readFile(join(repository, '.github/workflows/projects-required-checks.yml'), 'utf8'), data = parse(text);
  inspectWorkflow(text, 'projects-required-checks.yml');
  assert.deepEqual(data.on.pull_request.paths, ['projects/**']);
  const release = parse(await readFile(join(repository, '.github/workflows/release.yml'), 'utf8'));
  const required = ['dev-checks', 'definition-of-ready', 'ci-result', 'definition-of-done'].map(id => release.jobs[id].name);
  assert.deepEqual(data.jobs.report.strategy.matrix.check, required, 'the same four checks main requires');
  assert.equal(data.jobs.report.name, "${{ needs.scope.outputs.projects-only == 'true' && matrix.check || format('{0} (shell changes)', matrix.check) }}");
  const script = data.jobs.scope.steps.find(step => step.id === 'scope').run;
  const root = await mkdtemp(join(tmpdir(), 'projects-required-')); t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd: root, encoding: 'utf8' }).trim();
  const put = async (path, body) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), body); };
  git('init', '--quiet', '--initial-branch=main'); await put('src/a.ts', 'a\n'); await put('projects/demo/a.ts', 'a\n'); git('add', '-A'); git('commit', '--quiet', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const scope = head => {
    const output = join(root, `out-${head}`);
    execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script], { cwd: root, env: { ...process.env, BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: output } });
    return execFileSync('cat', [output], { encoding: 'utf8' }).trim();
  };
  await put('projects/demo/a.ts', 'b\n'); git('commit', '--quiet', '-am', 'project only');
  assert.equal(scope(git('rev-parse', 'HEAD')), 'projects-only=true');
  await put('src/a.ts', 'b\n'); git('commit', '--quiet', '-am', 'shell too');
  assert.equal(scope(git('rev-parse', 'HEAD')), 'projects-only=false');
  assert.equal(scope(base), 'projects-only=false', 'an empty diff is not projects-only');
});
