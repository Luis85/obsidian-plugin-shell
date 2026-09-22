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
    const req = request({ hostname: '127.0.0.1', port, path, method, timeout: 3000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('timeout', () => req.destroy(new Error('HTTP_TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

test('[HTTP-01] serves an explicitly labeled stylesheet fixture', async () => {
  const result = await get('/harness/style-fixture/');
  assert.equal(result.status, 200);
  assert.match(result.body, /Original CSS simulation/);
  assert.match(result.body, /not a live failure/i);
  assert.match(result.headers['content-type'], /text\/html/);
});
test('[HTTP-02] root redirects to the canonical asset-relative route', async () => {
  const result = await get('/');
  assert.equal(result.status, 302);
  assert.equal(result.headers.location, '/harness/style-fixture/');
});
test('[HTTP-03] serves all five ordered CSS modules', async () => {
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
test('[HTTP-04] rejects traversal, encoded paths, unrelated files, and writes', async () => {
  for (const path of ['/../AGENTS.md', '/harness/styles/../../AGENTS.md', '/%2e%2e/AGENTS.md', '/.obsidian/data.json', '/package.json']) {
    assert.equal((await get(path)).status, 404, path);
  }
  assert.equal((await get('/harness/style-fixture/', 'POST')).status, 405);
});
test('[HTTP-05] uses no-store, nosniff and no external-network CSP', async () => {
  const result = await get('/harness/style-fixture/');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
  assert.match(result.headers['content-security-policy'], /connect-src 'none'/);
  assert.match(result.headers['content-security-policy'], /frame-ancestors 'none'/);
});
test('[HTTP-06] HEAD returns headers without a body', async () => {
  const result = await get('/harness/styles/obsidian.css', 'HEAD');
  assert.equal(result.status, 200);
  assert.equal(result.body, '');
});
test('[HTTP-07] source-level tripwires: fixture provenance, no external assets or HTML injection', async () => {
  const entry = await readFile(new URL('../../harness/styles/obsidian.css', import.meta.url), 'utf8');
  const script = await readFile(new URL('../../harness/style-fixture/fixture.js', import.meta.url), 'utf8');
  assert.match(entry, /Not copied from Obsidian/);
  assert.doesNotMatch(entry, /https?:\/\//);
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|localStorage|\bfetch\(/);
});
test('[HTTP-08] all allowed asset bodies match actual source bytes', async () => {
  const paths = ['harness/style-fixture/fixture.css', 'harness/style-fixture/fixture.js',
    'harness/styles/obsidian.css', ...['tokens','base','controls','overlays','accessibility'].map((n) => `harness/styles/obsidian/${n}.css`)];
  for (const path of paths) {
    const expected = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    assert.equal((await get(`/${path}`)).body, expected, path);
  }
});
test('[HTTP-09] unsupported HTTP verbs cannot mutate the fixture', async () => {
  for (const method of ['PUT','PATCH','DELETE','OPTIONS'])
    assert.equal((await get('/harness/style-fixture/', method)).status, 405);
  assert.equal((await get('/harness/style-fixture/')).status, 200);
});
test('[HTTP-10] alternate traversal and absolute-form paths do not escape the allowlist', async () => {
  for (const path of ['/harness/%2e%2e/AGENTS.md', '/harness/styles/%252e%252e/README.md',
    '//harness/style-fixture/', '/harness/styles/obsidian.css/extra', 'http://example.invalid/'])
    assert.equal((await get(path)).status, 404, path);
});
