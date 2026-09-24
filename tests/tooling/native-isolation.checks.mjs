import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, realpath, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { nativeScratch, nativeScratchDirectory, nativeConfigDirectory, assertNativeVault, assertNativeSocketBudget, withNativeTemporaryDirectory } from '../../scripts/testing/native-isolation.mjs';
test('[NATIVE-ISOLATION-01] vault scratch remains inside its codebase and returned-vault mismatch fails', async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-codebase-')); t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = await realpath(root);
  const legacy = join(root, '.native-cache/qualification/run-legacy'); await mkdir(legacy, { recursive: true });
  await writeFile(join(legacy, 'preserved.txt'), 'retained prior attempt');
  const scratch = await nativeScratch(root); assert.match(relative(canonical, scratch).replaceAll(sep, '/'), /^\.nq\/[a-zA-Z0-9]{6}$/);
  assert.equal(await readFile(join(legacy, 'preserved.txt'), 'utf8'), 'retained prior attempt');
  const vault = join(scratch, 'vault'); await mkdir(vault); await assertNativeVault(vault, vault);
  await assert.rejects(assertNativeVault(undefined, vault), /UNSAFE_NATIVE_VAULT/);
  await assert.rejects(assertNativeVault(root, vault), /UNSAFE_NATIVE_VAULT/);
});
test('[NATIVE-ISOLATION-03] Windows case aliases produce canonical requested vault paths', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-case-')); t.after(() => rm(root, { recursive: true, force: true }));
  const canonical = await realpath(root); const scratch = await nativeScratch(canonical.toUpperCase());
  assert.equal(scratch, await realpath(scratch)); assert.ok(relative(canonical, scratch).startsWith(`.nq${sep}`));
  const vault = join(scratch, 'vault'); await mkdir(vault); await assertNativeVault(vault, vault);
});
test('[NATIVE-ISOLATION-02] configuration cleanup accepts only a real direct child of its contained scratch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-config-')); t.after(() => rm(root, { recursive: true, force: true }));
  const scratch = await nativeScratch(root); const config = await mkdtemp(join(scratch, 'obsidian-launcher-config-'));
  assert.equal(await nativeConfigDirectory(config, scratch, root), config);
  await assert.rejects(nativeConfigDirectory(tmpdir(), scratch, root), /UNSAFE_NATIVE_CONFIG/);
  await assert.rejects(nativeConfigDirectory(process.cwd(), scratch, root), /UNSAFE_NATIVE_CONFIG/);
  const outside = await mkdtemp(join(root, 'obsidian-launcher-config-'));
  await assert.rejects(nativeConfigDirectory(outside, scratch, root), /UNSAFE_NATIVE_CONFIG/);
  const nested = join(config, 'obsidian-launcher-config-nested'); await mkdir(nested);
  await assert.rejects(nativeConfigDirectory(nested, scratch, root), /UNSAFE_NATIVE_CONFIG/);
  const file = join(scratch, 'obsidian-launcher-config-file'); await writeFile(file, 'not a directory');
  await assert.rejects(nativeConfigDirectory(file, scratch, root), /UNSAFE_NATIVE_CONFIG/);
  const link = join(scratch, 'obsidian-launcher-config-link'); await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(nativeConfigDirectory(link, scratch, root), /UNSAFE_NATIVE_CONFIG/);
  const alias = join(root, '.nq/ABC123'); await symlink(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(nativeScratchDirectory(alias, root), /UNSAFE_NATIVE_SCRATCH/);
});

const temporaryKeys = ['TMP', 'TEMP', 'TMPDIR'];
const environment = () => temporaryKeys.map(key => [key, process.env[key]]);
test('[NATIVE-ISOLATION-04] scoped temporary roots contain both fresh launcher configs and restore original environment', async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-scoped-')); t.after(() => rm(root, { recursive: true, force: true }));
  const scratch = await nativeScratch(root); const before = environment(); const configs = [];
  for (let index = 0; index < 2; index++) configs.push(await withNativeTemporaryDirectory(scratch, async () => {
    assert.equal(await realpath(tmpdir()), scratch);
    for (const key of temporaryKeys) assert.equal(process.env[key], scratch);
    return mkdtemp(join(tmpdir(), 'obsidian-launcher-config-'));
  }, root));
  assert.notEqual(configs[0], configs[1]);
  for (const config of configs) assert.equal(await nativeConfigDirectory(config, scratch, root), config);
  assert.deepEqual(environment(), before);
  for (const failure of [new Error('actual launch failure'), undefined, null]) {
    let caught = false;
    try { await withNativeTemporaryDirectory(scratch, async () => { throw failure; }, root); }
    catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true); assert.deepEqual(environment(), before);
  }
  assert.equal(await withNativeTemporaryDirectory(scratch, async () => 'fresh scope', root), 'fresh scope');
});

test('[NATIVE-ISOLATION-05] overlapping temp scopes fail before acquisition and invalid roots never invoke launch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'native-overlap-')); t.after(() => rm(root, { recursive: true, force: true }));
  const scratch = await nativeScratch(root); const before = environment();
  const entered = Promise.withResolvers(); const release = Promise.withResolvers();
  const active = withNativeTemporaryDirectory(scratch, async () => { entered.resolve(); await release.promise; }, root);
  await entered.promise;
  try { await assert.rejects(withNativeTemporaryDirectory(scratch, async () => assert.fail('overlapping launch'), root), /NATIVE_TEMP_SCOPE_BUSY/); }
  finally { release.resolve(); await active; }
  assert.deepEqual(environment(), before);
  const outside = join(root, 'run-outside'); await mkdir(outside);
  await assert.rejects(withNativeTemporaryDirectory(outside, async () => assert.fail('outside launch'), root), /UNSAFE_NATIVE_SCRATCH/);
  assert.deepEqual(environment(), before);
});

test('[NATIVE-ISOLATION-06] Linux socket prerequisites use UTF8 bytes and reject the retained long-path failure before launch', () => {
  const root = '/home/runner/work/obsidian-plugin-shell/obsidian-plugin-shell';
  assert.equal(assertNativeSocketBudget(`${root}/.nq/ABC123`, 'linux'), 105);
  assert.throws(() => assertNativeSocketBudget(`${root}/.nq/run-ABC123`, 'linux'), /109 bytes exceeds/);
  assert.throws(() => assertNativeSocketBudget(`${root}/.native-cache/qualification/run-QuTgOB`, 'linux'), /133 bytes exceeds/);
  const exact = `/${'a'.repeat(73)}`;
  assert.equal(assertNativeSocketBudget(exact, 'linux'), 107);
  assert.throws(() => assertNativeSocketBudget(`${exact}a`, 'linux'), /108 bytes exceeds/);
  assert.throws(() => assertNativeSocketBudget(`/${'a'.repeat(72)}é`, 'linux'), /108 bytes exceeds/);
  assert.doesNotThrow(() => assertNativeSocketBudget(`${exact}${'a'.repeat(100)}`, 'win32'));
});

test('[NATIVE-ISOLATION-07] controlled Linux prerequisite rejects a real overlong contained root before callback and restores scope', async t => {
  const owned = await mkdtemp(join(tmpdir(), 'ns-')); t.after(() => rm(owned, { recursive: true, force: true }));
  const root = join(owned, 'long-native-root-'.repeat(5)); await mkdir(root);
  const scratch = await nativeScratch(root); const before = environment(); let callbacks = 0;
  // Only the tooling platform parameter is controlled; no Linux kernel or host execution is claimed.
  await assert.rejects(withNativeTemporaryDirectory(scratch, async () => { callbacks++; }, root, 'linux'), /NATIVE_SOCKET_PATH_TOO_LONG/);
  assert.equal(callbacks, 0); assert.deepEqual(environment(), before);
  const next = await nativeScratch(owned);
  assert.equal(await withNativeTemporaryDirectory(next, async () => { callbacks++; return 'available'; }, owned), 'available');
  assert.equal(callbacks, 1); assert.deepEqual(environment(), before);
});
