/**
 * Which optional Integration-tier qualification a run needs (owner decision: pull requests run the core shell gate).
 * `generators` is true when a pull request changes one of the generator inputs in configs/quality/ci-scope.json, and
 * for every other event (push, schedule, dispatch, workflow_call): only a pull request can narrow the run, and an
 * unreadable diff fails toward running more. Dependency-free so ci.yml's scope job runs it without an install.
 *
 *   node tooling/quality/ci-scope.mjs [--event <name>] [--files-from <path>]
 *
 * The event defaults to GITHUB_EVENT_NAME. A pull request's changed files are read from --files-from (one path per
 * line) or else from `git diff --name-only HEAD^1 HEAD` on the pull request's merge commit. The result is printed and,
 * when GITHUB_OUTPUT is set, appended there as `generators=true|false`.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchesAny } from '../../src/cli/tooling/delivery/paths.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** The generator inputs and the path-filtered consumer workflows. */
export function readScopeConfig(base = root) {
  const config = JSON.parse(readFileSync(resolve(base, 'configs/quality/ci-scope.json'), 'utf8'));
  const list = value => Array.isArray(value) && value.length && value.every(item => typeof item === 'string' && item.trim() === item && item);
  if (!list(config.generators) || !list(config.workflows)) throw new Error('CI_SCOPE_CONFIG_INVALID: generators and workflows must be non-empty lists of paths');
  return { generators: config.generators, workflows: config.workflows };
}

/** `changed` is the pull request's file list, or null when it could not be read. */
export function ciScope({ event, changed, config }) {
  if (event !== 'pull_request') return { generators: true, matched: [], reason: `${event || 'unknown'} event: every job runs` };
  if (changed === null) return { generators: true, matched: [], reason: 'changed files could not be read: every job runs' };
  const matched = changed.filter(path => matchesAny(config.generators, path));
  return matched.length
    ? { generators: true, matched, reason: `${matched.length} of ${changed.length} changed file(s) are generator inputs` }
    : { generators: false, matched, reason: `none of ${changed.length} changed file(s) is a generator input` };
}

const lines = text => text.split('\n').map(line => line.trim()).filter(Boolean);
function pullRequestFiles(filesFrom) {
  if (filesFrom) return lines(readFileSync(filesFrom, 'utf8'));
  const result = spawnSync('git', ['diff', '--name-only', 'HEAD^1', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? lines(result.stdout) : null;
}

export function parseScopeArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index], value = args[index + 1];
    if (flag !== '--event' && flag !== '--files-from') throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
    if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
    if (Object.hasOwn(options, flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`);
    options[flag] = value; index++;
  }
  return { event: options['--event'], filesFrom: options['--files-from'] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseScopeArguments(process.argv.slice(2));
    const event = options.event ?? process.env.GITHUB_EVENT_NAME ?? '';
    const changed = event === 'pull_request' ? pullRequestFiles(options.filesFrom) : [];
    const result = ciScope({ event, changed, config: readScopeConfig() });
    console.log(`generators=${result.generators}`);
    console.log(`reason: ${result.reason}`);
    for (const path of result.matched) console.log(`  ${path}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `generators=${result.generators}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
