import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink, link, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planFixtures, applyFixtures } from '../../docs/concepts/companion/test-kit/storage.mjs';
import { runTestData } from '../../docs/concepts/companion/test-kit/cli.mjs';
import { fixtureManifest } from './test-data-fixture.mjs';
async function sandbox(t) { const root = await realpath(await mkdtemp(join(tmpdir(), 'fixture-kit-'))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function put(root, path, value) { const parts = path.split('/'); await mkdir(join(root, ...parts.slice(0, -1)), { recursive: true }); await writeFile(join(root, ...parts), value); }

test('[TD-PLAN] planning performs zero filesystem mutations; apply needs exact explicit approval', async t => {
  const root = await sandbox(t), manifest = fixtureManifest(), plan = await planFixtures(root, manifest);
  assert.deepEqual(await readdir(root), []); assert.equal(plan.mode, 'seed'); assert.ok(plan.changes.length > 3); assert.equal(plan.blockers.length, 0);
  await assert.rejects(applyFixtures(root, manifest), /approval/); assert.deepEqual(await readdir(root), []);
  await assert.rejects(applyFixtures(root, manifest, '0'.repeat(64)), /approval/);
  const result = await applyFixtures(root, manifest, plan.approval); assert.equal(result.written, plan.changes.length);
  const next = await planFixtures(root, manifest); assert.ok(next.changes.every(c => c.status === 'unchanged'));
  const receipt = await readFile(join(root, '.test-vault/.shell-fixtures.json'), 'utf8');
  assert.equal((await applyFixtures(root, manifest, next.approval)).written, 0);
  assert.equal(await readFile(join(root, '.test-vault/.shell-fixtures.json'), 'utf8'), receipt);
});
test('[TD-PRESERVE] foreign and manually edited fixtures are never overwritten or reset', async t => {
  const root = await sandbox(t), manifest = fixtureManifest(), plan = await planFixtures(root, manifest), path = plan.changes[0].path;
  await put(root, '.test-vault/' + path, 'foreign content'); const blocked = await planFixtures(root, manifest);
  assert.deepEqual(blocked.blockers, [path]); await assert.rejects(applyFixtures(root, manifest, blocked.approval), /preserved/);
  assert.equal(await readFile(join(root, '.test-vault', path), 'utf8'), 'foreign content');
  await rm(join(root, '.test-vault'), { recursive: true }); const fresh = await planFixtures(root, manifest); await applyFixtures(root, manifest, fresh.approval);
  await writeFile(join(root, '.test-vault', path), 'manual fixture edit');
  const reset = await planFixtures(root, manifest, { reset: true }); assert.ok(reset.blockers.includes(path));
  await assert.rejects(applyFixtures(root, manifest, reset.approval, { reset: true }), /preserved/);
  assert.equal(await readFile(join(root, '.test-vault', path), 'utf8'), 'manual fixture edit');
});
test('[TD-RESET] cleanup removes only unchanged receipt-owned output, preserving notes and plugin configuration', async t => {
  const root = await sandbox(t), manifest = fixtureManifest();
  for (const path of ['README.md', '.obsidian/plugins/companion/data.json', '.test-vault/.obsidian/plugins/consumer/data.json', '.test-vault/My note.md', '.dev-vault/Existing.md']) await put(root, path, 'preserve me');
  const plan = await planFixtures(root, manifest); await applyFixtures(root, manifest, plan.approval);
  manifest.count = 1; const smaller = await planFixtures(root, manifest); assert.ok(smaller.changes.some(c => c.status === 'retain')); await applyFixtures(root, manifest, smaller.approval);
  const reset = await planFixtures(root, manifest, { reset: true }); await applyFixtures(root, manifest, reset.approval, { reset: true });
  for (const path of ['README.md', '.obsidian/plugins/companion/data.json', '.test-vault/.obsidian/plugins/consumer/data.json', '.test-vault/My note.md', '.dev-vault/Existing.md']) assert.equal(await readFile(join(root, path), 'utf8'), 'preserve me');
  for (const c of reset.changes) await assert.rejects(readFile(join(root, '.test-vault', c.path)), { code: 'ENOENT' });
  await assert.rejects(readFile(join(root, '.test-vault/.shell-fixtures.json')), { code: 'ENOENT' });
});
test('[TD-STALE] changed settings, receipts, file contents and provider identity invalidate approval', async t => {
  const root = await sandbox(t), manifest = fixtureManifest(), p = await planFixtures(root, manifest);
  const other = structuredClone(manifest); other.seed++; await assert.rejects(applyFixtures(root, other, p.approval), /Stale/);
  await assert.rejects(applyFixtures(root, manifest, p.approval, { providerName: 'other-provider' }), /Stale/);
  await applyFixtures(root, manifest, p.approval); const after = await planFixtures(root, manifest);
  await writeFile(join(root, '.test-vault', after.changes[0].path), 'changed'); await assert.rejects(applyFixtures(root, manifest, after.approval), /Stale/);
});
test('[TD-CONTAINMENT] symlinked targets, hardlinks and forged ownership paths are rejected', async t => {
  const root = await sandbox(t), outside = await sandbox(t), manifest = fixtureManifest();
  await symlink(outside, join(root, '.test-vault'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(planFixtures(root, manifest), /safe directory|Symlink/); await rm(join(root, '.test-vault'));
  await mkdir(join(root, '.test-vault')); await symlink(outside, join(root, '.test-vault/Records'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(planFixtures(root, manifest), /Symlink/); assert.deepEqual(await readdir(outside), []); await rm(join(root, '.test-vault/Records'));
  const p = await planFixtures(root, manifest); const target = p.changes[0].path; await put(root, '.test-vault/' + target, 'one'); await link(join(root, '.test-vault', target), join(outside, 'linked'));
  await assert.rejects(planFixtures(root, manifest), /hardlink/); await rm(join(root, '.test-vault'), { recursive: true });
  for (const path of ['../README.md', '.obsidian/plugins/x/data.json', 'Records/manual-note.md']) {
    await put(root, '.test-vault/.shell-fixtures.json', JSON.stringify({ schema: 1, target: '.test-vault', files: { [path]: 'a'.repeat(64) } }));
    await assert.rejects(planFixtures(root, manifest, { reset: true }), /Unsafe ownership/);
  }
});
test('[TD-LOCK] existing recovery locks and case-folding collisions fail closed', async t => {
  const root = await sandbox(t), manifest = fixtureManifest(); await mkdir(join(root, '.test-vault/.shell-fixtures-lock'), { recursive: true });
  await assert.rejects(planFixtures(root, manifest), /already in progress/); await rm(join(root, '.test-vault/.shell-fixtures-lock'), { recursive: true });
  await mkdir(join(root, '.test-vault/records')); await assert.rejects(planFixtures(root, manifest), /Case-insensitive/);
});
test('[TD-CLI] actual command entrypoint defaults to a read-only plan and uses an explicit target', async t => {
  const root = await sandbox(t), manifestPath = join(root, 'manifest.json'); await writeFile(manifestPath, JSON.stringify(fixtureManifest()));
  const p = await runTestData([], { root, manifestPath }); assert.equal(p.mode, 'seed'); assert.deepEqual(await readdir(root), ['manifest.json']);
  await assert.rejects(runTestData(['apply'], { root, manifestPath }), /approval/);
  const result = await runTestData(['apply', '--approve', p.approval], { root, manifestPath }); assert.ok(result.written > 0);
  await assert.rejects(runTestData(['plan', '--target', '../live'], { root, manifestPath }), /Invalid arguments/);
  const reset = await runTestData(['reset-plan'], { root, manifestPath }); await runTestData(['reset', '--approve', reset.approval], { root, manifestPath });
});
