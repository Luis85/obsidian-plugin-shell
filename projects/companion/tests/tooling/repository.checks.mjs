import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkflow, inspectCompositeAction, inspectOwnedCss, markdownLinks, checkRepository } from '../../scripts/quality/check-repository.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  assert.deepEqual(inspectWorkflow(workflow), { jobs: 1, localActions: [] });
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
  assert.deepEqual(inspectWorkflow(withLocal), { jobs: 1, localActions: ['setup-qualified'] });
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
  for (const path of ['.github/workflows', 'src/styles']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), withLocal);
  await writeFile(join(root, 'src/styles/owned.css'), '.owned { color: red; }');
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
  for (const path of ['.github/workflows', 'src/styles', 'docs']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), workflow);
  await writeFile(join(root, 'src/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n\n[Guide](docs/guide.md)\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  assert.equal((await checkRepository(root)).localLinks, 1);
  await writeFile(join(root, 'README.md'), '# Readme\n\n[Missing](docs/missing.md)\n');
  await assert.rejects(checkRepository(root), /MARKDOWN_MISSING_LOCAL_LINK/);
});
test('repository checker leaves the docs working directory out of the Markdown gate', async t => {
  const root = await mkdtemp(join(tmpdir(), 'repository-docs-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ['.github/workflows', 'src/styles', 'docs/concepts/draft']) await mkdir(join(root, path), { recursive: true });
  await writeFile(join(root, '.github/workflows/check.yml'), workflow);
  await writeFile(join(root, 'src/styles/owned.css'), '.owned { color: red; }');
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await writeFile(join(root, 'docs/concepts/draft/notes.md'), '# Draft\n\n[Moved](gone.md)\n\n```js\nunclosed\n');
  const result = await checkRepository(root); assert.equal(result.markdown, 1); assert.equal(result.localLinks, 0);
});
