import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, get } from 'node:http';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { showcase, previewAssets, openShowcaseBrowser } from '../adapters/first-run-preview.ts';
import { readFirstRunRequest } from '../domain/first-run.ts';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'first-showcase-'));
  try { await writeFile(join(root, 'index.html'), '<!doctype html><h1>Hello world</h1>'); await fn(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
async function port() {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function request(port, path = '/', host = `127.0.0.1:${port}`, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = get({ host: '127.0.0.1', port, path, method, agent: false, headers: { host } }, res => {
      let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }); req.on('error', reject);
  });
}
test('owned HTTP preview serves built assets, not source, and shuts down on explicit stop', async () => scratch(async root => {
  await writeFile(join(root, 'main.js'), 'console.log("built");');
  await writeFile(join(root, '.env'), 'private'); await writeFile(join(root, 'source.ts'), 'not public');
  const controller = new AbortController(), p = await port();
  const options = readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: p, showcaseDurationMs: 1000 });
  const result = await showcase(root, options, { signal: controller.signal, async ready(value) {
    assert.equal(value.httpStatus, 200); assert.equal(value.ready, true); assert.equal(value.stopped, false);
    const home = await request(p); assert.match(home.body, /Hello world/); assert.equal(home.headers['cache-control'], 'no-store');
    assert.equal((await request(p, '/main.js')).status, 200); assert.match((await request(p, '/main.js')).headers['content-type'], /javascript/);
    assert.equal((await request(p, '/', `127.0.0.1:${p}`, 'HEAD')).body, '');
    for (const path of ['/source.ts','/.env','/%2e%2e/.env','/index.html/../../package.json']) assert.equal((await request(p,path)).status, 404);
    assert.equal((await request(p,'/', 'attacker.example')).status, 404);
    assert.equal((await request(p,'/%invalid')).status, 400);
    controller.abort();
  } }, async () => { assert.fail('Browser opening must be opt-in.'); });
  assert.equal(result.ready, true); assert.equal(result.stopped, true); assert.equal(result.browser, 'not-requested');
  await assert.rejects(() => request(p), /ECONNREFUSED/);
}));
test('browser opens only after health succeeds and an opener failure retains the usable URL', async () => scratch(async root => {
  const p = await port(), controller = new AbortController(); let calls = 0;
  const result = await showcase(root, readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: p, openBrowser: true }), { signal: controller.signal, ready: () => controller.abort() }, async url => {
    calls++; assert.equal(url, `http://127.0.0.1:${p}/`); assert.equal((await request(p)).status, 200); return false;
  });
  assert.equal(calls, 1); assert.equal(result.browser, 'failed'); assert.equal(result.ready, true); assert.equal(result.stopped, true);
}));
test('successful browser dispatch is distinct from manual application acceptance', async () => scratch(async root => {
  const controller = new AbortController();
  const result = await showcase(root, readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: await port(), openBrowser: true }), { signal: controller.signal, ready: () => controller.abort() }, async () => true);
  assert.equal(result.browser, 'requested'); assert.equal(result.stopped, true);
}));
test('occupied ports fail without hijacking another server or opening a browser', async () => scratch(async root => {
  const server = createServer((_req,res) => res.end('other owner')); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const p = server.address().port;
  try {
    await assert.rejects(() => showcase(root, readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: p, openBrowser: true }), {}, async () => assert.fail('Must not open another service')), { code: 'EADDRINUSE' });
    assert.equal((await request(p)).body, 'other owner');
  } finally { await new Promise(resolve => server.close(resolve)); }
}));
test('bounded headless showcase expires and frees its port without leaving a daemon', async () => scratch(async root => {
  const p = await port(), start = Date.now();
  const result = await showcase(root, readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: p, showcaseDurationMs: 1000 }));
  assert.ok(Date.now() - start >= 900); assert.equal(result.stopped, true);
  await assert.rejects(() => request(p), /ECONNREFUSED/);
}));
test('cancel before readiness starts no showcase and browser URL injection is refused', async () => scratch(async root => {
  const p = await port();
  await assert.rejects(() => showcase(root, readFirstRunRequest({ schemaVersion: 1, mode: 'showcase', port: p }), { signal: AbortSignal.abort() }));
}));
test('preview refuses non-local opener URLs and symlink artifacts', async () => scratch(async root => {
  for (const url of ['https://example.com', 'file:///secret', 'http://127.0.0.1:4173/;command', 'http://localhost:4173/']) await assert.rejects(() => openShowcaseBrowser(url));
  if (process.platform !== 'win32') { await symlink(join(root,'index.html'),join(root,'linked.html')); await assert.rejects(() => previewAssets(root), /symbolic links/); }
}));
test('missing built index fails rather than showcasing stale project source', async () => scratch(async root => {
  await rm(join(root, 'index.html')); await assert.rejects(() => previewAssets(root), /ENOENT/);
}));
