import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executeReleaseOperation, authorizationDigest } from '../../scripts/release/execute.mjs';
import { createGitHubRemote } from '../../scripts/release/github-remote.mjs';
import { sha256 } from '../../scripts/release/candidate.mjs';
import { executionFixture } from './release-execution-fixture.mjs';

test('default operation authenticates discovery and returns exact bound plan without mutation', async t => {
  const f = await executionFixture(t);
  const plan = await executeReleaseOperation(f.input, { remote: f.remote, now: f.now });
  assert.equal(plan.status, 'plan-only'); assert.equal(plan.executed, false);
  assert.deepEqual(plan.authorizationBinding.assetHashes, f.hashes);
  assert.equal(plan.authorizationDigest, authorizationDigest(plan.authorizationBinding));
  assert.deepEqual(f.calls.map(call => call.method), ['snapshot']);
  assert.ok(plan.operations[0].includes(join(f.input.candidateDirectory, 'release-notes.md')));
});

test('first and subsequent drafts upload precisely five captured files with fresh discovery around each write', async t => {
  for (const previous of [false, true]) {
    const f = await executionFixture(t);
    if (previous) f.state.releases.push({ id: 1, version: '0.3.0', draft: false, targetCommit: 'c'.repeat(40), assets: [] });
    const result = await executeReleaseOperation(f.input, f.options);
    assert.equal(result.status, 'draft-complete'); assert.equal(result.completedOperations.length, 6);
    const writes = f.calls.filter(call => call.method !== 'snapshot');
    assert.equal(writes[0].method, 'createDraft'); assert.equal(writes[0].commit, f.input.commit);
    assert.equal(writes[0].notes, f.bytes['release-notes.md']); assert.equal(writes.length, 6);
    for (const call of writes.slice(1)) assert.equal(call.bytes.toString(), f.bytes[call.name]);
    for (let index = 0; index < f.calls.length; index++) if (f.calls[index].method !== 'snapshot') {
      assert.equal(f.calls[index - 1].method, 'snapshot'); assert.equal(f.calls[index + 1].method, 'snapshot');
    }
    assert.equal(f.state.tag, null);
  }
});

test('partial drafts resume only missing uploads and complete drafts are write-free', async t => {
  const f = await executionFixture(t);
  f.state.releases = [{ ...f.draft, assets: f.draft.assets.slice(0, 2) }];
  const resumed = await executeReleaseOperation(f.input, f.options);
  assert.equal(resumed.status, 'draft-complete'); assert.equal(resumed.completedOperations.length, 3);
  assert.ok(f.calls.filter(call => call.method === 'uploadAsset').every(call => !['main.js', 'manifest.json'].includes(call.name)));
  f.calls.length = 0;
  const complete = await executeReleaseOperation(f.input, f.options);
  assert.equal(complete.status, 'draft-complete'); assert.equal(complete.executed, false);
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
});

test('uncertain committed upload stops immediately and deliberate rerun reconciles without duplicate upload', async t => {
  const f = await executionFixture(t);
  const upload = f.remote.uploadAsset;
  f.remote.uploadAsset = async request => { await upload(request); throw new Error('CONNECTION_LOST'); };
  const failed = await executeReleaseOperation(f.input, f.options);
  assert.equal(failed.status, 'uncertain'); assert.equal(failed.error, 'CONNECTION_LOST');
  assert.equal(f.calls.filter(call => call.method === 'uploadAsset').length, 1);
  f.remote.uploadAsset = upload; f.calls.length = 0;
  const resumed = await executeReleaseOperation(f.input, f.options);
  assert.equal(resumed.status, 'draft-complete'); assert.equal(resumed.completedOperations.length, 4);
  assert.ok(f.calls.filter(call => call.method === 'uploadAsset').every(call => call.name !== 'main.js'));
});

test('uncertain create and missing upload readback do not trigger a retry', async t => {
  const f = await executionFixture(t); const create = f.remote.createDraft;
  f.remote.createDraft = async request => { await create(request); throw new Error('CREATE_TIMEOUT'); };
  const failed = await executeReleaseOperation(f.input, f.options);
  assert.equal(failed.status, 'uncertain'); assert.equal(failed.error, 'CREATE_TIMEOUT');
  assert.equal(f.calls.filter(call => call.method !== 'snapshot').length, 1);
  f.remote.createDraft = create;
  f.remote.uploadAsset = async request => { f.calls.push({ method: 'uploadAsset', ...request }); };
  const missing = await executeReleaseOperation(f.input, f.options);
  assert.equal(missing.status, 'uncertain'); assert.equal(missing.error, 'UPLOAD_READBACK_MISMATCH');
});

test('captured bytes and review evidence cannot change during authorization or remote writes', async t => {
  const f = await executionFixture(t);
  f.options.authorize = async binding => {
    await writeFile(join(f.input.candidateDirectory, 'main.js'), 'changed after capture');
    f.input.commit = 'd'.repeat(40);
    return structuredClone(binding);
  };
  const result = await executeReleaseOperation(f.input, f.options);
  assert.equal(result.status, 'draft-complete');
  assert.equal(f.calls.find(call => call.method === 'uploadAsset' && call.name === 'main.js').bytes.toString(), f.bytes['main.js']);
  assert.equal(result.sourceCommit, 'a'.repeat(40));
});

test('missing authorization and changes to each bound identity fail before mutations', async t => {
  const f = await executionFixture(t);
  const mutations = [() => false, binding => ({ ...binding, repository: 'Other/repository' }),
    binding => ({ ...binding, sourceCommit: 'b'.repeat(40) }), binding => ({ ...binding, version: '9.9.9' }),
    binding => ({ ...binding, mode: 'promote' }), binding => ({ ...binding, assetHashes: { ...binding.assetHashes, 'candidate.json': 'f'.repeat(64) } })];
  for (const authorize of mutations) await assert.rejects(executeReleaseOperation(f.input, { ...f.options, authorize }), /EXPLICIT_RELEASE_AUTHORIZATION_REQUIRED/);
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
});

test('invalid, stale, mismatched or immutable remote states reject before writes', async t => {
  const f = await executionFixture(t); const valid = structuredClone(f.state);
  for (const [change, reason] of [
    [{ repository: 'Other/repository' }, /REMOTE_REPOSITORY_MISMATCH/],
    [{ sourceReviewed: false }, /REMOTE_SNAPSHOT_INVALID_OR_STALE/],
    [{ checkedAt: '2026-09-20T12:00:00Z' }, /REMOTE_SNAPSHOT_INVALID_OR_STALE/],
    [{ tag: { name: f.input.version, commit: 'b'.repeat(40) } }, /TAG_SOURCE_MISMATCH/],
    [{ releases: [{ ...f.draft, draft: false }] }, /PUBLISHED_VERSION_IMMUTABLE/],
    [{ releases: [{ ...f.draft, targetCommit: 'b'.repeat(40) }] }, /RELEASE_SOURCE_MISMATCH/],
    [{ releases: [{ ...f.draft, assets: [{ name: 'main.js', sha256: 'b'.repeat(64) }] }] }, /REMOTE_ASSET_HASH_MISMATCH/],
    [{ releases: [{ ...f.draft, id: undefined }] }, /REMOTE_RELEASE_ID_REQUIRED/],
  ]) {
    Object.assign(f.state, valid, change);
    await assert.rejects(executeReleaseOperation(f.input, f.options), reason);
  }
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
});

test('remote changes after authorization and draft replacement after upload are detected', async t => {
  const f = await executionFixture(t);
  f.options.authorize = async binding => { f.state.releases = [{ ...f.draft, draft: false }]; return binding; };
  await assert.rejects(executeReleaseOperation(f.input, f.options), /PUBLISHED_VERSION_IMMUTABLE/);
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
  f.state.releases = [{ ...f.draft, assets: [] }]; f.options.authorize = async binding => binding;
  const upload = f.remote.uploadAsset;
  f.remote.uploadAsset = async request => { await upload(request); f.state.releases[0].id = 12; };
  const changed = await executeReleaseOperation(f.input, f.options);
  assert.equal(changed.status, 'uncertain'); assert.equal(changed.error, 'REMOTE_RELEASE_ID_CHANGED');
  assert.equal(f.calls.filter(call => call.method === 'uploadAsset').length, 1);
});

test('create response pins release identity before discovery and invalid responses cannot authorize uploads', async t => {
  for (const response of [{ id: 12 }, {}, { id: '11' }]) {
    const f = await executionFixture(t); const create = f.remote.createDraft;
    f.remote.createDraft = async request => { await create(request); return response; };
    const result = await executeReleaseOperation(f.input, f.options);
    assert.equal(result.status, 'uncertain');
    assert.equal(result.error, response.id === 12 ? 'REMOTE_RELEASE_ID_CHANGED' : 'DRAFT_RESPONSE_ID_REQUIRED');
    assert.equal(f.calls.filter(call => call.method !== 'snapshot').length, 1);
  }
});

test('same repository and version cannot execute concurrently even from another candidate directory', async t => {
  const f = await executionFixture(t); const other = await executionFixture(t);
  let release; const held = new Promise(resolve => { release = resolve; });
  let started; const ready = new Promise(resolve => { started = resolve; });
  f.options.authorize = async binding => { started(); await held; return binding; };
  const active = executeReleaseOperation(f.input, f.options);
  await ready;
  try { await assert.rejects(executeReleaseOperation(other.input, other.options), /RELEASE_OPERATION_LOCKED/); }
  finally { release(); }
  assert.equal((await active).status, 'draft-complete');
});

test('promotion requires complete evidence and existing tag, then validates immutable public readback', async t => {
  const f = await executionFixture(t); f.input.mode = 'promote'; f.state.releases = [structuredClone(f.draft)];
  await assert.rejects(executeReleaseOperation(f.input, f.options), /EXISTING_VERIFIED_TAG_REQUIRED/);
  f.state.tag = { name: f.input.version, commit: f.input.commit };
  await assert.rejects(executeReleaseOperation({ ...f.input, acceptance: [] }, f.options), /NATIVE_ACCEPTANCE_REQUIRED/);
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
  const published = await executeReleaseOperation(f.input, f.options);
  assert.equal(published.status, 'published'); assert.equal(published.completedOperations.length, 1);
  assert.deepEqual(f.calls.filter(call => call.method !== 'snapshot').map(call => call.method), ['publishDraft']);
  await assert.rejects(executeReleaseOperation(f.input, f.options), /PUBLISHED_VERSION_IMMUTABLE/);
});

test('publication timeout remains uncertain even if remote committed, and rerun cannot edit public version', async t => {
  const f = await executionFixture(t); f.input.mode = 'promote'; f.state.releases = [structuredClone(f.draft)];
  f.state.tag = { name: f.input.version, commit: f.input.commit };
  const publish = f.remote.publishDraft;
  f.remote.publishDraft = async request => { await publish(request); throw new Error('PUBLISH_TIMEOUT'); };
  const result = await executeReleaseOperation(f.input, f.options);
  assert.equal(result.status, 'uncertain'); assert.equal(result.error, 'PUBLISH_TIMEOUT');
  await assert.rejects(executeReleaseOperation(f.input, f.options), /PUBLISHED_VERSION_IMMUTABLE/);
  assert.equal(f.calls.filter(call => call.method === 'publishDraft').length, 1);
});

test('promotion authorization binds reviewed acceptance, reviewer and declared platform scope', async t => {
  const f = await executionFixture(t); f.input.mode = 'promote'; f.state.releases = [structuredClone(f.draft)];
  f.state.tag = { name: f.input.version, commit: f.input.commit };
  const initial = await executeReleaseOperation(f.input, { ...f.options, execute: false });
  const alteredEvidence = structuredClone(f.input); alteredEvidence.acceptance[0].actor = 'A different maintainer';
  const alteredReview = structuredClone(f.input); alteredReview.review.actor = 'A different reviewer';
  const alteredPlatforms = structuredClone(f.input); alteredPlatforms.platforms.push('win32');
  const windows = structuredClone(alteredPlatforms.acceptance[0]); windows.host.platform = 'win32'; alteredPlatforms.acceptance.push(windows);
  for (const input of [alteredEvidence, alteredReview, alteredPlatforms]) {
    const updated = await executeReleaseOperation(input, { ...f.options, execute: false });
    assert.notEqual(updated.authorizationDigest, initial.authorizationDigest);
    await assert.rejects(executeReleaseOperation(input, { ...f.options, authorize: async () => initial.authorizationBinding }), /EXPLICIT_RELEASE_AUTHORIZATION_REQUIRED/);
  }
  assert.ok(f.calls.every(call => call.method === 'snapshot'));
});

test('unavailable discovery and corrupted local bytes never become empty remote or success', async t => {
  const f = await executionFixture(t);
  f.remote.snapshot = async () => { throw new Error('READ_UNAVAILABLE'); };
  await assert.rejects(executeReleaseOperation(f.input, f.options), /READ_UNAVAILABLE/);
  await writeFile(join(f.input.candidateDirectory, 'styles.css'), 'changed');
  await assert.rejects(executeReleaseOperation(f.input, f.options), /ASSET_HASH_MISMATCH/);
  assert.equal(f.calls.length, 0);
});

test('execution integrates real GitHub discovery and mutation adapter across interrupted upload and promotion', async t => {
  const f = await executionFixture(t); const base = `repos/${f.input.repository}`;
  const raw = []; const assets = []; const requests = []; let interrupted = false; let tagged = false;
  const request = async call => {
    requests.push(call);
    const { method, path } = call;
    if (method === 'GET') {
      if (path === base) return { full_name: f.input.repository, default_branch: 'main', permissions: { push: true } };
      if (path === `${base}/commits/main`) return { sha: f.input.commit };
      if (path === `${base}/compare/${f.input.commit}...${f.input.commit}`) return { status: 'identical', base_commit: { sha: f.input.commit }, merge_base_commit: { sha: f.input.commit } };
      if (path === `${base}/git/ref/tags/${f.input.version}`) {
        if (tagged) return { ref: `refs/tags/${f.input.version}`, object: { type: 'commit', sha: f.input.commit } };
        throw Object.assign(new Error('absent'), { status: 404 });
      }
      if (path === `${base}/releases?per_page=100&page=1`) return structuredClone(raw);
      if (path === `${base}/releases/11/assets?per_page=100&page=1`) return structuredClone(assets);
    }
    if (method === 'POST' && path === `${base}/releases`) {
      assert.equal(call.body.draft, true); assert.equal(call.body.target_commitish, f.input.commit);
      raw.push({ id: 11, ...call.body }); return { id: 11 };
    }
    if (method === 'POST' && path.startsWith(`https://uploads.github.com/${base}/releases/11/assets?name=`)) {
      const name = new URL(path).searchParams.get('name');
      assert.equal(assets.some(asset => asset.name === name), false);
      assert.equal(call.bytes.toString(), f.bytes[name]);
      assets.push({ id: assets.length + 1, name, state: 'uploaded', size: call.bytes.length, digest: `sha256:${sha256(call.bytes)}` });
      if (!interrupted) { interrupted = true; throw new Error('SIMULATED_TRANSPORT_TIMEOUT'); }
      return { id: assets.length };
    }
    if (method === 'PATCH' && path === `${base}/releases/11`) {
      assert.equal(call.body.draft, false); assert.equal(call.body.target_commitish, f.input.commit);
      raw[0].draft = false; return structuredClone(raw[0]);
    }
    assert.fail(`Unexpected request ${method} ${path}`);
  };
  const remote = createGitHubRemote({ request, now: f.now });
  const options = { ...f.options, remote };
  assert.equal((await executeReleaseOperation(f.input, options)).status, 'uncertain');
  assert.equal(assets.length, 1);
  assert.equal((await executeReleaseOperation(f.input, options)).status, 'draft-complete');
  assert.equal(raw.length, 1); assert.equal(assets.length, 5);
  tagged = true;
  assert.equal((await executeReleaseOperation({ ...f.input, mode: 'promote' }, options)).status, 'published');
  assert.deepEqual(requests.filter(call => call.method !== 'GET').map(call => call.method), ['POST', 'POST', 'POST', 'POST', 'POST', 'POST', 'PATCH']);
  assert.ok(requests.every(call => !call.path.includes('/git/refs')));
});
