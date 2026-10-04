/**
 * Cut a release branch from the base branch. Default: a read-only plan (dry run).
 *
 *   node scripts/release/cut.mjs --version X.Y.Z [--date YYYY-MM-DD] [--base main] [--repository owner/repo] [--execute] [--remote] [--json]
 *
 * A dry run lists every blocker (exit 1) next to the plan. --execute: requires a clean tree on <base> matching origin/<base> (when fetched), no release/X.Y.Z branch
 * and no X.Y.Z tag; creates release/X.Y.Z, runs release preparation in-process (Unreleased -> X.Y.Z) and
 * commits "release: X.Y.Z". Rerunning on that branch resumes after the commit.
 * --remote (with --execute): pushes the branch (GH_TOKEN through the gh credential helper for that one command,
 * because checkouts use persist-credentials: false), opens a DRAFT pull request to <base> titled "Release X.Y.Z"
 * whose body is .github/PULL_REQUEST_TEMPLATE/release.md with {{version}}, {{base}}, {{base_sha}},
 * {{release_branch}}, {{date}} and {{changelog}} filled, and dispatches release.yml on the branch (pushes made
 * with GITHUB_TOKEN do not trigger workflows). Each remote step reads state first and is skipped when done.
 * Exit 0 done/planned, 1 refused before any remote write, 2 uncertain remote write (rerun to resume).
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFilePlan } from '../shared/file-plan.ts';
import { prepareVersion, stableVersion, today } from './prepare.mjs';
import { extractNotes, validDate } from './changelog.mjs';
import { verifyReleaseBranch } from './branch.mjs';
import { createRunner, gitSucceeds, gitText, safeDetail } from './commands.mjs';

const releaseFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'CHANGELOG.md'];
const refusal = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });
const fallbackBody = '## Release {{version}}\n\nRelease branch `{{release_branch}}` cut from `{{base}}` at {{base_sha}} on {{date}}.\n\n### Changelog\n\n{{changelog}}\n';

export function releaseBody(template, values) {
  return (template ?? fallbackBody).replace(/\{\{\s*(version|base|base_sha|release_branch|date|changelog)\s*\}\}/g, (_, key) => values[key]);
}

function remoteSha(run, kind, name) {
  const result = run('git', ['ls-remote', kind === 'tag' ? '--tags' : '--heads', 'origin', `refs/${kind === 'tag' ? 'tags' : 'heads'}/${name}`]);
  if (result.status !== 0) throw refusal('REMOTE_UNREACHABLE', `git ls-remote origin failed: ${safeDetail(result)}`);
  return result.stdout.trim().split(/\s+/)[0] || null;
}

function localState(run, version, branch) {
  const current = gitText(run, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const clean = gitText(run, ['status', '--porcelain', '--untracked-files=normal']) === '';
  const subject = gitText(run, ['log', '-1', '--format=%s']);
  return { current, clean, resumed: current === branch && clean && subject === `release: ${version}` };
}

/** --execute refuses at the first blocker; a dry run lists every blocker and still shows the plan. */
async function preflight({ run, root, version, base, branch, execute, remote, date, steps, warnings, blockers }) {
  const state = localState(run, version, branch);
  if (state.resumed) {
    for (const id of ['create-branch', 'prepare', 'commit']) steps.push({ id, status: 'skipped', detail: `Already on ${branch} with "release: ${version}".` });
    return null;
  }
  const block = (code, message) => { if (execute) throw refusal(code, message); blockers.push(`${code}: ${message}`); };
  if (!state.clean) block('CUT_TREE_NOT_CLEAN', 'Commit or stash local changes first.');
  if (state.current !== base) block('CUT_NOT_ON_BASE', `Check out ${base} (currently ${state.current}).`);
  if (execute && remote) { gitText(run, ['fetch', '--quiet', 'origin', base], 'REMOTE_UNREACHABLE'); steps.push({ id: 'fetch-base', status: 'done', detail: `Fetched origin/${base}.` }); }
  const tracking = run('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${base}^{commit}`]);
  if (tracking.status !== 0) warnings.push(`origin/${base} is not fetched; cannot prove ${base} is up to date.`);
  else if (state.current === base && tracking.stdout.trim() !== gitText(run, ['rev-parse', 'HEAD'])) block('CUT_BASE_NOT_CURRENT', `Local ${base} differs from origin/${base}; pull first.`);
  if (gitSucceeds(run, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`])) block('CUT_BRANCH_EXISTS', `Local branch ${branch} exists.`);
  if (gitText(run, ['tag', '-l', version])) block('CUT_TAG_EXISTS', `Local tag ${version} exists.`);
  if (execute && remote) {
    if (remoteSha(run, 'branch', branch)) throw refusal('CUT_BRANCH_EXISTS', `origin has ${branch}; check it out and rerun to resume.`);
    if (remoteSha(run, 'tag', version)) throw refusal('CUT_TAG_EXISTS', `origin has tag ${version}.`);
  }
  let prepared;
  try { prepared = await prepareVersion(root, version, '', { date }); }
  catch (error) { if (execute) throw error; blockers.push(error.message); return null; }
  steps.push({ id: 'create-branch', status: 'planned', detail: `git switch -c ${branch}` },
    { id: 'prepare', status: 'planned', detail: `Update ${prepared.plan.changes.map(change => change.path).join(', ')}.` },
    { id: 'commit', status: 'planned', detail: `git commit -m "release: ${version}"` });
  return prepared;
}

async function pushBranch({ run, env, branch, head }) {
  const existing = remoteSha(run, 'branch', branch);
  if (existing === head) return { id: 'push', status: 'skipped', detail: `origin/${branch} is already ${head}.` };
  if (existing) throw refusal('CUT_REMOTE_BRANCH_DIVERGED', `origin/${branch} is ${existing}, not ${head}; it is never force-pushed.`);
  const helper = env.GH_TOKEN ? ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential'] : [];
  const result = run('git', [...helper, 'push', 'origin', `HEAD:refs/heads/${branch}`]);
  if (result.status !== 0) throw Object.assign(refusal('PUSH_FAILED', safeDetail(result)), { uncertain: true });
  return { id: 'push', status: 'done', detail: `Pushed ${branch} at ${head}.` };
}

function ghJson(run, args, code) {
  const result = run('gh', args);
  if (result.status !== 0) throw refusal(code, result.error === 'ENOENT' ? 'Install the GitHub CLI (gh).' : safeDetail(result));
  try { return JSON.parse(result.stdout || 'null'); } catch { throw refusal(code, 'gh returned invalid JSON.'); }
}

async function openPullRequest({ run, root, repoArgs, branch, base, values }) {
  const open = ghJson(run, ['pr', 'list', '--head', branch, '--base', base, '--state', 'open', '--json', 'number,url,isDraft,headRefOid', ...repoArgs], 'GH_PR_LIST_FAILED');
  if (Array.isArray(open) && open.length) return { id: 'pull-request', status: 'skipped', detail: `Pull request ${open[0].url} is already open.` };
  let template = null;
  try { template = await readFile(join(root, '.github/PULL_REQUEST_TEMPLATE/release.md'), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const folder = await mkdtemp(join(tmpdir(), 'release-cut-'));
  try {
    const bodyFile = join(folder, 'body.md');
    await writeFile(bodyFile, releaseBody(template, values), { flag: 'wx' });
    const result = run('gh', ['pr', 'create', '--draft', '--base', base, '--head', branch, '--title', `Release ${values.version}`, '--body-file', bodyFile, ...repoArgs]);
    if (result.status !== 0) throw Object.assign(refusal('PR_CREATE_FAILED', safeDetail(result)), { uncertain: true });
    return { id: 'pull-request', status: 'done', detail: `Opened draft pull request ${result.stdout.trim()}.` };
  } finally { await rm(folder, { recursive: true, force: true }); }
}

function dispatchRelease({ run, repoArgs, branch, head }) {
  const runs = ghJson(run, ['run', 'list', '--workflow', 'release.yml', '--branch', branch, '--json', 'databaseId,headSha,status', '--limit', '20', ...repoArgs], 'GH_RUN_LIST_FAILED');
  const existing = Array.isArray(runs) ? runs.find(item => item.headSha === head) : null;
  if (existing) return { id: 'dispatch-release', status: 'skipped', detail: `Release run ${existing.databaseId} already exists for ${head}.` };
  const result = run('gh', ['workflow', 'run', 'release.yml', '--ref', branch, ...repoArgs]);
  if (result.status !== 0) throw Object.assign(refusal('DISPATCH_FAILED', safeDetail(result)), { uncertain: true });
  return { id: 'dispatch-release', status: 'done', detail: `Dispatched release.yml on ${branch}.` };
}

export async function cutRelease({ root = process.cwd(), version, date, base = 'main', repository, execute = false, remote = false,
  env = process.env, run = createRunner({ cwd: root }) }) {
  stableVersion(version); root = resolve(root); date ??= today();
  if (!validDate(date)) throw refusal('RELEASE_DATE_INVALID', date);
  const branch = `release/${version}`; const steps = []; const warnings = []; const blockers = [];
  const result = { schemaVersion: 1, mode: execute ? 'execute' : 'dry-run', version, date, base, branch, steps, warnings };
  const prepared = await preflight({ run, root, version, base, branch, execute, remote, date, steps, warnings, blockers });
  const remoteIds = remote ? ['push', 'pull-request', 'dispatch-release'] : [];
  if (!execute) {
    for (const id of remoteIds) steps.push({ id, status: 'planned', detail: 'Runs with --execute --remote; checks remote state first.' });
    return { ...result, status: blockers.length ? 'blocked' : 'planned', blockers, changelog: prepared?.changelog.section ?? null };
  }
  if (prepared) {
    gitText(run, ['switch', '--quiet', '-c', branch]); steps.find(item => item.id === 'create-branch').status = 'done';
    await applyFilePlan(prepared.plan); steps.find(item => item.id === 'prepare').status = 'done';
    gitText(run, ['add', '--', ...releaseFiles]);
    gitText(run, ['commit', '--quiet', '-m', `release: ${version}`]); steps.find(item => item.id === 'commit').status = 'done';
  }
  const check = await verifyReleaseBranch({ root, version, branch, base, run, env: {} });
  if (check.status !== 'passed') throw refusal('CUT_SELF_CHECK_FAILED', check.checks.filter(item => item.status === 'failed').map(item => item.code).join(', '));
  const head = gitText(run, ['rev-parse', 'HEAD']); const baseSha = gitText(run, ['rev-parse', 'HEAD^']);
  Object.assign(result, { head, baseSha });
  if (!remote) return { ...result, status: 'committed', next: `Review, then rerun with --execute --remote (or push ${branch} yourself).` };
  const repoArgs = repository ? ['--repo', repository] : [];
  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8');
  const values = { version, base, base_sha: baseSha, release_branch: branch, date, changelog: extractNotes(changelog, version) };
  try {
    steps.push(await pushBranch({ run, env, branch, head }));
    steps.push(await openPullRequest({ run, root, repoArgs, branch, base, values }));
    steps.push(dispatchRelease({ run, repoArgs, branch, head }));
  } catch (error) {
    if (!error.uncertain) throw error;
    return { ...result, status: 'uncertain', error: error.message, recovery: `Inspect origin and pull requests, then rerun with --execute --remote on ${branch}; each step checks state first.` };
  }
  return { ...result, status: 'pushed' };
}

export function parseCutArguments(args) {
  const options = {}; const seen = new Set();
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    seen.add(flag);
    if (['--execute', '--remote', '--json'].includes(flag)) options[flag.slice(2)] = true;
    else if (['--version', '--date', '--base', '--repository'].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  stableVersion(options.version);
  if (options.date && !validDate(options.date)) throw new Error('RELEASE_DATE_INVALID');
  if (options.base && !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(options.base)) throw new Error('INVALID_BASE_BRANCH');
  if (options.repository && !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(options.repository)) throw new Error('INVALID_REPOSITORY');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCutArguments(process.argv.slice(2));
    if (options.help) console.log('node scripts/release/cut.mjs --version X.Y.Z [--date YYYY-MM-DD] [--base main] [--repository owner/repo] [--execute] [--remote] [--json]\nDefault: a dry-run plan. --execute creates release/X.Y.Z and commits the prepared release; --remote also pushes, opens a draft PR and dispatches release.yml.');
    else {
      const result = await cutRelease({ ...options, repository: options.repository ?? process.env.GITHUB_REPOSITORY });
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        for (const item of result.steps) console.log(`${item.status.toUpperCase().padEnd(8)} ${item.id}: ${item.detail}`);
        for (const warning of result.warnings) console.log(`WARNING  ${warning}`);
        for (const blocker of result.blockers ?? []) console.log(`BLOCKED  ${blocker}`);
        if (result.changelog) console.log(`\n## [${result.version}] - ${result.date}\n\n${result.changelog}\n`);
        console.log(`Release cut ${result.status}: ${result.branch}${result.recovery ? `\n${result.error}\n${result.recovery}` : ''}`);
      }
      if (result.status === 'uncertain') process.exitCode = 2;
      else if (result.status === 'blocked') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
