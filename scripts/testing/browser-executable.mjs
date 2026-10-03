/** The one place that decides which Chromium Playwright-driven scripts use.
 * SHELL_CHROMIUM (an absolute executable path) overrides everything. Otherwise the Chromium revision pinned by the
 * installed playwright-core (node_modules/playwright-core/browsers.json) must exist in the Playwright browser cache.
 * A different installed revision is reported as `revision-mismatch`, never silently used or counted as a pass. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathFor } from '../shared/platform-path.mjs';

export const BROWSER_ENV = 'SHELL_CHROMIUM';
const INSTALL = 'node node_modules/@playwright/test/cli.js install chromium';
/** Executable locations inside a `chromium-<revision>` folder (current layouts, then the pre-1.5x `chrome-linux`). */
const EXECUTABLES = {
  linux: ['chrome-linux64/chrome', 'chrome-linux-arm64/chrome', 'chrome-linux/chrome'],
  darwin: ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'],
  win32: ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'],
};
const nodeFs = { exists: path => existsSync(path), readText: path => readFileSync(path, 'utf8'), list: path => readdirSync(path) };

/** Playwright's browser cache directory, resolved the way playwright-core resolves it; paths follow the named platform's separators. */
export function browsersDirectory({ env, root, platform, home, cwd }) {
  const path = pathFor(platform);
  const configured = env.PLAYWRIGHT_BROWSERS_PATH;
  if (configured === '0') return path.join(root, 'node_modules', 'playwright-core', '.local-browsers');
  if (configured) return path.isAbsolute(configured) ? configured : path.resolve(env.INIT_CWD || cwd, configured);
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches', 'ms-playwright');
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ms-playwright');
  return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright');
}
function readJson(fs, path) {
  try { return JSON.parse(fs.readText(path)); } catch { return null; }
}
function executableIn(fs, directory, platform) {
  const { join } = pathFor(platform);
  return (EXECUTABLES[platform] ?? EXECUTABLES.linux).map(relative => join(directory, ...relative.split('/'))).find(path => fs.exists(path)) ?? null;
}
/** Installed `chromium-<revision>` folders that really hold an executable, newest first. */
function installedRevisions(fs, directory, platform) {
  const { join } = pathFor(platform);
  let names = [];
  try { names = fs.list(directory); } catch { return []; }
  return names.flatMap(name => {
    const match = /^chromium-(\d+)$/.exec(name);
    const executablePath = match && executableIn(fs, join(directory, name), platform);
    return executablePath ? [{ revision: match[1], executablePath }] : [];
  }).sort((a, b) => Number(b.revision) - Number(a.revision));
}
function overrideResult(fs, value) {
  if (fs.exists(value)) return { status: 'override', executablePath: value, hint: `Using ${BROWSER_ENV}=${value}.` };
  return { status: 'missing', reason: 'override-missing', overridePath: value, hint: `${BROWSER_ENV} points to ${value}, which does not exist. Unset it or point it at a Chromium executable.` };
}
function mismatchResult(base, available, directory) {
  const alternative = available[0];
  return { ...base, status: 'revision-mismatch', reason: 'browser-revision-mismatch', availableRevisions: available.map(item => item.revision), candidateExecutable: alternative.executablePath,
    hint: `Playwright ${base.playwrightVersion} expects Chromium revision ${base.expectedRevision} but ${directory} only has ${available.map(item => item.revision).join(', ')}. `
      + `Provision the pinned one (${INSTALL}) or opt in to the older build explicitly: ${BROWSER_ENV}=${alternative.executablePath}` };
}
/** Resolve the Chromium executable for Playwright scripts.
 * @returns {{status:'pinned'|'override'|'revision-mismatch'|'missing', executablePath?:string, expectedRevision?:string, availableRevisions?:string[], reason?:string, candidateExecutable?:string, playwrightVersion?:string, hint:string}} */
export function resolveBrowserExecutable({ env = process.env, root = process.cwd(), platform = process.platform, home = homedir(), cwd = process.cwd(), fs = nodeFs } = {}) {
  const override = env[BROWSER_ENV]?.trim();
  if (override) return overrideResult(fs, override);
  const { join } = pathFor(platform);
  const core = join(root, 'node_modules', 'playwright-core');
  const entry = readJson(fs, join(core, 'browsers.json'))?.browsers?.find(browser => browser.name === 'chromium');
  if (!entry?.revision) return { status: 'missing', reason: 'playwright-not-installed', hint: `playwright-core is not installed in ${root}; run npm ci, then ${INSTALL}.` };
  const base = { expectedRevision: String(entry.revision), playwrightVersion: readJson(fs, join(core, 'package.json'))?.version ?? 'unknown' };
  const directory = browsersDirectory({ env, root, platform, home, cwd });
  const available = installedRevisions(fs, directory, platform);
  const pinned = available.find(item => item.revision === base.expectedRevision);
  if (pinned) return { ...base, status: 'pinned', executablePath: pinned.executablePath, availableRevisions: available.map(item => item.revision), hint: `Chromium revision ${base.expectedRevision} is installed.` };
  if (available.length) return mismatchResult(base, available, directory);
  return { ...base, status: 'missing', reason: 'browser-not-installed', availableRevisions: [], hint: `Chromium revision ${base.expectedRevision} is not installed under ${directory}. Run ${INSTALL} or set ${BROWSER_ENV}.` };
}
/** Playwright `launch` options for scripts: the override path when set; nothing for the pinned browser (Playwright finds it).
 * Throws with the exact override hint when Playwright would fail anyway (mismatched revision, broken override). */
export function chromiumLaunchOptions(options = {}) {
  const result = resolveBrowserExecutable(options);
  if (result.status === 'override') return { executablePath: result.executablePath };
  if (result.status === 'revision-mismatch' || result.reason === 'override-missing') throw new Error(`BROWSER_UNAVAILABLE: ${result.hint}`);
  return {};
}
/** `node scripts/testing/browser-executable.mjs [--json]`: print the resolution; exit 0 only when a browser is usable. */
export function main(argv, options = {}) {
  const result = resolveBrowserExecutable(options);
  console.log(argv.includes('--json') ? JSON.stringify(result, null, 2) : `${result.status}${result.executablePath ? ` ${result.executablePath}` : ''}: ${result.hint}`);
  return ['pinned', 'override'].includes(result.status) ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
