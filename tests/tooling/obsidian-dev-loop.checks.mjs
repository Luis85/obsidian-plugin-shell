import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, rename, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDevOptions } from '../../scripts/dev/obsidian-dev-options.mjs';
import { seedSandbox, enableVaultPlugin, sandboxDirectory, assertContained, copyVaultTree } from '../../scripts/dev/obsidian-sandbox.mjs';
import { createRebuildLoop, watchTree } from '../../scripts/dev/rebuild-loop.mjs';
import { stagedBuild } from '../../scripts/bundling/staged-build.mjs';
import { licenseNotices } from '../../scripts/bundling/license-notices.mjs';
import { installLocal } from '../../scripts/dev/install-local.mjs';
import { openPluginView, reloadPlugin } from '../../scripts/testing/obsidian-plugin-control.mjs';

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'obsidian dev ü-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'tests/obsidian/vault/Notes'), { recursive: true });
  await writeFile(join(root, 'tests/obsidian/vault/Welcome.md'), '# Welcome\n');
  await writeFile(join(root, 'tests/obsidian/vault/Notes/Example.md'), '# Example\n');
  return root;
}
const linkType = process.platform === 'win32' ? 'junction' : 'dir';

test('[OBSIDIAN-DEV-01] options default to a contained interactive sandbox on port 9222 and validate every flag', () => {
  assert.deepEqual(parseDevOptions([], {}), { once: false, port: 9222, logs: 'plugin', settleMs: 1500, sandbox: '.obsidian-sandbox',
    debugLogging: true, allowDownload: false, help: false });
  const parsed = parseDevOptions(['--headless', '--port', '9333', '--logs', 'all', '--settle', '0', '--sandbox', '.obsidian-sandbox-agent', '--no-debug-logging', '--allow-download'], {});
  assert.deepEqual(parsed, { once: true, port: 9333, logs: 'all', settleMs: 0, sandbox: '.obsidian-sandbox-agent', debugLogging: false, allowDownload: true, help: false });
  // Only dedicated sandbox folders: project, agent, editor and test-vault folders are never a sandbox.
  for (const name of ['.companion', '.framework', '.claude', '.vscode', '.test-vault', '.agent-sandbox', '.obsidian-sandboxes/x', '.obsidian-sandbox/../x'])
    assert.throws(() => sandboxDirectory(name), /SANDBOX_NAME_INVALID/, name);
  assert.equal(parseDevOptions(['--json'], {}).once, true);
  assert.equal(parseDevOptions([], { OBSIDIAN_DEBUG_PORT: '9444', OBSIDIAN_ALLOW_DOWNLOAD: '1' }).port, 9444);
  assert.equal(parseDevOptions([], { OBSIDIAN_ALLOW_DOWNLOAD: '1' }).allowDownload, true);
  for (const [argv, pattern] of [[['--port', '80'], /DEV_OPTION_RANGE/], [['--port', 'x'], /DEV_OPTION_INVALID/], [['--port'], /VALUE_MISSING/],
    [['--port', '--once'], /VALUE_MISSING/], [['--logs', 'none'], /DEV_OPTION_INVALID/], [['--once', '--headless'], /DUPLICATE/],
    [['--sandbox', '.dev-vault'], /SANDBOX_NAME_INVALID/], [['--sandbox', '../vault'], /SANDBOX_NAME_INVALID/],
    [['--sandbox', '.obsidian'], /SANDBOX_NAME_INVALID/], [['--vault', '/home/me/Vault'], /DEV_OPTION_UNKNOWN/]]) {
    assert.throws(() => parseDevOptions(argv, {}), pattern, argv.join(' '));
  }
  assert.throws(() => parseDevOptions([], { OBSIDIAN_DEBUG_PORT: '70000' }), /DEV_OPTION_RANGE/);
  assert.equal(sandboxDirectory('.obsidian-sandbox'), '.obsidian-sandbox');
});
test('[OBSIDIAN-DEV-02] the sandbox is seeded once and existing vault data is preserved byte-for-byte', async t => {
  const root = await workspace(t);
  const first = await seedSandbox({ root });
  assert.equal(first.seeded, true); assert.equal(first.files, 2);
  assert.equal(await readFile(join(root, '.obsidian-sandbox/vault/Notes/Example.md'), 'utf8'), '# Example\n');
  await writeFile(join(root, '.obsidian-sandbox/vault/Welcome.md'), 'edited by the developer\n');
  await writeFile(join(root, '.obsidian-sandbox/vault/Mine.md'), 'mine\n');
  await writeFile(join(root, 'tests/obsidian/vault/New.md'), 'new fixture\n');
  const second = await seedSandbox({ root });
  assert.equal(second.seeded, false);
  assert.equal(await readFile(join(root, '.obsidian-sandbox/vault/Welcome.md'), 'utf8'), 'edited by the developer\n');
  assert.deepEqual((await readdir(join(root, '.obsidian-sandbox/vault'))).sort(), ['Mine.md', 'Notes', 'Welcome.md']);
  assert.deepEqual((await readdir(join(root, '.obsidian-sandbox'))).sort(), ['logs', 'vault']);
});
test('[OBSIDIAN-DEV-03] seeding refuses symlinks, escapes and reserved locations without partial vaults', async t => {
  const root = await workspace(t); const outside = await mkdtemp(join(tmpdir(), 'obsidian outside-')); t.after(() => rm(outside, { recursive: true, force: true }));
  await symlink(outside, join(root, 'tests/obsidian/vault/Linked'), linkType);
  await assert.rejects(seedSandbox({ root }), /VAULT_SOURCE_SYMLINK: Linked/);
  assert.deepEqual(await readdir(join(root, '.obsidian-sandbox')), ['logs']);
  await rm(join(root, 'tests/obsidian/vault/Linked'));
  await assert.rejects(seedSandbox({ root, source: '../outside' }), /SANDBOX_PATH_ESCAPE/);
  await assert.rejects(seedSandbox({ root, sandbox: '.dev-vault' }), /SANDBOX_NAME_INVALID/);
  await symlink(outside, join(root, '.obsidian-sandbox-linked'), linkType);
  await assert.rejects(seedSandbox({ root, sandbox: '.obsidian-sandbox-linked' }), /SANDBOX_PATH_SYMLINK/);
  assert.deepEqual(await readdir(outside), []);
  await mkdir(join(root, '.obsidian-sandbox-file')); await writeFile(join(root, '.obsidian-sandbox-file/vault'), 'not a vault');
  await assert.rejects(seedSandbox({ root, sandbox: '.obsidian-sandbox-file' }), /SANDBOX_VAULT_INVALID/);
  await assert.rejects(assertContained(root, root), /SANDBOX_PATH_ESCAPE/);
  await assert.rejects(copyVaultTree(join(root, 'tests/obsidian/vault'), join(root, 'tests/obsidian/vault')), /VAULT_TARGET_EXISTS/);
});
test('[OBSIDIAN-DEV-04] enabling the plugin touches only this vault list, keeps other plugins and preserves corrupt data', async t => {
  const root = await workspace(t); const { vault } = await seedSandbox({ root });
  assert.deepEqual(await enableVaultPlugin(root, vault, 'plugin-shell'), { changed: true, enabled: ['plugin-shell'] });
  assert.deepEqual(await enableVaultPlugin(root, vault, 'plugin-shell'), { changed: false, enabled: ['plugin-shell'] });
  const list = join(vault, '.obsidian/community-plugins.json');
  await writeFile(list, JSON.stringify(['other-plugin']));
  assert.deepEqual((await enableVaultPlugin(root, vault, 'plugin-shell')).enabled, ['other-plugin', 'plugin-shell']);
  await writeFile(list, '{"broken"');
  await assert.rejects(enableVaultPlugin(root, vault, 'plugin-shell'), /SANDBOX_COMMUNITY_PLUGINS_INVALID/);
  assert.equal(await readFile(list, 'utf8'), '{"broken"');
  await writeFile(list, JSON.stringify({ not: 'a list' }));
  await assert.rejects(enableVaultPlugin(root, vault, 'plugin-shell'), /SANDBOX_COMMUNITY_PLUGINS_INVALID/);
  await assert.rejects(enableVaultPlugin(root, vault, '../escape'), /SANDBOX_PLUGIN_ID_INVALID/);
  assert.deepEqual((await readdir(join(vault, '.obsidian'))).sort(), ['community-plugins.json']);
});
test('[OBSIDIAN-DEV-05] change bursts coalesce into serialized rebuilds and failures keep the loop alive', async () => {
  let runs = 0; let active = 0; let overlap = false; const errors = [];
  const loop = createRebuildLoop(async () => {
    active++; overlap ||= active > 1; runs++;
    await new Promise(resolve => setTimeout(resolve, 20));
    active--; if (runs === 2) throw new Error('compile');
  }, { delay: 5, onError: error => errors.push(error.message) });
  await Promise.all([loop.now(), loop.now(), loop.now()]);
  assert.equal(runs, 2); assert.equal(overlap, false);
  assert.deepEqual(errors, ['compile']);
  loop.changed(); loop.changed(); loop.changed();
  await new Promise(resolve => setTimeout(resolve, 60)); await loop.idle();
  assert.equal(runs, 3);
  await loop.close(); await loop.now(); assert.equal(runs, 3);
});
test('[OBSIDIAN-DEV-06] the source watcher still sees a file after an editor replaces it by rename', { skip: process.platform !== 'linux' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'obsidian watch-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nested')); await writeFile(join(root, 'nested/main.ts'), '1');
  const seen = []; const close = watchTree(root, (_, name) => seen.push(String(name))); t.after(close);
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));
  await settle();
  await writeFile(join(root, 'nested/main.ts.tmp'), '2'); await rename(join(root, 'nested/main.ts.tmp'), join(root, 'nested/main.ts')); await settle();
  seen.length = 0; await writeFile(join(root, 'nested/main.ts'), '3'); await settle();
  assert.ok(seen.includes('main.ts'), `in-place write after rename-replace was observed: ${seen}`);
  await mkdir(join(root, 'nested/added')); await settle();
  seen.length = 0; await writeFile(join(root, 'nested/added/view.ts'), 'x'); await settle();
  assert.ok(seen.includes('view.ts'), `a file in a new directory was observed: ${seen}`);
});
test('[OBSIDIAN-DEV-19] a watched folder that is deleted and recreated is watched again, with its new subfolders', { skip: process.platform !== 'linux' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'obsidian watch-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'feature/deep'), { recursive: true });
  const seen = []; const close = watchTree(root, (_, name) => seen.push(String(name))); t.after(close);
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));
  await settle();
  assert.deepEqual(close.watched().map(path => path.slice(root.length)), ['', '/feature', '/feature/deep']);
  await rm(join(root, 'feature'), { recursive: true }); await settle();
  assert.deepEqual(close.watched().map(path => path.slice(root.length)), [''], 'watches below a deleted folder are closed');
  await mkdir(join(root, 'feature')); await settle();
  seen.length = 0; await writeFile(join(root, 'feature/view.ts'), 'x'); await settle();
  assert.ok(seen.includes('view.ts'), `a file in the recreated folder was observed: ${seen}`);
  await mkdir(join(root, 'feature/deep')); await settle();
  seen.length = 0; await writeFile(join(root, 'feature/deep/model.ts'), 'y'); await settle();
  assert.ok(seen.includes('model.ts'), `a file in a recreated subfolder was observed: ${seen}`);
});
test('[OBSIDIAN-DEV-07] dev candidates build into a contained target and reject unsafe targets before building', async t => {
  const root = await mkdtemp(join(tmpdir(), 'obsidian build-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'plugin-shell', version: '1.0.0' }));
  await mkdir(join(root, '.obsidian-sandbox'));
  const configs = [];
  const build = async config => { configs.push(config); await mkdir(config.build.outDir); for (const name of ['main.js', 'styles.css']) await writeFile(join(config.build.outDir, name), name); };
  await stagedBuild({ root, build, target: '.obsidian-sandbox/build', sourcemap: 'inline', logLevel: 'warn' });
  assert.equal(await readFile(join(root, '.obsidian-sandbox/build/main.js'), 'utf8'), 'main.js');
  assert.equal(configs[0].build.sourcemap, 'inline'); assert.equal(configs[0].logLevel, 'warn');
  await stagedBuild({ root, build });
  assert.equal(Object.hasOwn(configs[1].build, 'sourcemap'), false); assert.equal(Object.hasOwn(configs[1], 'logLevel'), false);
  for (const target of ['../dist', '/tmp/dist', 'a/../b', 'a//b']) await assert.rejects(stagedBuild({ root, build, target }), /UNSAFE_BUILD_TARGET/, target);
  await assert.rejects(stagedBuild({ root, build, sourcemap: true }), /UNSUPPORTED_BUILD_SOURCEMAP/);
  assert.equal(configs.length, 2);
  const installed = await installLocal({ root, vault: '.obsidian-sandbox/vault', source: '.obsidian-sandbox/build' });
  assert.equal(await readFile(join(installed.target, 'main.js'), 'utf8'), 'main.js');
  await assert.rejects(installLocal({ root, vault: '.obsidian-sandbox/vault', source: '../elsewhere' }), /UNSAFE_TARGET/);
});
test('[OBSIDIAN-DEV-08] the license banner shifts only dev inline source maps; release chunks stay banner plus code', () => {
  const map = { version: 3, sources: ['../../src/main.ts'], names: [], mappings: 'AAAA' };
  const encoded = Buffer.from(JSON.stringify(map)).toString('base64');
  const dev = { type: 'chunk', isEntry: true, modules: {}, code: `x;\n//# sourceMappingURL=data:application/json;base64,${encoded}\n` };
  const release = { type: 'chunk', isEntry: true, modules: {}, code: 'x;\n' };
  licenseNotices().generateBundle({}, { dev, release });
  const banner = release.code.slice(0, -'x;\n'.length);
  assert.match(banner, /^\/\*!\nPlugin Shell — bundled dependency notices/);
  const shifted = JSON.parse(Buffer.from(/base64,([A-Za-z0-9+/=]+)/.exec(dev.code)[1], 'base64').toString('utf8'));
  assert.equal(shifted.mappings, `${';'.repeat(banner.split('\n').length - 1)}AAAA`);
  assert.ok(dev.code.startsWith(`${banner}x;\n//# sourceMappingURL=`));
});
/** Obsidian's plugin manager as observed in 1.13: the plain disable drops the id from the enabled set,
 * the plain enable loads without recording it, and only the *AndSave variants persist the set. */
function hostPage(enabled) {
  const saved = [[...enabled]]; const loaded = new Set(enabled); const views = new Map(); const leaves = [];
  const viewRegistry = { registerView(type, create) { views.set(type, create); } };
  // Stack frames of the plugin's own script contain `plugin:<id>`, as in Obsidian.
  const pluginScript = { 'plugin:my-plugin'() { viewRegistry.registerView('my-view', () => ({})); viewRegistry.registerView('my-panel', () => ({})); } };
  const workspace = { getLeavesOfType: type => leaves.filter(leaf => leaf.type === type), setActiveLeaf() {}, async revealLeaf() {},
    getLeaf: () => { const leaf = { type: 'empty', view: { getViewType: () => leaf.type }, async setViewState(state) { if (!views.has(state.type)) throw new Error('no view'); leaf.type = state.type; } }; leaves.push(leaf); return leaf; } };
  const plugins = { enabledPlugins: new Set(enabled), manifests: { 'my-plugin': { version: '1.0.0' } }, plugins: {},
    async disablePlugin(id) { loaded.delete(id); this.enabledPlugins.delete(id); },
    async loadManifests() {},
    async enablePlugin(id) { loaded.add(id); viewRegistry.registerView('core-view', () => ({})); pluginScript['plugin:my-plugin'](); return true; },
    async enablePluginAndSave(id) { await this.enablePlugin(id); this.enabledPlugins.add(id); saved.push([...this.enabledPlugins]); return true; } };
  Object.defineProperty(plugins.plugins, 'my-plugin', { enumerable: true, get: () => ({ _loaded: loaded.has('my-plugin') }) });
  const window = { app: { plugins, viewRegistry, workspace } };
  const page = { evaluate: async (fn, arg) => { globalThis.window = window; try { return await fn(arg); } finally { delete globalThis.window; } } };
  return { page, saved, viewRegistry, leaves };
}
test('[OBSIDIAN-DEV-20] a reload reports only this plugin\'s views and the first one is shown; no view is not an error', async () => {
  const host = hostPage(['my-plugin']); const original = host.viewRegistry.registerView;
  const reload = await reloadPlugin(host.page, 'my-plugin', { timeout: 500 });
  assert.deepEqual(reload.viewTypes, ['my-view', 'my-panel'], 'registration order, core views excluded');
  assert.equal(host.viewRegistry.registerView, original, 'the host method is restored');
  assert.deepEqual(await openPluginView(host.page, reload.viewTypes), { type: 'my-view', opened: true, registered: ['my-view', 'my-panel'] });
  assert.deepEqual(await openPluginView(host.page, reload.viewTypes), { type: 'my-view', opened: true, registered: ['my-view', 'my-panel'] });
  assert.equal(host.leaves.length, 1, 'an open leaf of that view is reused');
  assert.equal(await openPluginView(host.page, []), null);
  const failed = await openPluginView(host.page, ['missing-view']);
  assert.deepEqual({ opened: failed.opened, error: failed.error }, { opened: false, error: 'no view' });
});
test('[OBSIDIAN-DEV-09] a hot reload keeps a persisted enablement enabled and saved, and never persists a transient one', async () => {
  const persisted = hostPage(['other', 'my-plugin']);
  const reload = await reloadPlugin(persisted.page, 'my-plugin', { timeout: 500 });
  assert.deepEqual({ loaded: reload.loaded, enabled: reload.enabled, error: reload.error }, { loaded: true, enabled: true, error: null });
  assert.deepEqual(persisted.saved.at(-1), ['other', 'my-plugin']);
  const transient = hostPage(['other']);
  const again = await reloadPlugin(transient.page, 'my-plugin', { timeout: 500 });
  assert.deepEqual({ loaded: again.loaded, enabled: again.enabled }, { loaded: true, enabled: false });
  assert.deepEqual(transient.saved, [['other']]);
});
