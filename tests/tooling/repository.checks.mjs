import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkflow, inspectOwnedCss, markdownLinks, checkRepository } from '../../scripts/quality/check-repository.mjs';
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
  assert.deepEqual(inspectWorkflow(workflow), { jobs: 1 });
  assert.throws(() => inspectWorkflow(workflow.replace('contents: read', 'contents: write')), /PERMISSIONS_NOT_READ_ONLY/);
  assert.throws(() => inspectWorkflow(workflow.replace('on: pull_request', 'on: pull_request_target')), /PRIVILEGED_PR_TRIGGER/);
  assert.throws(() => inspectWorkflow(workflow.replace('a'.repeat(40), 'v7')), /ACTION_NOT_PINNED/);
  assert.throws(() => inspectWorkflow(workflow.replace('persist-credentials: false', 'persist-credentials: true')), /PERSISTED_CREDENTIALS/);
  assert.throws(() => inspectWorkflow(workflow.replace('node scripts/check.mjs', 'echo ${{ inputs.source_commit }}')), /UNTRUSTED_SHELL_INTERPOLATION/);
  assert.throws(() => inspectWorkflow(workflow + 'jobs: {}'), /YAML_INVALID/);
  assert.throws(() => inspectWorkflow('name: ['), /YAML_INVALID/);
  assert.throws(() => inspectWorkflow(workflow.replace('runs-on: ubuntu-latest', 'wrong-runner: ubuntu-latest')), /JOB_INVALID/);
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
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n\n[Home](../README.md)\n');
  assert.equal((await checkRepository(root)).localLinks, 1);
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n\n[Missing](missing.md)\n');
  await assert.rejects(checkRepository(root), /MARKDOWN_MISSING_LOCAL_LINK/);
});
