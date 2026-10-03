import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { auditTracked, parseIndex } from '../../scripts/testing/handoff-audit.mjs';
import { DEFAULT_STARTER, applyEnvFile, baseNodeBin, parseOptions, recordStep, simulatedPath, summarize } from '../../scripts/testing/handoff-options.mjs';
import { failure, networkAvailable, sessionEnvironment, spawnTarget, tail } from '../../scripts/testing/handoff-run.mjs';
import { exportPath, exportVariable } from '../../scripts/agent/session-toolchain.mjs';

const script = resolve(import.meta.dirname, '../../scripts/testing/qualify-project-handoff.mjs');

test('[PROJECT-HANDOFF-01] options default to the quick-capture project and reject unknown, valueless and malformed input', () => {
  const defaults = parseOptions([]);
  assert.deepEqual([defaults.starter, defaults.target, defaults.baseNode, defaults.keep, defaults.skipE2e, defaults.error], [DEFAULT_STARTER, 'project', null, false, false, null]);
  const full = parseOptions(['--starter', 'feature-showcase', '--base-node', '/opt/node22', '--target', 'framework', '--work-dir', '/w', '--cache-dir', '/c', '--out', 'o.json', '--keep', '--skip-e2e']);
  assert.deepEqual(full, { starter: 'feature-showcase', target: 'framework', baseNode: '/opt/node22', workDir: '/w', cacheDir: '/c', out: 'o.json', keep: true, skipE2e: true, help: false, error: null });
  assert.equal(parseOptions(['--help']).help, true);
  assert.match(parseOptions(['--bogus']).error, /Unknown option --bogus/);
  assert.match(parseOptions(['--starter']).error, /--starter needs a value/);
  assert.match(parseOptions(['--starter', '--keep']).error, /needs a value/);
  assert.match(parseOptions(['--target', 'both']).error, /--target must be project or framework/);
  assert.match(parseOptions(['--starter', '../escape']).error, /must be a starter id/);
});

test('[PROJECT-HANDOFF-02] the simulated PATH holds only the base Node plus tools without a node of their own', () => {
  const holds = new Set(['/opt/node22/bin/node', '/usr/local/bin/node', '/opt/node22/bin']);
  const exists = path => holds.has(path);
  assert.equal(baseNodeBin(null, exists, 'linux'), null);
  assert.equal(baseNodeBin('/opt/node22', exists, 'linux'), '/opt/node22/bin');
  assert.equal(baseNodeBin('/opt/node22/bin', exists, 'linux'), '/opt/node22/bin', 'a bin directory is accepted as is');
  const path = ['/usr/local/bin', '/usr/bin', '', '/bin'].join(':');
  assert.equal(simulatedPath('/opt/node22/bin', path, exists, 'linux'), ['/opt/node22/bin', '/usr/bin', '/bin'].join(':'));
  assert.equal(simulatedPath(null, path, exists, 'linux'), path, 'without a base Node the current PATH is kept');
});

test('[PROJECT-HANDOFF-09] a simulated Windows host uses node.exe at the install root, semicolon PATH entries, the Path key and npm.cmd', () => {
  const holds = new Set(['C:\\node22\\node.exe', 'C:\\prefix\\bin\\node.exe', 'C:\\Program Files\\nodejs\\node.exe', 'C:\\Users\\u\\AppData\\Local\\ms-playwright']);
  const exists = path => holds.has(path);
  assert.equal(baseNodeBin('C:\\node22', exists, 'win32'), 'C:\\node22', 'Windows Node has no bin directory: the root holds node.exe');
  assert.equal(baseNodeBin('C:\\prefix', exists, 'win32'), 'C:\\prefix\\bin');
  const path = ['C:\\Windows\\System32', 'C:\\Program Files\\nodejs', '', 'C:\\Program Files\\Git\\cmd'].join(';');
  const expectedPath = 'C:\\node22;C:\\Windows\\System32;C:\\Program Files\\Git\\cmd';
  assert.equal(simulatedPath('C:\\node22', path, exists, 'win32'), expectedPath);
  const base = { HOME: 'C:\\Users\\u', Path: path, SystemRoot: 'C:\\Windows', npm_execpath: 'x' };
  const env = sessionEnvironment(base, { clone: 'C:\\c', envFile: 'C:\\e', cacheDir: 'C:\\cache', baseBin: 'C:\\node22', exists, platform: 'win32' });
  assert.equal(env.Path, expectedPath);
  assert.equal('PATH' in env, false, 'no second spelling of the Path variable');
  assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, 'C:\\Users\\u\\AppData\\Local\\ms-playwright', 'the Windows default browser cache is %LOCALAPPDATA%\\ms-playwright');
  assert.deepEqual(spawnTarget('npm', ['run', 'check'], 'win32'), { command: 'npm.cmd', args: ['run', 'check'], shell: true });
  assert.deepEqual(spawnTarget('npm', ['run', 'check'], 'linux'), { command: 'npm', args: ['run', 'check'], shell: false });
  assert.deepEqual(spawnTarget('node', ['-v'], 'win32'), { command: 'node', args: ['-v'], shell: false });
});

test('[PROJECT-HANDOFF-03] the env-file replay reads exactly what the session hook writes, including escapes and PATH expansion', async () => {
  const lines = [];
  const append = (file, line) => lines.push(line);
  const env = { CLAUDE_ENV_FILE: '/e' };
  exportPath(env, '/cache/a b/node-v24/bin', append, 'linux');
  exportVariable(env, 'SHELL_CHROMIUM', '/pw/chrome $HOME "x" `y` \\z', append);
  const applied = applyEnvFile(lines.join(''), { PATH: '/usr/bin', HOME: '/h' });
  assert.equal(applied.PATH, `/cache/a b/node-v24/bin:/usr/bin`);
  assert.equal(applied.SHELL_CHROMIUM, '/pw/chrome $HOME "x" `y` \\z', 'escaped characters are literal, never expanded');
  assert.equal(applied.HOME, '/h');
  const original = { PATH: '/usr/bin' };
  assert.equal(applyEnvFile('export A="1"\nexport B="${A}2$A"\nnot an export\nexport bad name="x"\n', original).B, '121', 'both $NAME and ${NAME} expand from earlier exports');
  assert.equal(applyEnvFile('export C="$MISSING."\n', original).C, '.');
  assert.deepEqual(original, { PATH: '/usr/bin' }, 'the input environment is not mutated');
  assert.deepEqual(applyEnvFile(null, original), original);
});

test('[PROJECT-HANDOFF-04] the verdict fails closed: failures win, not-run is incomplete and only all-passed passes', async () => {
  const s = (...statuses) => statuses.map(status => ({ status }));
  assert.deepEqual(summarize(s('passed', 'passed')), { status: 'passed', exitCode: 0 });
  assert.deepEqual(summarize(s('passed', 'not-run')), { status: 'incomplete', exitCode: 3 });
  assert.deepEqual(summarize(s('not-run', 'failed', 'passed')), { status: 'failed', exitCode: 1 });
  assert.deepEqual(summarize([]), { status: 'failed', exitCode: 1 }, 'no steps is not a pass');
  assert.deepEqual(summarize(s('passed', 'weird')), { status: 'failed', exitCode: 1 }, 'an unknown status is not a pass');
  const steps = []; let tick = 0;
  const now = () => (tick += 10);
  await recordStep(steps, 'ok', () => undefined, now);
  await recordStep(steps, 'skip', () => ({ status: 'not-run', detail: 'offline' }), now);
  await recordStep(steps, 'boom', async () => { throw new Error('exploded'); }, now);
  assert.deepEqual(steps, [{ name: 'ok', status: 'passed', durationMs: 10 }, { name: 'skip', status: 'not-run', durationMs: 10, detail: 'offline' }, { name: 'boom', status: 'failed', durationMs: 10, detail: 'exploded' }]);
});

const files = (extra = {}) => ({ 'package.json': '{"name":"p","dependencies":{"vue":"3.5.0"}}', 'package-lock.json': '{"packages":{"":{},"node_modules/vue":{"resolved":"https://registry.npmjs.org/vue"}}}', '.nvmrc': '24.21.0\n',
  '.claude/settings.json': JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ command: 'node "$CLAUDE_PROJECT_DIR/scripts/agent/session-start.mjs"' }] }] } }), 'scripts/agent/session-start.mjs': '', 'bin/app': '#!/usr/bin/env node\n', 'scripts/agent/cloud-setup.sh': '#!/bin/sh\n', ...extra });
const audit = (table, modes = {}, forbidden = ['/maintainer/checkout']) => {
  const entries = Object.keys(table).map(path => ({ path, mode: modes[path] ?? (path === 'bin/app' || path.endsWith('cloud-setup.sh') ? '100755' : '100644') }));
  return auditTracked(entries, { read: path => table[path] === undefined ? null : Buffer.from(table[path]), forbidden });
};
const checks = findings => findings.map(item => item.check);

test('[PROJECT-HANDOFF-05b] a checkout path already present in the copied framework file is fixture data, not a generation leak', () => {
  const table = files({ 'tests/tooling/fixture.checks.mjs': "const root = '/maintainer/checkout';\n", 'src/leak.ts': "const root = '/maintainer/checkout';\n" });
  const entries = Object.keys(table).map(path => ({ path, mode: path === 'bin/app' || path.endsWith('cloud-setup.sh') ? '100755' : '100644' }));
  const original = path => (path === 'tests/tooling/fixture.checks.mjs' ? Buffer.from(table[path]) : null);
  const found = auditTracked(entries, { read: path => (table[path] === undefined ? null : Buffer.from(table[path])), forbidden: ['/maintainer/checkout'], original });
  assert.deepEqual(found.map(item => [item.check, item.path]), [['absolute-path', 'src/leak.ts']]);
});

test('[PROJECT-HANDOFF-05] a clean project has no findings and every portability defect is detected (negative fixtures)', () => {
  assert.deepEqual(audit(files()), []);
  const tableWithout = name => { const copy = files(); delete copy[name]; return copy; };
  assert.deepEqual(checks(audit(tableWithout('package-lock.json'))), ['lockfile']);
  assert.deepEqual(checks(audit(tableWithout('.claude/settings.json'))), ['claude-settings']);
  assert.deepEqual(checks(audit(files({ '.claude/settings.local.json': '{}' }))), ['claude-settings']);
  assert.deepEqual(checks(audit(files({ '.claude/settings.json': '{broken' }))), ['claude-settings']);
  assert.match(audit(tableWithout('scripts/agent/session-start.mjs'))[0].detail, /hook runs scripts\/agent\/session-start\.mjs, which is not tracked/);
  assert.deepEqual(checks(audit(files(), { 'bin/app': '100644' })), ['executable-bit']);
  assert.deepEqual(checks(audit(files({ link: 'target' }), { link: '120000' })), ['symlink']);
  assert.deepEqual(checks(audit(files({ '.nvmrc': 'lts/*\n' }))), ['nvmrc']);
  assert.deepEqual(checks(audit(files({ 'src/a.ts': 'const root = "/maintainer/checkout/src";\n' }))), ['absolute-path']);
  assert.deepEqual(checks(audit(files({ 'scripts/agent/x.mjs': 'a\r\nb\r\n' }))), ['line-endings']);
  assert.deepEqual(checks(audit(files({ 'src/windows.ts': 'a\r\nb\r\n' }))), [], 'CRLF in ordinary sources is not a portability defect');
});

test('[PROJECT-HANDOFF-06] local dependencies are found in package.json and the lockfile, binary and oversized files are not scanned for paths', () => {
  for (const spec of ['file:../shell', 'link:../shell', '/abs/path', '../up', 'C:\\x', 'git+file:///x']) {
    const pkg = JSON.stringify({ devDependencies: { shell: spec } });
    assert.deepEqual(checks(audit(files({ 'package.json': pkg }))), ['local-dependency'], spec);
  }
  assert.deepEqual(checks(audit(files({ 'package.json': JSON.stringify({ overrides: { a: { b: 'file:../x' } } }) }))), ['local-dependency']);
  assert.deepEqual(checks(audit(files({ 'package-lock.json': '{"packages":{"node_modules/shell":{"resolved":"file:../shell","link":true}}}' }))), ['local-dependency']);
  assert.deepEqual(audit(files({ 'asset.bin': `\u0000/maintainer/checkout` })), []);
  assert.deepEqual(audit(files({ 'big.txt': `/maintainer/checkout${'x'.repeat(3_000_001)}` })), []);
  assert.deepEqual(parseIndex('100755 abcdef0123 0\tbin/app\n120000 0123abcdef 0\tlink with space\nnot a row\n'), [{ mode: '100755', path: 'bin/app' }, { mode: '120000', path: 'link with space' }]);
});

test('[PROJECT-HANDOFF-07] the simulated session starts from a clean environment and the process helpers report failures honestly', async () => {
  const base = { HOME: '/h', PATH: '/usr/local/bin:/usr/bin', npm_execpath: '/x/npm-cli.js', npm_config_https_proxy: 'http://p', INIT_CWD: '/x', CLAUDE_CODE_SESSION_ID: 's', SHELL_CHROMIUM: '/old', SHELL_SESSION_START_INSTALL: '0', KEEP: 'yes' };
  const env = sessionEnvironment(base, { clone: '/c', envFile: '/e', cacheDir: '/cache', baseBin: null, exists: () => false, platform: 'linux' });
  assert.deepEqual(env, { HOME: '/h', PATH: '/usr/local/bin:/usr/bin', npm_config_https_proxy: 'http://p', KEEP: 'yes', CLAUDE_CODE_REMOTE: 'true', CLAUDE_ENV_FILE: '/e', CLAUDE_PROJECT_DIR: '/c', XDG_CACHE_HOME: '/cache' });
  const withBrowsers = sessionEnvironment({ ...base, XDG_CACHE_HOME: '/real/cache' }, { clone: '/c', envFile: '/e', cacheDir: '/cache', baseBin: null, exists: path => path === '/real/cache/ms-playwright', platform: 'linux' });
  assert.equal(withBrowsers.PLAYWRIGHT_BROWSERS_PATH, '/real/cache/ms-playwright', 'a fresh Workbench cache must not hide the existing browsers');
  assert.equal(sessionEnvironment({ ...base, PLAYWRIGHT_BROWSERS_PATH: '/pw' }, { clone: '/c', envFile: '/e', cacheDir: '/cache', baseBin: null, exists: () => true, platform: 'linux' }).PLAYWRIGHT_BROWSERS_PATH, '/pw');
  assert.equal(failure({ status: 0, stdout: '', stderr: '' }, 'x'), null);
  assert.match(failure({ status: 2, stdout: 'out', stderr: 'bad' }, 'npm run check'), /^npm run check exited 2: out\s+bad$/);
  assert.match(failure({ status: null, error: Object.assign(new Error('t'), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' }, 'step'), /did not finish \(ETIMEDOUT\)/);
  assert.equal(tail('x'.repeat(5000), 10), `...${'x'.repeat(10)}`);
  const spawn = status => () => ({ status, error: status === null ? Object.assign(new Error('no curl'), { code: 'ENOENT' }) : null });
  assert.equal(await networkAvailable({}, spawn(0)), true);
  assert.equal(await networkAvailable({}, spawn(6)), false, 'curl ran and failed: offline');
  assert.equal(await networkAvailable({}, spawn(null), async () => ({ ok: true })), true, 'fetch is the fallback only when curl is missing');
  assert.equal(await networkAvailable({}, spawn(null), async () => { throw new Error('offline'); }), false);
});

test('[PROJECT-HANDOFF-08] the command line prints usage for --help and exits 2 for bad options without generating anything', () => {
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /^Usage: node scripts\/testing\/qualify-project-handoff\.mjs/);
  const bad = spawnSync(process.execPath, [script, '--starter'], { encoding: 'utf8' });
  assert.equal(bad.status, 2); assert.match(bad.stdout, /--starter needs a value\nUsage:/);
});
