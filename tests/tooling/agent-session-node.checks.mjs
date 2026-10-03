import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, utimes } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDirectory, cachedNodeBin, nodeArchive, nodeProvisionDecision, parseShasums, pinNpm, provisionNode } from '../../scripts/agent/session-node.mjs';
import { realNodeIo } from '../../scripts/agent/session-node-io.mjs';
import { VERSION, localNodeDist, noOfficialBuild } from './local-node-dist-fixture.mjs';

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
    sweep: path => { log.push(['sweep', path]); },
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
  assert.deepEqual(steps(log).filter(step => step !== 'probe'), ['sweep', 'mkdir', 'fetchText', 'download', 'extract', 'mkdir', 'rename', 'rm', 'run']);
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

const hostRequest = dist => ({ ...BASE, platform: process.platform, arch: process.arch, env: dist.env, home: dist.root, distBase: dist.distUrl });

test('[SESSION-NODE-07] the real io downloads through curl, verifies, extracts and pins npm in the cache (local server, no internet)', { skip: noOfficialBuild }, async t => {
  const dist = await localNodeDist(t);
  // Scratch an interrupted hook left behind is swept once it is stale; a recent one may belong to a concurrent session.
  for (const name of ['.tmp-1-stale', '.tmp-2-live']) await mkdir(join(dist.cache, name), { recursive: true });
  const old = new Date(Date.now() - 7 * 3600 * 1000);
  await utimes(join(dist.cache, '.tmp-1-stale'), old, old);
  const result = await provisionNode(hostRequest(dist), realNodeIo({ env: dist.env }));
  assert.equal(result.ok, true, result.text);
  assert.equal(result.npmPinned, true, result.text);
  const prefix = join(dist.cache, dist.archive.name);
  assert.equal(result.binDirectory, join(prefix, 'bin'));
  assert.equal(JSON.parse(await readFile(join(prefix, 'lib/node_modules/npm/package.json'), 'utf8')).version, '11.19.1');
  assert.deepEqual((await readdir(dist.cache)).sort(), ['.tmp-2-live', dist.archive.name], 'its own scratch is gone, the stale one was swept, the live one stays');
  const again = await provisionNode(hostRequest(dist), realNodeIo({ env: dist.env }));
  assert.match(again.text, /reused the cached copy/);
});

test('[SESSION-NODE-08] without curl the fetch fallback works; a corrupted download is refused and leaves no Node in the cache', { skip: noOfficialBuild }, async t => {
  const good = await localNodeDist(t);
  const noCurl = (command, args, options) => command === 'curl' ? { status: null, error: Object.assign(new Error('spawn curl ENOENT'), { code: 'ENOENT' }) } : spawnSync(command, args, options);
  const viaFetch = await provisionNode(hostRequest(good), realNodeIo({ env: good.env, spawn: noCurl }));
  assert.equal(viaFetch.ok, true, viaFetch.text);
  const bad = await localNodeDist(t, { corrupt: true });
  const refused = await provisionNode(hostRequest(bad), realNodeIo({ env: bad.env }));
  assert.equal(refused.ok, false);
  assert.match(refused.text, /SHA-256 mismatch .*refused, nothing was extracted/);
  assert.deepEqual(existsSync(bad.cache) ? await readdir(bad.cache) : [], [], 'neither the archive nor a half-extracted tree remains');
  const unreachable = await provisionNode({ ...hostRequest(bad), distBase: 'http://127.0.0.1:9' }, realNodeIo({ env: bad.env, spawn: noCurl }));
  assert.match(unreachable.text, /curl not found; fetch failed/);
});
