import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease } from '../release/publish.mjs';
import { sha256 } from '../../src/cli/tooling/release/candidate.mjs';
import { publishFixture, candidateFiles, distributionFiles, repository, version, head, other, changelog, addStaleHold } from '../../src/cli/tests/support/release-publish-fixture.mjs';
import { awaitRun, holdWaitFromEnvironment } from '../release/publish-hold.mjs';

/** Every refusal happens during read-only discovery: no write is attempted, in plan or execute mode. */
async function refuses(t, mutate, expected, { execute = true } = {}) {
  const fixture = await publishFixture(t);
  mutate(fixture.state, fixture);
  await assert.rejects(publishRelease({ repository, version, execute, run: fixture.run, lockDirectory: fixture.folder }), expected);
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
  fixture.state.artifacts = [{ id: 3, name: 'retained-build', expired: false }, { id: 4, name: 'unrelated', expired: false }, fixture.state.artifacts[1]];
  const plan = await publishRelease({ repository, version, run: fixture.run, lockDirectory: fixture.folder });
  assert.equal(plan.candidate.artifact, 'retained-build'); assert.deepEqual(fixture.state.writes, []);
});

test('a missing, expired or empty CLI distribution artifact blocks publication in plan and execute mode', async t => {
  for (const execute of [false, true]) {
    const missing = { execute };
    await refuses(t, state => { state.artifacts = state.artifacts.slice(0, 1); }, new RegExp(`DISTRIBUTION_ARTIFACT_MISSING: Release run 900 has no unexpired workbench-distributions-${head} artifact`), missing);
    await refuses(t, state => { state.artifacts[1].expired = true; }, /DISTRIBUTION_ARTIFACT_MISSING/, missing);
    await refuses(t, state => { state.artifacts[1].name = `workbench-distributions-${other}`; }, /DISTRIBUTION_ARTIFACT_MISSING/, missing);
    await refuses(t, state => { state.distributionFiles = {}; }, /DISTRIBUTION_INVALID: expected .*; found nothing/, missing);
  }
});

test('CLI downloads bound to another version or commit, with a wrong file set or wrong checksums are refused', async t => {
  const manifest = state => JSON.parse(state.distributionFiles['workbench-distributions.json']);
  const setManifest = (state, change) => { state.distributionFiles['workbench-distributions.json'] = JSON.stringify({ ...manifest(state), ...change }); };
  await refuses(t, state => setManifest(state, { version: '0.4.0' }), /DISTRIBUTION_INVALID: the manifest names version 0\.4\.0, not 0\.5\.0/);
  await refuses(t, state => { state.distributionFiles = { ...distributionFiles(other).bytes }; }, new RegExp(`DISTRIBUTION_INVALID: the manifest names source c{40}, not the release head ${head}`));
  await refuses(t, state => { state.distributionFiles = { ...distributionFiles(head, '0.4.0').bytes }; }, /DISTRIBUTION_INVALID: expected workbench-shell-0\.5\.0\.zip/);
  await refuses(t, state => { state.distributionFiles['extra.zip'] = 'x'; }, /DISTRIBUTION_INVALID: expected .* found .*extra\.zip/);
  await refuses(t, state => { delete state.distributionFiles['workbench-SHA256SUMS']; }, /DISTRIBUTION_INVALID: expected/);
  await refuses(t, state => { state.distributionFiles[`workbench-shell-${version}.zip`] = 'PK tampered'; }, /DISTRIBUTION_INVALID: the manifest entry for workbench-shell-0\.5\.0\.zip does not match its bytes/);
  await refuses(t, state => { state.distributionFiles['workbench-SHA256SUMS'] = state.distributionFiles['workbench-SHA256SUMS'].replace(/^./, '0'); }, /DISTRIBUTION_INVALID: workbench-SHA256SUMS does not match the archives/);
  await refuses(t, state => setManifest(state, { assets: manifest(state).assets.slice(0, 1) }), /DISTRIBUTION_INVALID: the manifest does not list exactly the shell and starters archives/);
  await refuses(t, state => { state.distributionFiles['workbench-distributions.json'] = 'not json'; }, /DISTRIBUTION_INVALID: workbench-distributions\.json is not JSON/);
});

test('an existing release whose CLI download differs from the tested one is never modified', async t => {
  await refuses(t, state => { state.releases = [{ id: 100, tag: version, draft: true, target: head, body: '', assets: [{ id: 1, name: `workbench-shell-${version}.zip`, state: 'uploaded', size: 3, digest: `sha256:${sha256('old')}` }] }]; },
    /RELEASE_ASSET_MISMATCH: Release 0\.5\.0 has assets that differ from the candidate: workbench-shell-0\.5\.0\.zip/);
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
  assert.equal((await publishRelease({ repository, version, run: fixture.run, lockDirectory: fixture.folder })).status, 'planned');
  delete fixture.state.repo.permissions;
  assert.equal((await publishRelease({ repository, version, execute: true, run: fixture.run, lockDirectory: fixture.folder })).status, 'published');
});

test('an installation token whose repository permissions say no push still executes; the job grants decide', async t => {
  const fixture = await publishFixture(t);
  Object.assign(fixture.state, { token: 'integration' }); fixture.state.repo.permissions.push = false;
  assert.equal((await publishRelease({ repository, version, execute: true, run: fixture.run, lockDirectory: fixture.folder })).status, 'published');
  assert.ok(fixture.state.calls.includes('GET /user'));
  const granted = await publishFixture(t);
  assert.equal((await publishRelease({ repository, version, run: granted.run, lockDirectory: granted.folder })).status, 'planned');
  assert.ok(!granted.state.calls.includes('GET /user'), 'no probe when the repository reports push access');
});

const instant = { intervalMs: 0, attempts: 2, sleep: async () => {} };
const hold = (fixture, execute = true) => publishRelease({ repository, version, execute, run: fixture.run, lockDirectory: fixture.folder, holdWait: instant });
const rerunCall = 'POST /actions/runs/700/rerun-failed-jobs';

test('a stale CI result hold is re-run before the merge; a failed re-run stops before merging', async t => {
  const fixture = await publishFixture(t); addStaleHold(fixture.state);
  const plan = await hold(fixture, false);
  assert.match(plan.steps.find(step => step.id === 'requalify').detail, /Re-run the failed jobs of CI run 700/);
  assert.equal((await hold(fixture)).status, 'published');
  assert.deepEqual(fixture.state.writes.slice(0, 3), ['pr ready', rerunCall, 'PUT /pulls/12/merge']);
  const failing = await publishFixture(t); addStaleHold(failing.state); failing.state.rerunOutcome = 'failure';
  await assert.rejects(hold(failing), /^Error: HOLD_RERUN_FAILED: CI run 700 attempt 2 concluded failure/);
  assert.deepEqual(failing.state.writes, ['pr ready', rerunCall]);
});

test('a re-run still running at the end of the budget is uncertain; the next publish waits instead of re-running', async t => {
  const fixture = await publishFixture(t); addStaleHold(fixture.state); fixture.state.rerunOutcome = 'running';
  const first = await hold(fixture);
  assert.deepEqual([first.status, first.failedStep], ['uncertain', 'requalify']); assert.match(first.error, /^HOLD_RERUN_TIMEOUT/);
  fixture.state.writes = [];
  const [run] = fixture.state.workflowRuns;
  const finishes = { intervalMs: 0, attempts: 2, sleep: async () => { Object.assign(run, { status: 'completed', conclusion: 'success' }); } };
  const second = await publishRelease({ repository, version, execute: true, run: fixture.run, lockDirectory: fixture.folder, holdWait: finishes });
  assert.equal(second.status, 'published');
  assert.match(second.steps.find(step => step.id === 'requalify').detail, /Wait for CI run 700/);
  assert.ok(!fixture.state.writes.includes(rerunCall), 'no second re-run while one is in progress');
});

test('only a failing ci.yml pull_request hold on the head counts, and not once the pull request is merged', async t => {
  for (const change of [run => { run.event = 'push'; }, run => { run.path = '.github/workflows/release.yml'; }, run => { run.head_sha = other; }]) {
    const fixture = await publishFixture(t); addStaleHold(fixture.state); change(fixture.state.workflowRuns[0]);
    assert.equal((await hold(fixture, false)).steps.find(step => step.id === 'requalify').status, 'done');
  }
  const green = await publishFixture(t); addStaleHold(green.state, { conclusion: 'success' });
  assert.equal((await hold(green, false)).steps.find(step => step.id === 'requalify').status, 'done');
  assert.ok(!green.state.calls.some(call => call.startsWith('GET /actions/runs?')), 'a green hold needs no run lookup');
  const lagging = await publishFixture(t); addStaleHold(lagging.state, { status: 'in_progress', conclusion: null });
  Object.assign(lagging.state.workflowRuns[0], { status: 'completed', conclusion: 'success' });
  assert.equal((await hold(lagging, false)).steps.find(step => step.id === 'requalify').status, 'done', 'the run outranks a lagging check');
  const merged = await publishFixture(t); addStaleHold(merged.state);
  Object.assign(merged.state.pulls[0], { state: 'closed', merged_at: '2026-10-02T09:00:00Z', draft: false }); merged.state.onMain.add(head);
  assert.equal((await hold(merged, false)).steps.find(step => step.id === 'requalify').status, 'done');
});

test('the hold wait budget is whole seconds and polling never sleeps after the last check', async () => {
  assert.equal(holdWaitFromEnvironment(undefined).attempts, 40);
  assert.equal(holdWaitFromEnvironment('0').attempts, 1);
  assert.equal(holdWaitFromEnvironment('60').attempts, 5);
  for (const bad of ['-1', '1.5', 'ten', '999999']) assert.throws(() => holdWaitFromEnvironment(bad), /INVALID_HOLD_WAIT/);
  let sleeps = 0;
  const gh = { api: async () => ({ status: 'in_progress', run_attempt: 2 }) };
  assert.equal(await awaitRun(gh, 700, 2, { intervalMs: 1, attempts: 3, sleep: async () => { sleeps++; } }), null);
  assert.equal(sleeps, 2);
});
