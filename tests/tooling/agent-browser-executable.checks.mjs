import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { BROWSER_ENV, browsersDirectory, chromiumLaunchOptions, main, resolveBrowserExecutable } from '../../scripts/testing/browser-executable.mjs';

const repository = resolve(import.meta.dirname, '../..');
const suitesCli = join(repository, 'scripts/testing/suites.mjs');
const resolverCli = join(repository, 'scripts/testing/browser-executable.mjs');
const LINUX_PINNED = 'chrome-linux64/chrome';
const LINUX_OLD = 'chrome-linux/chrome';

/** A project root with a fake playwright-core pinning `revision`, and a browser cache holding the given chromium folders. */
async function project(t, { revision = '1243', installed = {}, playwright = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'browser-executable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = join(root, 'cache');
  await mkdir(cache, { recursive: true });
  if (playwright) {
    await mkdir(join(root, 'node_modules/playwright-core'), { recursive: true });
    await writeFile(join(root, 'node_modules/playwright-core/browsers.json'), JSON.stringify({ browsers: [{ name: 'firefox', revision: '1' }, { name: 'chromium', revision }] }));
    await writeFile(join(root, 'node_modules/playwright-core/package.json'), JSON.stringify({ version: '9.9.9' }));
  }
  for (const [folder, executable] of Object.entries(installed)) {
    await mkdir(dirname(join(cache, folder, executable)), { recursive: true });
    await writeFile(join(cache, folder, executable), '');
  }
  return { root, cache, env: { PLAYWRIGHT_BROWSERS_PATH: cache }, options: { root, env: { PLAYWRIGHT_BROWSERS_PATH: cache }, platform: 'linux', home: root } };
}

test('[BROWSER-EXE-01] the pinned revision is used from the Playwright cache without any override', async t => {
  const { cache, options } = await project(t, { installed: { 'chromium-1243': LINUX_PINNED, 'chromium-1194': LINUX_OLD } });
  const result = resolveBrowserExecutable(options);
  assert.equal(result.status, 'pinned');
  assert.equal(result.executablePath, join(cache, 'chromium-1243', LINUX_PINNED));
  assert.equal(result.expectedRevision, '1243');
  assert.deepEqual(result.availableRevisions, ['1243', '1194']);
  assert.deepEqual(chromiumLaunchOptions(options), {}, 'Playwright finds its own pinned browser');
});

test('[BROWSER-EXE-02] an older installed revision is a reported mismatch with the exact override, never a silent pick', async t => {
  const { cache, options } = await project(t, { installed: { 'chromium-1194': LINUX_OLD, 'chromium-1100': LINUX_OLD, 'chromium_headless_shell-1243': 'chrome-headless-shell-linux64/chrome-headless-shell' } });
  const result = resolveBrowserExecutable(options);
  const expected = join(cache, 'chromium-1194', LINUX_OLD);
  assert.equal(result.status, 'revision-mismatch');
  assert.equal(result.reason, 'browser-revision-mismatch');
  assert.equal(result.executablePath, undefined, 'a mismatched browser is not offered as the executable');
  assert.deepEqual([result.expectedRevision, result.availableRevisions, result.candidateExecutable], ['1243', ['1194', '1100'], expected]);
  assert.match(result.hint, /Playwright 9\.9\.9 expects Chromium revision 1243 but .* only has 1194, 1100/);
  assert.ok(result.hint.endsWith(`${BROWSER_ENV}=${expected}`), result.hint);
  assert.throws(() => chromiumLaunchOptions(options), new RegExp(`BROWSER_UNAVAILABLE: .*${BROWSER_ENV}=`));
});

test('[BROWSER-EXE-03] SHELL_CHROMIUM overrides everything; a broken override is an error, not a fall-through', async t => {
  const { cache, options } = await project(t, { installed: { 'chromium-1243': LINUX_PINNED } });
  const custom = join(cache, 'custom-chrome');
  await writeFile(custom, '');
  const withOverride = { ...options, env: { ...options.env, [BROWSER_ENV]: custom } };
  assert.deepEqual([resolveBrowserExecutable(withOverride).status, resolveBrowserExecutable(withOverride).executablePath], ['override', custom]);
  assert.deepEqual(chromiumLaunchOptions(withOverride), { executablePath: custom });
  const broken = { ...options, env: { ...options.env, [BROWSER_ENV]: join(cache, 'nope') } };
  const result = resolveBrowserExecutable(broken);
  assert.deepEqual([result.status, result.reason], ['missing', 'override-missing']);
  assert.throws(() => chromiumLaunchOptions(broken), /BROWSER_UNAVAILABLE: SHELL_CHROMIUM points to .*nope, which does not exist/);
  for (const old of ['CHROMIUM_EXECUTABLE', 'PLAYWRIGHT_EXECUTABLE_PATH', 'CHROMIUM_PATH'])
    assert.equal(resolveBrowserExecutable({ ...options, env: { ...options.env, [old]: custom } }).status, 'pinned', `${old} is no longer an override`);
  assert.equal(resolveBrowserExecutable({ ...options, env: { ...options.env, [BROWSER_ENV]: '  ' } }).status, 'pinned', 'blank counts as unset');
});

test('[BROWSER-EXE-04] nothing installed, a folder without an executable and a missing playwright-core are each reported as missing', async t => {
  const empty = await project(t);
  const none = resolveBrowserExecutable(empty.options);
  assert.deepEqual([none.status, none.reason, none.availableRevisions], ['missing', 'browser-not-installed', []]);
  assert.match(none.hint, /install chromium/);
  const hollow = await project(t, { installed: { 'chromium-1243/placeholder': 'README' } });
  assert.equal(resolveBrowserExecutable(hollow.options).reason, 'browser-not-installed', 'a revision folder without chrome does not count');
  const absent = await project(t, { playwright: false });
  const result = resolveBrowserExecutable(absent.options);
  assert.deepEqual([result.status, result.reason], ['missing', 'playwright-not-installed']);
  assert.deepEqual(chromiumLaunchOptions(absent.options), {}, 'unknown situations are left to Playwright to explain');
  const corrupt = await project(t);
  await writeFile(join(corrupt.root, 'node_modules/playwright-core/browsers.json'), '{not json');
  assert.equal(resolveBrowserExecutable(corrupt.options).reason, 'playwright-not-installed');
});

test('[BROWSER-EXE-05] cache locations and executable layouts follow Playwright on every platform', () => {
  const base = { root: '/r', cwd: '/work', home: '/home/u' };
  assert.equal(browsersDirectory({ ...base, env: {}, platform: 'linux' }), '/home/u/.cache/ms-playwright');
  assert.equal(browsersDirectory({ ...base, env: { XDG_CACHE_HOME: '/xdg' }, platform: 'linux' }), '/xdg/ms-playwright');
  assert.equal(browsersDirectory({ ...base, env: {}, platform: 'darwin' }), '/home/u/Library/Caches/ms-playwright');
  assert.equal(browsersDirectory({ ...base, env: { LOCALAPPDATA: '/win/local' }, platform: 'win32' }), join('/win/local', 'ms-playwright'));
  assert.equal(browsersDirectory({ ...base, env: { PLAYWRIGHT_BROWSERS_PATH: '0' }, platform: 'linux' }), '/r/node_modules/playwright-core/.local-browsers');
  assert.equal(browsersDirectory({ ...base, env: { PLAYWRIGHT_BROWSERS_PATH: 'rel' }, platform: 'linux' }), resolve('/work', 'rel'));
  const present = new Set([join('/b', 'chromium-7', 'chrome-win64', 'chrome.exe')]);
  const fs = { exists: path => present.has(path) || path.endsWith('browsers.json') || path.endsWith('package.json'), list: () => ['chromium-7'],
    readText: path => path.endsWith('browsers.json') ? JSON.stringify({ browsers: [{ name: 'chromium', revision: '7' }] }) : '{}' };
  const result = resolveBrowserExecutable({ root: '/r', env: { PLAYWRIGHT_BROWSERS_PATH: '/b' }, platform: 'win32', fs });
  assert.deepEqual([result.status, result.executablePath], ['pinned', join('/b', 'chromium-7', 'chrome-win64', 'chrome.exe')]);
  assert.equal(resolveBrowserExecutable({ root: '/r', env: { PLAYWRIGHT_BROWSERS_PATH: '/b' }, platform: 'linux', fs }).status, 'missing', 'a Windows layout is not a Linux executable');
});

test('[BROWSER-EXE-06] the layout list agrees with the installed playwright-core, so a Playwright upgrade cannot silently drift', async t => {
  const { cache } = await project(t);
  const probe = spawnSync(process.execPath, ['-e', "console.log(require('playwright-core').chromium.executablePath())"],
    { cwd: repository, encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: cache } });
  assert.equal(probe.status, 0, probe.stderr);
  const playwrightPath = probe.stdout.trim();
  const revision = /chromium-(\d+)/.exec(playwrightPath)[1];
  await mkdir(dirname(playwrightPath), { recursive: true });
  await writeFile(playwrightPath, '');
  const real = resolveBrowserExecutable({ root: repository, env: { PLAYWRIGHT_BROWSERS_PATH: cache } });
  assert.deepEqual([real.status, real.executablePath, real.expectedRevision], ['pinned', playwrightPath, revision]);
});

async function suiteRoot(t, options) {
  const { root, env } = await project(t, options);
  const files = { 'package.json': '{"type":"module"}',
    'tests/suites.json': JSON.stringify({ schemaVersion: 1, roots: [{ path: 'tests/tooling' }], helperRoots: [], helpers: [],
      prerequisites: { chromium: { browser: true, hint: 'Provision Chromium.' } },
      suites: [{ name: 'browserish', purpose: 'needs a browser', runner: { type: 'node-test' }, include: ['tests/tooling/browserish-*.checks.mjs'], verify: 'opt-in', prerequisites: ['chromium'] }] }),
    'tests/tooling/browserish-one.checks.mjs': 'import { test } from "node:test"; test("ran", () => {});\n' };
  for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), content); }
  return { root, env };
}
const suites = (root, env, args = []) => {
  const environment = { ...process.env, ...env }; delete environment.NODE_TEST_CONTEXT; delete environment[BROWSER_ENV];
  return spawnSync(process.execPath, [suitesCli, 'browserish', '--json', ...args], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...environment, ...env } });
};

test('[BROWSER-EXE-07] a suite that needs Chromium is not-run with browser-revision-mismatch and the override hint, never passed', async t => {
  const { root, env } = await suiteRoot(t, { installed: { 'chromium-1194': LINUX_OLD } });
  const result = suites(root, env);
  assert.equal(result.status, 1, result.stderr);
  const outcome = JSON.parse(result.stdout).outcomes[0];
  assert.deepEqual([outcome.status, outcome.reason], ['not-run', 'browser-revision-mismatch']);
  assert.match(outcome.hint, new RegExp(`${BROWSER_ENV}=.*chromium-1194/${LINUX_OLD}`));
  assert.doesNotMatch(result.stderr, /# pass|ℹ pass/, 'the suite body never ran');
  const text = spawnSync(process.execPath, [suitesCli, 'browserish'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env, [BROWSER_ENV]: '' } });
  assert.match(text.stdout, /not-run\s+browserish\s.*browser-revision-mismatch: .*SHELL_CHROMIUM=/);
});

test('[BROWSER-EXE-08] a plainly missing browser keeps the generic prerequisite reason; override or pinned browsers let the suite run', async t => {
  const missing = await suiteRoot(t, {});
  const outcome = JSON.parse(suites(missing.root, missing.env).stdout).outcomes[0];
  assert.deepEqual([outcome.status, outcome.reason], ['not-run', 'missing prerequisites: chromium']);
  const pinned = await suiteRoot(t, { installed: { 'chromium-1243': LINUX_PINNED } });
  const ran = suites(pinned.root, pinned.env);
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(JSON.parse(ran.stdout).outcomes[0].status, 'passed');
  const mismatched = await suiteRoot(t, { installed: { 'chromium-1194': LINUX_OLD } });
  const explicit = join(mismatched.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium-1194', LINUX_OLD);
  const environment = { ...process.env, ...mismatched.env, [BROWSER_ENV]: explicit }; delete environment.NODE_TEST_CONTEXT;
  const opted = spawnSync(process.execPath, [suitesCli, 'browserish', '--json'], { cwd: mismatched.root, encoding: 'utf8', env: environment });
  assert.equal(opted.status, 0, opted.stderr);
  assert.equal(JSON.parse(opted.stdout).outcomes[0].status, 'passed', 'the explicit opt-in is honoured');
});

test('[BROWSER-EXE-09] the command line exits 0 only for a usable browser and prints the same hint', async t => {
  const { options } = await project(t, { installed: { 'chromium-1194': LINUX_OLD } });
  const lines = [];
  const log = console.log; console.log = line => lines.push(line);
  try { assert.equal(main([], options), 1); assert.equal(main(['--json'], options), 1); } finally { console.log = log; }
  assert.match(lines[0], /^revision-mismatch: /);
  assert.equal(JSON.parse(lines[1]).reason, 'browser-revision-mismatch');
  const run = spawnSync(process.execPath, [resolverCli], { cwd: repository, encoding: 'utf8', env: { ...process.env, [BROWSER_ENV]: process.execPath } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^override /);
});
