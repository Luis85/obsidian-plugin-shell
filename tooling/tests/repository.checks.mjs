import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkflow, inspectCompositeAction, inspectOwnedCss, markdownLinks, checkRepository } from '../quality/check-repository.mjs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

const workflow = `name: Check
on: pull_request
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${'a'.repeat(40)}
        with:
          persist-credentials: false
      - run: node scripts/check.mjs
`;
test('workflow checker accepts pinned read-only job and rejects unsafe or malformed variants', () => {
  assert.deepEqual(inspectWorkflow(workflow), { jobs: 1, localActions: [], localWorkflows: [], callable: false });
  assert.throws(() => inspectWorkflow(workflow.replace('contents: read', 'contents: write')), /PERMISSIONS_NOT_READ_ONLY/);
  assert.throws(() => inspectWorkflow(workflow.replace('on: pull_request', 'on: pull_request_target')), /PRIVILEGED_PR_TRIGGER/);
  assert.throws(() => inspectWorkflow(workflow.replace('a'.repeat(40), 'v7')), /ACTION_NOT_PINNED/);
  assert.throws(() => inspectWorkflow(workflow.replace('persist-credentials: false', 'persist-credentials: true')), /PERSISTED_CREDENTIALS/);
  assert.throws(() => inspectWorkflow(workflow.replace('node scripts/check.mjs', 'echo ${{ inputs.source_commit }}')), /UNTRUSTED_SHELL_INTERPOLATION/);
  assert.throws(() => inspectWorkflow(workflow + 'jobs: {}'), /YAML_INVALID/);
  assert.throws(() => inspectWorkflow('name: ['), /YAML_INVALID/);
  assert.throws(() => inspectWorkflow(workflow.replace('runs-on: ubuntu-latest', 'wrong-runner: ubuntu-latest')), /JOB_INVALID/);
});
const composite = `name: Setup
description: Local setup
runs:
  using: composite
  steps:
    - uses: actions/setup-node@${'b'.repeat(40)}
      with:
        node-version-file: .nvmrc
    - name: Install
      shell: bash
      env:
        FLAGS: \${{ inputs.flags }}
      run: echo "$FLAGS"
`;
const withLocal = workflow.replace('      - run: node scripts/check.mjs', '      - uses: ./.github/actions/setup-qualified\n      - run: node scripts/check.mjs');
test('repository-local composite actions are referenced by exact name and inspected for their own pins', () => {
  assert.deepEqual(inspectWorkflow(withLocal), { jobs: 1, localActions: ['setup-qualified'], localWorkflows: [], callable: false });
  for (const reference of ['./.github/actions/../workflows/x', './scripts/setup', '.github/actions/setup-qualified', './.github/actions/Setup', './.github/actions/setup-qualified@main']) {
    assert.throws(() => inspectWorkflow(withLocal.replace('./.github/actions/setup-qualified', reference)), /ACTION_NOT_PINNED/, reference);
  }
  assert.deepEqual(inspectCompositeAction(composite), { steps: 2 });
  assert.throws(() => inspectCompositeAction(composite.replace('b'.repeat(40), 'v7')), /ACTION_NOT_PINNED/);
  assert.throws(() => inspectCompositeAction(composite.replace('using: composite', 'using: node24')), /NOT_COMPOSITE/);
  assert.throws(() => inspectCompositeAction(composite.replace('      shell: bash\n', '')), /ACTION_STEP_INVALID/);
  assert.throws(() => inspectCompositeAction(composite.replace('run: echo "$FLAGS"', 'run: echo ${{ inputs.flags }}')), /UNTRUSTED_SHELL_INTERPOLATION/);
  assert.throws(() => inspectCompositeAction(composite.replace('setup-node@', 'checkout@').replace('node-version-file: .nvmrc', 'persist-credentials: true')), /PERSISTED_CREDENTIALS/);
  assert.throws(() => inspectCompositeAction(composite + 'runs: {}\n'), /ACTION_YAML_INVALID/);
});
test('repository checker inspects local actions and rejects a reference without one', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-actions-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), withLocal);
  await writeFile(join(root, 'src/plugin/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await assert.rejects(checkRepository(root), /WORKFLOW_LOCAL_ACTION_MISSING: setup-qualified/);
  await mkdir(join(root, '.github/actions/setup-qualified'), { recursive: true });
  await writeFile(join(root, '.github/actions/setup-qualified/action.yml'), composite.replace('b'.repeat(40), 'main'));
  await assert.rejects(checkRepository(root), /setup-qualified.action\.yml: WORKFLOW_ACTION_NOT_PINNED/);
  await writeFile(join(root, '.github/actions/setup-qualified/action.yml'), composite);
  assert.equal((await checkRepository(root)).actions, 1);
});
test('owned CSS syntax and selector checks detect invalid or broad inputs', () => {
  assert.equal(inspectOwnedCss('.owned { color: var(--text-normal); }').declarations, 1);
  assert.equal(inspectOwnedCss('@media (width > 30px) { [data-plugin-ui="fixture"] button { color: red; } }').declarations, 1);
  assert.throws(() => inspectOwnedCss('.owned { color red; }'), /Unknown word/);
  assert.throws(() => inspectOwnedCss('.owned { color: ; }'), /EMPTY_DECLARATION/);
  assert.throws(() => inspectOwnedCss('body { color: red; }'), /UNOWNED_SELECTOR/);
  assert.throws(() => inspectOwnedCss('.owned, * { color: red; }'), /UNOWNED_SELECTOR/);
});
test('Markdown policy ignores examples and remote links but rejects incomplete fences', () => {
  assert.deepEqual(markdownLinks('[Local](../README.md#part) [Remote](https://example.invalid)\n```md\n[Example](missing.md)\n```\n`[literal](missing.md)`'), ['../README.md']);
  assert.deepEqual(markdownLinks('[spaced](<a%20b.md>)'), ['a b.md']);
  assert.throws(() => markdownLinks('```js\nunclosed'), /UNCLOSED_FENCE/);
});
test('repository checker discovers actual files and fails on a missing local document target', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-policy-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles', 'docs']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), workflow);
  await writeFile(join(root, 'src/plugin/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n\n[Guide](docs/guide.md)\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  assert.equal((await checkRepository(root)).localLinks, 1);
  await writeFile(join(root, 'README.md'), '# Readme\n\n[Missing](docs/missing.md)\n');
  await assert.rejects(checkRepository(root), /MARKDOWN_MISSING_LOCAL_LINK/);
});
test('repository checker leaves the docs working directory out of the Markdown gate', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-docs-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles', 'docs/concepts/draft']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), workflow);
  await writeFile(join(root, 'src/plugin/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await writeFile(join(root, 'docs/concepts/draft/notes.md'), '# Draft\n\n[Moved](gone.md)\n\n```js\nunclosed\n');
  const result = await checkRepository(root); assert.equal(result.markdown, 1); assert.equal(result.localLinks, 0);
});
const dispatched = workflow.replace('on: pull_request', 'on:\n  workflow_dispatch:\n    inputs:\n      version:\n        type: string')
  .replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    environment: release\n    permissions:\n      contents: write\n      pull-requests: write');
test('only the allowlisted dispatch-only release workflows may grant write scopes, and only behind the release environment', () => {
  for (const file of ['release-cut.yml', 'publish.yml']) assert.deepEqual(inspectWorkflow(dispatched, file), { jobs: 1, localActions: [], localWorkflows: [], callable: false }, file);
  for (const file of [undefined, 'ci.yml', 'release.yml', 'starter-distribution.yml', 'publish.yaml', 'nested/publish.yml'])
    assert.throws(() => inspectWorkflow(dispatched, file), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/, String(file));
  assert.throws(() => inspectWorkflow(dispatched.replace('permissions:\n  contents: read\njobs', 'permissions:\n  contents: write\njobs'), 'publish.yml'), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
  assert.throws(() => inspectWorkflow(dispatched.replace('contents: write', 'contents: admin'), 'publish.yml'), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
  assert.throws(() => inspectWorkflow(dispatched.replace('    environment: release\n', ''), 'publish.yml'), /PRIVILEGED_JOB_WITHOUT_ENVIRONMENT/);
  assert.throws(() => inspectWorkflow(dispatched.replace('environment: release', 'environment: staging'), 'release-cut.yml'), /PRIVILEGED_JOB_WITHOUT_ENVIRONMENT/);
  assert.doesNotThrow(() => inspectWorkflow(dispatched.replace('environment: release', 'environment:\n      name: release'), 'release-cut.yml'));
  for (const trigger of ['  pull_request:\n', '  push:\n', '  workflow_call:\n', '  schedule:\n    - cron: "1 1 * * 1"\n', '  pull_request_target:\n'])
    assert.throws(() => inspectWorkflow(dispatched.replace('on:\n', `on:\n${trigger}`), 'publish.yml'), /PRIVILEGED_WORKFLOW_TRIGGER_FORBIDDEN/, trigger);
  const caller = 'name: Call\non: workflow_dispatch\npermissions:\n  contents: read\njobs:\n  call:\n    environment: release\n    permissions:\n      contents: write\n    uses: ./.github/workflows/ci.yml\n';
  assert.throws(() => inspectWorkflow(caller, 'publish.yml'), /PRIVILEGED_WORKFLOW_CALL_FORBIDDEN/);
});
test('the shipped release cut and publish workflows pass only under their allowlisted names', async () => {
  for (const file of ['release-cut.yml', 'publish.yml']) {
    const text = await readFile(join(repositoryRoot, '.github/workflows', file), 'utf8');
    assert.equal(inspectWorkflow(text, file).jobs, 1, file);
    assert.throws(() => inspectWorkflow(text, 'release.yml'), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/, file);
    assert.match(text, /VERSION: \$\{\{ inputs\.version \}\}/); assert.match(text, /GH_TOKEN: \$\{\{ secrets\.RELEASE_TOKEN \|\| github\.token \}\}/);
  }
  const dev = await readFile(join(repositoryRoot, '.github/workflows/dev.yml'), 'utf8');
  assert.equal(inspectWorkflow(dev, 'dev.yml').jobs, 1);
  assert.match(dev, /name: Dev checks/); assert.match(dev, /types: \[opened, synchronize, reopened, ready_for_review\]/); assert.doesNotMatch(dev, /\n {4}if:/);
});
const reusable = workflow.replace('on: pull_request', 'on:\n  pull_request:\n  workflow_call:\n    inputs:\n      tier:\n        type: string\n        default: integration');
const callerOf = (target, extra = '') => `name: Release\non:\n  push:\n    branches: ['release/**']\npermissions:\n  contents: read\njobs:\n  call:\n    uses: ${target}\n    with:\n      tier: release\n${extra}`;
test('jobs call only exact repository-local workflow files, never with inherited secrets or write scopes', () => {
  assert.deepEqual(inspectWorkflow(callerOf('./.github/workflows/check.yml')), { jobs: 1, localActions: [], localWorkflows: ['check.yml'], callable: false });
  assert.equal(inspectWorkflow(reusable).callable, true);
  for (const target of ['./.github/workflows/../actions/x.yml', './.github/workflows/sub/check.yml', '.github/workflows/check.yml', './.github/workflows/Check.yml', './.github/workflows/check.yml@main', 'owner/repo/.github/workflows/check.yml@main'])
    assert.throws(() => inspectWorkflow(callerOf(target)), /ACTION_NOT_PINNED/, target);
  assert.throws(() => inspectWorkflow(callerOf('./.github/workflows/check.yml', '    secrets: inherit\n')), /WORKFLOW_CALL_SECRETS_FORBIDDEN/);
  assert.throws(() => inspectWorkflow(callerOf('./.github/workflows/check.yml', '    permissions:\n      contents: write\n')), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
  assert.throws(() => inspectWorkflow(withLocal.replace('./.github/actions/setup-qualified', './.github/workflows/check.yml')), /ACTION_NOT_PINNED/, 'a step never calls a workflow');
});
test('repository checker requires each called workflow to exist and declare workflow_call, and keeps every other file read-only', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-calls-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'src/plugin/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await writeFile(join(root, '.github/workflows/release.yml'), callerOf('./.github/workflows/check.yml'));
  await assert.rejects(checkRepository(root), /release\.yml: WORKFLOW_LOCAL_WORKFLOW_MISSING: check\.yml/);
  await writeFile(join(root, '.github/workflows/check.yml'), workflow);
  await assert.rejects(checkRepository(root), /release\.yml: WORKFLOW_LOCAL_WORKFLOW_NOT_CALLABLE: check\.yml/);
  await writeFile(join(root, '.github/workflows/check.yml'), reusable);
  assert.equal((await checkRepository(root)).workflows, 2);
  await writeFile(join(root, '.github/workflows/check.yml'), reusable.replace('contents: read', 'contents: write'));
  await assert.rejects(checkRepository(root), /check\.yml: WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
  await writeFile(join(root, '.github/workflows/check.yml'), reusable);
  await writeFile(join(root, '.github/workflows/publish.yml'), dispatched.replace('on:\n', 'on:\n  pull_request:\n'));
  await assert.rejects(checkRepository(root), /publish\.yml: PRIVILEGED_WORKFLOW_TRIGGER_FORBIDDEN/);
  await writeFile(join(root, '.github/workflows/publish.yml'), dispatched);
  assert.equal((await checkRepository(root)).workflows, 3);
  await writeFile(join(root, '.github/workflows/starter-distribution.yml'), dispatched);
  await assert.rejects(checkRepository(root), /starter-distribution\.yml: WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
});

test('a synced project workflow keeps the portable review but follows its project, not the framework e2e tiers', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-synced-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/plugin/styles']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, 'src/plugin/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n');
  const browser = workflow.replace(/run: .*/, 'run: npm run test:e2e');
  await writeFile(join(root, '.github/workflows/browser.yml'), browser);
  await assert.rejects(checkRepository(root), /browser\.yml: WORKFLOW_E2E_/);
  await rm(join(root, '.github/workflows/browser.yml'));
  await writeFile(join(root, '.github/workflows/projects--demo--ci.yml'), browser);
  assert.equal((await checkRepository(root)).workflows, 1);
  await writeFile(join(root, '.github/workflows/projects--demo--ci.yml'), browser.replace('contents: read', 'contents: write'));
  await assert.rejects(checkRepository(root), /projects--demo--ci\.yml: WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
});
