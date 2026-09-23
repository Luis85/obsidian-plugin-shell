import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeIdentity, readNativeIdentity } from '../../scripts/testing/native-identity.mjs';
const manifest = { id: 'plugin-shell', name: 'Plugin Shell', version: '0.3.0' };
test('[NATIVE-ID-01] native qualification derives paths/selectors and literal settings matching from candidate identity', () => {
  const original = nativeIdentity(manifest);
  assert.equal(original.pluginDirectory, '.obsidian/plugins/plugin-shell');
  assert.equal(original.viewSelector, '.workspace-leaf-content[data-type="plugin-shell-showcase"]');
  assert.equal(original.headerMarker, 'plugin-shell-native-header-hidden');
  assert.ok(original.settingsName.test('Plugin shell'));
  const renamed = nativeIdentity({ id: 'research-notes', name: 'Research [Notes].* + (ä) $|? @ {}\\', version: '2.3.4' });
  assert.equal(renamed.id, 'research-notes'); assert.equal(renamed.version, '2.3.4');
  assert.equal(renamed.pluginDirectory, '.obsidian/plugins/research-notes');
  assert.equal(renamed.viewType, 'research-notes-showcase'); assert.equal(renamed.headerMarker, 'research-notes-native-header-hidden');
  assert.ok(renamed.settingsName.test(renamed.name)); assert.equal(renamed.settingsName.test(`${renamed.name} extra`), false);
  assert.equal(renamed.settingsName.test('Research Notes anything'), false); assert.ok(Object.isFrozen(renamed));
});
test('[NATIVE-ID-02] malformed identity cannot escape vault-relative paths or inject selectors', () => {
  for (const value of [null, [], 'name']) assert.throws(() => nativeIdentity(value), /NATIVE_MANIFEST_INVALID/);
  for (const id of ['', '../escape', 'C:/absolute', 'name/path', 'name\\path', 'name"].other', 'UPPER', 'con', 'lpt1', 'x'.repeat(65)]) {
    assert.throws(() => nativeIdentity({ ...manifest, id }), /NATIVE_MANIFEST_ID/);
  }
  for (const name of ['', ' padded ', 'line\nbreak', 'control\u007f', 'x'.repeat(81), null]) {
    assert.throws(() => nativeIdentity({ ...manifest, name }), /NATIVE_MANIFEST_NAME/);
  }
  for (const version of ['', '01.2.3', '1.2', '1.2.3-beta', null]) assert.throws(() => nativeIdentity({ ...manifest, version }), /NATIVE_MANIFEST_VERSION/);
});
test('[NATIVE-ID-03] candidate manifest reader is read-only and rejects missing/malformed JSON', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'native-identity-')); const path = join(directory, 'manifest.json');
  try {
    const bytes = JSON.stringify({ ...manifest, id: 'renamed-example' }); await writeFile(path, bytes);
    assert.equal((await readNativeIdentity(path)).id, 'renamed-example'); assert.equal(await readFile(path, 'utf8'), bytes);
    assert.deepEqual(await readdir(directory), ['manifest.json']);
    await writeFile(path, '{'); await assert.rejects(readNativeIdentity(path), SyntaxError);
    await assert.rejects(readNativeIdentity(join(directory, 'missing.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
