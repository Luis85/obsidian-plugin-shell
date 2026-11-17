/**
 * Release preflight: read-only checks to run on main before dispatching Release cut, so a release attempt does not
 * fail hours later on something visible in minutes.
 *
 *   node tooling/release/preflight.mjs --version X.Y.Z [--date YYYY-MM-DD] [--skip-security] [--json]
 *
 * cut-plan         the cut's own dry run: stable newer version, non-empty Unreleased, clean current main, no
 *                  release branch or tag yet.
 * changelog-tests  every acceptance test that reads CHANGELOG.md, run against the promoted changelog (Unreleased ->
 *                  X.Y.Z) in a throwaway git worktree of HEAD; a test pinned to Unreleased fails here, not in Release.
 * security         the live `check:security` audit that Candidate qualification gates on (needs the registry).
 * Exit 0 when nothing failed (skipped checks are reported), 1 when a check failed. The checkout is never written.
 */
import { mkdtemp, readFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFilePlan } from '../../src/shared/platform/file-plan.ts';
import { prepareVersion, stableVersion, today } from '../../src/cli/tooling/release/prepare.mjs';
import { validDate } from '../../src/cli/tooling/release/changelog.mjs';
import { cutRelease } from './cut.mjs';
import { createRunner, gitText, safeDetail } from './commands.mjs';
import { releaseOutputs } from './generated-outputs.mjs';

const outcome = status => (id, detail) => ({ id, status, detail });
const passed = outcome('passed'), failed = outcome('failed'), skipped = outcome('skipped');
const exists = async path => { try { await stat(path); return true; } catch { return false; } };

/** Repository-relative acceptance test files that read CHANGELOG.md. */
export async function changelogBoundTests(root) {
  const folder = join(root, 'tests/acceptance');
  if (!await exists(folder)) return [];
  const files = (await readdir(folder, { recursive: true })).map(name => join(folder, name)).filter(path => path.endsWith('.checks.mjs'));
  const bound = [];
  for (const path of files.sort()) if ((await readFile(path, 'utf8')).includes('CHANGELOG.md')) bound.push(relative(root, path).replaceAll('\\', '/'));
  return bound;
}

async function changelogTests({ root, version, date, run }) {
  const files = await changelogBoundTests(root);
  if (!files.length) return skipped('changelog-tests', 'No acceptance test reads CHANGELOG.md.');
  const folder = await mkdtemp(join(tmpdir(), 'release-preflight-')); const tree = join(folder, 'tree');
  try {
    gitText(run, ['worktree', 'add', '--quiet', '--detach', tree, 'HEAD']);
    try {
      const prepared = await prepareVersion(tree, version, '', { date, generated: await releaseOutputs(tree) });
      await applyFilePlan(prepared.plan);
      if (await exists(join(root, 'node_modules'))) await symlink(join(root, 'node_modules'), join(tree, 'node_modules'), 'junction');
      // A clean environment: an inherited NODE_TEST_CONTEXT would make the nested runner report to an absent parent.
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
      const result = run(process.execPath, ['--test', ...files], { cwd: tree, timeout: 600000, env });
      if (result.status === 0) return passed('changelog-tests', `${files.length} test file(s) pass against the promoted changelog.`);
      const failing = [...new Set([...result.stdout.matchAll(/^✖ (.+?) \(\d/gmu)].map(match => match[1]))].join('; ');
      return failed('changelog-tests', `Fails against the promoted changelog (${files.join(', ')}): ${failing || safeDetail(result)}`);
    } finally { run('git', ['worktree', 'remove', '--force', tree]); }
  } finally { await rm(folder, { recursive: true, force: true }); }
}

/** The live audit through npm, as `npm run check:security` requires; skipped when npm cannot be started safely. */
export function liveSecurity({ root, run }) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli && process.platform === 'win32') return skipped('security', 'Run through `npm run release:preflight` on Windows to reach npm.');
  const result = npmCli ? run(process.execPath, [npmCli, 'run', 'check:security'], { cwd: root }) : run('npm', ['run', 'check:security'], { cwd: root });
  if (result.status === null) return skipped('security', `npm could not start (${result.error}).`);
  const verdict = /Security check: (.+)/.exec(result.stdout)?.[1] ?? 'no verdict';
  const uncovered = /^uncovered: (.+)$/m.exec(result.stdout)?.[1];
  return result.status === 0 ? passed('security', verdict) : failed('security', `${verdict}${uncovered ? `; uncovered: ${uncovered}` : ''}`);
}

export async function preflightRelease({ root = process.cwd(), version, date, skipSecurity = false, run = createRunner({ cwd: root }), security = liveSecurity }) {
  stableVersion(version); root = resolve(root); date ??= today();
  if (!validDate(date)) throw new Error(`RELEASE_DATE_INVALID: ${date}`);
  const checks = [];
  const plan = await cutRelease({ root, version, date, run, env: {} });
  checks.push(plan.status === 'planned' ? passed('cut-plan', `${plan.branch} planned from ${plan.base}.`) : failed('cut-plan', plan.blockers.join(' | ')));
  checks.push(await changelogTests({ root, version, date, run }));
  checks.push(skipSecurity ? skipped('security', 'Skipped with --skip-security.') : await security({ root, run }));
  return { schemaVersion: 1, version, date, status: checks.some(check => check.status === 'failed') ? 'blocked' : 'ready', checks };
}

export function parsePreflightArguments(args) {
  const options = {}; const seen = new Set();
  if (!args.length || (args.length === 1 && args[0] === '--help')) return { help: true };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    seen.add(flag);
    if (flag === '--json') options.json = true;
    else if (flag === '--skip-security') options.skipSecurity = true;
    else if (flag === '--version' || flag === '--date') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag.slice(2)] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  stableVersion(options.version);
  if (options.date && !validDate(options.date)) throw new Error('RELEASE_DATE_INVALID');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parsePreflightArguments(process.argv.slice(2));
    if (options.help) console.log('node tooling/release/preflight.mjs --version X.Y.Z [--date YYYY-MM-DD] [--skip-security] [--json]\nRead-only checks before Release cut: the cut plan, acceptance tests that read CHANGELOG.md against the promoted changelog, and the live security audit.');
    else {
      const result = await preflightRelease(options);
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        for (const check of result.checks) console.log(`${check.status.toUpperCase().padEnd(8)} ${check.id}: ${check.detail}`);
        console.log(`Release preflight ${result.status}: ${result.version}`);
      }
      if (result.status !== 'ready') process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
