/**
 * Release-branch metadata gate for the Release tier (read-only; never fetches, tags or pushes).
 *
 *   node scripts/release/branch.mjs verify --version X.Y.Z [--branch release/X.Y.Z] [--base main] [--json]
 *
 * Checks: branch name release/X.Y.Z (--branch, else GITHUB_HEAD_REF, GITHUB_REF_NAME, then the checked-out
 * branch), package/lock/manifest versions, versions.json entry, a valid Keep a Changelog with a non-empty
 * "## [X.Y.Z] - date" section, no local tag X.Y.Z, and shared history with origin/<base> when it was fetched
 * (a warning otherwise). Exit 0 passed (warnings allowed), 1 failed.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableVersion } from './prepare.mjs';
import { validateChangelog, sectionBody } from './changelog.mjs';
import { createRunner, gitSucceeds, gitText } from './commands.mjs';

async function readJson(root, name) {
  try { return JSON.parse(await readFile(join(root, name), 'utf8')); } catch { return null; }
}
function branchName({ branch, env, run }) {
  if (branch) return branch;
  if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF;
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  const result = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.status === 0 ? result.stdout.trim() : '';
}
function ancestry(run, base, add) {
  const remote = `refs/remotes/origin/${base}`;
  if (!gitSucceeds(run, ['rev-parse', '--verify', '--quiet', `${remote}^{commit}`])) {
    add('base-ancestry', 'warning', 'RELEASE_BASE_NOT_FETCHED', `origin/${base} is not fetched; ancestry was not checked (fetch it with full history).`);
    return;
  }
  const mergeBase = run('git', ['merge-base', 'HEAD', remote]);
  if (mergeBase.status !== 0) {
    const shallow = run('git', ['rev-parse', '--is-shallow-repository']).stdout.trim() === 'true';
    if (shallow) add('base-ancestry', 'warning', 'RELEASE_HISTORY_SHALLOW', 'The checkout is shallow; fetch full history to prove ancestry.');
    else add('base-ancestry', 'failed', 'RELEASE_BASE_UNRELATED', `HEAD shares no history with origin/${base}.`);
    return;
  }
  const point = mergeBase.stdout.trim();
  const ahead = Number(gitText(run, ['rev-list', '--count', `${point}..HEAD`]));
  const behind = Number(gitText(run, ['rev-list', '--count', `HEAD..${remote}`]));
  add('base-ancestry', 'passed', 'RELEASE_BASE_ANCESTRY', `Cut from origin/${base} at ${point}; ${ahead} release commit(s).`);
  if (behind > 0) add('base-advanced', 'warning', 'RELEASE_BASE_ADVANCED', `origin/${base} gained ${behind} commit(s) since the cut; publish merges with a merge commit.`);
}

export async function verifyReleaseBranch({ root = process.cwd(), version, branch, base = 'main', env = process.env, run = createRunner({ cwd: root }) }) {
  stableVersion(version); root = resolve(root);
  const checks = [];
  const add = (id, status, code, message) => checks.push({ id, status, code, message });
  const name = branchName({ branch, env, run });
  if (name === `release/${version}`) add('branch-name', 'passed', 'RELEASE_BRANCH_NAME', `Branch ${name}.`);
  else add('branch-name', 'failed', 'RELEASE_BRANCH_NAME_MISMATCH', `Expected release/${version}, found ${name || 'no branch'}.`);
  const [pkg, lock, manifest, versions] = await Promise.all(['package.json', 'package-lock.json', 'manifest.json', 'versions.json'].map(file => readJson(root, file)));
  const found = { 'package.json': pkg?.version, 'package-lock.json': lock?.version, 'package-lock.json packages[""]': lock?.packages?.['']?.version, 'manifest.json': manifest?.version };
  const wrong = Object.entries(found).filter(([, value]) => value !== version).map(([file, value]) => `${file}=${value ?? 'missing'}`);
  if (wrong.length) add('versions', 'failed', 'RELEASE_VERSION_MISMATCH', `Expected ${version}: ${wrong.join(', ')}.`);
  else add('versions', 'passed', 'RELEASE_VERSIONS', `package, lockfile and manifest are ${version}.`);
  if (versions && Object.hasOwn(versions, version) && versions[version] === manifest?.minAppVersion) add('versions-json', 'passed', 'RELEASE_VERSIONS_JSON', `versions.json maps ${version} to ${versions[version]}.`);
  else add('versions-json', 'failed', 'RELEASE_VERSIONS_JSON_MISMATCH', `versions.json must map ${version} to manifest minAppVersion ${manifest?.minAppVersion ?? 'missing'}.`);
  let text = null;
  try { text = await readFile(join(root, 'CHANGELOG.md'), 'utf8'); } catch { add('changelog', 'failed', 'CHANGELOG_MISSING', 'CHANGELOG.md is missing.'); }
  if (text !== null) {
    const result = validateChangelog(text);
    if (!result.ok) add('changelog', 'failed', 'CHANGELOG_INVALID', result.diagnostics.map(item => `line ${item.line}: ${item.code}`).join('; '));
    else add('changelog', 'passed', 'CHANGELOG_VALID', 'Keep a Changelog structure is valid.');
    const section = result.versions.find(item => item.version === version);
    if (!section || !sectionBody(result.model, section)) add('release-notes', 'failed', 'RELEASE_NOTES_MISSING', `CHANGELOG.md needs a non-empty "## [${version}] - YYYY-MM-DD" section.`);
    else add('release-notes', 'passed', 'RELEASE_NOTES', `Section ${version} dated ${section.date}.`);
  }
  const tags = run('git', ['tag', '-l', version]);
  if (tags.status !== 0) add('tag-absent', 'failed', 'GIT_UNAVAILABLE', 'git tag -l failed.');
  else if (tags.stdout.trim()) add('tag-absent', 'failed', 'RELEASE_TAG_EXISTS', `Tag ${version} already exists locally.`);
  else add('tag-absent', 'passed', 'RELEASE_TAG_ABSENT', `No local tag ${version} (remote tags are checked by publish).`);
  ancestry(run, base, add);
  const head = run('git', ['rev-parse', 'HEAD']);
  return { schemaVersion: 1, status: checks.some(item => item.status === 'failed') ? 'failed' : 'passed', version, branch: name || null,
    head: head.status === 0 ? head.stdout.trim() : null, base, checks };
}

export function parseBranchArguments(args) {
  const [command, ...rest] = args; const options = {}; const seen = new Set();
  if (!command || command === '--help') return { help: true };
  if (command !== 'verify') throw new Error(`UNKNOWN_COMMAND: ${command}`);
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    seen.add(flag);
    if (flag === '--json') options.json = true;
    else if (['--version', '--branch', '--base'].includes(flag)) {
      const value = rest[++index];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  stableVersion(options.version);
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseBranchArguments(process.argv.slice(2));
    if (options.help) console.log('node scripts/release/branch.mjs verify --version X.Y.Z [--branch release/X.Y.Z] [--base main] [--json]\nRead-only release-branch metadata gate. Exit 1 when any check fails.');
    else {
      const result = await verifyReleaseBranch(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        for (const item of result.checks) console.log(`${item.status.toUpperCase().padEnd(7)} ${item.code}: ${item.message}`);
        console.log(`Release branch ${result.status}: ${result.branch ?? 'unknown'} for ${result.version}.`);
      }
      if (result.status !== 'passed') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
