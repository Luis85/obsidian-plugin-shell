import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { VERSION, localNodeDist, noOfficialBuild } from './local-node-dist-fixture.mjs';

const script = resolve(import.meta.dirname, '../agent/cloud-setup.sh');
const TOOLS = ['sh', 'curl', 'tar', 'gzip', 'grep', 'cut', 'tr', 'uname', 'rm', 'mkdir', 'mv', 'dirname', 'cat', 'sleep'];
const lookup = tool => spawnSync('sh', ['-c', `command -v ${tool}`], { encoding: 'utf8' }).stdout.trim();
const hasSha = ['sha256sum', 'shasum'].some(tool => lookup(tool));
const skip = noOfficialBuild || (!hasSha || !lookup('curl') ? 'needs curl and a SHA-256 tool' : false);
/** A PATH holding only the tools the script needs, so "no Node installed" is true whatever the host has. */
async function isolatedPath(t, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cloud setup ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'bin'); await mkdir(bin);
  for (const tool of [...TOOLS, 'sha256sum', 'shasum']) if (lookup(tool)) await symlink(lookup(tool), join(bin, tool));
  for (const [name, body] of Object.entries(extra)) { await writeFile(join(bin, name), `#!/bin/sh\n${body}\n`); await chmod(join(bin, name), 0o755); }
  const project = join(root, 'project'); await mkdir(join(project, 'tooling/agent'), { recursive: true });
  await writeFile(join(project, 'package.json'), '{}'); await writeFile(join(project, '.nvmrc'), `${VERSION}\n`); await writeFile(join(project, 'tooling/agent/session-start.mjs'), '');
  return { root, bin, project };
}
const setup = (box, env) => spawnSync('sh', [script], { cwd: box.project, encoding: 'utf8', timeout: 120_000,
  env: { PATH: box.bin, HOME: box.root, CLAUDE_PROJECT_DIR: box.project, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', ...env } });

test('[CLOUD-SETUP-01] the script is valid POSIX shell, executable and does nothing outside a Workbench checkout', { skip: process.platform === 'win32' }, async t => {
  assert.equal(spawnSync('sh', ['-n', script], { encoding: 'utf8' }).status, 0);
  assert.ok(statSync(script).mode & 0o111, 'executable bit set');
  const box = await isolatedPath(t);
  const empty = join(box.root, 'empty'); await mkdir(empty);
  const outside = setup({ ...box, project: empty }, { CLAUDE_PROJECT_DIR: empty });
  assert.equal(outside.status, 0, outside.stderr);
  assert.match(outside.stdout, /no Workbench checkout in .*\(missing tooling\/agent\/session-start\.mjs\); nothing to do/);
});

test('[CLOUD-SETUP-02] with a usable Node the script delegates to the session hook in provisioning mode and downloads nothing', { skip: process.platform === 'win32' }, async t => {
  const box = await isolatedPath(t, { node: 'case "$1" in -p) echo 22 ;; *) echo "node ran: $*" ;; esac' });
  const result = setup(box, { XDG_CACHE_HOME: join(box.root, 'cache'), SHELL_NODE_DIST: 'http://127.0.0.1:9' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'node ran: tooling/agent/session-start.mjs --provision-only');
  assert.equal(existsSync(join(box.root, 'cache')), false);
  const old = await isolatedPath(t, { node: 'case "$1" in -p) echo 16 ;; *) echo "node ran: $*" ;; esac' });
  const tooOld = setup(old, { XDG_CACHE_HOME: join(old.root, 'cache'), SHELL_NODE_DIST: 'http://127.0.0.1:9' });
  assert.equal(tooOld.status, 0);
  assert.match(tooOld.stdout, /could not download SHASUMS256\.txt/, 'Node 16 cannot run the hook, so the qualified Node is fetched');
});

test('[CLOUD-SETUP-03] without any Node the script downloads the verified qualified Node into the cache, then runs the hook with it', { skip }, async t => {
  const dist = await localNodeDist(t);
  const box = await isolatedPath(t);
  const result = setup(box, { XDG_CACHE_HOME: join(dist.root, 'cache'), SHELL_NODE_DIST: dist.distUrl });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`downloaded ${dist.archive.file} \\(SHA-256 verified\\) to ${join(dist.cache, dist.archive.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(result.stdout, /fake-node tooling\/agent\/session-start\.mjs --provision-only/);
  assert.deepEqual(await readdir(dist.cache), [dist.archive.name], 'no scratch left behind');
  const again = setup(box, { XDG_CACHE_HOME: join(dist.root, 'cache'), SHELL_NODE_DIST: 'http://127.0.0.1:9' });
  assert.equal(again.status, 0);
  assert.doesNotMatch(again.stdout, /downloaded/, 'a cached Node is reused without a network');
  assert.match(again.stdout, /fake-node tooling\/agent\/session-start\.mjs --provision-only/);
});

test('[CLOUD-SETUP-04] a checksum mismatch or an unsupported .nvmrc is refused, reported and still exits 0', { skip }, async t => {
  const bad = await localNodeDist(t, { corrupt: true });
  const box = await isolatedPath(t);
  const refused = setup(box, { XDG_CACHE_HOME: join(bad.root, 'cache'), SHELL_NODE_DIST: bad.distUrl });
  assert.equal(refused.status, 0, refused.stderr);
  assert.match(refused.stdout, /SHA-256 mismatch or unavailable for .*; refused/);
  assert.match(refused.stdout, /the qualified Node could not be fetched; the session continues/);
  assert.doesNotMatch(refused.stdout, /fake-node/);
  assert.deepEqual(existsSync(bad.cache) ? await readdir(bad.cache) : [], [], 'nothing extracted or kept');
  await writeFile(join(box.project, '.nvmrc'), 'lts/*\n');
  const invalid = setup(box, { XDG_CACHE_HOME: join(bad.root, 'cache'), SHELL_NODE_DIST: bad.distUrl });
  assert.equal(invalid.status, 0);
  assert.match(invalid.stdout, /\.nvmrc does not hold a plain x\.y\.z version/);
});
