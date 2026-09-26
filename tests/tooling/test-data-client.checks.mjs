import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHttpPort } from '../../docs/concepts/companion/test-kit/client.mjs';
import { startFixtureServer } from '../../docs/concepts/companion/test-kit/server.mjs';
import { fixtureManifest } from './test-data-fixture.mjs';

test('[TD-CLIENT] exported application port consumes the real loopback server and validates writes', async t => {
  const manifest = fixtureManifest(), server = await startFixtureServer(manifest);
  t.after(() => server.close()); const client = createTestHttpPort(manifest, 'tasks', server); t.after(() => client.dispose());
  const rows = await client.port['list-tasks'](); assert.equal(rows.length, 3);
  await client.port['save-task']({ ...rows[0], title: 'Edited through HTTP port' });
  assert.equal((await client.port['list-tasks']())[0].title, 'Edited through HTTP port');
  await client.port['delete-task']({ id: rows[0].id }); assert.equal((await client.port['list-tasks']()).length, 2);
  await assert.rejects(client.port['save-task']({ title: 'Missing identity' }), /Input violates/);
  client.dispose(); await assert.rejects(client.port['list-tasks'](), /disposed/);
});
test('[TD-CLIENT-SCOPE] explicit local origin, session secret and no redirected/live fallback', async () => {
  const manifest = fixtureManifest(), token = 'a'.repeat(48);
  for (const url of ['https://example.invalid', 'http://localhost:3000', 'http://127.0.0.1:3000/proxy', 'http://user:pass@127.0.0.1:3000']) assert.throws(() => createTestHttpPort(manifest, 'tasks', { url, token }), /loopback/);
  assert.throws(() => createTestHttpPort(manifest, 'tasks', { url: 'http://127.0.0.1:3000', token: '' }), /token/);
  let supplied;
  const client = createTestHttpPort(manifest, 'tasks', { url: 'http://127.0.0.1:3000', token, transport: async (url, options) => { supplied = { url, options }; return { ok: true, text: async () => '[{"invalid":"payload"}]' }; } });
  await assert.rejects(client.port['list-tasks'](), /output violates/); assert.equal(supplied.options.redirect, 'error'); assert.equal(supplied.options.credentials, 'omit'); assert.match(supplied.url, /^http:\/\/127\.0\.0\.1:3000\/sources\/tasks\//); client.dispose();
});
test('[TD-CLIENT-CANCEL] cancellation and disposal abort actual pending requests without writes', async t => {
  const m = fixtureManifest(); m.operations[0].latencyMs = 3000; const server = await startFixtureServer(m); t.after(() => server.close());
  const client = createTestHttpPort(m, 'tasks', server); t.after(() => client.dispose()); const abort = new AbortController();
  const pending = client.port['list-tasks'](undefined, { signal: abort.signal }); abort.abort(new Error('cancelled'));
  await assert.rejects(pending, /cancelled/); assert.deepEqual(server.adapter.captured(), []);
  const second = client.port['list-tasks'](); client.dispose(); await assert.rejects(second, /disposed/);
});
test('[TD-CLIENT-PARAMETERS] path and query serialization preserve declared scalar inputs', async t => {
  const m = fixtureManifest(); m.operations = [m.operations[0]]; const op = m.operations[0]; op.behavior = 'fixture'; op.resource = '/tasks/{id}'; op.input = { schema: { type: 'object', properties: { id: { type: 'string' }, limit: { type: 'integer' } }, required: ['id','limit'], additionalProperties: false } };
  const server = await startFixtureServer(m); t.after(() => server.close()); const client = createTestHttpPort(m, 'tasks', server); t.after(() => client.dispose());
  const result = await client.port['list-tasks']({ id: 'synthetic space', limit: 5 }); assert.equal(result.length, 3);
  assert.deepEqual(server.adapter.captured()[0].input, { id: 'synthetic space', limit: 5 });
});
