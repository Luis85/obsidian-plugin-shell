import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease } from '../../scripts/release/publish.mjs';
import { sha256 } from '../../scripts/release/candidate.mjs';
import { publishFixture, candidateFiles, repository, version, head, other, changelog } from './release-publish-fixture.mjs';

/** Every refusal happens during read-only discovery: no write is attempted, in plan or execute mode. */
async function refuses(t, mutate, expected, { execute = true } = {}) {
  const fixture = await publishFixture(t);
  mutate(fixture.state, fixture);
  await assert.rejects(publishRelease({ repository, version, execute, run: fixture.run }), expected);
  assert.deepEqual(fixture.state.writes, []);
}
const asset = (name, bytes) => ({ id: 1, name, state: 'uploaded', size: bytes.length, digest: `sha256:${sha256(bytes)}` });

test('a tag that already points elsewhere is never moved', async t => {
  await refuses(t, state => { state.refs[`tags/${version}`] = other; }, /TAG_SOURCE_MISMATCH: Tag 0\.5\.0 points to c{40}/);
});

test('a missing, red, pending or superseded Release result blocks publication', async t => {
  await refuses(t, state => { state.checkRuns = []; }, /RELEASE_RESULT_MISSING/);
  await refuses(t, state => { state.checkRuns[0].conclusion = 'failure'; }, /RELEASE_RESULT_NOT_GREEN: "Release result" on a{40} is failure/);
  await refuses(t, state => { Object.assign(state.checkRuns[0], { status: 'in_progress', conclusion: null }); }, /RELEASE_RESULT_NOT_GREEN: .* is in_progress/);
  await refuses(t, state => { state.checkRuns.push({ id: 6, name: 'Release result', status: 'completed', conclusion: 'cancelled', check_suite: { id: 301 } }); }, /RELEASE_RESULT_NOT_GREEN/);
  await refuses(t, state => { state.checkRuns[0].name = 'CI result'; }, /RELEASE_RESULT_MISSING/);
  await refuses(t, state => { state.runs[0].conclusion = 'failure'; }, /RELEASE_RUN_MISSING/);
});

test('a missing, expired or misplaced candidate artifact blocks publication; retained-build is the fallback', async t => {
  await refuses(t, state => { state.artifacts = []; }, /CANDIDATE_ARTIFACT_MISSING: Release run 900 has no unexpired qualified-candidate or retained-build artifact/);
  await refuses(t, state => { state.artifacts[0].expired = true; }, /CANDIDATE_ARTIFACT_MISSING/);
  await refuses(t, state => { state.artifactFiles = { dist: {} }; }, /CANDIDATE_ARTIFACT_MISSING: qualified-candidate has no reports\/release\/0\.5\.0-a{40}/);
  const fixture = await publishFixture(t);
  fixture.state.artifacts = [{ id: 2, name: 'retained-build', expired: false }, { id: 3, name: 'unrelated', expired: false }];
  const plan = await publishRelease({ repository, version, run: fixture.run });
  assert.equal(plan.candidate.artifact, 'retained-build'); assert.deepEqual(fixture.state.writes, []);
});

test('candidate bytes, provenance and notes must match the tested commit and its changelog', async t => {
  await refuses(t, state => { state.artifactFiles[Object.keys(state.artifactFiles)[0]]['main.js'] = 'tampered'; }, /CANDIDATE_INVALID: ASSET_HASH_MISMATCH/);
  await refuses(t, state => { const files = candidateFiles(other); state.artifactFiles = { [`reports/release/${version}-${head}`]: files.bytes }; }, /CANDIDATE_INVALID: PROVENANCE_MISMATCH/);
  await refuses(t, state => { state.artifactFiles[Object.keys(state.artifactFiles)[0]]['extra.js'] = 'x'; }, /CANDIDATE_INVALID: ASSET_SET_MISMATCH/);
  await refuses(t, state => { state.changelog = changelog.replace('- Release automation.', '- Different notes.'); }, /NOTES_MISMATCH/);
  await refuses(t, state => { state.changelog = '# Changelog\n\n## 0.5.0\n\nLegacy.\n'; }, /CHANGELOG_NOTES_UNAVAILABLE: CHANGELOG_INVALID/);
});

test('an existing release with different, extra or missing published assets is never modified', async t => {
  const files = candidateFiles();
  const published = assets => state => { state.refs[`tags/${version}`] = head; state.releases.push({ id: 100, tag: version, draft: false, target: head, body: '', assets }); };
  await refuses(t, published([asset('main.js', 'other bytes'), asset('manifest.json', files.bytes['manifest.json']), asset('styles.css', files.bytes['styles.css'])]), /RELEASE_ASSET_MISMATCH: .*main\.js/);
  await refuses(t, published([asset('main.js', files.bytes['main.js']), asset('manifest.json', files.bytes['manifest.json']), asset('styles.css', files.bytes['styles.css']), asset('notes.txt', 'x')]), /RELEASE_ASSET_MISMATCH: .*notes\.txt/);
  await refuses(t, published([asset('main.js', files.bytes['main.js'])]), /RELEASE_ASSET_MISMATCH: Published release 0\.5\.0 is incomplete/);
  await refuses(t, published([{ id: 9, name: 'main.js', state: 'uploaded', size: 3 }]), /REMOTE_ASSET_DIGEST_REQUIRED/);
  await refuses(t, state => { state.releases.push({ id: 100, tag: version, draft: true, target: other, body: '', assets: [] }); }, /RELEASE_SOURCE_MISMATCH/);
  await refuses(t, state => { state.releases.push({ id: 100, tag: version, draft: true, target: head, assets: [] }, { id: 101, tag: version, draft: true, target: head, assets: [] }); }, /DUPLICATE_RELEASE/);
});

test('the release pull request must be unique, from this repository and still at the tested head', async t => {
  await refuses(t, state => { state.refs[`heads/release/${version}`] = other; }, /BRANCH_HEAD_MISMATCH: release\/0\.5\.0 is c{40}/);
  await refuses(t, state => { delete state.refs[`heads/release/${version}`]; }, /BRANCH_HEAD_MISMATCH: release\/0\.5\.0 is missing/);
  await refuses(t, state => { state.pulls = []; }, /RELEASE_PR_NOT_FOUND/);
  await refuses(t, state => { state.pulls[0].head.repo.full_name = 'Fork/plugin'; }, /RELEASE_PR_NOT_FOUND/);
  await refuses(t, state => { state.pulls[0].base.ref = 'develop'; }, /RELEASE_PR_NOT_FOUND/);
  await refuses(t, state => { Object.assign(state.pulls[0], { state: 'closed', merged_at: null }); }, /RELEASE_PR_NOT_FOUND/);
  await refuses(t, state => { state.pulls.push({ ...state.pulls[0], number: 13 }); }, /RELEASE_PR_AMBIGUOUS/);
  await refuses(t, state => { Object.assign(state.pulls[0], { state: 'closed', merged_at: '2026-10-02T09:00:00Z' }); }, /SOURCE_NOT_ON_DEFAULT_BRANCH/);
  await refuses(t, state => { Object.assign(state.pulls[0], { state: 'closed', merged_at: '2026-10-02T09:00:00Z' }); state.onMain.add(head); state.refs[`heads/release/${version}`] = other; }, /BRANCH_HEAD_MISMATCH/);
});

test('a token without push permission may plan but not execute', async t => {
  await refuses(t, state => { state.repo.permissions.push = false; }, /PUSH_PERMISSION_REQUIRED/);
  const fixture = await publishFixture(t);
  fixture.state.repo.permissions.push = false;
  assert.equal((await publishRelease({ repository, version, run: fixture.run })).status, 'planned');
  delete fixture.state.repo.permissions;
  assert.equal((await publishRelease({ repository, version, execute: true, run: fixture.run })).status, 'published');
});
