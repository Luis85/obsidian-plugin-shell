import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { planIdentity, validateIdentity } from '../../scripts/setup/identity.mjs';
import { setupOptions } from '../../scripts/setup/options.mjs';
import { inputFingerprint } from '../../scripts/setup/journal.mjs';
import { executeSetup } from '../../scripts/setup/execute.mjs';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { fixture, run, snapshot } from './setup-identity-fixture.mjs';
const parsed = async (root, path) => JSON.parse(await readFile(join(root, path), 'utf8'));
const flags = ['--yes', '--no-interaction', '--json'];

test('[IDENTITY-01] dependency-free dry run plans exact portable identity without child processes or file writes', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true })); const before = await snapshot(f.root);
  const result = run(f.root, join(f.root, 'nonexistent launcher.mjs'), ['--dry-run', '--json', '--id', 'field-notes', '--name', 'Field Notes', '--repo', 'owner/field-notes', '--version', '2.0.0']);
  assert.equal(result.status, 0, result.stderr); const plan = JSON.parse(result.stdout);
  assert.equal(plan.identity.id, 'field-notes'); assert.equal(plan.profile, 'browser'); assert.equal(plan.dryRun, true);
  assert.deepEqual(plan.files.map(item => item.path), ['manifest.json', 'package.json', 'package-lock.json', 'versions.json', 'PROJECT-IDENTITY.md']);
  assert.deepEqual(await snapshot(f.root), before);
});

test('[IDENTITY-02] apply preserves all resolved dependencies, attribution, unrelated metadata and reruns identically', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const options = await setupOptions(['--id', 'field-notes', '--name', 'Field Notes', '--description', 'Useful notes', '--author', 'Ada', '--repo', 'owner/field-notes', '--version', '2.0.0']);
  const original = await snapshot(f.root); const planned = await planIdentity(f.root, options); await applyFilePlan(planned.plan);
  const lock = await parsed(f.root, 'package-lock.json'); assert.deepEqual(lock.packages['node_modules/sample'], f.lock.packages['node_modules/sample']);
  assert.deepEqual(lock.packages[''].dependencies, f.lock.packages[''].dependencies);
  assert.equal(lock.name, 'field-notes'); assert.equal(lock.packages[''].version, '2.0.0');
  const manifest = await parsed(f.root, 'manifest.json'); assert.equal(manifest.minAppVersion, f.manifest.minAppVersion); assert.equal(manifest.isDesktopOnly, true);
  assert.equal((await parsed(f.root, 'package.json')).license, 'MIT');
  assert.equal((await parsed(f.root, 'package.json')).repository.url, 'https://github.com/owner/field-notes.git');
  assert.deepEqual(await parsed(f.root, 'versions.json'), { '1.0.0': '1.13.7', '2.0.0': '1.13.7' });
  const after = await snapshot(f.root); assert.equal(after['LICENSE'], original['LICENSE']); assert.equal(after['README.md'], original['README.md']);
  const rerun = await planIdentity(f.root, options); assert.ok(rerun.plan.changes.every(change => change.status === 'unchanged'));
  await writeFile(join(f.root, 'PROJECT-IDENTITY.md'), 'user edits'); await assert.rejects(planIdentity(f.root, options), /user edits/);
});

test('[IDENTITY-03] unsafe metadata, malformed answers, lock drift and noninteractive omissions fail closed', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const valid = { ...f.manifest, repo: null };
  for (const id of ['../escape', 'CON', 'con', '123-id', 'with space', 'a/b', 'a\\b', 'a.', 'é']) assert.throws(() => validateIdentity({ ...valid, id }));
  for (const version of ['1.2', '01.2.3', '1.2.3-beta']) assert.throws(() => validateIdentity({ ...valid, version }));
  for (const repo of ['https://token@github.com/a/b', '../outside', 'a/b.git']) assert.throws(() => validateIdentity({ ...valid, repo }));
  assert.throws(() => validateIdentity({ ...valid, name: 'newline\n' }));
  await writeFile(join(f.root, 'answers.json'), '{"hook":"anything"}');
  assert.notEqual(run(f.root, f.launcher, ['--answers', 'answers.json', '--dry-run']).status, 0);
  assert.notEqual(run(f.root, f.launcher, ['--unknown']).status, 0);
  assert.notEqual(run(f.root, f.launcher, ['--no-interaction']).status, 0);
  await writeFile(join(f.root, 'versions.json'), '{"1.0.0":"1.0.0"}');
  await assert.rejects(planIdentity(f.root, await setupOptions([])), /historical host floor/);
  await writeFile(join(f.root, 'package-lock.json'), '{}');
  assert.notEqual(run(f.root, f.launcher, ['--dry-run']).status, 0);
});

test('[IDENTITY-04] reviewed plans reject intervening edits and preserve original metadata on owned write failure', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const options = await setupOptions(['--id', 'field-notes']); const plan = (await planIdentity(f.root, options)).plan;
  const original = await snapshot(f.root);
  await assert.rejects(applyFilePlan(plan, { beforeWrite(_change, index) { if (index === 1) throw new Error('injected write failure'); } }));
  assert.deepEqual(await snapshot(f.root), original);
  await writeFile(join(f.root, 'manifest.json'), 'external edit');
  await assert.rejects(applyFilePlan(plan), /STALE/); assert.equal(await readFile(join(f.root, 'manifest.json'), 'utf8'), 'external edit');
});

test('[IDENTITY-09] equivalent dependency maps ignore insertion order while changed pins fail', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const pkg = await parsed(f.root, 'package.json'); const lock = await parsed(f.root, 'package-lock.json');
  pkg.devDependencies = { zed: '1.0.0', alpha: '2.0.0' }; lock.packages[''].devDependencies = { alpha: '2.0.0', zed: '1.0.0' };
  await writeFile(join(f.root, 'package.json'), JSON.stringify(pkg)); await writeFile(join(f.root, 'package-lock.json'), JSON.stringify(lock));
  assert.equal((await planIdentity(f.root, await setupOptions(['--id', 'renamed']))).identity.id, 'renamed');
  lock.packages[''].devDependencies.zed = '1.0.1'; await writeFile(join(f.root, 'package-lock.json'), JSON.stringify(lock));
  await assert.rejects(planIdentity(f.root, await setupOptions([])), /devDependencies disagree/);
});

test('[IDENTITY-11] planning cannot silently adopt intervening edits as new write preconditions', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const options = await setupOptions(['--id', 'renamed']);
  const external = { ...f.manifest, description: 'External edit must survive' };
  await assert.rejects(planIdentity(f.root, options, null, { afterRead: () => writeFile(join(f.root, 'manifest.json'), JSON.stringify(external)) }), /inputs changed/);
  assert.deepEqual(await parsed(f.root, 'manifest.json'), external);
  const stable = await planIdentity(f.root, options); await applyFilePlan(stable.plan);
  await assert.rejects(planIdentity(f.root, options, null, { afterRead: () => writeFile(join(f.root, 'PROJECT-IDENTITY.md'), 'concurrent author edit') }), /inputs changed/);
  assert.equal(await readFile(join(f.root, 'PROJECT-IDENTITY.md'), 'utf8'), 'concurrent author edit');
});

test('[IDENTITY-05] installed migration copies exact data while preserving notes, old installation and security state', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const config = join(f.root, '.dev-vault/.obsidian'); await mkdir(join(config, 'plugins/original-plugin'), { recursive: true });
  await writeFile(join(config, 'plugins/original-plugin/manifest.json'), JSON.stringify(f.manifest));
  await writeFile(join(config, 'plugins/original-plugin/data.json'), '{invalid but preserved bytes}\n');
  await writeFile(join(config, 'community-plugins.json'), '["unrelated"]'); await writeFile(join(f.root, '.dev-vault/note.md'), 'user note');
  await assert.rejects(planIdentity(f.root, await setupOptions(['--id', 'new-plugin'])), /explicit --migrate-from/);
  const options = await setupOptions(['--id', 'new-plugin', '--migrate-from', 'original-plugin', '--profile', 'native']);
  const before = await snapshot(f.root); const plan = await planIdentity(f.root, options);
  assert.deepEqual(await snapshot(f.root), before); await applyFilePlan(plan.migration.plan);
  assert.equal(await readFile(join(config, 'plugins/new-plugin/data.json'), 'utf8'), '{invalid but preserved bytes}\n');
  for (const path of ['.dev-vault/note.md', '.dev-vault/.obsidian/community-plugins.json', '.dev-vault/.obsidian/plugins/original-plugin/data.json']) assert.equal((await snapshot(f.root))[path], before[path]);
  const receipt = { migration: { from: 'original-plugin', to: 'new-plugin', status: 'verified' } };
  await writeFile(join(config, 'plugins/new-plugin/data.json'), 'different'); await assert.rejects(planIdentity(f.root, options, receipt), /conflicts/);
  await writeFile(join(config, 'community-plugins.json'), '["original-plugin"]'); await assert.rejects(planIdentity(f.root, options, receipt), /Disable both/);
});

test('[IDENTITY-06] answers remain data-only and symlinked identity inputs never escape a repository', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await writeFile(join(f.root, 'answers.json'), JSON.stringify({ id: 'safe-id', name: 'Safe Name', profile: 'browser' }));
  const result = run(f.root, f.launcher, ['--answers', 'answers.json', '--dry-run', '--json']); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).identity.id, 'safe-id');
  const saved = await readFile(join(f.root, 'manifest.json')); await rm(join(f.root, 'manifest.json'));
  await writeFile(join(f.root, 'separate.json'), saved);
  try { await symlink(join(f.root, 'separate.json'), join(f.root, 'manifest.json')); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('File symlink creation unavailable on this host; junction escape is tested separately'); return; } throw error; }
  await assert.rejects(planIdentity(f.root, await setupOptions([])), /SYMLINK/);
});

test('[IDENTITY-07] foreign destination plugin manifests and occupied folders are never overwritten', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const target = join(f.root, '.dev-vault/.obsidian/plugins/new-plugin'); await mkdir(target, { recursive: true });
  await writeFile(join(target, 'manifest.json'), JSON.stringify({ id: 'unrelated-plugin', name: 'Unrelated', version: '1.0.0' }));
  const before = await snapshot(f.root); const options = await setupOptions(['--id', 'new-plugin', '--profile', 'native']);
  await assert.rejects(planIdentity(f.root, options), /Destination installation conflicts/); assert.deepEqual(await snapshot(f.root), before);
  await rm(join(target, 'manifest.json')); await writeFile(join(target, 'main.js'), 'unrelated bytes');
  await assert.rejects(planIdentity(f.root, options), /occupied/); assert.equal(await readFile(join(target, 'main.js'), 'utf8'), 'unrelated bytes');
});

test('[IDENTITY-08] directory junctions cannot redirect the approved vault into another directory', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const elsewhere = join(f.root, 'outside-vault'); await mkdir(join(elsewhere, '.obsidian/plugins'), { recursive: true });
  try { await symlink(elsewhere, join(f.root, '.dev-vault'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Directory symlinks unavailable on this host'); return; } throw error; }
  await assert.rejects(planIdentity(f.root, await setupOptions(['--profile', 'native'])), /UNSAFE_ROOT/);
});

test('[IDENTITY-10] non-roundtripping UTF-8 settings abort before metadata or migration writes', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const source = join(f.root, '.dev-vault/.obsidian/plugins/original-plugin'); await mkdir(source, { recursive: true });
  await writeFile(join(source, 'manifest.json'), JSON.stringify(f.manifest));
  const bytes = Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]); await writeFile(join(source, 'data.json'), bytes);
  const before = await snapshot(f.root);
  const result = run(f.root, f.launcher, [...flags, '--id', 'renamed', '--profile', 'native', '--migrate-from', 'original-plugin']);
  assert.equal(result.status, 1); assert.match(result.stdout, /lossless UTF-8/);
  assert.deepEqual(await snapshot(f.root), before); assert.deepEqual(await readFile(join(source, 'data.json')), bytes);
});

test('[IDENTITY-12] reviewed migration source bytes remain preconditions until the copy applies', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const old = join(f.root, '.dev-vault/.obsidian/plugins/original-plugin'); await mkdir(old, { recursive: true });
  await writeFile(join(old, 'manifest.json'), JSON.stringify(f.manifest)); await writeFile(join(old, 'data.json'), 'original settings');
  const plan = await planIdentity(f.root, await setupOptions(['--id', 'new-plugin', '--migrate-from', 'original-plugin', '--profile', 'native']));
  await writeFile(join(old, 'data.json'), 'concurrent settings');
  await assert.rejects(applyFilePlan(plan.migration.plan), /STALE/);
  assert.equal(await readFile(join(old, 'data.json'), 'utf8'), 'concurrent settings');
  await assert.rejects(readFile(join(f.root, '.dev-vault/.obsidian/plugins/new-plugin/data.json')), { code: 'ENOENT' });
});

test('[SETUP-04] fingerprint includes executable acceptance inventory and token fixture contracts', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const toolchain = { node: process.version, npm: '11.19.1', platform: process.platform, architecture: process.arch };
  const options = await setupOptions([]); let previous = await inputFingerprint(f.root, toolchain, options);
  for (const path of ['docs/testing/test-plan.json', 'docs/design/obsidian-tokens.json']) {
    await mkdir(join(f.root, path, '..'), { recursive: true }); await writeFile(join(f.root, path), '{}');
    const current = await inputFingerprint(f.root, toolchain, options); assert.notEqual(current, previous, path); previous = current;
  }
});

test('[SETUP-01] failed verification is journaled; resume revalidates dependencies and reruns checks without losing identity', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await writeFile(join(f.root, '.fail-verify'), 'fail');
  const failed = run(f.root, f.launcher, [...flags, '--id', 'resumable-plugin']); assert.equal(failed.status, 1);
  let journal = await parsed(f.root, '.template-state/setup.json'); assert.equal(journal.status, 'failed');
  assert.equal(journal.stages.find(stage => stage.id === 'verify').status, 'failed');
  assert.equal(journal.stages.find(stage => stage.id === 'verify').exitCode, 7);
  await rm(join(f.root, '.fail-verify')); const resumed = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(resumed.status, 0, resumed.stdout + resumed.stderr);
  const output = JSON.parse(resumed.stdout); assert.equal(output.identity.id, 'resumable-plugin'); assert.equal(output.status, 'verified');
  assert.match(resumed.stderr, /Synthetic verify boundary/); assert.doesNotMatch(resumed.stdout, /Synthetic/);
  assert.equal(await readFile(join(f.root, 'install-count'), 'utf8'), '1');
  await rm(join(f.root, 'node_modules/sample/bin.mjs'));
  const missingBinary = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(missingBinary.status, 1); assert.match(missingBinary.stdout, /failed/);
  await rm(join(f.root, 'node_modules/sample/package.json'));
  const repaired = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(repaired.status, 0, repaired.stdout + repaired.stderr);
  assert.equal(await readFile(join(f.root, 'install-count'), 'utf8'), '2');
});

test('[SETUP-02] source changes invalidate completion and concurrent setup is blocked without deleting state', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await mkdir(join(f.root, '.template-setup.lock'));
  const locked = run(f.root, f.launcher, flags); assert.equal(locked.status, 1); assert.match(locked.stdout, /SETUP_LOCKED/);
  await rm(join(f.root, '.template-setup.lock'), { recursive: true });
  await writeFile(join(f.root, '.change-source'), 'change');
  const changed = run(f.root, f.launcher, flags); assert.equal(changed.status, 1); assert.match(changed.stdout, /inputs changed/);
  assert.equal((await parsed(f.root, '.template-state/setup.json')).status, 'failed');
  await rm(join(f.root, '.change-source'));
  const current = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(current.status, 0, current.stdout + current.stderr);
});

test('[SETUP-03] native identity migration installs one matching candidate and resumes without changing old data or enabling plugins', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const config = join(f.root, '.dev-vault/.obsidian'); const old = join(config, 'plugins/original-plugin');
  await mkdir(old, { recursive: true }); await writeFile(join(old, 'manifest.json'), JSON.stringify(f.manifest));
  await writeFile(join(old, 'data.json'), '{"user":"preserve exact"}\n'); await writeFile(join(old, 'main.js'), 'old bundle');
  await writeFile(join(config, 'community-plugins.json'), '[]');
  const result = run(f.root, f.launcher, [...flags, '--id', 'new-plugin', '--profile', 'native', '--migrate-from', 'original-plugin']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal((await parsed(f.root, '.dev-vault/.obsidian/plugins/new-plugin/manifest.json')).id, 'new-plugin');
  assert.equal(await readFile(join(config, 'plugins/new-plugin/data.json'), 'utf8'), '{"user":"preserve exact"}\n');
  assert.equal(await readFile(join(old, 'main.js'), 'utf8'), 'old bundle'); assert.equal(await readFile(join(config, 'community-plugins.json'), 'utf8'), '[]');
  const resume = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(resume.status, 0, resume.stdout + resume.stderr);
  assert.equal(JSON.parse(resume.stdout).stages.find(stage => stage.id === 'native-install').resumed, true);
});

test('[SETUP-05] intent is journaled before metadata application and externally changed journals are preserved', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const options = await setupOptions(['--id', 'recover-intent']); const planned = await planIdentity(f.root, options);
  const edited = { ...f.manifest, description: 'edited after review' }; await writeFile(join(f.root, 'manifest.json'), JSON.stringify(edited));
  const activeNpm = process.env.npm_execpath; process.env.npm_execpath = f.launcher;
  try { await assert.rejects(executeSetup(f.root, options, planned, null), /STALE/); }
  finally { if (activeNpm === undefined) delete process.env.npm_execpath; else process.env.npm_execpath = activeNpm; }
  assert.deepEqual(await parsed(f.root, 'manifest.json'), edited);
  assert.equal((await parsed(f.root, '.template-state/setup.json')).options.id, 'recover-intent');
  const recovered = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
  await writeFile(join(f.root, '.change-journal'), 'change');
  const changed = run(f.root, f.launcher, [...flags, '--resume']); assert.equal(changed.status, 1); assert.match(changed.stdout, /journal changed externally/);
  assert.equal(await readFile(join(f.root, '.template-state/setup.json'), 'utf8'), '{"external":true}');
  const corrupt = run(f.root, f.launcher, ['--dry-run', '--json']); assert.equal(corrupt.status, 1); assert.match(corrupt.stdout, /Invalid setup journal/);
  assert.equal(await readFile(join(f.root, '.template-state/setup.json'), 'utf8'), '{"external":true}');
});
