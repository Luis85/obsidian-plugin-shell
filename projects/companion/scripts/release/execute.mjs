import { lstat, readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { assetNames, sha256, validateRetained } from './candidate.mjs';
import { planReleaseOperation } from './promotion-plan.mjs';

const files = Object.freeze([...assetNames, 'release-notes.md', 'candidate.json']);
const repositoryPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\/[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
export const authorizationDigest = binding => sha256(JSON.stringify(binding));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

async function capture(input) {
  await validateRetained(input.candidateDirectory, input.commit, input.version);
  const directory = await mkdtemp(join(tmpdir(), 'retained-release-'));
  try {
    const bytes = {};
    for (const name of files) {
      const path = join(input.candidateDirectory, name);
      const stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('UNSAFE_CANDIDATE_FILE');
      bytes[name] = await readFile(path);
      await writeFile(join(directory, name), bytes[name], { flag: 'wx', mode: 0o600 });
    }
    // Validate the captured set, closing the validation/read gap on mutable inputs.
    await validateRetained(directory, input.commit, input.version);
    return { directory, bytes, hashes: Object.fromEntries(files.map(name => [name, sha256(bytes[name])])) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

function bindingFor(input, hashes) {
  return Object.freeze({ schemaVersion: 1, repository: input.repository, sourceCommit: input.commit,
    version: input.version, mode: input.mode, assetHashes: Object.freeze({ ...hashes }),
    ...(input.mode === 'promote' ? { evidenceDigest: sha256(JSON.stringify(canonical({ platforms: input.platforms, acceptance: input.acceptance, review: input.review }))) } : {}) });
}

function authorized(actual, expected) {
  return actual && Object.keys(actual).length === Object.keys(expected).length &&
    ['schemaVersion', 'repository', 'sourceCommit', 'version', 'mode', 'evidenceDigest'].every(key => actual[key] === expected[key]) &&
    actual.assetHashes && Object.keys(actual.assetHashes).length === files.length &&
    files.every(name => actual.assetHashes[name] === expected.assetHashes[name]);
}

function displayPlan(plan, captured, original) {
  return { ...plan, operations: plan.operations.map(args => args.map(arg =>
    files.some(name => arg === join(captured, name)) ? join(original, arg.slice(captured.length + 1)) : arg)) };
}

/** Authenticated discovery is read-only by default. Mutations require exact, separate authorization. */
export async function executeReleaseOperation(input, { remote, authorize, execute = false, now = () => new Date() } = {}) {
  input = structuredClone(input);
  if (!repositoryPattern.test(input.repository ?? '')) throw new Error('REPOSITORY_REQUIRED');
  if (!remote || typeof remote.snapshot !== 'function') throw new Error('AUTHENTICATED_REMOTE_REQUIRED');
  input.candidateDirectory = resolve(input.candidateDirectory);
  const retained = await capture(input);
  const binding = bindingFor(input, retained.hashes);
  const completedOperations = [];
  let lock;
  let releaseId;
  let attempted = false;
  let outcome;
  let failure;
  const finish = result => { outcome = result; return result; };
  const request = { repository: input.repository, commit: input.commit, version: input.version };
  const validate = snapshot => planReleaseOperation({ ...input, candidateDirectory: retained.directory, remote: snapshot, now: now() });
  async function discover() {
    const snapshot = await remote.snapshot({ ...request });
    if (snapshot.repository !== input.repository) throw new Error('REMOTE_REPOSITORY_MISMATCH');
    const plan = await validate(snapshot);
    const release = snapshot.releases.find(item => item.version === input.version);
    if (release && (!Number.isSafeInteger(release.id) || release.id < 1)) throw new Error('REMOTE_RELEASE_ID_REQUIRED');
    if (releaseId !== undefined && release?.id !== releaseId) throw new Error('REMOTE_RELEASE_ID_CHANGED');
    if (release) releaseId = release.id;
    return { snapshot, plan, release };
  }
  try {
    if (execute) {
      const path = join(tmpdir(), `plugin-release-${sha256(`${input.repository.toLowerCase()}/${input.version}`)}.lock`);
      try { await mkdir(path, { mode: 0o700 }); lock = path; }
      catch (error) {
        if (error.code === 'EEXIST') throw Object.assign(new Error('RELEASE_OPERATION_LOCKED'), { lockPath: path });
        throw error;
      }
    }
    const first = await discover();
    const plan = displayPlan(first.plan, retained.directory, input.candidateDirectory);
    if (!execute) return finish({ ...plan, provenance: 'authenticated remote discovery and captured retained bytes', authorizationBinding: binding, authorizationDigest: authorizationDigest(binding) });
    if (input.mode === 'promote' && !first.snapshot.tag) throw new Error('EXISTING_VERIFIED_TAG_REQUIRED');
    if (typeof authorize !== 'function' || !authorized(await authorize(binding), binding)) throw new Error('EXPLICIT_RELEASE_AUTHORIZATION_REQUIRED');
    // Each mutation starts with newly authenticated discovery, never a caller-supplied snapshot.
    for (let count = 0; count < 7; count++) {
      const { snapshot, plan: fresh, release } = await discover();
      if (input.mode === 'promote') {
        if (!snapshot.tag) throw new Error('EXISTING_VERIFIED_TAG_REQUIRED');
        attempted = true;
        await remote.publishDraft({ ...request, releaseId });
        const published = await remote.snapshot({ ...request });
        if (published.repository !== input.repository) throw new Error('REMOTE_REPOSITORY_MISMATCH');
        const result = published.releases.find(item => item.version === input.version);
        if (!result || result.id !== releaseId || result.draft !== false || !published.tag) throw new Error('PROMOTION_READBACK_MISMATCH');
        // The planner rejects public versions; validate the same observed row as a draft solely for integrity checks.
        await validate({ ...published, releases: published.releases.map(item => item === result ? { ...item, draft: true } : item) });
        completedOperations.push({ operation: 'publish', releaseId });
        return finish({ status: 'published', executed: true, authorization: 'granted', ...binding, completedOperations });
      }
      if (release && !fresh.missingAssets.length) return finish({ status: 'draft-complete', executed: attempted, authorization: 'granted', ...binding, completedOperations });
      if (!release) {
        attempted = true;
        const created = await remote.createDraft({ ...request, notes: retained.bytes['release-notes.md'].toString('utf8') });
        if (!Number.isSafeInteger(created?.id) || created.id < 1) throw new Error('DRAFT_RESPONSE_ID_REQUIRED');
        releaseId = created.id;
        const observed = await discover();
        if (!observed.release) throw new Error('DRAFT_READBACK_MISMATCH');
        completedOperations.push({ operation: 'create-draft', releaseId });
      } else {
        const name = fresh.missingAssets[0];
        attempted = true;
        // Pass a fresh copy: adapters cannot mutate bytes used by later uploads or validation.
        await remote.uploadAsset({ ...request, releaseId, name, bytes: Buffer.from(retained.bytes[name]) });
        const observed = await discover();
        if (observed.plan.missingAssets.includes(name)) throw new Error('UPLOAD_READBACK_MISMATCH');
        completedOperations.push({ operation: 'upload', releaseId, name, sha256: retained.hashes[name] });
      }
    }
    throw new Error('REMOTE_OPERATION_LIMIT');
  } catch (error) {
    if (!attempted) { failure = error; throw error; }
    // A rejected write or later discovery may conceal a committed effect. Never retry in this run.
    return finish({ status: 'uncertain', executed: true, authorization: 'granted', ...binding, completedOperations,
      error: error.message, recovery: 'Inspect authenticated remote state and deliberately rerun the same retained candidate. Public versions remain immutable.' });
  } finally {
    const paths = [lock, retained.directory].filter(Boolean);
    const cleanup = await Promise.allSettled(paths.map(path => rm(path, { recursive: true, force: true })));
    const remaining = paths.filter((_, index) => cleanup[index].status === 'rejected');
    if (remaining.length) {
      // Cleanup cannot relabel a verified publication or conceal an uncertain remote write.
      const details = { status: 'incomplete', paths: remaining, recovery: 'Inspect these local operation paths before removing leftovers; do not repeat a verified publication.' };
      if (outcome) outcome.localCleanup = details;
      else if (failure) failure.localCleanup = details;
    }
  }
}
