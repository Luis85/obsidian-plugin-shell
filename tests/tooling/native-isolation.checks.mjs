import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { nativeScratch, nativeConfigDirectory, assertNativeVault } from '../../scripts/testing/native-isolation.mjs';
test('[NATIVE-ISOLATION-01] vault scratch remains inside its codebase and returned-vault mismatch fails', async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-codebase-')); t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = await realpath(root);
  const scratch = await nativeScratch(root); assert.ok(relative(canonical, scratch).startsWith(`.native-cache${sep}qualification${sep}run-`));
  const vault = join(scratch, 'vault'); await mkdir(vault); await assertNativeVault(vault, vault);
  await assert.rejects(assertNativeVault(undefined, vault), /UNSAFE_NATIVE_VAULT/);
  await assert.rejects(assertNativeVault(root, vault), /UNSAFE_NATIVE_VAULT/);
});
test('[NATIVE-ISOLATION-03] Windows case aliases produce canonical requested vault paths', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-case-')); t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = await realpath(root); const scratch = await nativeScratch(canonical.toUpperCase());
  assert.equal(scratch, await realpath(scratch)); assert.ok(relative(canonical, scratch).startsWith(`.native-cache${sep}`));
  const vault = join(scratch, 'vault'); await mkdir(vault); await assertNativeVault(vault, vault);
});
test('[NATIVE-ISOLATION-02] recursive configuration cleanup accepts only the launcher temporary-directory contract', async t => {
  const config = await mkdtemp(join(tmpdir(), 'obsidian-launcher-config-')); t.after(() => rm(config, { recursive: true, force: true }));
  assert.equal(await nativeConfigDirectory(config), config);
  await assert.rejects(nativeConfigDirectory(tmpdir()), /UNSAFE_NATIVE_CONFIG/);
  await assert.rejects(nativeConfigDirectory(process.cwd()), /UNSAFE_NATIVE_CONFIG/);
  const nested = join(config, 'obsidian-launcher-config-nested'); await mkdir(nested);
  await assert.rejects(nativeConfigDirectory(nested), /UNSAFE_NATIVE_CONFIG/);
});
