import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startFixtureServer } from '../../docs/concepts/companion/test-kit/server.mjs';
import { fixtureManifest } from './test-data-fixture.mjs';
function request(server, path, { method = 'GET', data, headers = {} } = {}) {
  const content = data === undefined ? null : typeof data === 'string' ? data : JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request(server.url + path, { method, headers: { Authorization: 'Bearer ' + server.token, ...(content === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(content) }), ...headers } }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', value => { body += value; }); res.on('end', () => resolve({ status: res.statusCode, data: body ? JSON.parse(body) : undefined, headers: res.headers }));
    }); req.on('error', reject); req.end(content);
  });
}
test('[TD-HTTP] real loopback transport serves declared GET/POST/DELETE behavior and never proxies', async t => {
  const server = await startFixtureServer(fixtureManifest()); t.after(() => server.close()); assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  const route = '/sources/tasks/tasks'; let result = await request(server, route); assert.equal(result.status, 200); assert.equal(result.data.length, 3);
  const row = { ...result.data[0], title: 'HTTP synthetic edit' }; assert.equal((await request(server, route, { method: 'POST', data: row })).status, 200);
  result = await request(server, route); assert.equal(result.data[0].title, row.title);
  assert.equal((await request(server, route, { method: 'DELETE', data: { id: row.id } })).status, 200); assert.equal((await request(server, route)).data.length, 2);
  assert.equal((await request(server, '/unknown')).status, 404);
  assert.equal((await request(server, route, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await request(server, route, { headers: { Host: 'example.invalid' } })).status, 403);
  assert.equal((await request(server, route, { headers: { Origin: 'https://example.invalid' } })).status, 403);
  assert.equal((await request(server, route, { method: 'POST', data: '{bad' })).status, 400);
  assert.equal((await request(server, route, { method: 'POST', data: {} })).status, 422);
  assert.equal((await request(server, route, { method: 'POST', data: 'x'.repeat(66000) })).status, 413);
});
test('[TD-HTTP-FAILURE] mocked error statuses and request parameters reflect operation contracts', async t => {
  const m = fixtureManifest(); m.operations = [m.operations[0]]; const op = m.operations[0]; op.behavior = 'fixture'; op.resource = '/tasks/{id}'; op.input = { schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false } };
  const server = await startFixtureServer(m); t.after(() => server.close());
  assert.equal((await request(server, '/sources/tasks/tasks/7')).status, 200); assert.equal(server.adapter.captured()[0].input.id, 7);
  assert.equal((await request(server, '/sources/tasks/tasks/abc')).status, 422);
  assert.equal((await request(server, '/sources/tasks/tasks/7?id=9')).status, 422);
  assert.equal((await request(server, '/sources/tasks/tasks/7?other=1&other=2')).status, 422);
  m.operations[0].scenario = 'error'; m.operations[0].errorStatus = 429; const failure = await startFixtureServer(m); t.after(() => failure.close());
  assert.equal((await request(failure, '/sources/tasks/tasks/7')).status, 429);
});
test('[TD-HTTP-ROUTES] ambiguous routes, nonlocal targets and invalid methods are refused before listen', async () => {
  const m = fixtureManifest(); m.operations.push({ ...structuredClone(m.operations[0]), id: 'ds-operation-99', slug: 'other-list', behavior: 'fixture' });
  await assert.rejects(startFixtureServer(m), /Ambiguous/);
  m.operations.pop(); m.operations[0].resource = 'https://example.invalid/tasks'; await assert.rejects(startFixtureServer(m), /resource|path/);
  await assert.rejects(startFixtureServer(fixtureManifest(), { port: -1 }), /port/);
});

test('[TD-CORS] exact native origin preflight does not expose payloads or remove token checks', async t => {
  const server = await startFixtureServer(fixtureManifest()); t.after(() => server.close()); const path = '/sources/tasks/tasks';
  const result = await request(server, path, { method: 'OPTIONS', headers: { Authorization: '', Origin: 'app://obsidian.md', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type' } });
  assert.equal(result.status, 204); assert.equal(result.data, undefined); assert.equal(result.headers['access-control-allow-origin'], 'app://obsidian.md');
  assert.equal((await request(server, path, { headers: { Origin: 'app://obsidian.md', Authorization: '' } })).status, 401);
  assert.equal((await request(server, path, { headers: { Origin: 'app://obsidian.md' } })).status, 200);
  assert.equal((await request(server, path, { method: 'OPTIONS', headers: { Origin: 'https://example.invalid', 'Access-Control-Request-Method': 'GET' } })).status, 403);
  assert.equal((await request(server, path, { method: 'OPTIONS', headers: { Origin: 'app://obsidian.md', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-live-token' } })).status, 403);
});
