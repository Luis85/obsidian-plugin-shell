import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { exportPath, findQualifiedNode, installDecision, installDependencies, qualifiedToolchain, runSessionStart, satisfies, sessionStatus, toolLine } from '../../scripts/agent/session-start.mjs';

const hook = resolve(import.meta.dirname, '../../scripts/agent/session-start.mjs');
const files = { '/p/.nvmrc': '24.21.0\n', '/p/package.json': JSON.stringify({ engines: { node: '>=22.13.0', npm: '>=11.19.1 <13' }, packageManager: 'npm@11.19.1' }) };
const readFrom = table => path => table[path] ?? null;
const mismatch = { status: 'revision-mismatch', reason: 'browser-revision-mismatch', expectedRevision: '1243', availableRevisions: ['1194'], candidateExecutable: '/pw/chromium-1194/chrome-linux/chrome', hint: 'long' };
/** Fake side effects that record what the hook would have done. */
function fakes(overrides = {}) {
  const calls = { install: [], exported: [], found: [] };
  const deps = { read: readFrom(files), nodeVersion: '24.21.0', npmVersion: () => '11.19.1', home: '/h', exists: () => true, stale: () => false,
    findNode: (qualified, context) => { calls.found.push([qualified, context.home]); return null; },
    exportPath: (env, directory) => { calls.exported.push(directory); return Boolean(env.CLAUDE_ENV_FILE); },
    install: (root, env, directory) => { calls.install.push([root, directory]); return { ok: true, text: 'restored with npm ci --ignore-scripts (3s).' }; },
    resolveBrowser: () => ({ status: 'pinned', expectedRevision: '1243' }), ...overrides };
  return { deps, calls };
}
const status = (env, overrides) => { const { deps, calls } = fakes(overrides); return sessionStatus('/p', env, deps).then(text => ({ text, calls })); };

test('[SESSION-START-01] qualified toolchains are read from .nvmrc, engines and packageManager; ranges are compared conservatively', () => {
  assert.deepEqual(qualifiedToolchain('/p', readFrom(files)), { node: '24.21.0', nodeRange: '>=22.13.0', npm: '11.19.1', npmRange: '>=11.19.1 <13' });
  assert.deepEqual(qualifiedToolchain('/p', readFrom({ '/p/.nvmrc': 'v20.1.0' })), { node: '20.1.0', nodeRange: null, npm: null, npmRange: null });
  assert.deepEqual(qualifiedToolchain('/p', readFrom({ '/p/.nvmrc': 'lts/*', '/p/package.json': '{broken' })), { node: null, nodeRange: null, npm: null, npmRange: null });
  assert.equal(satisfies('22.22.0', '>=22.13.0'), true);
  assert.equal(satisfies('22.12.9', '>=22.13.0'), false);
  assert.equal(satisfies('12.0.0', '>=11.19.1 <13'), true);
  assert.equal(satisfies('13.0.0', '>=11.19.1 <13'), false);
  assert.equal(satisfies('10.9.2', '>=11.19.1 <13'), false);
  for (const unknown of ['^22', '>=20 || >=22', '', null]) assert.equal(satisfies('22.0.0', unknown), null, String(unknown));
  assert.equal(satisfies('garbage', '>=1.0.0'), null);
});

test('[SESSION-START-02] the status line says qualified, merely engine-compatible, outside engines or absent', () => {
  assert.equal(toolLine('Node', '24.21.0', '24.21.0', '>=22'), 'Node 24.21.0: qualified.');
  assert.match(toolLine('Node', '22.22.0', '24.21.0', '>=22.13.0'), /Node 22\.22\.0: not the qualified 24\.21\.0 \(satisfies engines >=22\.13\.0\); results may differ/);
  assert.match(toolLine('npm', '10.9.0', '11.19.1', '>=11.19.1 <13'), /npm 10\.9\.0: UNQUALIFIED, outside engines >=11\.19\.1 <13 \(qualified 11\.19\.1\)\./);
  assert.match(toolLine('Node', '24.0.0', null, null), /no qualified version declared/);
  assert.match(toolLine('npm', null, '11.19.1', null), /npm: not found \(qualified 11\.19\.1\)/);
});

test('[SESSION-START-03] a fully qualified checkout with dependencies and a pinned browser reports briefly and changes nothing', async () => {
  const { text, calls } = await status({});
  assert.deepEqual(text.split('\n').slice(1), ['Node 24.21.0: qualified.', 'npm 11.19.1: qualified.', 'Browser: pinned Chromium r1243 ready.']);
  assert.deepEqual([calls.install, calls.exported, calls.found], [[], [], []]);
  const stale = await status({}, { stale: () => true });
  assert.match(stale.text, /Dependencies: node_modules is older than package-lock\.json/);
});

test('[SESSION-START-04] an unqualified Node is reported; a qualified install found elsewhere goes on PATH through CLAUDE_ENV_FILE', async () => {
  const cloud = { CLAUDE_ENV_FILE: '/tmp/env' };
  const found = await status(cloud, { nodeVersion: '22.22.0', npmVersion: directory => directory === '/opt/node24/bin' ? '11.19.1' : '10.9.0', findNode: () => '/opt/node24/bin' });
  assert.match(found.text, /Node 22\.22\.0: not the qualified 24\.21\.0/);
  assert.match(found.text, /Qualified Node 24\.21\.0 found at \/opt\/node24\/bin; put first on PATH for this session\./);
  assert.match(found.text, /npm \(with the qualified Node\) 11\.19\.1: qualified\./);
  assert.deepEqual(found.calls.exported, ['/opt/node24/bin']);
  const noFile = await status({}, { nodeVersion: '22.22.0', findNode: () => '/opt/node24/bin' });
  assert.match(noFile.text, /found at \/opt\/node24\/bin; run: export PATH="\/opt\/node24\/bin:\$PATH"\./);
  const absent = await status({}, { nodeVersion: '22.22.0', npmVersion: () => '10.9.0' });
  assert.match(absent.text, /No qualified Node 24\.21\.0 found in known locations; install it \(nvm install 24\.21\.0\)\./);
  assert.match(absent.text, /npm 10\.9\.0: UNQUALIFIED/);
});

test('[SESSION-START-05] a missing node_modules is restored only in cloud or opted-in sessions and never when disabled', async () => {
  const missing = { exists: path => !path.endsWith('node_modules') };
  const cloud = await status({ CLAUDE_CODE_REMOTE: 'true' }, missing);
  assert.deepEqual(cloud.calls.install, [['/p', null]]);
  assert.match(cloud.text, /Dependencies: node_modules was missing, restored with npm ci --ignore-scripts \(3s\)\./);
  const optedIn = await status({ SHELL_SESSION_START_INSTALL: '1' }, missing);
  assert.equal(optedIn.calls.install.length, 1);
  const disabled = await status({ CLAUDE_CODE_REMOTE: 'true', SHELL_SESSION_START_INSTALL: '0' }, missing);
  assert.deepEqual(disabled.calls.install, []);
  assert.match(disabled.text, /node_modules MISSING; not installing \(SHELL_SESSION_START_INSTALL=0\)\. Run npm ci --ignore-scripts\./);
  const local = await status({}, missing);
  assert.deepEqual(local.calls.install, [], 'a local session never installs unasked');
  assert.match(local.text, /not installing \(local session; set SHELL_SESSION_START_INSTALL=1 to allow\)/);
  assert.deepEqual(installDecision({ CLAUDE_CODE_REMOTE: 'false' }), { install: false, why: 'local session; set SHELL_SESSION_START_INSTALL=1 to allow' });
  const qualified = await status({ CLAUDE_CODE_REMOTE: 'true' }, { ...missing, nodeVersion: '22.22.0', findNode: () => '/opt/node24/bin' });
  assert.deepEqual(qualified.calls.install, [['/p', '/opt/node24/bin']], 'the install uses the qualified Node');
});

test('[SESSION-START-06] npm ci runs ignoring scripts with the qualified Node first; failures are bounded text, never exceptions', () => {
  const calls = [];
  const ok = installDependencies('/p', { PATH: '/usr/bin' }, '/opt/node24/bin', (command, args, options) => { calls.push({ command, args, options }); return { status: 0 }; });
  assert.equal(ok.ok, true);
  assert.deepEqual(calls[0].args.slice(0, 2), ['ci', '--ignore-scripts']);
  assert.equal(calls[0].options.cwd, '/p');
  assert.ok(calls[0].options.env.PATH.startsWith('/opt/node24/bin'), calls[0].options.env.PATH);
  const failed = installDependencies('/p', {}, null, () => ({ status: 1, stderr: `npm ERR! ${'x'.repeat(2000)}\n\n\nlast line`, stdout: '' }));
  assert.equal(failed.ok, false);
  assert.match(failed.text, /^npm ci --ignore-scripts failed \(exit 1\): .*last line$/);
  assert.ok(failed.text.length < 500, String(failed.text.length));
  const timeout = installDependencies('/p', {}, null, () => ({ status: null, error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }));
  assert.match(timeout.text, /did not finish \(ETIMEDOUT\)/);
});

test('[SESSION-START-07] the browser line distinguishes pinned, override, mismatch, not ready and nothing to resolve', async () => {
  const line = async resolveBrowser => (await status({}, { resolveBrowser })).text.split('\n').find(row => row.startsWith('Browser'));
  assert.equal(await line(() => ({ status: 'override', executablePath: '/x/chrome' })), 'Browser: SHELL_CHROMIUM override /x/chrome.');
  assert.equal(await line(() => mismatch), 'Browser: REVISION MISMATCH (expects r1243, has 1194); browser suites report not-run. Opt in to the older build: SHELL_CHROMIUM=/pw/chromium-1194/chrome-linux/chrome');
  assert.match(await line(() => ({ status: 'missing', reason: 'browser-not-installed', hint: 'Run install.' })), /^Browser: NOT READY\. Run install\./);
  assert.equal(await line(() => ({ status: 'missing', reason: 'playwright-not-installed', hint: 'x' })), undefined);
  assert.equal(await line(null), undefined);
});

test('[SESSION-START-08] the status never exceeds ten lines and a crashing dependency is reported, not thrown', async () => {
  const noisy = await status({ CLAUDE_CODE_REMOTE: 'true' }, { exists: () => false, nodeVersion: '22.22.0', findNode: () => '/n', resolveBrowser: () => mismatch });
  assert.ok(noisy.text.split('\n').length <= 10, noisy.text);
  const crashed = await runSessionStart({ cwd: tmpdir() }, { CLAUDE_PROJECT_DIR: resolve(import.meta.dirname, '../..') }, () => { throw new Error('boom'); });
  assert.equal(crashed, 'Session toolchain: the start-up check itself failed (boom); the session continues.');
  assert.equal(await runSessionStart({}, { CLAUDE_PROJECT_DIR: '/' }, () => { throw new Error('unused'); }), 'Session toolchain: no package.json found; nothing to check.');
});

test('[SESSION-START-09] a qualified Node is found only when the candidate really reports the qualified version', () => {
  const env = { SHELL_NODE_BIN: '/custom/bin' };
  const versions = { '/custom/bin': '24.20.0', '/opt/node24/bin': '24.21.0' };
  const probe = directory => versions[directory] ?? null;
  assert.equal(findQualifiedNode('24.21.0', { env, home: '/h', exists: () => true, probe }), '/opt/node24/bin');
  assert.equal(findQualifiedNode('24.21.0', { env, home: '/h', exists: path => path !== '/opt/node24/bin', probe }), null, 'a missing directory is skipped');
  assert.equal(findQualifiedNode('24.99.0', { env, home: '/h', exists: () => true, probe }), null);
  assert.equal(findQualifiedNode(null, { env, home: '/h', exists: () => true, probe }), null);
});

/** Run the hook as Claude Code does: a process fed the SessionStart event, with the cloud/install switches pinned off. */
async function hookRun(t, project, input = '{}', env = {}) {
  const root = await mkdtemp(join(tmpdir(), 'session start ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(project)) { await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content); }
  const environment = { ...process.env, CLAUDE_CODE_REMOTE: 'false', SHELL_SESSION_START_INSTALL: '0', CLAUDE_PROJECT_DIR: root, ...env };
  delete environment.NODE_TEST_CONTEXT; delete environment.CLAUDE_ENV_FILE;
  return { root, result: spawnSync(process.execPath, [hook], { input, encoding: 'utf8', timeout: 60000, env: { ...environment, ...env } }) };
}

test('[SESSION-START-10] the real hook exits 0 with a short status, even for hostile input or an unreachable qualified Node', async t => {
  const impossible = { '.nvmrc': '99.0.0\n', 'package.json': JSON.stringify({ engines: { node: '>=99.0.0' } }) };
  const { result } = await hookRun(t, { ...impossible, 'node_modules/.keep': '' }, 'not json at all');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Node \d+\.\d+\.\d+: UNQUALIFIED, outside engines >=99\.0\.0 \(qualified 99\.0\.0\)\./);
  assert.match(result.stdout, /No qualified Node 99\.0\.0 found in known locations/);
  assert.ok(result.stdout.trim().split('\n').length <= 10);
  const noPackage = await hookRun(t, {}, '{}', { CLAUDE_PROJECT_DIR: tmpdir() });
  assert.equal(noPackage.result.status, 0);
});

test('[SESSION-START-11] without node_modules the real hook reports the gap, does not install when disabled and exports PATH when a file is offered', async t => {
  const { result } = await hookRun(t, { '.nvmrc': `${process.versions.node}\n`, 'package.json': '{"engines":{"node":">=1.0.0"}}' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /node_modules MISSING; not installing \(SHELL_SESSION_START_INSTALL=0\)/);
  assert.match(result.stdout, new RegExp(`Node ${process.versions.node.replaceAll('.', '\\.')}: qualified\\.`));
});

test('[SESSION-START-12] the PATH export appends one shell line to the offered file and reports failure instead of throwing', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'session-env-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'env.sh');
  assert.equal(exportPath({ CLAUDE_ENV_FILE: file }, '/opt/node24/bin'), true);
  assert.equal(await readFile(file, 'utf8'), 'export PATH="/opt/node24/bin:$PATH"\n');
  assert.equal(exportPath({}, '/opt/node24/bin'), false, 'no file offered');
  assert.equal(exportPath({ CLAUDE_ENV_FILE: join(dir, 'missing/dir/env.sh') }, '/opt/node24/bin'), false, 'an unwritable file is a false, not a crash');
});
