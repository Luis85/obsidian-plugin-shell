/** Dependency restoration for the session hook: `npm ci --ignore-scripts` with the chosen toolchain first on PATH. */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { pathFor, withPathFirst } from '../../src/shared/platform/platform-path.mjs';
import { boundedOutput, npmCommand } from './hook-io.mjs';
import { switchDecision } from './session-switch.mjs';

const INSTALL_MS = 480_000;
export function installDecision(env) {
  const { enabled, why } = switchDecision(env, 'SHELL_SESSION_START_INSTALL');
  return { install: enabled, why };
}
export const stale = root => {
  try { return statSync(join(root, 'node_modules/.package-lock.json')).mtimeMs < statSync(join(root, 'package-lock.json')).mtimeMs; } catch { return false; }
};
/** `npm ci --ignore-scripts`; bounded failure text, never throws. `budgetMs` caps the run inside the hook's overall time. */
export function installDependencies(root, env, nodeDirectory, run = spawnSync, budgetMs = INSTALL_MS) {
  const childEnv = { ...(nodeDirectory ? withPathFirst(env, nodeDirectory) : env), FORCE_COLOR: '0' };
  const npm = npmCommand(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { ...childEnv, npm_execpath: undefined });
  const started = Date.now();
  const result = run(npm.command, npm.args, { cwd: root, encoding: 'utf8', timeout: Math.min(INSTALL_MS, budgetMs), shell: npm.shell, maxBuffer: 16 * 1024 * 1024, env: childEnv });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!result.error && !result.signal && result.status === 0) return { ok: true, text: `restored with npm ci --ignore-scripts (${seconds}s).` };
  const why = result.error || result.signal ? `did not finish (${result.error?.code ?? result.error?.message ?? result.signal})` : `failed (exit ${result.status})`;
  return { ok: false, text: `npm ci --ignore-scripts ${why}: ${boundedOutput(`${result.stderr ?? ''}\n${result.stdout ?? ''}`, 400).replace(/\s+/g, ' ')}` };
}
/** The dependency status line; null when node_modules is present and current. */
export function dependencyLine(root, env, nodeDirectory, deps, budgetMs) {
  if (deps.exists(pathFor(deps.platform ?? process.platform).join(root, 'node_modules'))) return deps.stale(root) ? 'Dependencies: node_modules is older than package-lock.json; run npm ci --ignore-scripts if imports fail.' : null;
  const decision = installDecision(env);
  if (!decision.install) return `Dependencies: node_modules MISSING; not installing (${decision.why}). Run npm ci --ignore-scripts.`;
  const outcome = deps.install(root, env, nodeDirectory, undefined, budgetMs);
  return `Dependencies: node_modules was missing, ${outcome.text}`;
}
