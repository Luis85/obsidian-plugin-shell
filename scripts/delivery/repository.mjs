/**
 * The only filesystem and Git access of the delivery checks: base resolution, the diff against the merge
 * base (working tree plus untracked files, through the self-review diff parser), the repository file list,
 * suites, npm scripts, pull-request environment and the optional `node bin/app check --plan` gates.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { collectChanges } from '../quality/self-review-diff.mjs';
import { safeRelative } from './paths.mjs';

const git = (root, args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const failure = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code });

/** The merge base of HEAD with `ref`. */
function mergeBase(root, ref) {
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return { ref, sha: git(root, ['merge-base', 'HEAD', ref]).trim() };
  } catch {
    throw failure('DELIVERY_BASE_UNRESOLVED', `cannot resolve a merge base with "${ref}". Fetch it (git fetch origin <branch>) or pass --base <ref>.`);
  }
}

/** An untracked symlink to a folder (a worktree's linked node_modules) is environment, not a change. */
function linkedFolder(root, path) {
  try { return lstatSync(join(root, path)).isSymbolicLink() && statSync(join(root, path)).isDirectory(); } catch { return false; }
}

/** Tracked and untracked (not ignored) files that exist in the working tree. */
function repositoryFiles(root) {
  const listed = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--deduplicate']).split('\0').filter(Boolean);
  return [...new Set(listed)].filter(path => existsSync(join(root, path)) && !linkedFolder(root, path)).sort();
}

function readText(root, path) {
  if (!safeRelative(path)) return null;
  try { return readFileSync(join(root, path), 'utf8'); } catch { return null; }
}
function readJson(root, path) {
  try { return JSON.parse(readText(root, path) ?? 'null'); } catch { return null; }
}

/** Pull-request labels (comma or newline separated); null when the variable is absent (a local run). */
function parseLabels(value) {
  if (value === undefined || value === null) return null;
  return String(value).split(/[,\n]/).map(label => label.trim()).filter(Boolean);
}

/** `node bin/app check --plan --json` gates, or null when dependencies are not installed or the plan fails. */
export function checkPlanGates(root, baseRef) {
  if (!existsSync(join(root, 'node_modules')) || !existsSync(join(root, 'bin/app'))) return null;
  const run = spawnSync(process.execPath, ['bin/app', 'check', '--plan', '--base', baseRef, '--json'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  try {
    const gates = JSON.parse(run.stdout).data?.gates;
    return Array.isArray(gates) ? gates.map(gate => ({ id: String(gate.id), command: String(gate.command), required: gate.required === true })) : null;
  } catch { return null; }
}

/** Everything the rules read from this checkout, gathered once. */
export function repositorySnapshot(root, baseRef, { env = process.env, labelsEnv = 'PR_LABELS' } = {}) {
  const base = mergeBase(root, baseRef);
  const diff = collectChanges(root, base.sha).filter(file => !(file.status === 'A' && linkedFolder(root, file.path))).map(file => ({ path: file.path, status: file.status, added: file.added }));
  const suites = readJson(root, 'tests/suites.json')?.suites;
  return { base, diff, files: repositoryFiles(root),
    suites: Array.isArray(suites) ? suites.map(suite => suite.name) : [],
    scripts: readJson(root, 'package.json')?.scripts ?? {},
    labels: parseLabels(env[labelsEnv]), headRef: env.DELIVERY_HEAD_REF ?? '', actor: env.DELIVERY_ACTOR ?? '', body: env.DELIVERY_PR_BODY ?? '',
    readText: path => readText(root, path) };
}
