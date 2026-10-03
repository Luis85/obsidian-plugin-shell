/** Agent SessionStart hook (framework checkout and generated projects): report the toolchain, make cloud sessions usable.
 * Stdout becomes the agent's context, so it is a short plain-text status (at most 10 lines). It never fails the session:
 * every problem is reported as text and the exit code is always 0. When everything is fine it is read-only and fast.
 *  - Node/npm: actual versus the qualified ones from .nvmrc, package.json engines and packageManager. When Node is not the
 *    qualified one but a qualified install exists in a well-known place, it is put on PATH for the session (CLAUDE_ENV_FILE).
 *  - Dependencies: a missing node_modules is restored with `npm ci --ignore-scripts`, only in cloud sessions
 *    (CLAUDE_CODE_REMOTE=true) or when SHELL_SESSION_START_INSTALL=1; SHELL_SESSION_START_INSTALL=0 never installs.
 *  - Browser: reported through the shared resolver (SHELL_CHROMIUM override, pinned revision, mismatch). Never downloads. */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boundedOutput, npmCommand, packageRootFor, readHookInput } from './hook-io.mjs';

const INSTALL_TIMEOUT_MS = 480_000;
const MAX_LINES = 10;
const version = text => /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''))?.slice(1, 4).map(Number) ?? null;
function compare(a, b) { return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]; }
const operators = { '>=': d => d >= 0, '>': d => d > 0, '<=': d => d <= 0, '<': d => d < 0, '=': d => d === 0, '': d => d === 0 };
/** Space-separated comparators only (`>=22.13.0`, `>=11.19.1 <13`); anything else is "unknown" (null), never a false verdict. */
export function satisfies(actual, range) {
  const have = version(actual);
  if (!have || !range || range.includes('||')) return null;
  const parts = range.trim().split(/\s+/).map(part => /^(>=|<=|>|<|=)?v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(part));
  if (parts.some(part => !part)) return null;
  return parts.every(([, operator = '', major, minor = '0', patch = '0']) => operators[operator](compare(have, [Number(major), Number(minor), Number(patch)])));
}
const readText = path => { try { return readFileSync(path, 'utf8'); } catch { return null; } };
const readJson = path => { try { return JSON.parse(readText(path)); } catch { return null; } };
/** The qualified toolchain a checkout declares; missing declarations stay null. */
export function qualifiedToolchain(root, read = readText) {
  const pkg = (() => { try { return JSON.parse(read(join(root, 'package.json'))) ?? {}; } catch { return {}; } })();
  const nvmrc = String(read(join(root, '.nvmrc')) ?? '').trim().replace(/^v/, '');
  const manager = /^npm@(\d+\.\d+\.\d+)/.exec(pkg.packageManager ?? '');
  return { node: version(nvmrc) ? nvmrc : null, nodeRange: pkg.engines?.node ?? null, npm: manager?.[1] ?? null, npmRange: pkg.engines?.npm ?? null };
}
/** One status line per tool: matches, satisfies only the engines range, or is outside it. */
export function toolLine(label, actual, qualified, range) {
  if (!actual) return `${label}: not found${qualified ? ` (qualified ${qualified})` : ''}.`;
  if (qualified && version(actual)?.join('.') === version(qualified).join('.')) return `${label} ${actual}: qualified.`;
  const inRange = satisfies(actual, range);
  if (inRange === false) return `${label} ${actual}: UNQUALIFIED, outside engines ${range}${qualified ? ` (qualified ${qualified})` : ''}.`;
  if (qualified) return `${label} ${actual}: not the qualified ${qualified}${inRange ? ` (satisfies engines ${range})` : ''}; results may differ from the qualified toolchain.`;
  return `${label} ${actual}: no qualified version declared.`;
}
/** Directories that commonly hold another Node install, most specific first. */
function nodeCandidates(qualified, env, home) {
  const major = version(qualified)?.[0];
  return [env.SHELL_NODE_BIN, `/opt/node${major}/bin`, join(env.NVM_DIR ?? join(home, '.nvm'), 'versions', 'node', `v${qualified}`, 'bin'),
    `/usr/local/n/versions/node/${qualified}/bin`, join(home, '.volta', 'tools', 'image', 'node', qualified, 'bin')].filter(Boolean);
}
const probeNode = directory => {
  const result = spawnSync(join(directory, process.platform === 'win32' ? 'node.exe' : 'node'), ['--version'], { encoding: 'utf8', timeout: 5000 });
  return result.status === 0 ? result.stdout.trim().replace(/^v/, '') : null;
};
/** A bin directory whose node is exactly the qualified version, else null. */
export function findQualifiedNode(qualified, { env, home, exists = existsSync, probe = probeNode }) {
  if (!version(qualified)) return null;
  return nodeCandidates(qualified, env, home).find(directory => exists(directory) && probe(directory) === qualified) ?? null;
}
/** Persist the qualified Node for the session's later shell commands; false when no env file is offered. */
export function exportPath(env, directory, append = appendFileSync) {
  if (!env.CLAUDE_ENV_FILE) return false;
  try { append(env.CLAUDE_ENV_FILE, `export PATH="${directory}:$PATH"\n`); return true; } catch { return false; }
}
export function installDecision(env) {
  if (env.SHELL_SESSION_START_INSTALL === '0') return { install: false, why: 'SHELL_SESSION_START_INSTALL=0' };
  if (env.SHELL_SESSION_START_INSTALL === '1') return { install: true, why: 'opted in' };
  return env.CLAUDE_CODE_REMOTE === 'true' ? { install: true, why: 'cloud session' } : { install: false, why: 'local session; set SHELL_SESSION_START_INSTALL=1 to allow' };
}
/** `npm ci --ignore-scripts` with the chosen toolchain first on PATH; bounded failure text, never throws. */
export function installDependencies(root, env, nodeDirectory, run = spawnSync) {
  const childEnv = { ...env, FORCE_COLOR: '0', ...(nodeDirectory ? { PATH: `${nodeDirectory}${process.platform === 'win32' ? ';' : ':'}${env.PATH ?? ''}` } : {}) };
  const npm = npmCommand(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { ...childEnv, npm_execpath: undefined });
  const started = Date.now();
  const result = run(npm.command, npm.args, { cwd: root, encoding: 'utf8', timeout: INSTALL_TIMEOUT_MS, shell: npm.shell, maxBuffer: 16 * 1024 * 1024, env: childEnv });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!result.error && !result.signal && result.status === 0) return { ok: true, text: `restored with npm ci --ignore-scripts (${seconds}s).` };
  const why = result.error || result.signal ? `did not finish (${result.error?.code ?? result.error?.message ?? result.signal})` : `failed (exit ${result.status})`;
  return { ok: false, text: `npm ci --ignore-scripts ${why}: ${boundedOutput(`${result.stderr ?? ''}\n${result.stdout ?? ''}`, 400).replace(/\s+/g, ' ')}` };
}
function dependencyLine(root, env, nodeDirectory, deps) {
  if (deps.exists(join(root, 'node_modules'))) return deps.stale(root) ? 'Dependencies: node_modules is older than package-lock.json; run npm ci --ignore-scripts if imports fail.' : null;
  const decision = installDecision(env);
  if (!decision.install) return `Dependencies: node_modules MISSING; not installing (${decision.why}). Run npm ci --ignore-scripts.`;
  const outcome = deps.install(root, env, nodeDirectory);
  return `Dependencies: node_modules was missing, ${outcome.text}`;
}
async function loadResolver(root) {
  try { return (await import(pathToFileURL(join(root, 'scripts/testing/browser-executable.mjs')).href)).resolveBrowserExecutable; } catch { return null; }
}
/** Browser readiness line; silent when the project has no Playwright dependency to resolve. */
function browserLine(resolveBrowser, root, env) {
  if (!resolveBrowser) return null;
  const result = resolveBrowser({ env, root });
  if (result.reason === 'playwright-not-installed') return null;
  if (result.status === 'pinned') return `Browser: pinned Chromium r${result.expectedRevision} ready.`;
  if (result.status === 'override') return `Browser: SHELL_CHROMIUM override ${result.executablePath}.`;
  if (result.status === 'revision-mismatch') return `Browser: REVISION MISMATCH (expects r${result.expectedRevision}, has ${result.availableRevisions.join(',')}); browser suites report not-run. Opt in to the older build: SHELL_CHROMIUM=${result.candidateExecutable}`;
  return `Browser: NOT READY. ${result.hint}`;
}
const stale = root => {
  try { return statSync(join(root, 'node_modules/.package-lock.json')).mtimeMs < statSync(join(root, 'package-lock.json')).mtimeMs; } catch { return false; }
};
/** npm bundled beside a node binary (Unix `bin/../lib/node_modules/npm`, Windows `node_modules/npm`). */
const bundledNpm = binDirectory => ['../lib/node_modules/npm', 'node_modules/npm'].map(path => readJson(join(binDirectory, path, 'package.json'))?.version).find(Boolean) ?? null;
function pathNpm(run = spawnSync) {
  const npm = npmCommand(['--version'], {});
  const result = run(npm.command, npm.args, { encoding: 'utf8', timeout: 10000, shell: npm.shell });
  return result.status === 0 ? result.stdout.trim() : null;
}
/** Build the status text. `deps` carries every side effect so tests can fake the file system, processes and environment. */
export async function sessionStatus(root, env, deps) {
  const qualified = qualifiedToolchain(root, deps.read);
  const lines = [`Session toolchain (${root}):`];
  const nodeOk = qualified.node && version(deps.nodeVersion)?.join('.') === version(qualified.node).join('.');
  let nodeDirectory = null;
  lines.push(toolLine('Node', deps.nodeVersion, qualified.node, qualified.nodeRange));
  if (qualified.node && !nodeOk) {
    nodeDirectory = deps.findNode(qualified.node, { env, home: deps.home });
    lines.push(nodeDirectory ? `Qualified Node ${qualified.node} found at ${nodeDirectory}; ${deps.exportPath(env, nodeDirectory) ? 'put first on PATH for this session' : `run: export PATH="${nodeDirectory}:$PATH"`}.`
      : `No qualified Node ${qualified.node} found in known locations; install it (nvm install ${qualified.node}).`);
  }
  lines.push(toolLine(nodeDirectory ? 'npm (with the qualified Node)' : 'npm', deps.npmVersion(nodeDirectory), qualified.npm, qualified.npmRange));
  for (const line of [dependencyLine(root, env, nodeDirectory, deps), browserLine(deps.resolveBrowser, root, env)]) if (line) lines.push(line);
  return lines.slice(0, MAX_LINES).join('\n');
}
async function realDeps() {
  return { read: readText, nodeVersion: process.versions.node, npmVersion: directory => directory ? bundledNpm(directory) : bundledNpm(dirname(process.execPath)) ?? pathNpm(), home: homedir(), exists: existsSync, stale, findNode: findQualifiedNode,
    exportPath, install: installDependencies, resolveBrowser: await loadResolver(resolve(dirname(fileURLToPath(import.meta.url)), '../..')) };
}
export async function runSessionStart(input, env = process.env, makeDeps = realDeps) {
  try {
    const start = typeof input?.cwd === 'string' ? input.cwd : env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const root = packageRootFor(env.CLAUDE_PROJECT_DIR ?? start) ?? packageRootFor(start);
    if (!root) return 'Session toolchain: no package.json found; nothing to check.';
    return await sessionStatus(root, env, await makeDeps(root));
  } catch (error) {
    return `Session toolchain: the start-up check itself failed (${error?.message ?? error}); the session continues.`;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${await runSessionStart(await readHookInput().catch(() => ({})))}\n`);
  process.exitCode = 0;
}
