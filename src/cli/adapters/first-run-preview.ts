import * as timers from 'node:timers';
import { createServer, get } from 'node:http';
import { lstat, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readBounded } from './framework/files.ts';
import { OperationError } from './framework/contracts.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { FirstRunRequest } from '../domain/first-run.ts';
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
export interface PreviewResult { url: string; ready: boolean; httpStatus: number | null; browser: 'not-requested' | 'requested' | 'failed'; stopped: boolean }
export async function previewAssets(root: string) {
  const assets = new Map<string, { bytes: Buffer; type: string }>(); let bytes = 0, entries = 0;
  async function walk(folder: string, prefix: string, depth: number) {
    requireSketch(depth < 20, 'FIRST_RUN_PREVIEW_LIMIT', 'Built assets exceed the directory limit.');
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      requireSketch(++entries <= 2000, 'FIRST_RUN_PREVIEW_LIMIT', 'Built assets exceed 2000 entries.');
      const path = join(folder, entry.name), stat = await lstat(path);
      requireSketch(!stat.isSymbolicLink(), 'FIRST_RUN_SYMLINK', 'Built output must not contain symbolic links.');
      if (entry.name.startsWith('.')) continue;
      if (stat.isDirectory()) await walk(path, prefix + entry.name + '/', depth + 1);
      else if (mime[extname(entry.name)]) {
        bytes += stat.size; requireSketch(bytes <= 64_000_000, 'FIRST_RUN_PREVIEW_LIMIT', 'Built showcase assets exceed 64 MB.');
        assets.set(prefix + entry.name, { bytes: await readBounded(path, 16_000_000), type: mime[extname(entry.name)]! });
      }
    }
  }
  // Bounded reading checks every ancestor, including dist and target directories.
  await readBounded(join(root, 'index.html'), 16_000_000);
  await walk(root, '/', 0); return assets;
}
export async function openShowcaseBrowser(url: string): Promise<boolean> {
  requireSketch(/^http:\/\/127\.0\.0\.1:\d+\/$/.test(url), 'FIRST_RUN_BROWSER', 'Only the owned localhost URL may be opened.');
  const command = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32/rundll32.exe') : process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise(resolve => {
    const child = spawn(command, args, { shell: false, windowsHide: true, stdio: 'ignore' });
    const timer = timers.setTimeout(() => { child.kill(); resolve(false); }, 5000);
    child.once('error', () => { timers.clearTimeout(timer); resolve(false); });
    child.once('close', code => { timers.clearTimeout(timer); resolve(code === 0); });
  });
}
function probe(port: number, token: string, timeout: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = get({ host: '127.0.0.1', port, path: '/', timeout, agent: false }, response => {
      response.resume();
      if (response.statusCode === 200 && response.headers['x-shell-preview'] === token) resolve(200);
      else reject(new OperationError('FIRST_RUN_HEALTH', 'The owned showcase did not serve index.html successfully.'));
    });
    req.once('timeout', () => req.destroy(new OperationError('FIRST_RUN_HEALTH_TIMEOUT', 'Showcase health check timed out.')));
    req.once('error', reject);
  });
}
export interface PreviewHooks { signal?: AbortSignal; progress?: (text: string) => void; ready?: (result: PreviewResult) => Promise<void> | void }
/** An owned, bounded localhost server, never a detached process or a server exposing project source. */
export async function showcase(root: string, options: FirstRunRequest, hooks: PreviewHooks = {}, openBrowser = openShowcaseBrowser): Promise<PreviewResult> {
  const assets = await previewAssets(root), token = randomBytes(24).toString('hex');
  const address = `127.0.0.1:${options.port}`, url = `http://${address}/`;
  const result: PreviewResult = { url, ready: false, httpStatus: null, browser: 'not-requested', stopped: false };
  const server = createServer((request, response) => {
    let path: string;
    try { path = decodeURIComponent((request.url ?? '/').split('?')[0]!); }
    catch { response.writeHead(400); response.end(); return; }
    const asset = assets.get(path === '/' ? '/index.html' : path);
    if (request.headers.host !== address || !['GET', 'HEAD'].includes(request.method ?? '') || !asset) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-shell-preview': token, 'content-length': asset.bytes.length });
    response.end(request.method === 'HEAD' ? undefined : asset.bytes);
  });
  let timer: NodeJS.Timeout | undefined;
  let abort: (() => void) | undefined;
  try {
    requireSketch(!hooks.signal?.aborted, 'CANCELLED', 'First run cancelled before showcase.');
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', resolve); });
    result.httpStatus = await probe(options.port, token, options.readyTimeoutMs); result.ready = true;
    requireSketch(!hooks.signal?.aborted, 'CANCELLED', 'First run cancelled before browser opening.');
    hooks.progress?.(`SHOWCASE_READY ${url}\n`);
    if (options.openBrowser) result.browser = await openBrowser(url) ? 'requested' : 'failed';
    await hooks.ready?.(result);
    await new Promise<void>(resolve => {
      abort = resolve; hooks.signal?.addEventListener('abort', abort, { once: true });
      timer = timers.setTimeout(resolve, options.showcaseDurationMs);
      if (hooks.signal?.aborted) resolve();
    });
    return result;
  } finally {
    if (timer) timers.clearTimeout(timer); if (abort) hooks.signal?.removeEventListener('abort', abort);
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    result.stopped = true;
  }
}
