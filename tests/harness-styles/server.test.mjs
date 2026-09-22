import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createFixtureServer } from '../../scripts/harness/serve-style-fixture.mjs';

const server = createFixtureServer();
let port;
before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});
function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves an explicitly labeled stylesheet fixture', async () => {
  const result = await get('/harness/style-fixture/');
  assert.equal(result.status, 200);
  assert.match(result.body, /Original CSS simulation/);
  assert.match(result.body, /not a live failure/i);
  assert.match(result.headers['content-type'], /text\/html/);
});
test('root redirects to the canonical asset-relative route', async () => {
  const result = await get('/');
  assert.equal(result.status, 302);
  assert.equal(result.headers.location, '/harness/style-fixture/');
});
test('serves all five ordered CSS modules', async () => {
  const entry = await get('/harness/styles/obsidian.css');
  const names = [...entry.body.matchAll(/@import '\.\/obsidian\/([a-z]+)\.css';/g)].map((m) => m[1]);
  assert.deepEqual(names, ['tokens', 'base', 'controls', 'overlays', 'accessibility']);
  for (const name of names) {
    const result = await get(`/harness/styles/obsidian/${name}.css`);
    assert.equal(result.status, 200);
    assert.match(result.headers['content-type'], /text\/css/);
    assert.ok(result.body.split('\n').length <= 400);
  }
});
test('rejects traversal, encoded paths, unrelated files, and writes', async () => {
  for (const path of ['/../AGENTS.md', '/harness/styles/../../AGENTS.md', '/%2e%2e/AGENTS.md', '/.obsidian/data.json', '/package.json']) {
    assert.equal((await get(path)).status, 404, path);
  }
  assert.equal((await get('/harness/style-fixture/', 'POST')).status, 405);
});
test('uses no-store, nosniff and no external-network CSP', async () => {
  const result = await get('/harness/style-fixture/');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
  assert.match(result.headers['content-security-policy'], /connect-src 'none'/);
  assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
});
test('HEAD returns headers without a body', async () => {
  const result = await get('/harness/styles/obsidian.css', 'HEAD');
  assert.equal(result.status, 200);
  assert.equal(result.body, '');
});
test('source-level tripwires: fixture provenance, no external assets or HTML injection', async () => {
  const entry = await readFile(new URL('../../harness/styles/obsidian.css', import.meta.url), 'utf8');
  const script = await readFile(new URL('../../harness/style-fixture/fixture.js', import.meta.url), 'utf8');
  assert.match(entry, /Not copied from Obsidian/);
  assert.doesNotMatch(entry, /https?:\/\//);
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|localStorage|\bfetch\(/);
});
