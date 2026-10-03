/** Pure parts of the project handoff qualification: options, the simulated cloud environment, the env-file replay and the summary. */
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export const DEFAULT_STARTER = 'quick-capture';
export const USAGE = `Usage: node scripts/testing/qualify-project-handoff.mjs [--starter <id>] [--base-node <dir>] [--target project|framework]
  [--work-dir <empty dir>] [--cache-dir <dir>] [--out <summary.json>] [--keep] [--skip-e2e]
  Generates a project (or takes this framework's committed HEAD), clones it so only committed files exist and replays a
  cloud session start in the clone: SessionStart hook, dependency restore, check, doctor, ui status, e2e. Prints one JSON summary.
  --base-node <dir>  Node install prefix (or bin directory) that is the ONLY Node on the simulated PATH, for example a Node 22.
  --cache-dir <dir>  Workbench cache for the provisioned Node (default: a fresh directory in the work dir).
  Exit 0 only when every step passed; 1 when a step failed; 3 when steps could not run (offline, no browser, --skip-e2e).`;
const VALUE = new Set(['--starter', '--base-node', '--target', '--work-dir', '--cache-dir', '--out']);
const FLAGS = { '--keep': 'keep', '--skip-e2e': 'skipE2e', '--help': 'help' };
const VALUE_KEYS = { '--starter': 'starter', '--base-node': 'baseNode', '--target': 'target', '--work-dir': 'workDir', '--cache-dir': 'cacheDir', '--out': 'out' };
/** @returns {{starter:string, target:string, baseNode:string|null, workDir:string|null, cacheDir:string|null, out:string|null, keep:boolean, skipE2e:boolean, help:boolean, error:string|null}} */
export function parseOptions(argv) {
  const options = { starter: DEFAULT_STARTER, target: 'project', baseNode: null, workDir: null, cacheDir: null, out: null, keep: false, skipE2e: false, help: false, error: null };
  for (let index = 0; index < argv.length && !options.error; index += 1) {
    const name = argv[index];
    if (name in FLAGS) { options[FLAGS[name]] = true; continue; }
    if (!VALUE.has(name)) { options.error = `Unknown option ${name}`; continue; }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) { options.error = `${name} needs a value`; continue; }
    options[VALUE_KEYS[name]] = value; index += 1;
  }
  if (!options.error && !['project', 'framework'].includes(options.target)) options.error = `--target must be project or framework, not ${options.target}`;
  if (!options.error && !/^[a-z0-9][a-z0-9-]*$/.test(options.starter)) options.error = `--starter must be a starter id, not ${options.starter}`;
  return options;
}
/** The bin directory for `--base-node`: the prefix's bin when it has one, else the directory itself. */
export function baseNodeBin(baseNode, exists = existsSync) {
  if (!baseNode) return null;
  return exists(join(baseNode, 'bin', 'node')) ? join(baseNode, 'bin') : baseNode;
}
/** PATH for the simulated session: the base Node first, then the current entries that hold no node of their own (git, curl, tar stay available). */
export function simulatedPath(baseBin, currentPath, exists = existsSync) {
  if (!baseBin) return currentPath;
  const keep = String(currentPath ?? '').split(delimiter).filter(entry => entry && !exists(join(entry, 'node')) && !exists(join(entry, 'node.exe')));
  return [baseBin, ...keep].join(delimiter);
}
/** Replay the exports a SessionStart hook wrote to CLAUDE_ENV_FILE (`export NAME="value"`, backslash escapes, `$NAME` expansion). */
export function applyEnvFile(text, env) {
  const next = { ...env };
  for (const line of String(text ?? '').split('\n')) {
    const match = /^export ([A-Za-z_][A-Za-z0-9_]*)="((?:[^"\\]|\\.)*)"$/.exec(line.trim());
    if (match) next[match[1]] = expand(match[2], next);
  }
  return next;
}
function expand(value, env) {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\\') { out += value[index + 1] ?? ''; index += 1; continue; }
    const name = char === '$' ? /^\$(?:\{([A-Za-z_]\w*)\}|([A-Za-z_]\w*))/.exec(value.slice(index)) : null;
    if (!name) { out += char; continue; }
    out += env[name[1] ?? name[2]] ?? '';
    index += name[0].length - 1;
  }
  return out;
}
/** Overall verdict, fail closed: only all-passed is "passed"; any failure wins over steps that did not run. */
export function summarize(steps) {
  if (steps.length === 0 || steps.some(step => step.status === 'failed')) return { status: 'failed', exitCode: 1 };
  if (steps.some(step => step.status === 'not-run')) return { status: 'incomplete', exitCode: 3 };
  return steps.every(step => step.status === 'passed') ? { status: 'passed', exitCode: 0 } : { status: 'failed', exitCode: 1 };
}
/** Run one named step; a throw becomes a failed step. The body returns `{status, detail}` or nothing for passed. */
export async function recordStep(steps, name, body, now = Date.now) {
  const started = now();
  let result;
  try { result = (await body()) ?? {}; } catch (error) { result = { status: 'failed', detail: String(error?.message ?? error).slice(0, 2000) }; }
  const step = { name, status: result.status ?? 'passed', durationMs: now() - started, ...(result.detail ? { detail: result.detail } : {}) };
  steps.push(step);
  return step;
}
