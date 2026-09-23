import { spawnSync } from 'node:child_process';
import { stableVersion } from './prepare.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const id = value => Number.isSafeInteger(value) && value > 0;
const names = new Set(['main.js', 'manifest.json', 'styles.css', 'release-notes.md', 'candidate.json']);
function repositoryPath(repository) {
  if (typeof repository !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(repository)) throw new Error('INVALID_REPOSITORY');
  return `repos/${repository}`;
}
function source(commit, version) {
  if (!sha(commit)) throw new Error('FIXED_COMMIT_REQUIRED');
  stableVersion(version);
}
function remoteError(status) {
  const error = new Error(Number.isInteger(status) ? `GITHUB_API_FAILED_HTTP_${status}` : 'GITHUB_API_FAILED');
  error.status = status;
  return error;
}
/** Only fixed GitHub API routes are accepted. Error bodies may contain secrets. */
export function createGhRequest({ run = spawnSync } = {}) {
  return async ({ method = 'GET', path, body, bytes }) => {
    if (!['GET', 'POST', 'PATCH'].includes(method) || typeof path !== 'string' ||
      !/^(?:repos\/[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9%_.?=&/-]+)?|https:\/\/uploads\.github\.com\/repos\/[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*\/releases\/\d+\/assets\?name=[a-zA-Z0-9.-]+)$/.test(path) || /\/(?:\.|\.\.)(?:\/|$)/.test(path)) throw new Error('UNSAFE_GITHUB_API_REQUEST');
    const args = ['api', '--hostname', 'github.com', '--method', method, '--include', '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'];
    if (body !== undefined && bytes !== undefined) throw new Error('AMBIGUOUS_GITHUB_API_BODY');
    if (body !== undefined || bytes !== undefined) args.push('--input', '-', '-H', `Content-Type: ${bytes === undefined ? 'application/json' : 'application/octet-stream'}`);
    args.push(path);
    const response = run('gh', args, { input: bytes ?? (body === undefined ? undefined : JSON.stringify(body)), encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    const output = typeof response.stdout === 'string' ? response.stdout : '';
    const match = /^HTTP\/\S+ (\d{3})[^\r\n]*\r?\n/.exec(output);
    const status = match ? Number(match[1]) : undefined;
    if (response.error || response.status !== 0 || !status || status < 200 || status >= 300) throw remoteError(status);
    const separator = /\r?\n\r?\n/.exec(output);
    if (!separator) throw new Error('GITHUB_API_RESPONSE_INVALID');
    try { return JSON.parse(output.slice(separator.index + separator[0].length)); }
    catch { throw new Error('GITHUB_API_RESPONSE_INVALID'); }
  };
}

export function createGitHubRemote({ request = createGhRequest(), now = () => new Date() } = {}) {
  const get = path => request({ method: 'GET', path });
  async function pages(path) {
    const result = [];
    for (let page = 1; page <= 1000; page++) {
      const values = await get(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(values) || values.length > 100) throw new Error('REMOTE_PAGE_INVALID');
      result.push(...values);
      if (values.length < 100) return result;
    }
    throw new Error('REMOTE_PAGINATION_LIMIT');
  }
  async function tagCommit(base, version) {
    let reference;
    try { reference = await get(`${base}/git/ref/tags/${version}`); }
    catch (error) { if (error.status === 404) return null; throw error; }
    if (reference?.ref !== `refs/tags/${version}`) throw new Error('REMOTE_TAG_INVALID');
    let object = reference.object;
    const seen = new Set();
    for (let depth = 0; depth < 16; depth++) {
      if (!sha(object?.sha) || seen.has(object.sha)) throw new Error('REMOTE_TAG_INVALID');
      seen.add(object.sha);
      if (object.type === 'commit') return object.sha;
      if (object.type !== 'tag') throw new Error('REMOTE_TAG_INVALID');
      const tag = await get(`${base}/git/tags/${object.sha}`);
      if (tag?.sha !== object.sha) throw new Error('REMOTE_TAG_INVALID');
      object = tag.object;
    }
    throw new Error('REMOTE_TAG_DEPTH_LIMIT');
  }
  async function snapshot({ repository, commit, version }) {
    const base = repositoryPath(repository); source(commit, version);
    const metadata = await get(base);
    if (typeof metadata?.full_name !== 'string' || metadata.full_name.toLowerCase() !== repository.toLowerCase() || metadata.permissions?.push !== true) throw new Error('AUTHENTICATED_DRAFT_VISIBILITY_REQUIRED');
    if (typeof metadata.default_branch !== 'string' || !metadata.default_branch || metadata.default_branch.length > 255) throw new Error('REMOTE_DEFAULT_BRANCH_INVALID');
    const head = await get(`${base}/commits/${encodeURIComponent(metadata.default_branch)}`);
    if (!sha(head?.sha)) throw new Error('REMOTE_DEFAULT_BRANCH_INVALID');
    const comparison = await get(`${base}/compare/${commit}...${head.sha}`);
    if (!['ahead', 'identical'].includes(comparison?.status) || comparison.base_commit?.sha !== commit || comparison.merge_base_commit?.sha !== commit) throw new Error('SOURCE_NOT_ON_DEFAULT_BRANCH');
    const targetTag = await tagCommit(base, version);
    const rawReleases = await pages(`${base}/releases`);
    const releases = []; const seenIds = new Set();
    for (const raw of rawReleases) {
      if (!id(raw?.id) || seenIds.has(raw.id) || typeof raw.draft !== 'boolean' || typeof raw.prerelease !== 'boolean' || typeof raw.tag_name !== 'string') throw new Error('REMOTE_RELEASE_INVALID');
      seenIds.add(raw.id);
      // Other prereleases are outside stable-version ordering; the exact target must be stable.
      if (raw.prerelease && raw.tag_name !== version) continue;
      if (raw.prerelease) throw new Error('REMOTE_RELEASE_INVALID');
      stableVersion(raw.tag_name);
      const tag = raw.tag_name === version ? targetTag : await tagCommit(base, raw.tag_name);
      if ((!raw.draft && !tag) || (raw.draft && !sha(raw.target_commitish))) throw new Error('REMOTE_RELEASE_SOURCE_INVALID');
      if (raw.draft && tag && tag !== raw.target_commitish) throw new Error('TAG_SOURCE_MISMATCH');
      const assets = []; const seenAssets = new Set();
      // Historical asset metadata is irrelevant to the selected candidate and may predate digests.
      for (const asset of raw.tag_name === version ? await pages(`${base}/releases/${raw.id}/assets`) : []) {
        if (!id(asset?.id) || typeof asset.name !== 'string' || !asset.name || seenAssets.has(asset.id) || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0) throw new Error('REMOTE_ASSET_INVALID');
        seenAssets.add(asset.id);
        if (typeof asset.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) throw new Error('REMOTE_ASSET_DIGEST_REQUIRED: GitHub must provide a SHA-256 digest before this release can be used.');
        assets.push({ id: asset.id, name: asset.name, sha256: asset.digest.slice(7) });
      }
      releases.push({ id: raw.id, version: raw.tag_name, draft: raw.draft, targetCommit: raw.draft ? raw.target_commitish : tag, assets });
    }
    // Planner compatibility: this flag establishes default-branch ancestry, not independent review approval.
    return { schemaVersion: 1, repository, checkedAt: now().toISOString(), sourceCommit: commit, sourceReviewed: true,
      defaultBranch: metadata.default_branch, defaultBranchCommit: head.sha, tag: targetTag ? { name: version, commit: targetTag } : null,
      releases, release: releases.find(release => release.version === version) ?? null };
  }
  async function createDraft({ repository, commit, version, notes }) {
    const base = repositoryPath(repository); source(commit, version);
    if (typeof notes !== 'string' || !notes.trim()) throw new Error('RELEASE_NOTES_REQUIRED');
    return request({ method: 'POST', path: `${base}/releases`, body: { tag_name: version, target_commitish: commit, name: version, body: notes, draft: true, prerelease: false, generate_release_notes: false } });
  }
  async function uploadAsset({ repository, releaseId, name, bytes }) {
    const base = repositoryPath(repository);
    if (!id(releaseId) || !names.has(name) || !Buffer.isBuffer(bytes) || !bytes.length) throw new Error('INVALID_RELEASE_UPLOAD');
    return request({ method: 'POST', path: `https://uploads.github.com/${base}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, bytes });
  }
  async function publishDraft({ repository, releaseId, commit, version }) {
    const base = repositoryPath(repository); source(commit, version);
    if (!id(releaseId)) throw new Error('INVALID_RELEASE_ID');
    return request({ method: 'PATCH', path: `${base}/releases/${releaseId}`, body: { draft: false, tag_name: version, target_commitish: commit, make_latest: 'true' } });
  }
  return { snapshot, createDraft, uploadAsset, publishDraft };
}
