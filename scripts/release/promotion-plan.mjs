import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, validateRetained } from './candidate.mjs';
import { stableVersion, compareVersions } from './prepare.mjs';

export const nativeScenarios = Object.freeze(['load', 'settings-search', 'settings-edit-reload', 'entity-flow', 'failed-write', 'modal-focus-cancel', 'notices', 'command-ribbon', 'view-close-reopen', 'disable-reenable']);
const commitPattern = /^[a-f0-9]{40}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const identifier = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
const sameHashes = (actual, expected) => actual && Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([name, hash]) => actual[name] === hash);
function recent(value, now, age = Infinity) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now.getTime() && now.getTime() - time <= age;
}
function remoteState(remote, record, now) {
  if (remote?.schemaVersion !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(remote.repository ?? '') || !recent(remote.checkedAt, now, 3600000) ||
    remote.sourceCommit !== record.sourceCommit || remote.sourceReviewed !== true || !Array.isArray(remote.releases) || !Object.hasOwn(remote, 'tag')) throw new Error('REMOTE_SNAPSHOT_INVALID_OR_STALE');
  if (remote.tag !== null && (remote.tag.name !== record.version || remote.tag.commit !== record.sourceCommit)) throw new Error('TAG_SOURCE_MISMATCH');
  const versions = new Set(); let target = null;
  for (const release of remote.releases) {
    stableVersion(release.version);
    if (versions.has(release.version)) throw new Error('DUPLICATE_REMOTE_RELEASE');
    versions.add(release.version);
    if (typeof release.draft !== 'boolean' || !commitPattern.test(release.targetCommit ?? '') || !Array.isArray(release.assets)) throw new Error('REMOTE_RELEASE_INVALID');
    if (release.version === record.version) {
      if (!release.draft) throw new Error('PUBLISHED_VERSION_IMMUTABLE');
      if (release.targetCommit !== record.sourceCommit) throw new Error('RELEASE_SOURCE_MISMATCH');
      target = release;
    } else if (!release.draft && compareVersions(record.version, release.version) <= 0) throw new Error('VERSION_NOT_NEW');
  }
  return target;
}
function nativeAcceptance(evidence, record, platforms, now) {
  if (!Array.isArray(platforms) || !platforms.length || new Set(platforms).size !== platforms.length || platforms.some(platform => !['win32', 'darwin', 'linux', 'ios', 'android'].includes(platform))) throw new Error('DECLARED_PLATFORMS_REQUIRED');
  if (record.isDesktopOnly && platforms.some(platform => ['ios', 'android'].includes(platform))) throw new Error('PLATFORM_POLICY_MISMATCH');
  if (!record.isDesktopOnly && !['ios', 'android'].every(platform => platforms.includes(platform))) throw new Error('MOBILE_ACCEPTANCE_REQUIRED');
  if (!Array.isArray(evidence)) throw new Error('NATIVE_ACCEPTANCE_REQUIRED');
  for (const platform of platforms) {
    const records = evidence.filter(item => item?.host?.platform === platform);
    if (!records.length) throw new Error('NATIVE_ACCEPTANCE_REQUIRED: ' + platform);
    for (const item of records) {
      if (item.schemaVersion !== 1 || !['manual', 'automated'].includes(item.mode) || !identifier(item.actor) || !recent(item.completedAt, now) || Date.parse(item.completedAt) < Date.parse(record.createdAt) ||
        item.sourceCommit !== record.sourceCommit || item.version !== record.version || !sameHashes(item.assetHashes, record.assetHashes) || !identifier(item.host.architecture) ||
        !item.scenarios || nativeScenarios.some(scenario => item.scenarios[scenario] !== 'passed')) throw new Error('NATIVE_ACCEPTANCE_INVALID');
      stableVersion(item.host.appVersion); stableVersion(item.host.installerVersion);
      if (compareVersions(item.host.appVersion, record.minAppVersion) < 0) throw new Error('HOST_BELOW_DECLARED_MINIMUM');
    }
    if (!records.some(item => item.host.appVersion === record.minAppVersion)) throw new Error('MINIMUM_HOST_ACCEPTANCE_REQUIRED: ' + platform);
  }
}
/** Produce reviewable argument arrays only. No shell, network or mutation runs here. */
export async function planReleaseOperation({ candidateDirectory, commit, version, mode, remote, acceptance, review, platforms, now = new Date() }) {
  if (!['draft', 'promote'].includes(mode)) throw new Error('RELEASE_PLAN_MODE_REQUIRED');
  const directory = resolve(candidateDirectory);
  const record = await validateRetained(directory, commit, version);
  const release = remoteState(remote, record, now);
  const hashes = { ...record.assetHashes, 'release-notes.md': record.notesHash, 'candidate.json': sha256(await readFile(join(directory, 'candidate.json'))) };
  const existing = new Set();
  for (const asset of release?.assets ?? []) {
    if (existing.has(asset.name)) throw new Error('DUPLICATE_REMOTE_ASSET');
    existing.add(asset.name);
    if (!Object.hasOwn(hashes, asset.name) || !hashPattern.test(asset.sha256 ?? '') || asset.sha256 !== hashes[asset.name]) throw new Error('REMOTE_ASSET_HASH_MISMATCH');
  }
  const missing = Object.keys(hashes).filter(name => !existing.has(name));
  const operations = []; const repo = remote.repository;
  if (mode === 'draft') {
    if (!release) operations.push(['release', 'create', version, '--repo', repo, '--target', commit, '--title', version, '--notes-file', join(directory, 'release-notes.md'), '--draft']);
    if (missing.length) operations.push(['release', 'upload', version, ...missing.map(name => join(directory, name)), '--repo', repo]);
  } else {
    if (!release) throw new Error('DRAFT_REQUIRED');
    if (missing.length) throw new Error('INCOMPLETE_REMOTE_ASSETS');
    nativeAcceptance(acceptance, record, platforms, now);
    if (!review || !identifier(review.actor) || !recent(review.reviewedAt, now, 86400000) || review.sourceCommit !== commit || !sameHashes(review.assetHashes, record.assetHashes)) throw new Error('CANDIDATE_REVIEW_REQUIRED');
    operations.push(['release', 'edit', version, '--repo', repo, '--target', commit, '--draft=false', ...(remote.tag ? ['--verify-tag'] : [])]);
  }
  return { schemaVersion: 1, status: 'plan-only', mode, authorization: 'not-granted', executed: false,
    provenance: 'local retained bytes and supplied remote/evidence snapshots; no authenticated remote execution',
    sourceCommit: commit, version, repository: repo, expectedTag: { name: version, commit }, expectedAssets: hashes,
    nativeEvidence: mode === 'promote' ? { status: 'validated-provided-records', platforms } : { status: 'not-required-for-draft' },
    executable: 'gh', operations, missingAssets: missing,
    preconditions: ['Refresh authenticated remote source/tag/release/asset state immediately before execution.', 'Obtain separate publication authorization and narrowly scoped mutation permissions.', 'Use retained bytes; never rebuild, move an existing tag or clobber a public asset.'],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (!args.length || (args.length === 1 && args[0] === '--help')) {
      console.log('npm run release:plan -- --input <operation-input.json>\nRead-only draft/promotion validation and exact gh argument plan. Never executes, tags, uploads or publishes.');
    } else {
      if (args.length !== 2 || args[0] !== '--input' || !args[1] || args[1].startsWith('--')) throw new Error('EXPECTED_INPUT_FILE');
      const path = resolve(args[1]); const input = JSON.parse(await readFile(path, 'utf8'));
      // A caller cannot replace the validation clock through input JSON.
      console.log(JSON.stringify(await planReleaseOperation({ ...input, candidateDirectory: resolve(dirname(path), input.candidateDirectory), now: new Date() }), null, 2));
    }
  } catch (error) { console.error(JSON.stringify({ status: 'failed', error: error.message, executed: false })); process.exitCode = 1; }
}
