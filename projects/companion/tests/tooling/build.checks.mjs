import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stagedBuild } from '../../scripts/bundling/staged-build.mjs';
import { installLocal } from '../../scripts/dev/install-local.mjs';
const assets = ['main.js', 'styles.css', 'manifest.json'];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'shell build ü-'));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'plugin-shell', version: '0.2.0' }));
  for (const name of assets) await writeFile(join(root, 'dist', name), name === 'manifest.json' ? JSON.stringify({ id: 'plugin-shell', version: '0.1.0' }) : `old ${name}`);
  return root;
}
async function snapshot(root) { return Promise.all(assets.map(name => readFile(join(root, 'dist', name), 'utf8'))); }
test('[BLD-02-01] compilation and incomplete output failures preserve the complete previous candidate', async () => {
  const root = await fixture(); const before = await snapshot(root);
  try {
    await assert.rejects(stagedBuild({ root, build: async ({ build }) => { await mkdir(build.outDir); await writeFile(join(build.outDir, 'main.js'), 'partial'); throw new Error('compile'); } }), /compile/);
    assert.deepEqual(await snapshot(root), before);
    await assert.rejects(stagedBuild({ root, build: async ({ build }) => { await mkdir(build.outDir); await writeFile(join(build.outDir, 'main.js'), 'partial'); } }), /ENOENT/);
    assert.deepEqual(await snapshot(root), before);
    assert.deepEqual((await readdir(root)).sort(), ['dist', 'manifest.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('[BLD-02-02] promotion and local installation use one complete version and preserve user data', async () => {
  const root = await fixture();
  try {
    const target = join(root, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(target, { recursive: true });
    await writeFile(join(target, 'data.json'), 'user settings');
    await stagedBuild({ root, build: async ({ build }) => { await mkdir(build.outDir); for (const name of ['main.js', 'styles.css']) await writeFile(join(build.outDir, name), `new ${name}`); } });
    const result = await installLocal({ root });
    assert.equal(result.written, true); assert.equal(result.assets.length, 3);
    assert.equal(await readFile(join(target, 'data.json'), 'utf8'), 'user settings');
    for (const name of assets) assert.equal(await readFile(join(target, name), 'utf8'), await readFile(join(root, 'dist', name), 'utf8'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('[BLD-02-03] overlapping build processes cannot consume another process lock or change assets', async () => {
  const root = await fixture(); const before = await snapshot(root);
  try {
    await mkdir(join(root, '.shell-build-lock'));
    await assert.rejects(stagedBuild({ root, build: async () => { assert.fail('must not build'); } }), { code: 'EEXIST' });
    assert.deepEqual(await snapshot(root), before); assert.ok((await readdir(root)).includes('.shell-build-lock'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('[IDENTITY-INSTALL-01] a different installed plugin is never overwritten by a chosen target name', async () => {
  const root = await fixture();
  try {
    const target = join(root, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(target, { recursive: true });
    const existing = JSON.stringify({ id: 'unrelated-plugin', name: 'Unrelated', version: '1.0.0' });
    await writeFile(join(target, 'manifest.json'), existing); await writeFile(join(target, 'main.js'), 'unrelated code');
    await writeFile(join(target, 'data.json'), 'unrelated settings');
    await assert.rejects(installLocal({ root, dryRun: true }), /INSTALLED_IDENTITY_CONFLICT/);
    await assert.rejects(installLocal({ root }), /INSTALLED_IDENTITY_CONFLICT/);
    assert.equal(await readFile(join(target, 'manifest.json'), 'utf8'), existing);
    assert.equal(await readFile(join(target, 'main.js'), 'utf8'), 'unrelated code');
    assert.equal(await readFile(join(target, 'data.json'), 'utf8'), 'unrelated settings');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('[INSTALL-RECOVERY-01] failed restoration retains last-good backups and blocks later installers', async () => {
  const root = await fixture();
  try {
    const target = join(root, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(target, { recursive: true });
    await writeFile(join(target, 'main.js'), 'last-good main');
    let failure;
    try { await installLocal({ root, beforePromote(_name, index) { if (index === 1) throw new Error('promotion failure'); }, beforeRestore() { throw new Error('restore failure'); } }); }
    catch (error) { failure = error; }
    assert.match(failure?.message ?? '', /INSTALL_RECOVERY_REQUIRED/);
    assert.equal(await readFile(join(failure.report.recoveryPath, 'main.js.previous'), 'utf8'), 'last-good main');
    assert.deepEqual(failure.report.preserved, ['main.js']);
    assert.ok((await readdir(target)).includes('.shell-install-lock'));
    await assert.rejects(installLocal({ root }), { code: 'EEXIST' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('[INSTALL-RECOVERY-02] rollback preserves an external edit and restores only still-owned bytes', async () => {
  const root = await fixture();
  try {
    const target = join(root, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(target, { recursive: true });
    await writeFile(join(target, 'main.js'), 'last-good main');
    let failure;
    try { await installLocal({ root, async beforePromote(_name, index) { if (index === 1) { await writeFile(join(target, 'main.js'), 'external edit'); throw new Error('promotion failure'); } } }); }
    catch (error) { failure = error; }
    assert.match(failure?.message ?? '', /INSTALL_RECOVERY_REQUIRED/);
    assert.equal(await readFile(join(target, 'main.js'), 'utf8'), 'external edit');
    assert.equal(await readFile(join(failure.report.recoveryPath, 'main.js.previous'), 'utf8'), 'last-good main');
  } finally { await rm(root, { recursive: true, force: true }); }
});
