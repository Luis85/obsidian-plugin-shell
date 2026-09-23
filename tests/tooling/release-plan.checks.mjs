import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256 } from '../../scripts/release/candidate.mjs';
import { planReleaseOperation, nativeScenarios } from '../../scripts/release/promotion-plan.mjs';

async function fixture(t) {
  const candidateDirectory = await mkdtemp(join(tmpdir(), 'release-plan-'));
  t.after(() => rm(candidateDirectory, { recursive: true, force: true }));
  const commit = 'a'.repeat(40); const version = '0.4.0'; const now = new Date('2026-09-23T12:00:00Z');
  const manifest = { id: 'consumer-plugin', version, minAppVersion: '1.13.7', isDesktopOnly: true };
  const files = { 'main.js': '/* license */ console.log("retained");', 'manifest.json': JSON.stringify(manifest), 'styles.css': '.owned { color: inherit; }', 'release-notes.md': '# Notes\n\nReviewed release.' };
  const hashes = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, sha256(bytes)]));
  const assetHashes = Object.fromEntries(['main.js', 'manifest.json', 'styles.css'].map(name => [name, hashes[name]]));
  const record = { schemaVersion: 1, kind: 'release-rehearsal', sourceCommit: commit, version, identity: manifest.id,
    minAppVersion: manifest.minAppVersion, isDesktopOnly: true, assetHashes, notesHash: hashes['release-notes.md'], lockHash: 'b'.repeat(64),
    createdAt: '2026-09-23T10:00:00Z', tools: { node: 'v24.21.0', npm: '11.19.1' },
    qualification: { status: 'passed', command: 'verify', sourceCommit: commit, assetHashes, node: 'v24.21.0', npm: '11.19.1' }, nativeAcceptance: { status: 'not-run' }, publication: 'not-authorized' };
  files['candidate.json'] = JSON.stringify(record); hashes['candidate.json'] = sha256(files['candidate.json']);
  for (const [name, value] of Object.entries(files)) await writeFile(join(candidateDirectory, name), value);
  const remote = { schemaVersion: 1, repository: 'Example/consumer-plugin', sourceCommit: commit, sourceReviewed: true, checkedAt: '2026-09-23T11:50:00Z', tag: null, releases: [] };
  const draft = { version, draft: true, targetCommit: commit, assets: Object.entries(hashes).map(([name, hash]) => ({ name, sha256: hash })) };
  const acceptance = [{ schemaVersion: 1, mode: 'manual', actor: 'Fixture maintainer', completedAt: '2026-09-23T11:30:00Z', sourceCommit: commit, version, assetHashes,
    host: { platform: 'linux', architecture: 'x64', appVersion: '1.13.7', installerVersion: '1.13.8' }, scenarios: Object.fromEntries(nativeScenarios.map(name => [name, 'passed'])) }];
  const review = { actor: 'Fixture reviewer', reviewedAt: '2026-09-23T11:40:00Z', sourceCommit: commit, assetHashes };
  return { candidateDirectory, commit, version, now, remote, draft, acceptance, review, platforms: ['linux'] };
}
test('first and subsequent drafts plan exact target and retained uploads without executing', async t => {
  const f = await fixture(t);
  for (const releases of [[], [{ version: '0.3.0', draft: false, targetCommit: 'c'.repeat(40), assets: [] }]]) {
    const plan = await planReleaseOperation({ ...f, mode: 'draft', remote: { ...f.remote, releases } });
    assert.equal(plan.executed, false); assert.equal(plan.authorization, 'not-granted'); assert.equal(plan.status, 'plan-only');
    assert.deepEqual(plan.operations[0].slice(0, 7), ['release', 'create', '0.4.0', '--repo', 'Example/consumer-plugin', '--target', f.commit]);
    assert.ok(plan.operations[0].includes('--draft')); assert.equal(plan.missingAssets.length, 5);
    assert.ok(plan.operations.every(args => !args.includes('--clobber')));
  }
});
test('partial draft upload resumes only absent identical-candidate assets', async t => {
  const f = await fixture(t); const partial = { ...f.draft, assets: f.draft.assets.slice(0, 2) };
  const plan = await planReleaseOperation({ ...f, mode: 'draft', remote: { ...f.remote, releases: [partial] } });
  assert.equal(plan.operations.length, 1); assert.deepEqual(plan.operations[0].slice(0, 3), ['release', 'upload', '0.4.0']);
  assert.equal(plan.missingAssets.length, 3); assert.ok(!plan.missingAssets.includes('main.js'));
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote: { ...f.remote, releases: [partial] } }), /INCOMPLETE_REMOTE_ASSETS/);
  const complete = await planReleaseOperation({ ...f, mode: 'draft', remote: { ...f.remote, releases: [f.draft] } });
  assert.deepEqual(complete.operations, []);
});
test('promotion plans only retained draft with bound native scenarios, minimum host and review record', async t => {
  const f = await fixture(t); const remote = { ...f.remote, tag: { name: f.version, commit: f.commit }, releases: [f.draft] };
  const plan = await planReleaseOperation({ ...f, mode: 'promote', remote });
  assert.deepEqual(plan.operations, [['release', 'edit', f.version, '--repo', remote.repository, '--target', f.commit, '--draft=false', '--verify-tag']]);
  assert.equal(plan.executed, false); assert.equal(plan.authorization, 'not-granted');
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, acceptance: undefined }), /NATIVE_ACCEPTANCE_REQUIRED/);
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, review: undefined }), /CANDIDATE_REVIEW_REQUIRED/);
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, platforms: ['darwin'] }), /NATIVE_ACCEPTANCE_REQUIRED/);
  const skipped = structuredClone(f.acceptance); skipped[0].scenarios['failed-write'] = 'not-run';
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, acceptance: skipped }), /NATIVE_ACCEPTANCE_INVALID/);
  const newer = structuredClone(f.acceptance); newer[0].host.appVersion = '1.13.8';
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, acceptance: newer }), /MINIMUM_HOST_ACCEPTANCE_REQUIRED/);
});
test('rejects published versions, duplicate releases/assets, wrong tags, source and changed uploads', async t => {
  const f = await fixture(t);
  for (const [remote, reason] of [
    [{ ...f.remote, releases: [{ ...f.draft, draft: false }] }, /PUBLISHED_VERSION_IMMUTABLE/],
    [{ ...f.remote, releases: [f.draft, f.draft] }, /DUPLICATE_REMOTE_RELEASE/],
    [{ ...f.remote, tag: { name: f.version, commit: 'b'.repeat(40) } }, /TAG_SOURCE_MISMATCH/],
    [{ ...f.remote, tag: { name: 'v0.4.0', commit: f.commit } }, /TAG_SOURCE_MISMATCH/],
    [{ ...f.remote, releases: [{ ...f.draft, targetCommit: 'b'.repeat(40) }] }, /RELEASE_SOURCE_MISMATCH/],
    [{ ...f.remote, releases: [{ ...f.draft, assets: [f.draft.assets[0], f.draft.assets[0]] }] }, /DUPLICATE_REMOTE_ASSET/],
    [{ ...f.remote, releases: [{ ...f.draft, assets: [{ name: 'main.js', sha256: 'b'.repeat(64) }] }] }, /REMOTE_ASSET_HASH_MISMATCH/],
    [{ ...f.remote, checkedAt: '2026-09-20T10:00:00Z' }, /REMOTE_SNAPSHOT_INVALID_OR_STALE/],
    [{ ...f.remote, sourceReviewed: false }, /REMOTE_SNAPSHOT_INVALID_OR_STALE/],
  ]) await assert.rejects(planReleaseOperation({ ...f, mode: 'draft', remote }), reason);
});
test('local changed bytes and native evidence hash/source mismatch fail before an operation is returned', async t => {
  const f = await fixture(t); const remote = { ...f.remote, releases: [f.draft] };
  const wrong = structuredClone(f.acceptance); wrong[0].assetHashes['main.js'] = 'b'.repeat(64);
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, acceptance: wrong }), /NATIVE_ACCEPTANCE_INVALID/);
  wrong[0].assetHashes = f.acceptance[0].assetHashes; wrong[0].sourceCommit = 'c'.repeat(40);
  await assert.rejects(planReleaseOperation({ ...f, mode: 'promote', remote, acceptance: wrong }), /NATIVE_ACCEPTANCE_INVALID/);
  const original = await readFile(join(f.candidateDirectory, 'main.js')); await writeFile(join(f.candidateDirectory, 'main.js'), 'changed');
  await assert.rejects(planReleaseOperation({ ...f, mode: 'draft', remote }), /ASSET_HASH_MISMATCH/);
  await writeFile(join(f.candidateDirectory, 'main.js'), original);
});
