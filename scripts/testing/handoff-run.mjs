/** Process and environment plumbing for the project handoff qualification (nothing here is specific to one step). */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { simulatedPath } from './handoff-options.mjs';

const OUTPUT_LIMIT = 1800;
/** The tail of a command's output, where failure summaries are. */
export const tail = (text, limit = OUTPUT_LIMIT) => { const plain = String(text ?? '').trim(); return plain.length > limit ? `...${plain.slice(-limit)}` : plain; };
/** Run a command to completion; never throws. `error` carries spawn failures and timeouts. */
export function run(command, args, { cwd, env, timeout = 600_000, input } = {}) {
  const result = spawnSync(command, args, { cwd, env, input, encoding: 'utf8', timeout, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  return { status: result.status, signal: result.signal, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error ?? null };
}
/** One-line verdict for a finished command: null when it exited 0, else why not. */
export function failure(result, label) {
  if (result.error) return `${label} did not finish (${result.error.code ?? result.error.message}): ${tail(`${result.stdout}\n${result.stderr}`)}`;
  return result.status === 0 ? null : `${label} exited ${result.status}: ${tail(`${result.stdout}\n${result.stderr}`)}`;
}
/** Network reachability for the steps that must download (Node, npm packages). curl first: it honours HTTPS_PROXY and the CA variables. */
export async function networkAvailable(env, spawn = spawnSync, fetchImpl = globalThis.fetch) {
  const curl = spawn('curl', ['-fsSI', '--max-time', '15', 'https://registry.npmjs.org/-/ping'], { env, encoding: 'utf8', timeout: 20_000 });
  if (curl.status === 0) return true;
  if (!curl.error || curl.error.code !== 'ENOENT') return false;
  try { return (await fetchImpl('https://registry.npmjs.org/-/ping', { signal: AbortSignal.timeout(15_000) })).ok; } catch { return false; }
}
/** Keys that must not leak from the maintainer's shell into the simulated session: npm's own run variables, session switches and the browser override. */
const LEAKING = /^(?:npm_(?!config_)|INIT_CWD$|NODE$|CLAUDE_|SHELL_CHROMIUM$|SHELL_SESSION_START_|SHELL_NODE_)/;
/** The environment of a fresh cloud session in `clone`: remote flag, env file, a private Workbench cache and only the base Node on PATH. */
export function sessionEnvironment(base, { clone, envFile, cacheDir, baseBin, exists = existsSync, home = base.HOME ?? homedir() }) {
  const env = Object.fromEntries(Object.entries(base).filter(([key]) => !LEAKING.test(key)));
  const defaultBrowsers = join(base.XDG_CACHE_HOME || join(home, '.cache'), 'ms-playwright');
  if (!env.PLAYWRIGHT_BROWSERS_PATH && exists(defaultBrowsers)) env.PLAYWRIGHT_BROWSERS_PATH = defaultBrowsers;
  return { ...env, HOME: home, PATH: simulatedPath(baseBin, base.PATH), CLAUDE_CODE_REMOTE: 'true', CLAUDE_ENV_FILE: envFile, CLAUDE_PROJECT_DIR: clone, XDG_CACHE_HOME: cacheDir };
}
