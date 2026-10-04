import test from 'node:test';
import assert from 'node:assert/strict';
import { createGhRequest, createGitHubRemote } from '../../scripts/release/github-remote.mjs';

const commit = 'a'.repeat(40); const tip = 'b'.repeat(40); const annotation = 'c'.repeat(40);
const input = { repository: 'Example/plugin', commit, version: '0.4.0' };
const base = 'repos/Example/plugin';
const ref = { ref: 'refs/tags/0.4.0', object: { type: 'commit', sha: commit } };
const draft = { id: 7, tag_name: '0.4.0', draft: true, prerelease: false, target_commitish: commit };
const asset = { id: 20, name: 'main.js', state: 'uploaded', size: 4, digest: `sha256:${'d'.repeat(64)}` };
function fixture(overrides = {}) {
  const calls = [];
  const routes = {
    [base]: { full_name: input.repository, default_branch: 'main', permissions: { push: true } },
    [`${base}/commits/main`]: { sha: tip },
    [`${base}/compare/${commit}...${tip}`]: { status: 'ahead', base_commit: { sha: commit }, merge_base_commit: { sha: commit } },
    [`${base}/git/ref/tags/0.4.0`]: ref,
    [`${base}/releases?per_page=100&page=1`]: [draft],
    [`${base}/releases/7/assets?per_page=100&page=1`]: [asset],
    ...overrides,
  };
  const request = async call => {
    calls.push(call);
    assert.equal(call.method, 'GET');
    assert.ok(Object.hasOwn(routes, call.path), `Unexpected endpoint: ${call.path}`);
    const value = routes[call.path];
    if (value instanceof Error) throw value;
    return value;
  };
  return { calls, remote: createGitHubRemote({ request, now: () => new Date('2026-09-23T12:00:00Z') }) };
}
const failure = status => Object.assign(new Error('remote failed'), { status });

test('authenticated discovery proves default branch ancestry, resolves tag and asset digest', async () => {
  const { remote, calls } = fixture();
  const snapshot = await remote.snapshot(input);
  assert.deepEqual(snapshot.tag, { name: input.version, commit });
  assert.equal(snapshot.sourceReviewed, true);
  assert.equal(snapshot.defaultBranchCommit, tip);
  assert.equal(snapshot.checkedAt, '2026-09-23T12:00:00.000Z');
  assert.deepEqual(snapshot.release, { id: 7, version: input.version, draft: true, targetCommit: commit, assets: [{ id: 20, name: 'main.js', sha256: 'd'.repeat(64) }] });
  assert.equal(calls.length, 6);
});

test('only an exact tag endpoint 404 is absence; auth, network and release errors fail closed', async () => {
  const tagPath = `${base}/git/ref/tags/0.4.0`;
  const missing = fixture({ [tagPath]: failure(404) });
  assert.equal((await missing.remote.snapshot(input)).tag, null);
  for (const status of [undefined, 401, 403, 429, 500]) {
    await assert.rejects(fixture({ [tagPath]: failure(status) }).remote.snapshot(input), /remote failed/);
  }
  for (const path of [base, `${base}/commits/main`, `${base}/releases?per_page=100&page=1`, `${base}/releases/7/assets?per_page=100&page=1`]) {
    await assert.rejects(fixture({ [path]: failure(404) }).remote.snapshot(input), /remote failed/);
  }
});

test('annotated tags peel to commit and malformed or cyclic tag objects fail', async () => {
  const tagPath = `${base}/git/ref/tags/0.4.0`;
  const annotated = { ref: ref.ref, object: { type: 'tag', sha: annotation } };
  const routes = { [tagPath]: annotated, [`${base}/git/tags/${annotation}`]: { sha: annotation, object: { type: 'commit', sha: commit } } };
  assert.equal((await fixture(routes).remote.snapshot(input)).tag.commit, commit);
  for (const invalid of [{ ...ref, ref: 'refs/heads/0.4.0' }, { ...ref, object: { type: 'tree', sha: commit } }, { ...ref, object: { type: 'commit', sha: 'short' } }]) {
    await assert.rejects(fixture({ [tagPath]: invalid }).remote.snapshot(input), /REMOTE_TAG_INVALID/);
  }
  routes[`${base}/git/tags/${annotation}`] = { sha: annotation, object: annotated.object };
  await assert.rejects(fixture(routes).remote.snapshot(input), /REMOTE_TAG_INVALID/);
});

test('discovery rejects missing draft visibility, source outside default ancestry and ambiguous release source', async () => {
  for (const metadata of [{ full_name: input.repository, default_branch: 'main' }, { full_name: 'Other/plugin', permissions: { push: true } }]) {
    await assert.rejects(fixture({ [base]: metadata }).remote.snapshot(input), /AUTHENTICATED_DRAFT_VISIBILITY_REQUIRED/);
  }
  for (const status of ['behind', 'diverged', null]) {
    await assert.rejects(fixture({ [`${base}/compare/${commit}...${tip}`]: { status, base_commit: { sha: commit }, merge_base_commit: { sha: commit } } }).remote.snapshot(input), /SOURCE_NOT_ON_DEFAULT_BRANCH/);
  }
  await assert.rejects(fixture({ [`${base}/compare/${commit}...${tip}`]: { status: 'ahead', base_commit: { sha: commit }, merge_base_commit: { sha: tip } } }).remote.snapshot(input), /SOURCE_NOT_ON_DEFAULT_BRANCH/);
  for (const release of [{ ...draft, target_commitish: 'main' }, { ...draft, prerelease: true }, { ...draft, id: '7' }, { ...draft, target_commitish: tip }]) {
    await assert.rejects(fixture({ [`${base}/releases?per_page=100&page=1`]: [release] }).remote.snapshot(input), /REMOTE_RELEASE|TAG_SOURCE_MISMATCH/);
  }
});

test('published releases resolve commit from tag rather than moving target branch', async () => {
  const snapshot = await fixture({ [`${base}/releases?per_page=100&page=1`]: [{ ...draft, draft: false, target_commitish: 'main' }] }).remote.snapshot(input);
  assert.equal(snapshot.release.targetCommit, commit);
  await assert.rejects(fixture({ [`${base}/git/ref/tags/0.4.0`]: failure(404), [`${base}/releases?per_page=100&page=1`]: [{ ...draft, draft: false }] }).remote.snapshot(input), /REMOTE_RELEASE_SOURCE_INVALID/);
});

test('historical assets without digests and unrelated prereleases cannot block stable candidate discovery', async () => {
  const { remote, calls } = fixture({
    [`${base}/releases?per_page=100&page=1`]: [draft,
      { ...draft, id: 8, tag_name: '0.3.0', draft: false, target_commitish: 'main', assets: [{ digest: null, name: 'old-source.zip' }] },
      { ...draft, id: 9, tag_name: '0.5.0-beta.1', prerelease: true }],
    [`${base}/git/ref/tags/0.3.0`]: { ref: 'refs/tags/0.3.0', object: { type: 'commit', sha: tip } },
  });
  const snapshot = await remote.snapshot(input);
  assert.equal(snapshot.releases.length, 2);
  assert.equal(snapshot.releases[1].targetCommit, tip);
  assert.deepEqual(snapshot.releases[1].assets, []);
  assert.ok(calls.every(call => !call.path.includes('/releases/8/assets')));
});

test('release and asset pagination includes every page before planning', async () => {
  const routes = { [`${base}/releases?per_page=100&page=1`]: Array.from({ length: 100 }, (_, i) => ({ ...draft, id: i + 1, tag_name: `0.3.${i}` })),
    [`${base}/releases?per_page=100&page=2`]: [{ ...draft, id: 101 }],
    [`${base}/releases/101/assets?per_page=100&page=1`]: Array.from({ length: 100 }, (_, i) => ({ ...asset, id: i + 1, name: `asset-${i}` })),
    [`${base}/releases/101/assets?per_page=100&page=2`]: [{ ...asset, id: 101 }],
  };
  for (let i = 0; i < 100; i++) {
    routes[`${base}/git/ref/tags/0.3.${i}`] = failure(404);
    routes[`${base}/releases/${i + 1}/assets?per_page=100&page=1`] = [];
  }
  const snapshot = await fixture(routes).remote.snapshot(input);
  assert.equal(snapshot.releases.length, 101);
  assert.equal(snapshot.release.assets.length, 101);
  assert.equal(snapshot.release.assets.at(-1).name, 'main.js');
});

test('malformed pages, repeated releases and missing or invalid asset digests fail closed', async () => {
  for (const value of [null, {}, [draft, draft]]) {
    await assert.rejects(fixture({ [`${base}/releases?per_page=100&page=1`]: value }).remote.snapshot(input), /REMOTE_PAGE_INVALID|REMOTE_RELEASE_INVALID/);
  }
  for (const value of [{ ...asset, digest: null }, { ...asset, digest: 'sha1:abc' }, { ...asset, digest: `sha256:${'z'.repeat(64)}` }]) {
    await assert.rejects(fixture({ [`${base}/releases/7/assets?per_page=100&page=1`]: [value] }).remote.snapshot(input), /REMOTE_ASSET_DIGEST_REQUIRED/);
  }
  for (const value of [[{ ...asset, state: 'starter' }], [asset, asset]]) {
    await assert.rejects(fixture({ [`${base}/releases/7/assets?per_page=100&page=1`]: value }).remote.snapshot(input), /REMOTE_ASSET_INVALID/);
  }
});

test('mutation API pins full commit and release id, uploads retained bytes without delete or clobber', async () => {
  const calls = []; const remote = createGitHubRemote({ request: async call => { calls.push(call); return { id: 7 }; } });
  const bytes = Buffer.from([0, 255, 10]);
  await remote.createDraft({ ...input, notes: 'Exact notes' });
  await remote.uploadAsset({ repository: input.repository, releaseId: 7, name: 'main.js', bytes });
  await remote.publishDraft({ ...input, releaseId: 7 });
  assert.deepEqual(calls.map(call => call.method), ['POST', 'POST', 'PATCH']);
  assert.equal(calls[0].body.target_commitish, commit); assert.equal(calls[0].body.draft, true);
  assert.equal(calls[0].body.body, 'Exact notes'); assert.equal(calls[0].body.generate_release_notes, false);
  assert.equal(calls[1].path, 'https://uploads.github.com/repos/Example/plugin/releases/7/assets?name=main.js');
  assert.equal(calls[1].bytes, bytes);
  assert.deepEqual(calls[2], { method: 'PATCH', path: `${base}/releases/7`, body: { draft: false, tag_name: input.version, target_commitish: commit, make_latest: 'true' } });
  for (const repository of ['https://evil.test/a', 'Example/plugin?x=y', 'Example/../other', 'Example/plugin\n']) {
    await assert.rejects(remote.snapshot({ ...input, repository }), /INVALID_REPOSITORY/);
  }
  await assert.rejects(remote.uploadAsset({ repository: input.repository, releaseId: 7, name: '../main.js', bytes }), /INVALID_RELEASE_UPLOAD/);
  await assert.rejects(remote.uploadAsset({ repository: input.repository, releaseId: -1, name: 'main.js', bytes }), /INVALID_RELEASE_UPLOAD/);
  assert.equal(calls.length, 3);
});

test('gh transport uses argument arrays and stdin bytes and suppresses sensitive failure output', async () => {
  const runs = []; const bytes = Buffer.from([255, 0, 128]);
  const request = createGhRequest({ run: (executable, args, options) => {
    runs.push({ executable, args, options });
    return { status: 0, stdout: 'HTTP/2.0 201 Created\r\nContent-Type: application/json\r\n\r\n{"id":7}' };
  } });
  assert.deepEqual(await request({ method: 'POST', path: `https://uploads.github.com/${base}/releases/7/assets?name=main.js`, bytes }), { id: 7 });
  assert.equal(runs[0].executable, 'gh');
  assert.ok(Array.isArray(runs[0].args)); assert.equal(runs[0].options.shell, undefined);
  assert.equal(runs[0].options.windowsHide, true); assert.equal(runs[0].options.input, bytes);
  assert.ok(runs[0].args.includes('github.com')); assert.ok(runs[0].args.includes('--input'));
  for (const path of ['https://evil.test/api', `${base}/../secret`, `${base}\nAuthorization: secret`]) {
    await assert.rejects(request({ path }), /UNSAFE_GITHUB_API_REQUEST/);
  }
  const denied = createGhRequest({ run: () => ({ status: 1, stdout: 'HTTP/2.0 403 Forbidden\n\n{"token":"secret"}', stderr: 'secret' }) });
  await assert.rejects(denied({ path: base }), error => error.status === 403 && error.message === 'GITHUB_API_FAILED_HTTP_403');
  const malformed = createGhRequest({ run: () => ({ status: 0, stdout: 'HTTP/2.0 200 OK\n\nsecret' }) });
  await assert.rejects(malformed({ path: base }), /^Error: GITHUB_API_RESPONSE_INVALID$/);
});
