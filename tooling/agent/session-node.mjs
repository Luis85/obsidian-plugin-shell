/** Provision the exact qualified Node (and its pinned npm) into a user-level cache, never into a system location.
 * Flow: official tarball from nodejs.org -> SHA-256 against the official SHASUMS256.txt (mismatch is refused, nothing is
 * extracted) -> extract into a scratch directory -> verify the binary reports the version -> atomic rename into
 * `<cache>/workbench/node-v<version>-<platform>-<arch>` -> pin npm with `npm install -g` against that private prefix only.
 * Every side effect goes through `io`, so tests run the whole flow without a network. */
import { pathFor, withPathFirst } from '../../src/shared/platform/platform-path.mjs';
import { switchDecision } from './session-switch.mjs';
import { sameVersion } from './session-version.mjs';

const NODE_DIST = 'https://nodejs.org/dist';
const PLATFORMS = { linux: 'linux', darwin: 'darwin' };
const ARCHITECTURES = { x64: 'x64', arm64: 'arm64', arm: 'armv7l' };
const DOWNLOAD_MS = 240_000;
const NPM_MS = 150_000;
const RESERVE_MS = 20_000;
/** Whether this session may download Node: cloud sessions yes, local ones only on request, `=0` never. */
export function nodeProvisionDecision(env) {
  const { enabled, why } = switchDecision(env, 'SHELL_SESSION_START_NODE');
  return { provision: enabled, why };
}
/** Official archive coordinates, or null for an unsupported platform or a version that is not a plain x.y.z. */
export function nodeArchive(version, platform, arch, base = NODE_DIST) {
  const system = PLATFORMS[platform]; const cpu = ARCHITECTURES[arch];
  if (!system || !cpu || !/^\d+\.\d+\.\d+$/.test(version ?? '')) return null;
  const name = `node-v${version}-${system}-${cpu}`;
  return { name, file: `${name}.tar.gz`, url: `${base}/v${version}/${name}.tar.gz`, sumsUrl: `${base}/v${version}/SHASUMS256.txt` };
}
/** Workbench cache root: `${XDG_CACHE_HOME:-~/.cache}/workbench`. */
export function cacheDirectory(env, home, platform = process.platform) {
  const { join } = pathFor(platform);
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), 'workbench');
}
/** The `bin` directory a provisioned Node lives in (whether or not it exists yet). */
export function cachedNodeBin(version, { env, home, platform = process.platform, arch = process.arch }) {
  const archive = nodeArchive(version, platform, arch);
  return archive ? pathFor(platform).join(cacheDirectory(env, home, platform), archive.name, 'bin') : null;
}
/** The hex digest the official SHASUMS256.txt lists for a file, or null. */
export function parseShasums(text, file) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(\S+)$/i.exec(line.trim());
    if (match && match[2] === file) return match[1].toLowerCase();
  }
  return null;
}
const failure = text => ({ ok: false, text });
/** The path flavour of the request's platform (the host's when the request names none). */
const pathOf = request => pathFor(request.platform ?? process.platform);
/** Time left for one step, keeping a reserve so the whole hook stays inside its own budget; 0 means out of time. */
const allowance = (request, wanted) => Math.max(0, Math.min(wanted, request.remaining() - RESERVE_MS));
async function fetchVerified(target, scratch, request, io) {
  const expected = parseShasums(await io.fetchText(target.sumsUrl), target.file);
  if (!expected) return failure(`SHASUMS256.txt lists no ${target.file}`);
  const wait = allowance(request, DOWNLOAD_MS);
  if (!wait) return failure('no time left to download Node');
  const archive = pathOf(request).join(scratch, target.file);
  await io.download(target.url, archive, wait);
  const actual = await io.sha256(archive);
  if (actual !== expected) return failure(`SHA-256 mismatch for ${target.file} (expected ${expected.slice(0, 12)}..., got ${String(actual).slice(0, 12)}...); refused, nothing was extracted`);
  return { ok: true, archive };
}
/** Move the verified tree into the cache; a concurrent session's valid copy wins, a broken one is replaced. */
function install(unpacked, prefix, request, io) {
  const { dirname, join } = pathOf(request);
  if (io.exists(prefix)) {
    if (io.probe(join(prefix, 'bin')) === request.version) return;
    io.rm(prefix);
  }
  io.mkdir(dirname(prefix));
  io.rename(unpacked, prefix);
}
async function downloadNode(target, prefix, request, io) {
  const { dirname, join } = pathOf(request);
  const scratch = join(dirname(prefix), `.tmp-${request.token}`);
  try {
    io.mkdir(scratch);
    const fetched = await fetchVerified(target, scratch, request, io);
    if (!fetched.ok) return fetched;
    const extracted = io.extract(fetched.archive, scratch);
    if (!extracted.ok) return failure(`could not extract ${target.file}: ${extracted.error}`);
    const unpacked = join(scratch, target.name);
    if (io.probe(join(unpacked, 'bin')) !== request.version) return failure(`the extracted node does not report v${request.version}`);
    install(unpacked, prefix, request, io);
    return { ok: true, text: `downloaded ${target.file} (SHA-256 verified)` };
  } catch (error) {
    return failure(String(error?.message ?? error));
  } finally {
    io.rm(scratch);
  }
}
/** Pin npm inside the private prefix: `npm install -g` there targets that prefix only. */
export function pinNpm(binDirectory, prefix, request, io) {
  const wanted = request.npm;
  if (!wanted) return { ok: true, text: 'no npm version declared to pin' };
  const bundled = io.npmVersion(binDirectory);
  if (sameVersion(bundled, wanted)) return { ok: true, text: `npm ${bundled} is bundled` };
  const wait = allowance(request, NPM_MS);
  if (!wait) return { ok: false, text: `npm ${bundled ?? '?'} kept: no time left to pin npm@${wanted}` };
  const env = { ...withPathFirst(request.env, binDirectory, request.platform), npm_config_prefix: prefix, npm_execpath: undefined };
  const run = io.run(pathOf(request).join(binDirectory, 'npm'), ['install', '-g', `npm@${wanted}`, '--no-audit', '--no-fund'], { env, timeout: wait });
  const now = io.npmVersion(binDirectory);
  if (!run.error && run.status === 0 && sameVersion(now, wanted)) return { ok: true, text: `npm pinned to ${now}` };
  return { ok: false, text: `npm ${now ?? bundled ?? '?'} kept: npm install -g npm@${wanted} ${run.error ? `did not finish (${run.error.code ?? run.error.message})` : `failed (exit ${run.status})`}` };
}
/** Provision Node `request.version` (and pin `request.npm`). Never throws; `ok` means Node itself is usable and verified.
 * @returns {Promise<{ok:boolean, binDirectory?:string, npmPinned?:boolean, text:string}>} */
export async function provisionNode(request, io) {
  const target = nodeArchive(request.version, request.platform, request.arch, request.distBase);
  if (!target) return failure(`no official Node build for v${request.version} on ${request.platform}-${request.arch}`);
  const { dirname, join } = pathOf(request);
  const prefix = join(cacheDirectory(request.env, request.home, request.platform), target.name);
  const binDirectory = join(prefix, 'bin');
  let note = 'reused the cached copy';
  if (io.probe(binDirectory) !== request.version) {
    io.sweep(dirname(prefix));
    const outcome = await downloadNode(target, prefix, request, io);
    if (!outcome.ok) return outcome;
    note = outcome.text;
  }
  const npm = pinNpm(binDirectory, prefix, request, io);
  return { ok: true, binDirectory, npmPinned: npm.ok, text: `${note}; ${npm.text}` };
}
