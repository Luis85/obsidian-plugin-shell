import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { manifestRules, versionsRule, lintRule } from '../../scripts/framework/submission.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const valid = { id: 'quick-capture', name: 'Quick Capture', version: '1.0.0', minAppVersion: '1.5.0', description: 'Capture a thought into today\'s note with one command.', author: 'Example Author', isDesktopOnly: false };
const status = (rules, id) => rules.find(item => item.id === id)?.status;
const failing = rules => rules.filter(item => item.status === 'fail').map(item => item.id);
test('a documented-valid manifest passes every manifest rule, each citing an official source', () => {
  const rules = manifestRules(JSON.stringify(valid));
  assert.deepEqual(failing(rules), []);
  assert.ok(rules.every(item => item.status === 'pass'), JSON.stringify(rules));
  assert.ok(rules.every(item => /^https:\/\/(docs\.obsidian\.md|github\.com\/obsidianmd)\//.test(item.source)), 'every rule cites an obsidianmd source');
  const funded = manifestRules(JSON.stringify({ ...valid, authorUrl: 'https://example.com', fundingUrl: { 'Buy me a coffee': 'https://example.com/coffee' } }));
  assert.deepEqual(failing(funded), []);
});
test('each invalid manifest case fails exactly its rule with a remediation', () => {
  const cases = [
    [null, 'manifest-json'], ['[1]', 'manifest-json'], ['{not json', 'manifest-json'],
    [{ ...valid, author: undefined }, 'manifest-required-fields'], [{ ...valid, author: '' }, 'manifest-required-fields'], [{ ...valid, isDesktopOnly: 'no' }, 'manifest-required-fields'],
    [{ ...valid, helpUrl: 'https://example.com' }, 'manifest-allowed-fields'],
    [{ ...valid, id: 'Quick_Capture' }, 'id-format'], [{ ...valid, id: 'quick--capture' }, 'id-format'],
    [{ ...valid, id: 'obsidian-capture' }, 'id-forbidden-words'], [{ ...valid, id: 'capture-plugin' }, 'id-forbidden-words'], [{ ...valid, id: 'plugin-capture' }, 'id-forbidden-words'],
    [{ ...valid, name: 'Obsidian Capture' }, 'name-forbidden-words'], [{ ...valid, name: 'Capture Plugin' }, 'name-forbidden-words'],
    [{ ...valid, version: '1.0' }, 'version-semver'], [{ ...valid, version: 'v1.0.0' }, 'version-semver'],
    [{ ...valid, minAppVersion: '' }, 'min-app-version'],
    [{ ...valid, description: 'Capture a thought into today\'s note' }, 'description-format'], [{ ...valid, description: 'capture a thought quickly.' }, 'description-format'],
    [{ ...valid, description: 'Short.' }, 'description-format'], [{ ...valid, description: `${'A'.repeat(250)}.` }, 'description-format'],
    [{ ...valid, description: 'Capture thoughts: fast and simple.' }, 'description-format'], [{ ...valid, description: 'Capture thoughts inside Obsidian quickly.' }, 'description-format'],
    [{ ...valid, fundingUrl: '' }, 'funding-url'], [{ ...valid, fundingUrl: {} }, 'funding-url'], [{ ...valid, fundingUrl: { Coffee: 3 } }, 'funding-url'],
  ];
  for (const [manifest, expected] of cases) {
    const text = manifest === null || typeof manifest === 'string' ? manifest : JSON.stringify(manifest);
    const rules = manifestRules(text);
    const failed = failing(rules).filter(id => id !== 'manifest-required-fields' || expected === 'manifest-required-fields');
    assert.deepEqual(failed, [expected], `${text}: ${JSON.stringify(rules)}`);
    const rule = rules.find(item => item.id === expected);
    assert.ok(rule.remediation && rule.message, expected);
  }
  assert.equal(status(manifestRules(JSON.stringify({ ...valid, minAppVersion: '1.5' })), 'min-app-version'), 'warn');
  assert.equal(status(manifestRules(JSON.stringify({ ...valid, id: 'capture2' })), 'id-format'), 'warn');
});
test('versions.json must map the manifest version to its minAppVersion', () => {
  const manifest = JSON.stringify(valid);
  assert.equal(versionsRule(manifest, JSON.stringify({ '0.9.0': '1.4.0', '1.0.0': '1.5.0' })).status, 'pass');
  for (const versions of [null, '[]', JSON.stringify({ '1.0.0': '1.4.0' }), JSON.stringify({ '0.9.0': '1.5.0' }), JSON.stringify({ '1.0.0': 1 }), '{broken']) {
    const rule = versionsRule(manifest, versions);
    assert.equal(rule.status, 'fail', String(versions)); assert.match(rule.remediation, /versions\.json/);
  }
});
test('lint results summarize problems by rule, including obsidianmd rules', () => {
  const clean = lintRule([{ filePath: '/p/src/a.ts', messages: [] }], '/p');
  assert.equal(clean.status, 'pass'); assert.match(clean.message, /1 files/);
  const report = [{ filePath: '/p/src/a.ts', messages: [{ ruleId: 'obsidianmd/no-static-styles-assignment', severity: 2, line: 4 }, { ruleId: 'obsidianmd/no-static-styles-assignment', severity: 2, line: 9 }] },
    { filePath: '/p/src/b.ts', messages: [{ ruleId: '@typescript-eslint/no-floating-promises', severity: 2, line: 1 }] }];
  const failed = lintRule(report, '/p');
  assert.equal(failed.status, 'fail');
  assert.match(failed.message, /^3 ESLint problems \(2 from obsidianmd rules\): obsidianmd\/no-static-styles-assignment x2 \(first src\/a\.ts:4\); @typescript-eslint\/no-floating-promises x1/);
  const missing = lintRule(null, '/p', 'ESLint is not installed.');
  assert.equal(missing.status, 'fail'); assert.equal(missing.remediation, 'Install dependencies: node shell.mjs install --yes');
});
test('check submission is read-only and reports per-rule outcomes with remediation', async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'shell-submission-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(valid)); await writeFile(join(dir, 'versions.json'), JSON.stringify({ '1.0.0': '1.5.0' }));
  await writeFile(join(dir, 'LICENSE'), 'MIT'); await writeFile(join(dir, 'README.md'), '# Quick Capture');
  await mkdir(join(dir, 'dist')); await writeFile(join(dir, 'dist/main.js'), 'module.exports = {};'); await writeFile(join(dir, 'dist/manifest.json'), JSON.stringify(valid));
  const before = (await readdir(dir, { recursive: true })).sort();
  const output = spawnSync(process.execPath, [join(root, 'shell.mjs'), 'check', 'submission', '--root', dir, '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(output.status, 1, output.stderr);
  const result = JSON.parse(output.stdout);
  assert.equal(result.status, 'blocked'); assert.equal(result.data.readOnly, true);
  assert.deepEqual(failing(result.data.rules), ['eslint-obsidianmd'], 'only the uninstalled linter fails in this fixture');
  assert.equal(status(result.data.rules, 'build-artifacts'), 'pass'); assert.equal(status(result.data.rules, 'build-styles'), 'warn');
  assert.equal(result.diagnostics[0].code, 'SUBMISSION_RULES_FAILED'); assert.equal(result.diagnostics[0].next, 'Install dependencies: node shell.mjs install --yes');
  assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before, 'nothing was written');
  await writeFile(join(dir, 'dist/manifest.json'), JSON.stringify({ ...valid, version: '0.9.0' }));
  const human = spawnSync(process.execPath, [join(root, 'shell.mjs'), 'check', 'submission', '--root', dir], { encoding: 'utf8', timeout: 60000 });
  assert.equal(human.status, 1);
  assert.match(human.stdout, /^ {2}\[FAIL\] build-artifacts +dist\/manifest\.json id\/version differ from manifest\.json\.$/m);
  assert.match(human.stdout, /^ +fix: Build the release assets: node shell\.mjs build$/m);
  assert.match(human.stdout, /^ {2}\[ok\] {3}license +LICENSE is present\.$/m);
  assert.match(human.stdout, /Local mirror only/);
});
