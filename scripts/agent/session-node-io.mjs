/** The real side effects of Node provisioning. curl comes first because it honours HTTPS_PROXY and the CA variables the
 * cloud proxy sets; Node's global fetch ignores them unless NODE_USE_ENV_PROXY=1, so it is only the fallback. */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathFor } from '../shared/platform-path.mjs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readJson } from './session-version.mjs';

/** The version a node binary in `directory` reports, or null when it does not run. */
export function probeNode(directory, run = spawnSync, platform = process.platform) {
  const result = run(pathFor(platform).join(directory, platform === 'win32' ? 'node.exe' : 'node'), ['--version'], { encoding: 'utf8', timeout: 5000 });
  return result.status === 0 ? String(result.stdout).trim().replace(/^v/, '') : null;
}
/** npm bundled beside a node binary (Unix `bin/../lib/node_modules/npm`, Windows `node_modules/npm`). */
export const bundledNpm = binDirectory => ['../lib/node_modules/npm', 'node_modules/npm'].map(path => readJson(join(binDirectory, path, 'package.json'))?.version).find(Boolean) ?? null;
const STALE_SCRATCH_MS = 6 * 60 * 60 * 1000;
/** Remove download scratch directories an interrupted hook left behind (older than six hours, so a concurrent session's live one stays). */
function sweepScratch(cache, now = Date.now()) {
  try {
    for (const name of readdirSync(cache)) {
      if (name.startsWith('.tmp-') && now - statSync(join(cache, name)).mtimeMs > STALE_SCRATCH_MS) rmSync(join(cache, name), { recursive: true, force: true });
    }
  } catch { /* no cache yet, or a concurrent session removed it */ }
}
const CURL = ['-fsSL', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20'];
function curlFailure(result) {
  if (result.error?.code === 'ENOENT') return 'curl not found';
  return `curl ${result.error?.code ?? `exit ${result.status}`}: ${String(result.stderr ?? '').trim().slice(0, 200)}`;
}
const proxyHint = env => env.HTTPS_PROXY || env.https_proxy ? '; behind a proxy, install curl or run Node with NODE_USE_ENV_PROXY=1' : '';
async function fetchToFile(fetchImpl, url, destination, timeoutMs) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}
export function realNodeIo({ env = process.env, spawn = spawnSync, fetchImpl = globalThis.fetch } = {}) {
  const viaCurl = (extra, url, timeoutMs, options = {}) => spawn('curl', [...CURL, '--max-time', String(Math.ceil(timeoutMs / 1000)), ...extra, url],
    { encoding: 'utf8', timeout: timeoutMs + 5000, maxBuffer: 4 * 1024 * 1024, env, ...options });
  const fallbackError = (result, error) => new Error(`${curlFailure(result)}; fetch failed (${error.cause?.code ?? error.message})${proxyHint(env)}`);
  return {
    probe: directory => probeNode(directory, spawn),
    npmVersion: bundledNpm,
    exists: existsSync,
    mkdir: path => mkdirSync(path, { recursive: true }),
    rm: path => rmSync(path, { recursive: true, force: true }),
    sweep: sweepScratch,
    rename: renameSync,
    run: (command, args, options) => spawn(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options }),
    extract: (archive, destination) => {
      const result = spawn('tar', ['-xzf', archive, '-C', destination], { encoding: 'utf8', timeout: 120_000 });
      return result.status === 0 ? { ok: true } : { ok: false, error: result.error?.message ?? String(result.stderr ?? '').trim().slice(0, 200) };
    },
    sha256: file => new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      createReadStream(file).on('error', reject).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')));
    }),
    async fetchText(url) {
      const result = viaCurl([], url, 30_000);
      if (result.status === 0) return String(result.stdout);
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) { throw fallbackError(result, error); }
    },
    async download(url, destination, timeoutMs) {
      const result = viaCurl(['-o', destination], url, timeoutMs);
      if (result.status === 0) return;
      try { await fetchToFile(fetchImpl, url, destination, timeoutMs); } catch (error) { throw fallbackError(result, error); }
    },
  };
}
