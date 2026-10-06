import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILE_PLAN_PROTECTED_ROOTS, PROTECTED_PROJECT_SEGMENTS, RESERVED_FOLDER_NAMES, isProtectedSegment } from '#shared/platform/protected-directories.ts';
import { hasProtectedProjectRoot } from '#shared/platform/project-path.ts';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { portablePath as starterPath } from '../adapters/starters/validation.ts';
import { loadHandoutWorkspace } from '../adapters/framework/handout-workspace.ts';
import { packStarterOperation } from '../adapters/starters/operations.ts';
import { packKit } from '../adapters/framework/kit.ts';
import { configuration } from '../adapters/framework/configuration.ts';
import { readSettings } from '../domain/user-settings.ts';
import { PROTECTED_ROOTS } from '../documentation/adapters/settings.ts';

const frameworkRoot = fileURLToPath(new URL('../../../', import.meta.url));
const failureCode = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code ?? error.message; } };
const upper = name => name.toUpperCase();

test('protected directory sets are case-folded compositions of one base', () => {
  for (const set of [PROTECTED_PROJECT_SEGMENTS, RESERVED_FOLDER_NAMES, FILE_PLAN_PROTECTED_ROOTS]) {
    assert.ok(Object.isFrozen(set));
    assert.deepEqual(set, [...new Set(set.map(name => name.toLowerCase()))]);
  }
  assert.ok(RESERVED_FOLDER_NAMES.every(name => PROTECTED_PROJECT_SEGMENTS.includes(name)));
  assert.ok(FILE_PLAN_PROTECTED_ROOTS.every(name => PROTECTED_PROJECT_SEGMENTS.includes(name)));
  for (const name of ['.git', 'node_modules', '.framework', '.companion', '.workbench', '.obsidian', '.test-vault', '.dev-vault', '.qualification']) {
    assert.equal(isProtectedSegment(upper(name)), true, name);
  }
  // Reviewed file plans write ownership records, host configuration and the test vault on purpose.
  for (const name of ['.framework', '.companion', '.obsidian', '.test-vault']) assert.equal(isProtectedSegment(name, FILE_PLAN_PROTECTED_ROOTS), false, name);
  assert.ok(PROTECTED_PROJECT_SEGMENTS.every(name => PROTECTED_ROOTS.includes(name)));
});

test('every path consumer refuses every protected segment, whatever its case', async () => {
  for (const name of PROTECTED_PROJECT_SEGMENTS) {
    for (const segment of [name, upper(name)]) {
      assert.equal(hasProtectedProjectRoot(segment + '/file.json'), true, segment);
      assert.equal(starterPath('nested/' + segment + '/file.txt'), false, segment);
      await assert.rejects(loadHandoutWorkspace(frameworkRoot, { prds: 'docs/' + segment + '/prds' }), /protected folders/, segment);
      assert.throws(() => readSettings({ schemaVersion: 1, paths: { project: segment + '/project.json' } }), undefined, segment);
    }
  }
  for (const name of FILE_PLAN_PROTECTED_ROOTS) await assert.rejects(createFilePlan(frameworkRoot, [{ path: upper(name) + '/x', content: 'x' }]), /PLAN_PROTECTED_PATH/);
});

test('folder-name settings refuse reserved names but keep the conventional vault and host folders', () => {
  const project = { id: 'probe-plugin', name: 'Probe', author: 'Example', version: '1.0.0', description: '' };
  const config = paths => configuration({ schemaVersion: 1, project, paths: { codebaseFolder: 'src', testsFolder: 'tests', testVaultFolder: '.test-vault', configDirectory: '.obsidian', ...paths } });
  assert.equal(config({}).paths.testVaultFolder, '.test-vault');
  for (const name of RESERVED_FOLDER_NAMES.filter(entry => /^\.[a-z0-9_-]+$/.test(entry))) {
    assert.throws(() => config({ testVaultFolder: upper(name) }), /test-vault/, name);
    assert.throws(() => config({ configDirectory: name }), /configuration directory/, name);
    assert.throws(() => readSettings({ schemaVersion: 1, preferences: { vaultConfigDirectory: name } }), /vault configuration directory/, name);
  }
  assert.equal(readSettings({ schemaVersion: 1, preferences: { vaultConfigDirectory: '.obsidian' } }).preferences.vaultConfigDirectory, '.obsidian');
});

test('starter and kit archives refuse the same protected folders, including host and ownership folders', async t => {
  const root = await mkdtemp(join(tmpdir(), 'protected-archives-')); t.after(() => rm(root, { recursive: true, force: true }));
  const request = out => ({ command: 'starters pack', args: [], options: { out, yes: true } });
  for (const name of ['.companion', '.test-vault', '.OBSIDIAN', '.workbench']) {
    assert.equal(await failureCode(packStarterOperation(request(name + '/starters.zip'), { root, frameworkRoot })), 'STARTER_PATH', name);
    assert.equal(await failureCode(packKit({ root, frameworkRoot }, name + '/kit.zip')), 'KIT_OUTPUT_PATH', name);
  }
  assert.deepEqual(await readdir(root), []);
});
