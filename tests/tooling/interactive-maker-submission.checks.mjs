import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { manifestRules, versionsRule, lintRule, submissionCheck } from '../../src/cli/adapters/framework/submission.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const valid = {
  id: 'quick-capture',
  name: 'Quick Capture',
  version: '1.0.0',
  minAppVersion: '1.5.0',
  description: "Capture a thought into today's note with one command.",
  author: 'Example Author',
  isDesktopOnly: false,
};
const failed = rules => rules.filter(item => item.status === 'fail').map(item => item.id);
const status = (rules, id) => rules.find(item => item.id === id)?.status;

test('relocated submission adapter preserves compatibility identity and manifest policy', () => {

  assert.deepEqual(failed(manifestRules(JSON.stringify(valid))), []);
  const cases = [
    [null, 'manifest-json'],
    ['{broken', 'manifest-json'],
    [{ ...valid, author: '' }, 'manifest-required-fields'],
    [{ ...valid, helpUrl: 'https://example.com' }, 'manifest-allowed-fields'],
    [{ ...valid, id: 'Quick_Capture' }, 'id-format'],
    [{ ...valid, id: 'capture-plugin' }, 'id-forbidden-words'],
    [{ ...valid, name: 'Obsidian Capture' }, 'name-forbidden-words'],
    [{ ...valid, version: '1.0' }, 'version-semver'],
    [{ ...valid, minAppVersion: '' }, 'min-app-version'],
    [{ ...valid, description: 'Short.' }, 'description-format'],
    [{ ...valid, fundingUrl: '' }, 'funding-url'],
  ];
  for (const [value, expected] of cases) {
    const text = value === null || typeof value === 'string' ? value : JSON.stringify(value);
    assert.ok(failed(manifestRules(text)).includes(expected), expected);
  }
  assert.equal(status(manifestRules(JSON.stringify({ ...valid, minAppVersion: '1.5' })), 'min-app-version'), 'warn');
  assert.equal(status(manifestRules(JSON.stringify({ ...valid, id: 'capture2' })), 'id-format'), 'warn');
});

test('relocated submission adapter preserves versions and lint summaries', () => {
  const manifest = JSON.stringify(valid);
  assert.equal(versionsRule(manifest, JSON.stringify({ '1.0.0': '1.5.0' })).status, 'pass');
  for (const versions of [null, '[]', JSON.stringify({ '1.0.0': '1.4.0' }), JSON.stringify({ '1.0.0': 1 }), '{broken']) {
    assert.equal(versionsRule(manifest, versions).status, 'fail');
  }

  assert.equal(lintRule([{ filePath: '/p/src/a.ts', messages: [] }], '/p').status, 'pass');
  const lint = lintRule([
    { filePath: '/p/src/a.ts', messages: [
      { ruleId: 'obsidianmd/no-static-styles-assignment', severity: 2, line: 4 },
      { ruleId: 'obsidianmd/no-static-styles-assignment', severity: 2, line: 9 },
    ] },
    { filePath: '/p/src/b.ts', messages: [{ ruleId: '@typescript-eslint/no-floating-promises', severity: 2, line: 1 }] },
  ], '/p');
  assert.equal(lint.status, 'fail');
  assert.match(lint.message, /3 ESLint problems \(2 from obsidianmd rules\)/);
  assert.equal(lintRule(null, '/p', 'ESLint is not installed.').remediation, 'Install dependencies: node bin/app install --yes');
});

test('relocated submission check is read-only and dry-run never executes project tooling', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maker-submission-')));
  try {
    await writeFile(join(root, 'manifest.json'), JSON.stringify(valid));
    await writeFile(join(root, 'versions.json'), JSON.stringify({ '1.0.0': '1.5.0' }));
    await writeFile(join(root, 'LICENSE'), 'MIT');
    await writeFile(join(root, 'README.md'), '# Quick Capture');
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/main.js'), 'module.exports = {};');
    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify(valid));

    const dry = await submissionCheck({ root, frameworkRoot }, true);
    assert.equal(dry.status, 'planned');
    assert.equal(dry.data.execution, 'not-run');

    const before = (await readdir(root, { recursive: true })).sort();
    const result = await submissionCheck({ root, frameworkRoot });
    assert.equal(result.status, 'blocked');
    assert.equal(result.data.readOnly, true);
    assert.deepEqual(failed(result.data.rules), ['eslint-obsidianmd']);
    assert.equal(status(result.data.rules, 'build-artifacts'), 'pass');
    assert.equal(status(result.data.rules, 'build-styles'), 'warn');
    assert.equal(result.diagnostics[0].code, 'SUBMISSION_RULES_FAILED');
    assert.equal(result.diagnostics[0].next, 'Install dependencies: node bin/app install --yes');
    assert.deepEqual((await readdir(root, { recursive: true })).sort(), before);

    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ ...valid, version: '0.9.0' }));
    const mismatched = await submissionCheck({ root, frameworkRoot });
    assert.equal(status(mismatched.data.rules, 'build-artifacts'), 'fail');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
