/**
 * Read-only remote discovery for release publishing. Every blocking finding throws a coded error before any
 * write. The candidate comes from the successful Release workflow run of the exact tested head commit.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assetNames, sha256, validateRetained } from './candidate.mjs';
import { extractNotes } from './changelog.mjs';

const candidateArtifacts = Object.freeze(['qualified-candidate', 'retained-build']);
const releaseCheckName = 'Release result';
const commitPattern = /^[a-f0-9]{40}$/;
const coded = (code, message) => Object.assign(new Error(message ? `${code}: ${message}` : code), { code });
const newest = (items, field = 'id') => [...items].sort((a, b) => (a[field] > b[field] ? -1 : 1))[0];

function selectPullRequest(pulls, { repository, branch, defaultBranch }) {
  const own = pulls.filter(pr => pr?.head?.ref === branch && pr.base?.ref === defaultBranch &&
    String(pr.head?.repo?.full_name ?? '').toLowerCase() === repository.toLowerCase());
  const open = own.filter(pr => pr.state === 'open');
  if (open.length > 1) throw coded('RELEASE_PR_AMBIGUOUS', `${open.length} open pull requests use ${branch}.`);
  const pr = open[0] ?? newest(own.filter(item => item.merged_at), 'merged_at');
  if (!pr) throw coded('RELEASE_PR_NOT_FOUND', `No open or merged pull request from ${branch} into ${defaultBranch}.`);
  if (!commitPattern.test(pr.head?.sha ?? '') || !Number.isSafeInteger(pr.number)) throw coded('GITHUB_API_RESPONSE_INVALID');
  return { number: pr.number, url: pr.html_url, draft: pr.draft === true, state: pr.state === 'open' ? 'open' : 'merged', sha: pr.head.sha };
}

/** Commit a tag ref points to, following annotated tag objects. */
export async function tagCommit(gh, version) {
  const reference = await gh.optional(`/git/ref/tags/${version}`);
  if (!reference) return null;
  let object = reference.object;
  for (let depth = 0; depth < 8; depth++) {
    if (!commitPattern.test(object?.sha ?? '')) throw coded('REMOTE_TAG_INVALID');
    if (object.type === 'commit') return object.sha;
    if (object.type !== 'tag') throw coded('REMOTE_TAG_INVALID');
    object = (await gh.api('GET', `/git/tags/${object.sha}`))?.object;
  }
  throw coded('REMOTE_TAG_INVALID');
}

export async function onDefaultBranch(gh, sha, defaultBranch) {
  const comparison = await gh.api('GET', `/compare/${sha}...${encodeURIComponent(defaultBranch)}`);
  return ['ahead', 'identical'].includes(comparison?.status) && comparison.merge_base_commit?.sha === sha;
}

/** The release row for a version with its assets compared to the candidate hashes. */
export async function releaseState(gh, version, hashes) {
  const rows = (await gh.pages('/releases')).filter(item => item?.tag_name === version);
  if (rows.length > 1) throw coded('DUPLICATE_RELEASE', `${rows.length} releases use tag ${version}.`);
  if (!rows.length) return null;
  const [row] = rows; const assets = [];
  for (const asset of await gh.pages(`/releases/${row.id}/assets`)) {
    if (asset?.state !== 'uploaded') continue;
    if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? '')) throw coded('REMOTE_ASSET_DIGEST_REQUIRED', asset.name);
    assets.push({ id: asset.id, name: asset.name, sha256: asset.digest.slice(7) });
  }
  const names = assets.map(asset => asset.name);
  const mismatched = assets.filter(asset => !Object.hasOwn(hashes, asset.name) || asset.sha256 !== hashes[asset.name]).map(asset => asset.name);
  const missing = assetNames.filter(name => !names.includes(name));
  if (new Set(names).size !== names.length) mismatched.push('duplicate');
  return { id: row.id, draft: row.draft === true, target: row.target_commitish, body: row.body ?? '', assets, missing, mismatched };
}

async function releaseResult(gh, sha) {
  const runs = (await gh.pages(`/commits/${sha}/check-runs?check_name=${encodeURIComponent(releaseCheckName)}`, 'check_runs')).filter(item => item?.name === releaseCheckName);
  if (!runs.length) throw coded('RELEASE_RESULT_MISSING', `No "${releaseCheckName}" check on ${sha}; run the Release workflow on the release branch.`);
  const latest = newest(runs);
  if (latest.status !== 'completed' || latest.conclusion !== 'success') throw coded('RELEASE_RESULT_NOT_GREEN', `"${releaseCheckName}" on ${sha} is ${latest.conclusion ?? latest.status}.`);
  return latest;
}

async function candidate(gh, { sha, version, check, workdir }) {
  const runs = (await gh.pages(`/actions/workflows/release.yml/runs?head_sha=${sha}`, 'workflow_runs')).filter(item => item?.head_sha === sha && item.conclusion === 'success');
  const run = runs.find(item => item.check_suite_id === check.check_suite?.id) ?? newest(runs);
  if (!run) throw coded('RELEASE_RUN_MISSING', `No successful Release workflow run for ${sha}.`);
  const available = (await gh.pages(`/actions/runs/${run.id}/artifacts`, 'artifacts')).filter(item => !item?.expired).map(item => item.name);
  const name = candidateArtifacts.find(item => available.includes(item));
  if (!name) throw coded('CANDIDATE_ARTIFACT_MISSING', `Release run ${run.id} has no unexpired ${candidateArtifacts.join(' or ')} artifact.`);
  const target = join(workdir, 'artifact');
  await gh.download(run.id, name, target);
  const directory = join(target, 'reports/release', `${version}-${sha}`);
  let record;
  try { record = await validateRetained(directory, sha, version); }
  catch (error) { throw coded(error.code === 'ENOENT' ? 'CANDIDATE_ARTIFACT_MISSING' : 'CANDIDATE_INVALID', error.code === 'ENOENT' ? `${name} has no reports/release/${version}-${sha}.` : error.message); }
  const notes = (await readFile(join(directory, 'release-notes.md'), 'utf8')).trim();
  return { runId: run.id, artifact: name, directory, record, notes, hashes: record.assetHashes };
}

async function changelogNotes(gh, sha, version) {
  const file = await gh.api('GET', `/contents/CHANGELOG.md?ref=${sha}`);
  if (file?.encoding !== 'base64' || typeof file.content !== 'string') throw coded('GITHUB_API_RESPONSE_INVALID');
  try { return extractNotes(Buffer.from(file.content, 'base64').toString('utf8'), version); }
  catch (error) { throw coded('CHANGELOG_NOTES_UNAVAILABLE', error.message); }
}

export async function discoverRelease(gh, { version, workdir }) {
  const repo = await gh.api('GET', '');
  if (typeof repo?.default_branch !== 'string' || String(repo.full_name).toLowerCase() !== gh.repository.toLowerCase()) throw coded('GITHUB_API_RESPONSE_INVALID');
  const defaultBranch = repo.default_branch; const branch = `release/${version}`; const owner = gh.repository.split('/')[0];
  const pulls = await gh.pages(`/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(defaultBranch)}`);
  const pr = selectPullRequest(pulls, { repository: gh.repository, branch, defaultBranch });
  const sha = pr.sha;
  const branchHead = (await gh.optional(`/git/ref/heads/${branch}`))?.object?.sha ?? null;
  if (pr.state === 'open' ? branchHead !== sha : branchHead && branchHead !== sha) throw coded('BRANCH_HEAD_MISMATCH', `${branch} is ${branchHead ?? 'missing'}, the pull request head is ${sha}.`);
  const check = await releaseResult(gh, sha);
  const found = await candidate(gh, { sha, version, check, workdir });
  const changelog = await changelogNotes(gh, sha, version);
  if (changelog !== found.notes) throw coded('NOTES_MISMATCH', `Candidate release-notes.md differs from CHANGELOG.md ${version} at ${sha}.`);
  const merged = await onDefaultBranch(gh, sha, defaultBranch);
  if (pr.state === 'merged' && !merged) throw coded('SOURCE_NOT_ON_DEFAULT_BRANCH', `Merged ${sha} is not an ancestor of ${defaultBranch}.`);
  const tag = await tagCommit(gh, version);
  if (tag && tag !== sha) throw coded('TAG_SOURCE_MISMATCH', `Tag ${version} points to ${tag}, not ${sha}.`);
  const release = await releaseState(gh, version, found.hashes);
  if (release?.mismatched.length) throw coded('RELEASE_ASSET_MISMATCH', `Release ${version} has assets that differ from the candidate: ${release.mismatched.join(', ')}.`);
  if (release && !release.draft && (release.missing.length || tag !== sha)) throw coded('RELEASE_ASSET_MISMATCH', `Published release ${version} is incomplete; it is never modified automatically.`);
  if (release?.draft && release.target !== sha) throw coded('RELEASE_SOURCE_MISMATCH', `Draft release ${version} targets ${release.target}.`);
  return { repository: gh.repository, defaultBranch, canPush: repo.permissions?.push ?? null, branch, pr, sha, branchHead,
    check: { id: check.id, conclusion: check.conclusion }, candidate: found, merged, tag, release, notesHash: sha256(found.notes) };
}
