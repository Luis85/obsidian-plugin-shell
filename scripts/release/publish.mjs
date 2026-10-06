/**
 * Publish a qualified release from its release pull request. Default: read-only discovery and a step plan.
 *
 *   node scripts/release/publish.mjs --version X.Y.Z --repository owner/repo [--execute] [--json]
 *
 * Requires (gh authenticated, e.g. GH_TOKEN): one open (or already merged) pull request from release/X.Y.Z
 * into the default branch; a green "Release result" check on its head SHA; the branch head equal to that SHA;
 * a successful Release workflow run for the SHA whose qualified-candidate (or retained-build) artifact holds a
 * valid retained candidate (reports/release/X.Y.Z-SHA) with matching hashes; release notes equal to the
 * CHANGELOG section at the SHA. --execute then, in order and each skipped when already done:
 * mark the PR ready, merge it with a merge commit pinned to the SHA, create tag X.Y.Z at the SHA, create the
 * GitHub release (draft, upload main.js/manifest.json/styles.css, publish), delete release/X.Y.Z when its head
 * is still the SHA. Never moves a tag, replaces an asset or edits a published release. A failed write stops
 * with exit 2 (uncertain): rerun the same command; it rediscovers state and resumes. Refusals exit 1.
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetNames, sha256 } from './candidate.mjs';
import { stableVersion } from './prepare.mjs';
import { createRunner } from './commands.mjs';
import { createGitHub } from './publish-github.mjs';
import { discoverRelease, onDefaultBranch, releaseState, tagCommit } from './publish-discovery.mjs';

const coded = (code, message) => Object.assign(new Error(message ? `${code}: ${message}` : code), { code });
export const publishLockPath = (repository, version, directory = tmpdir()) => join(directory, `plugin-publish-${sha256(`${repository.toLowerCase()}/${version}`)}.lock`);

export function planSteps(state) {
  const done = (id, condition, pending, finished) => ({ id, status: condition ? 'done' : 'pending', detail: condition ? finished : pending });
  const release = state.release;
  return [
    done('ready', state.pr.state === 'merged' || !state.pr.draft, `Mark pull request #${state.pr.number} ready for review.`, `Pull request #${state.pr.number} is ready or merged.`),
    done('merge', state.merged, `Merge #${state.pr.number} into ${state.defaultBranch} with a merge commit pinned to ${state.sha}.`, `${state.sha} is on ${state.defaultBranch}.`),
    done('tag', state.tag === state.sha, `Create tag ${state.version} at ${state.sha}.`, `Tag ${state.version} is ${state.sha}.`),
    done('release', release && !release.draft, release ? `Complete draft release ${release.id}: upload ${release.missing.join(', ') || 'nothing'}, then publish.` : `Create release ${state.version} with ${assetNames.join(', ')}.`, `Release ${state.version} is published with matching assets.`),
    done('delete-branch', !state.branchHead, `Delete ${state.branch} at ${state.sha}.`, `${state.branch} is already deleted.`),
  ];
}

function write(effect) {
  try { return effect(); } catch (error) { throw Object.assign(error, { uncertain: true }); }
}
async function confirm(check, code) {
  let ok = false;
  try { ok = await check(); } catch (error) { throw Object.assign(error, { uncertain: true }); }
  if (!ok) throw Object.assign(coded(code), { uncertain: true });
}

const steps = {
  async ready(gh, state) {
    write(() => gh.prReady(state.pr.number));
    await confirm(async () => (await gh.api('GET', `/pulls/${state.pr.number}`))?.draft === false, 'READY_READBACK_MISMATCH');
  },
  async merge(gh, state) {
    write(() => gh.api('PUT', `/pulls/${state.pr.number}/merge`, { body: { merge_method: 'merge', sha: state.sha, commit_title: `Merge release ${state.version} (#${state.pr.number})` } }));
    await confirm(() => onDefaultBranch(gh, state.sha, state.defaultBranch), 'MERGE_READBACK_MISMATCH');
  },
  async tag(gh, state) {
    write(() => gh.api('POST', '/git/refs', { body: { ref: `refs/tags/${state.version}`, sha: state.sha } }));
    await confirm(async () => (await tagCommit(gh, state.version)) === state.sha, 'TAG_READBACK_MISMATCH');
  },
  async release(gh, state) {
    const hashes = state.candidate.hashes;
    let release = state.release;
    if (!release) {
      const created = write(() => gh.api('POST', '/releases', { body: { tag_name: state.version, target_commitish: state.sha, name: state.version,
        body: state.candidate.notes, draft: true, prerelease: false, generate_release_notes: false } }));
      if (!Number.isSafeInteger(created?.id)) throw Object.assign(coded('RELEASE_RESPONSE_INVALID'), { uncertain: true });
      release = { id: created.id, draft: true, missing: [...assetNames] };
    }
    for (const name of release.missing)
      write(() => gh.api('POST', `https://uploads.github.com/repos/${gh.repository}/releases/${release.id}/assets?name=${name}`, { file: join(state.candidate.directory, name) }));
    if (release.draft) write(() => gh.api('PATCH', `/releases/${release.id}`, { body: { draft: false, tag_name: state.version, make_latest: 'true' } }));
    await confirm(async () => {
      const observed = await releaseState(gh, state.version, hashes);
      return observed?.id === release.id && !observed.draft && !observed.missing.length && !observed.mismatched.length;
    }, 'RELEASE_READBACK_MISMATCH');
  },
  async 'delete-branch'(gh, state) {
    write(() => gh.api('DELETE', `/git/refs/heads/${state.branch}`));
    await confirm(async () => (await gh.optional(`/git/ref/heads/${state.branch}`)) === null, 'BRANCH_DELETE_READBACK_MISMATCH');
  },
};

export async function publishRelease({ repository, version, execute = false, run = createRunner(), lockDirectory = tmpdir() }) {
  stableVersion(version);
  const gh = createGitHub({ run, repository });
  const workdir = await mkdtemp(join(tmpdir(), 'release-publish-'));
  let lock = null;
  try {
    if (execute) {
      const path = publishLockPath(repository, version, lockDirectory);
      try { await mkdir(path, { mode: 0o700 }); lock = path; }
      catch (error) { throw error.code === 'EEXIST' ? Object.assign(coded('PUBLISH_LOCKED', `Another publish holds ${path}; remove it only after confirming no run is active.`), { lockPath: path }) : error; }
    }
    const state = { version, ...(await discoverRelease(gh, { version, workdir })) };
    const plan = planSteps(state);
    const summary = { schemaVersion: 1, repository, version, sha: state.sha, pullRequest: state.pr, defaultBranch: state.defaultBranch,
      releaseResult: state.check, candidate: { runId: state.candidate.runId, artifact: state.candidate.artifact, assetHashes: state.candidate.hashes, notesHash: state.notesHash } };
    if (!execute) return { ...summary, mode: 'dry-run', status: plan.every(step => step.status === 'done') ? 'published' : 'planned', steps: plan };
    if (state.canPush === false) throw coded('PUSH_PERMISSION_REQUIRED', `The token cannot write to ${repository}.`);
    const completed = [];
    for (const step of plan) {
      if (step.status === 'done') continue;
      try { await steps[step.id](gh, state); }
      catch (error) {
        if (!error.uncertain) throw error;
        return { ...summary, mode: 'execute', status: 'uncertain', steps: plan, completed, failedStep: step.id, error: error.message,
          recovery: 'A remote write may or may not have taken effect. Inspect the pull request, tag and release, then rerun the same publish command; it rediscovers state and resumes without repeating finished steps.' };
      }
      step.status = 'done'; completed.push(step.id);
    }
    return { ...summary, mode: 'execute', status: 'published', steps: plan, completed };
  } finally {
    await rm(workdir, { recursive: true, force: true });
    if (lock) await rm(lock, { recursive: true, force: true });
  }
}

export function parsePublishArguments(args) {
  const options = {}; const seen = new Set();
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    seen.add(flag);
    if (flag === '--execute' || flag === '--json') options[flag.slice(2)] = true;
    else if (flag === '--version' || flag === '--repository') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  stableVersion(options.version);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(options.repository ?? '')) throw new Error('REPOSITORY_REQUIRED: --repository owner/repo');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parsePublishArguments(process.argv.slice(2));
    if (options.help) console.log('node scripts/release/publish.mjs --version X.Y.Z --repository owner/repo [--execute] [--json]\nDefault: read-only discovery and plan. --execute merges, tags, releases and deletes the branch; each step resumes on rerun.');
    else {
      const result = await publishRelease(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`Release ${result.version} from ${result.sha} (PR #${result.pullRequest.number}, Release result ${result.releaseResult.conclusion}, candidate run ${result.candidate.runId}/${result.candidate.artifact}).`);
        for (const step of result.steps) console.log(`${step.status.toUpperCase().padEnd(8)} ${step.id}: ${step.detail}`);
        console.log(`Publish ${result.status}.${result.recovery ? `\n${result.error}\n${result.recovery}` : ''}`);
      }
      if (result.status === 'uncertain') process.exitCode = 2;
    }
  } catch (error) {
    // Never echo gh output, tokens or file contents: codes and fixed messages only.
    console.error(JSON.stringify({ status: 'failed', error: error.message, lockPath: error.lockPath }));
    process.exitCode = 1;
  }
}
