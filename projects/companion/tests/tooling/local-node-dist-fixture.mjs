import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeArchive } from '../../scripts/agent/session-node.mjs';

export const VERSION = '24.21.0';
/** The "nodejs.org" runs in its own process: the code under test blocks its event loop with spawnSync (curl), which would starve an in-process server. */
const SERVER = `import { createServer } from 'node:http'; import { readFileSync } from 'node:fs';
const [root, sums, file] = process.argv.slice(1);
createServer((request, response) => {
  if (request.url.endsWith('SHASUMS256.txt')) return response.end(sums);
  if (request.url.endsWith(file)) return response.end(readFileSync(root + '/' + file));
  response.statusCode = 404; response.end('missing');
}).listen(0, '127.0.0.1', function () { console.log(this.address().port); });`;
async function serveDirectory(t, root, sums, file) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', SERVER, root, sums, file], { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => child.kill());
  return new Promise((resolve, reject) => { child.once('error', reject); child.stdout.once('data', chunk => resolve(Number(String(chunk).trim()))); });
}
/** Reason a host cannot run the local-download tests, or false. */
export const noOfficialBuild = process.platform === 'win32' || !['x64', 'arm64', 'arm'].includes(process.arch) ? 'POSIX hosts with an official Node architecture only' : false;
/** A local "nodejs.org" for this host: SHASUMS256.txt plus one tarball holding a fake node (`--version` reports the version, other
 * arguments are echoed) and a fake npm that records the pinned version. `corrupt` lists a checksum that cannot match. */
export async function localNodeDist(t, { corrupt = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'session node ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = nodeArchive(VERSION, process.platform, process.arch);
  const tree = join(root, 'stage', archive.name);
  await mkdir(join(tree, 'bin'), { recursive: true }); await mkdir(join(tree, 'lib/node_modules/npm'), { recursive: true });
  await writeFile(join(tree, 'bin/node'), `#!/bin/sh\nif [ "$1" = "--version" ]; then echo v${VERSION}; else echo "fake-node $*"; fi\n`); await chmod(join(tree, 'bin/node'), 0o755);
  await writeFile(join(tree, 'lib/node_modules/npm/package.json'), '{"version":"10.0.0"}');
  await writeFile(join(tree, 'bin/npm'), `#!/bin/sh\n[ "$npm_config_prefix" = "$(dirname "$(dirname "$0")")" ] || exit 9\nprintf '{"version":"%s"}' "\${3#npm@}" > "$npm_config_prefix/lib/node_modules/npm/package.json"\n`);
  await chmod(join(tree, 'bin/npm'), 0o755);
  assert.equal(spawnSync('tar', ['-czf', join(root, archive.file), '-C', join(root, 'stage'), archive.name]).status, 0);
  const bytes = await readFile(join(root, archive.file));
  const sums = `${createHash('sha256').update(corrupt ? 'something else' : bytes).digest('hex')}  ${archive.file}\n`;
  const port = await serveDirectory(t, root, sums, archive.file);
  const env = { ...process.env, XDG_CACHE_HOME: join(root, 'cache'), NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' };
  delete env.npm_execpath;
  return { root, env, archive, distUrl: `http://127.0.0.1:${port}`, cache: join(root, 'cache/workbench') };
}
