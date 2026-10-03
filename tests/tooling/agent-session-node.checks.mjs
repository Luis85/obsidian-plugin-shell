import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheDirectory, cachedNodeBin, nodeArchive, nodeProvisionDecision, parseShasums, pinNpm, provisionNode } from '../../scripts/agent/session-node.mjs';
import { realNodeIo } from '../../scripts/agent/session-node-io.mjs';

const VERSION = '24.21.0';
const FILE = `node-v${VERSION}-linux-x64.tar.gz`;
const GOOD = 'a'.repeat(64);
const BASE = { version: VERSION, npm: '11.19.1', env: { PATH: '/usr/bin', XDG_CACHE_HOME: '/cache' }, home: '/h', platform: 'linux', arch: 'x64', remaining: () => 500_000, token: 't1' };
const PREFIX = '/cache/workbench/node-v24.21.0-linux-x64';

/** In-memory io that records every side effect, so no test downloads or touches the disk. */
function fakeIo(overrides = {}) {
  const log = []; const present = new Set(); const versions = new Map();
  const io = {
    probe: directory => { log.push(['probe', directory]); return versions.get(directory) ?? null; },
    npmVersion: () => io.npm,
    npm: '10.0.0',
    exists: path => present.has(path),
    mkdir: path => { log.push(['mkdir', path]); },
    rm: path => { log.push(['rm', path]); present.delete(path); },
    rename: (from, to) => { log.push(['rename', from, to]); present.add(to); versions.set(`${to}/bin`, VERSION); },
    fetchText: async url => { log.push(['fetchText', url]); return `${GOOD}  ${FILE}\n${'b'.repeat(64)}  other.tar.gz\n`; },
    download: async (url, destination, timeout) => { log.push(['download', url, destination, timeout]); },
    sha256: async () => GOOD,
    extract: (archive, destination) => { log.push(['extract', archive, destination]); versions.set(`${destination}/node-v${VERSION}-linux-x64/bin`, VERSION); return { ok: true }; },
    run: (command, args, options) => { log.push(['run', command, args, options.env.npm_config_prefix, options.env.PATH.split(':')[0]]); io.npm = '11.19.1'; return { status: 0 }; },
    ...overrides,
  };
  return { io, log, present, versions };
}
const steps = log => log.map(entry => entry[0]);

test('[SESSION-NODE-01] official archive coordinates, cache location and checksum parsing are strict', () => {
  assert.deepEqual(nodeArchive(VERSION, 'linux', 'x64'), { name: 'node-v24.21.0-linux-x64', file: FILE, url: `https://nodejs.org/dist/v24.21.0/${FILE}`, sumsUrl: 'https://nodejs.org/dist/v24.21.0/SHASUMS256.txt' });
  assert.equal(nodeArchive(VERSION, 'darwin', 'arm64').file, 'node-v24.21.0-darwin-arm64.tar.gz');
  assert.equal(nodeArchive(VERSION, 'linux', 'arm').file, 'node-v24.21.0-linux-armv7l.tar.gz');
  for (const [version, platform, arch] of [[VERSION, 'win32', 'x64'], [VERSION, 'linux', 'riscv64'], ['24.21.0-evil/../x', 'linux', 'x64'], ['lts/*', 'linux', 'x64'], [null, 'linux', 'x64']])
    assert.equal(nodeArchive(version, platform, arch), null, `${version} ${platform} ${arch}`);
  assert.equal(cacheDirectory({ XDG_CACHE_HOME: '/x' }, '/h'), '/x/workbench');
  assert.equal(cacheDirectory({}, '/h'), '/h/.cache/workbench');
  assert.equal(cachedNodeBin(VERSION, { env: {}, home: '/h', platform: 'linux', arch: 'x64' }), '/h/.cache/workbench/node-v24.21.0-linux-x64/bin');
  assert.equal(cachedNodeBin(VERSION, { env: {}, home: '/h', platform: 'win32', arch: 'x64' }), null);
  assert.equal(parseShasums(`${GOOD}  ${FILE}\r\n${'c'.repeat(64)} *other.zip\n`, FILE), GOOD);
  assert.equal(parseShasums(`${'C'.repeat(64)} *other.zip\n`, 'other.zip'), 'c'.repeat(64));
  for (const text of ['', null, `${GOOD}  node-v24.21.0-linux-x64.tar.xz`, `short  ${FILE}`]) assert.equal(parseShasums(text, FILE), null);
  assert.deepEqual(nodeProvisionDecision({ CLAUDE_CODE_REMOTE: 'true' }), { provision: true, why: 'cloud session' });
  assert.equal(nodeProvisionDecision({ CLAUDE_CODE_REMOTE: 'true', SHELL_SESSION_START_NODE: '0' }).provision, false);
  assert.equal(nodeProvisionDecision({}).provision, false);
  assert.equal(nodeProvisionDecision({ SHELL_SESSION_START_NODE: '1' }).provision, true);
});

test('[SESSION-NODE-02] a verified download lands in the private cache with its pinned npm, and the scratch directory is removed', async () => {
  const { io, log, present } = fakeIo();
  const result = await provisionNode(BASE, io);
  assert.deepEqual(result, { ok: true, binDirectory: `${PREFIX}/bin`, npmPinned: true, text: `downloaded ${FILE} (SHA-256 verified); npm pinned to 11.19.1` });
  assert.deepEqual(steps(log).filter(step => step !== 'probe'), ['mkdir', 'fetchText', 'download', 'extract', 'mkdir', 'rename', 'rm', 'run']);
  assert.deepEqual(log.find(entry => entry[0] === 'rename'), ['rename', `/cache/workbench/.tmp-t1/node-v${VERSION}-linux-x64`, PREFIX]);
  assert.deepEqual(log.find(entry => entry[0] === 'download').slice(1, 3), [`https://nodejs.org/dist/v24.21.0/${FILE}`, `/cache/workbench/.tmp-t1/${FILE}`]);
  assert.deepEqual(log.at(-2), ['rm', '/cache/workbench/.tmp-t1']);
  // npm is pinned against the private prefix only, with the private Node first on PATH.
  assert.deepEqual(log.at(-1).slice(1), [`${PREFIX}/bin/npm`, ['install', '-g', 'npm@11.19.1', '--no-audit', '--no-fund'], PREFIX, `${PREFIX}/bin`]);
  assert.ok(present.has(PREFIX));
  assert.ok(log.every(entry => entry[0] === 'run' || entry.slice(1).every(item => typeof item !== 'string' || item.startsWith('/cache/') || item.startsWith('https://nodejs.org/dist/'))), 'nothing outside the cache is touched');
});

test('[SESSION-NODE-03] a checksum mismatch is refused: nothing is extracted or installed and the scratch is removed', async () => {
  const { io, log } = fakeIo({ sha256: async () => 'd'.repeat(64) });
  const result = await provisionNode(BASE, io);
  assert.equal(result.ok, false);
  assert.match(result.text, /^SHA-256 mismatch for node-v24\.21\.0-linux-x64\.tar\.gz \(expected aaaaaaaaaaaa\.\.\., got dddddddddddd\.\.\.\); refused, nothing was extracted$/);
  assert.equal(steps(log).some(step => ['extract', 'rename', 'run'].includes(step)), false);
  assert.deepEqual(log.at(-1), ['rm', '/cache/workbench/.tmp-t1']);
  const missing = await provisionNode(BASE, fakeIo({ fetchText: async () => `${GOOD}  other.tar.gz\n` }).io);
  assert.equal(missing.text, `SHASUMS256.txt lists no ${FILE}`);
});

test('[SESSION-NODE-04] unsupported platforms, invalid versions and network, extraction or runtime failures are reported, never thrown', async () => {
  const run = async (request, overrides) => { const { io, log } = fakeIo(overrides); return { result: await provisionNode({ ...BASE, ...request }, io), log }; };
  assert.match((await run({ platform: 'win32' })).result.text, /no official Node build for v24\.21\.0 on win32-x64/);
  assert.match((await run({ version: '../../etc' })).result.text, /no official Node build/);
  const offline = await run({}, { fetchText: async () => { throw new Error('curl not found; fetch failed (ENOTFOUND)'); } });
  assert.deepEqual([offline.result.ok, offline.result.text], [false, 'curl not found; fetch failed (ENOTFOUND)']);
  assert.deepEqual(offline.log.at(-1), ['rm', '/cache/workbench/.tmp-t1'], 'scratch removed after a failure');
  const broken = await run({}, { extract: () => ({ ok: false, error: 'tar: Unexpected EOF' }) });
  assert.equal(broken.result.text, `could not extract ${FILE}: tar: Unexpected EOF`);
  const wrong = await run({}, { extract: () => ({ ok: true }) });
  assert.equal(wrong.result.text, 'the extracted node does not report v24.21.0');
  assert.equal(wrong.log.some(entry => entry[0] === 'rename'), false);
  const late = await run({ remaining: () => 10_000 });
  assert.equal(late.result.text, 'no time left to download Node');
});

test('[SESSION-NODE-05] a cached Node is reused, a concurrent valid install wins and a broken target is replaced', async () => {
  const cached = fakeIo(); cached.versions.set(`${PREFIX}/bin`, VERSION); cached.io.npm = '11.19.1';
  const reused = await provisionNode(BASE, cached.io);
  assert.deepEqual(reused, { ok: true, binDirectory: `${PREFIX}/bin`, npmPinned: true, text: 'reused the cached copy; npm 11.19.1 is bundled' });
  assert.deepEqual(steps(cached.log).filter(step => step !== 'probe'), [], 'no download, no npm install');
  const raced = fakeIo(); raced.present.add(PREFIX);
  let probes = 0;
  raced.io.probe = directory => directory === `${PREFIX}/bin` ? (++probes > 1 ? VERSION : null) : raced.versions.get(directory) ?? null;
  assert.equal((await provisionNode(BASE, raced.io)).ok, true);
  assert.equal(raced.log.some(entry => entry[0] === 'rename'), false, 'the other session\'s valid copy is kept');
  const broken = fakeIo(); broken.present.add(PREFIX);
  assert.equal((await provisionNode(BASE, broken.io)).ok, true);
  assert.ok(broken.log.some(entry => entry[0] === 'rm' && entry[1] === PREFIX), 'a broken target is replaced inside the cache');
});

test('[SESSION-NODE-06] npm pinning keeps the bundled npm when it matches and reports a failed or timed-out pin without failing Node', async () => {
  const env = { ...BASE.env };
  assert.deepEqual(pinNpm('/b', '/p', { ...BASE, npm: null, env }, fakeIo().io), { ok: true, text: 'no npm version declared to pin' });
  const same = fakeIo(); same.io.npm = '11.19.1';
  assert.equal(pinNpm('/b', '/p', { ...BASE, env }, same.io).text, 'npm 11.19.1 is bundled');
  const failed = fakeIo({ run: () => ({ status: 1 }) });
  assert.deepEqual(pinNpm('/b', '/p', { ...BASE, env }, failed.io), { ok: false, text: 'npm 10.0.0 kept: npm install -g npm@11.19.1 failed (exit 1)' });
  const timeout = fakeIo({ run: () => ({ status: null, error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }) });
  assert.match(pinNpm('/b', '/p', { ...BASE, env }, timeout.io).text, /did not finish \(ETIMEDOUT\)/);
  const lying = fakeIo({ run: () => ({ status: 0 }) });
  assert.equal(pinNpm('/b', '/p', { ...BASE, env }, lying.io).ok, false, 'exit 0 without the pinned version is not a pin');
  assert.match(pinNpm('/b', '/p', { ...BASE, env, remaining: () => 5000 }, fakeIo().io).text, /no time left to pin npm@11\.19\.1/);
  const kept = await provisionNode(BASE, fakeIo({ run: () => ({ status: 1 }) }).io);
  assert.deepEqual([kept.ok, kept.npmPinned], [true, false]);
});

/** The "nodejs.org" runs in its own process: the code under test blocks its event loop with spawnSync (curl), which would starve an in-process server. */
const SERVER = `import { createServer } from 'node:http'; import { readFileSync } from 'node:fs';
const [root, sums, file] = process.argv.slice(1);
createServer((request, response) => {
  if (request.url.endsWith('SHASUMS256.txt')) return response.end(sums);
  if (request.url.endsWith(file)) return response.end(readFileSync(root + '/' + file));
  response.statusCode = 404; response.end('missing');
}).listen(0, '127.0.0.1', function () { console.log(this.address().port); });`;
async function serveDirectory(t, root, sums) {
  const archive = nodeArchive(VERSION, process.platform, process.arch);
  const child = spawn(process.execPath, ['--input-type=module', '-e', SERVER, root, sums, archive.file], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => child.kill());
  return new Promise((resolve, reject) => { child.once('error', reject); child.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))); });
}
const posixOnly = process.platform === 'win32' || !['x64', 'arm64', 'arm'].includes(process.arch) ? 'POSIX hosts with an official Node architecture only' : false;
/** A local "nodejs.org": SHASUMS256.txt and one tarball holding a fake node and npm that report the requested version. */
async function localDist(t, { corrupt = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'session node ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = nodeArchive(VERSION, process.platform, process.arch);
  const tree = join(root, 'stage', archive.name);
  await mkdir(join(tree, 'bin'), { recursive: true }); await mkdir(join(tree, 'lib/node_modules/npm'), { recursive: true });
  await writeFile(join(tree, 'bin/node'), `#!/bin/sh\necho v${VERSION}\n`); await chmod(join(tree, 'bin/node'), 0o755);
  await writeFile(join(tree, 'lib/node_modules/npm/package.json'), '{"version":"10.0.0"}');
  await writeFile(join(tree, 'bin/npm'), `#!/bin/sh\n[ "$npm_config_prefix" = "$(dirname "$(dirname "$0")")" ] || exit 9\nprintf '{"version":"%s"}' "\${3#npm@}" > "$npm_config_prefix/lib/node_modules/npm/package.json"\n`);
  await chmod(join(tree, 'bin/npm'), 0o755);
  assert.equal(spawnSync('tar', ['-czf', join(root, archive.file), '-C', join(root, 'stage'), archive.name]).status, 0);
  const bytes = await readFile(join(root, archive.file));
  const sums = `${createHash('sha256').update(corrupt ? 'something else' : bytes).digest('hex')}  ${archive.file}\n`;
  const port = await serveDirectory(t, root, sums);
  const env = { ...process.env, XDG_CACHE_HOME: join(root, 'cache'), NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' };
  delete env.npm_execpath;
  return { root, env, request: { ...BASE, platform: process.platform, arch: process.arch, env, home: root, distBase: `http://127.0.0.1:${port}` } };
}

test('[SESSION-NODE-07] the real io downloads through curl, verifies, extracts and pins npm in the cache (local server, no internet)', { skip: posixOnly }, async t => {
  const dist = await localDist(t);
  const result = await provisionNode(dist.request, realNodeIo({ env: dist.env }));
  assert.equal(result.ok, true, result.text);
  assert.equal(result.npmPinned, true, result.text);
  const prefix = join(dist.root, 'cache/workbench', nodeArchive(VERSION, process.platform, process.arch).name);
  assert.equal(result.binDirectory, join(prefix, 'bin'));
  assert.equal(JSON.parse(await readFile(join(prefix, 'lib/node_modules/npm/package.json'), 'utf8')).version, '11.19.1');
  assert.deepEqual((await readdir(join(dist.root, 'cache/workbench'))).sort(), [nodeArchive(VERSION, process.platform, process.arch).name], 'no scratch left behind');
  const again = await provisionNode(dist.request, realNodeIo({ env: dist.env }));
  assert.match(again.text, /reused the cached copy/);
});

test('[SESSION-NODE-08] without curl the fetch fallback works; a corrupted download is refused and leaves no Node in the cache', { skip: posixOnly }, async t => {
  const good = await localDist(t);
  const noCurl = (command, args, options) => command === 'curl' ? { status: null, error: Object.assign(new Error('spawn curl ENOENT'), { code: 'ENOENT' }) } : spawnSync(command, args, options);
  const viaFetch = await provisionNode(good.request, realNodeIo({ env: good.env, spawn: noCurl }));
  assert.equal(viaFetch.ok, true, viaFetch.text);
  const bad = await localDist(t, { corrupt: true });
  const refused = await provisionNode(bad.request, realNodeIo({ env: bad.env }));
  assert.equal(refused.ok, false);
  assert.match(refused.text, /SHA-256 mismatch .*refused, nothing was extracted/);
  const cache = join(bad.root, 'cache/workbench');
  assert.deepEqual(existsSync(cache) ? await readdir(cache) : [], [], 'neither the archive nor a half-extracted tree remains');
  const unreachable = await provisionNode({ ...bad.request, distBase: 'http://127.0.0.1:9' }, realNodeIo({ env: bad.env, spawn: noCurl }));
  assert.match(unreachable.text, /curl not found; fetch failed/);
});
