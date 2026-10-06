import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureEngine } from '../../docs/concepts/companion/test-kit/engine.mjs';
import { createFixtureAdapter } from '../../docs/concepts/companion/test-kit/adapters.mjs';
import { createFakerProvider } from '../../docs/concepts/companion/test-kit/faker-provider.mjs';
import { fixtureManifest, entityManifest } from './test-data-fixture.mjs';
const engine = createFixtureEngine();

test('[TD-REPEAT] generation is repeatable, seeded, versioned and input-immutable', () => {
  const manifest = fixtureManifest(), before = JSON.stringify(manifest), a = engine.generate(manifest);
  assert.deepEqual(a, engine.generate(manifest)); assert.equal(JSON.stringify(manifest), before);
  manifest.seed++; assert.notDeepEqual(a.files, engine.generate(manifest).files);
  manifest.seed--; manifest.operations.reverse();
  assert.deepEqual(a.files, engine.generate(manifest).files, 'independent operation ordering does not change files');
  assert.equal(a.engine, 'shell-fixtures/1'); assert.equal(a.provider, 'builtin-v1');
});
test('[TD-LINKS] entity pools share stable identities and satisfiable cyclic references', () => {
  const manifest = entityManifest(), result = engine.generate(manifest);
  const notes = result.files.filter(f => f.path.endsWith('.md'));
  assert.equal(notes.length, manifest.count);
  for (const [i, note] of notes.entries()) {
    const lines = Object.fromEntries(note.content.split('\n').slice(1, 7).map(line => { const colon = line.indexOf(':'); return [JSON.parse(line.slice(0, colon)), JSON.parse(line.slice(colon + 1))]; }));
    assert.equal(lines.mentor, `[[Records/People/fixture-person-${String(i + 1).padStart(4, '0')}]]`);
    assert.deepEqual(lines.friends, [lines.mentor]); assert.match(lines.email, /@example\.invalid$/);
    assert.ok(engine.matches(lines, manifest.entities[0].schema));
  }
  assert.equal(new Set(result.operations[0].outputValue.map(r => r.id)).size, manifest.count);
});
test('[TD-SHAPES] custom nested DTOs, formats, defaults and explicit field rules produce valid payloads', () => {
  const m = fixtureManifest(), op = m.operations[0]; m.operations = [op]; op.behavior = 'fixture';
  op.output.schema.items.properties.details = { type: 'object', properties: { due: { type: 'string', format: 'date' }, tags: { type: 'array', items: { type: 'string', enum: ['one', 'two'] } } }, required: ['due', 'tags'], additionalProperties: false };
  op.rules = [{ side: 'output', path: '/*/title', provider: 'sequence', argument: 'Demo' }];
  const result = engine.generate(m); assert.ok(engine.matches(result.operations[0].outputValue, op.output.schema));
  assert.equal(result.operations[0].outputValue[0].title, 'Demo0001');
  assert.equal(result.operations[0].outputValue[0].completed, false);
  const due = result.operations[0].outputValue[0].details.due; assert.match(due, /^2026-/);
  op.rules[0].provider = 'literal'; op.rules[0].argument = 'false'; assert.throws(() => engine.generate(m), /does not match/);
  op.rules[0].argument = '{'; assert.throws(() => engine.generate(m), /valid JSON/);
});
test('[TD-BOUNDS] malformed manifests, impossible outputs and unsafe targets fail before I/O', () => {
  for (const mutate of [m => { m.target = '../live'; }, m => { m.count = 101; }, m => { m.seed = NaN; }, m => { m.engine = 'unknown'; }, m => { m.operations[3].resource = '../notes'; }, m => { m.operations[3].resource = '.obsidian/plugins'; }, m => { m.operations[0].output.schema.$ref = 'https://example.invalid'; }, m => { m.operations[0].rules = [{ side: 'output', path: '/missing', provider: 'email', argument: '' }]; }]) {
    const m = fixtureManifest(); mutate(m); assert.throws(() => engine.generate(m));
  }
  const nested = fixtureManifest(); nested.operations[3].output.schema.items.properties.nested = { type: 'object', properties: {}, required: [] };
  assert.throws(() => engine.generate(nested), /flat object/);
  const missing = entityManifest(); missing.entities[0].relationships[0].target = 'absent'; assert.throws(() => engine.generate(missing), /target is missing/);
  const folder = entityManifest(); folder.operations[0].resource = 'Other'; assert.throws(() => engine.generate(folder), /folder differ/);
});
test('[TD-STATEFUL] list/upsert/delete share an isolated dataset and validate mutations', async () => {
  const m = fixtureManifest(), a = createFixtureAdapter(m), b = createFixtureAdapter(m), port = a.port('tasks');
  const before = await port['list-tasks'](), row = { ...before[0], title: 'Edited synthetic task' };
  await port['save-task'](row); assert.equal((await port['list-tasks']())[0].title, row.title);
  assert.equal((await b.execute('ds-operation-1'))[0].title, before[0].title);
  await assert.rejects(port['save-task']({ id: row.id }), /contract/);
  assert.equal((await port['list-tasks']())[0].title, row.title);
  await port['delete-task']({ id: row.id }); assert.equal((await port['list-tasks']()).length, 2);
  await assert.rejects(port['delete-task']({ id: row.id }), /not found/);
  assert.ok(a.captured().some(c => c.operation === 'ds-operation-2'));
  a.reset(); assert.deepEqual(await port['list-tasks'](), before);
  await assert.rejects(a.execute('live-fallback'), /fallback is forbidden/);
  await assert.rejects(a.execute('ds-operation-4'), /seed real notes/);
  a.dispose(); await assert.rejects(port['list-tasks'](), /disposed/); b.dispose();
});
test('[TD-SCENARIOS] empty, controlled failure, delay cancellation and fixed-response writes are explicit', async () => {
  const m = fixtureManifest(); m.operations = [m.operations[0]]; m.operations[0].scenario = 'empty';
  let a = createFixtureAdapter(m); assert.deepEqual(await a.execute('ds-operation-1'), []); a.dispose();
  m.operations[0].scenario = 'error'; a = createFixtureAdapter(m); await assert.rejects(a.execute('ds-operation-1'), e => e.status === 503); a.dispose();
  m.operations[0].scenario = 'slow'; a = createFixtureAdapter(m); const abort = new AbortController(), pending = a.execute('ds-operation-1', undefined, { signal: abort.signal }); abort.abort(new Error('Cancelled fixture'));
  await assert.rejects(pending, /Cancelled/); assert.equal(a.captured().length, 0); a.dispose();
  const f = fixtureManifest(); f.operations[1].behavior = 'fixture'; a = createFixtureAdapter(f);
  const original = await a.execute('ds-operation-1'); await a.execute('ds-operation-2', { ...original[0], title: 'Captured only' }); assert.deepEqual(await a.execute('ds-operation-1'), original); a.dispose();
});
test('[TD-FAKER-SEAM] optional provider is version-bound, seeded per field and called only for supported values', () => {
  const calls = [], fake = { seed: n => calls.push(['seed', n]), setDefaultRefDate: date => calls.push(['date', date]), person: { fullName: () => 'Test Provider' }, string: { alphanumeric: () => 'abcXYZ' } };
  assert.throws(() => createFakerProvider(fake, '0.0.0'), /Requalify/);
  const provider = createFakerProvider(fake, '10.5.0');
  const result = engine.generate(entityManifest(), { provider, providerName: 'injected-test-provider' });
  assert.equal(result.operations[0].outputValue[0].name, 'Test Provider'); assert.equal(result.operations[0].outputValue[0].email, 'fixture-abcxyz@example.invalid');
  assert.ok(calls.some(c => c[0] === 'date' && c[1] === '2026-01-01T00:00:00.000Z'));
  assert.equal(result.provider, 'injected-test-provider');
  // This fixture verifies the injection contract, not the separately installed Faker package.
});


test('[TD-EXPANSION] pathological nested collections stop before unbounded fixture allocation', () => {
  const m = fixtureManifest(); m.operations = [m.operations[0]]; m.count = 100; m.operations[0].behavior = 'fixture';
  let nested = { type: 'object', properties: Object.fromEntries(Array.from({ length: 70 }, (_, i) => ['field' + i, { type: 'string' }])), required: [], additionalProperties: false };
  for (let i = 0; i < 4; i++) nested = { type: 'array', items: nested };
  m.operations[0].output.schema = { type: 'array', items: nested };
  const m2 = structuredClone(m.operations[0]); m2.id = 'ds-operation-99'; m2.slug = 'large-two'; m.operations.push(m2);
  assert.throws(() => engine.generate(m), /200,000|5 MB/);
});
test('[TD-ROUTE-CONTRACT] unsupported path/query shapes fail before a simulator is started', () => {
  for (const resource of ['/tasks/prefix-{id}', '/tasks/{id}/{id}', '/tasks/{unknown}']) {
    const m = fixtureManifest(); m.operations[0].resource = resource;
    assert.throws(() => engine.validate(m), /parameter/);
  }
  const m = fixtureManifest(); m.operations[0].input = { schema: { type: 'string' } }; m.operations[0].behavior = 'fixture';
  assert.throws(() => engine.validate(m), /query inputs/);
});
