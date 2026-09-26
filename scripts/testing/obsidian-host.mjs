import { spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';
import { assertNativeSocketBudget } from './native-isolation.mjs';

/** Provision and drive a real Obsidian host for the contained dev loop and E2E harness.
 * The launcher lives only in .native-runner and the host only in .native-cache. */
const LAUNCHER_VERSION = '3.2.1';
const DEFAULT_APP_VERSION = '1.13.7';
const versionPattern = /^(?:\d+\.\d+\.\d+|latest|earliest)$/;

export function downloadAllowed(args = [], env = process.env) {
  return args.includes('--allow-download') || env.OBSIDIAN_ALLOW_DOWNLOAD === '1';
}
export function requestedAppVersion(env = process.env) {
  const version = env.OBSIDIAN_VERSION ?? DEFAULT_APP_VERSION;
  if (!versionPattern.test(version)) throw new Error('OBSIDIAN_VERSION_INVALID');
  return version;
}
export class ProvisionRequired extends Error {
  constructor(missing) {
    super(provisionMessage(missing));
    this.code = 'OBSIDIAN_PROVISION_REQUIRED'; this.missing = missing;
  }
}
function provisionMessage(missing) {
  return [`Real-Obsidian tooling is not provisioned: ${missing.join('; ')}.`,
    'Nothing was downloaded or launched. Opt in explicitly with --allow-download (or OBSIDIAN_ALLOW_DOWNLOAD=1) to',
    `install obsidian-launcher ${LAUNCHER_VERSION} into .native-runner and download the host into .native-cache.`,
    'Only contained scratch/sandbox vaults inside this checkout are ever opened.'].join('\n');
}
async function exists(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function installedLauncherVersion(root) {
  const manifest = join(root, '.native-runner/node_modules/obsidian-launcher/package.json');
  if (!await exists(manifest)) return null;
  return JSON.parse(await readFile(manifest, 'utf8')).version ?? null;
}
/** npm install into the contained runner prefix only; never global, never the project lockfile. */
export function launcherInstallCommand(env = process.env) {
  const args = ['install', '--prefix', '.native-runner', '--save-exact', '--no-fund', '--no-audit', `obsidian-launcher@${LAUNCHER_VERSION}`];
  const npm = env.npm_execpath;
  if (npm && /\.[cm]?js$/.test(npm)) return { command: process.execPath, args: [npm, ...args] };
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}
function installLauncher(root, log) {
  const { command, args } = launcherInstallCommand();
  log(`Provisioning obsidian-launcher ${LAUNCHER_VERSION} into .native-runner (explicit opt-in).`);
  const run = spawnSync(command, args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: projectInstallEnvironment().env, shell: process.platform === 'win32' });
  if (run.error || run.status !== 0) throw new Error(`OBSIDIAN_LAUNCHER_INSTALL_FAILED: ${run.error?.message ?? run.status}`);
}
/** Downloads run in a separate launcher CLI process: an in-process undici socket assertion was
 * observed to crash the whole Node process through the agent proxy, which no retry could catch. */
function downloadHost(root, kind, version, log, attempts = 3) {
  const cli = join(root, '.native-runner/node_modules/obsidian-launcher/dist/cli.js');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    log(`Downloading Obsidian ${kind} ${version} into .native-cache (attempt ${attempt}/${attempts}).`);
    const run = spawnSync(process.execPath, [cli, 'download', kind, '-v', version, '--cache', join(root, '.native-cache')],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], timeout: 15 * 60 * 1000 });
    if (!run.error && run.status === 0) return;
  }
  throw new Error(`OBSIDIAN_HOST_DOWNLOAD_FAILED: ${kind} ${version}`);
}
/** Resolve the pinned launcher and cached host; download only with explicit opt-in. */
export async function provisionHost({ root = process.cwd(), allowDownload = false, appVersion = DEFAULT_APP_VERSION, log = message => console.error(message) } = {}) {
  root = resolve(root);
  const found = await installedLauncherVersion(root);
  if (found !== LAUNCHER_VERSION) {
    if (!allowDownload) throw new ProvisionRequired([`obsidian-launcher ${LAUNCHER_VERSION} in .native-runner${found ? ` (found ${found})` : ''}`]);
    installLauncher(root, log);
    if (await installedLauncherVersion(root) !== LAUNCHER_VERSION) throw new Error('OBSIDIAN_LAUNCHER_UNQUALIFIED');
  }
  const cacheDir = resolve(root, '.native-cache');
  if (!allowDownload && !await exists(join(cacheDir, 'obsidian-versions.json'))) throw new ProvisionRequired(['the Obsidian version index in .native-cache']);
  const module = await import(pathToFileURL(join(root, '.native-runner/node_modules/obsidian-launcher/dist/index.js')).href);
  const Launcher = module.default ?? module.ObsidianLauncher;
  const launcher = new Launcher({ cacheDir, interactive: false });
  const [app, installer] = await launcher.resolveVersion(appVersion, 'latest');
  const missing = [];
  for (const [kind, version] of [['app', app], ['installer', installer]]) {
    if (await launcher.isInCache(kind, version)) continue;
    if (!allowDownload) { missing.push(`Obsidian ${kind} ${version} in .native-cache`); continue; }
    downloadHost(root, kind, version, log);
    if (!await launcher.isInCache(kind, version)) throw new Error(`OBSIDIAN_HOST_NOT_CACHED: ${kind} ${version}`);
  }
  if (missing.length) throw new ProvisionRequired(missing);
  return { launcher, appVersion: app, installerVersion: installer, launcherVersion: LAUNCHER_VERSION, requestedVersion: appVersion };
}
/** Fail before building when this checkout path cannot host Chromium's singleton socket (Linux). */
export function assertHostPath(root = process.cwd(), platform = process.platform) {
  return assertNativeSocketBudget(join(resolve(root), '.nq', 'XXXXXX'), platform);
}
export async function freePort() {
  const server = createServer();
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  const { port } = server.address();
  await new Promise(ok => server.close(ok));
  return port;
}
export async function assertPortFree(port) {
  const server = createServer();
  try { await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); }); }
  catch (error) { throw new Error(`OBSIDIAN_DEBUG_PORT_IN_USE: 127.0.0.1:${port} (${error.code ?? error.message}); pass --port <n>.`); }
  await new Promise(ok => server.close(ok));
}
/** Attach Playwright over CDP; fails fast when the host exits first. */
export async function connectHost({ chromium, port, proc, output = () => '', timeout = 90000 }) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 2000 }); }
    catch {
      if (proc.exitCode !== null || proc.signalCode !== null) throw new Error(`OBSIDIAN_EXITED_BEFORE_DEBUGGER (${proc.exitCode ?? proc.signalCode}):\n${output().slice(-4000)}`);
      await new Promise(ok => setTimeout(ok, 250));
    }
  }
  throw new Error(`OBSIDIAN_DEBUGGER_UNAVAILABLE after ${timeout}ms:\n${output().slice(-4000)}`);
}
/** The main workspace window, not a pop-out or DevTools target. */
export async function workspacePage(browser, timeout = 45000) {
  const context = browser.contexts()[0];
  if (!context) throw new Error('OBSIDIAN_CONTEXT_MISSING');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const page of context.pages()) {
      if (!page.url().startsWith('app://')) continue;
      if (await page.evaluate(() => Boolean(document.querySelector('.workspace') && window.app?.workspace)).catch(() => false)) return page;
    }
    await new Promise(ok => setTimeout(ok, 200));
  }
  throw new Error('OBSIDIAN_WORKSPACE_TIMEOUT');
}
export function processRunning(proc) { return Boolean(proc?.pid) && proc.exitCode === null && proc.signalCode === null; }
/** Stop the detached host process group, escalating to SIGKILL after a bounded wait. */
export async function stopHost(proc, timeout = 10000) {
  if (!processRunning(proc)) return { stopped: true, signal: null };
  const exited = new Promise(ok => proc.once('exit', ok));
  const signal = name => {
    try { if (process.platform !== 'win32') process.kill(-proc.pid, name); else proc.kill(); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
  };
  signal('SIGTERM');
  let timer;
  const stopped = await Promise.race([exited.then(() => true), new Promise(ok => { timer = setTimeout(() => ok(false), timeout); })]);
  clearTimeout(timer);
  if (stopped) return { stopped: true, signal: 'SIGTERM' };
  signal('SIGKILL');
  await Promise.race([exited, new Promise((_, fail) => setTimeout(() => fail(new Error('OBSIDIAN_STOP_TIMEOUT')), timeout))]);
  return { stopped: true, signal: 'SIGKILL' };
}
/** Retain bounded host stdout/stderr for diagnostics. */
export function captureOutput(proc, limit = 200000) {
  let text = '';
  const capture = data => { text = (text + data.toString()).slice(-limit); };
  proc.stdout?.on('data', capture); proc.stderr?.on('data', capture);
  return () => text;
}
