import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { fakerMethods, fakerCall, generatorsFor, fakePropertyTypes } from '../../bin/domain/fake-data-generators.ts';
import { fakeEntityJson, fakeFolder, fakeId, readFakeEntity, readFakeProperty } from '../../bin/domain/fake-data-entity.ts';
import { fakeBase, generateCollection, renderBody } from '../../bin/domain/fake-data.ts';
import { defaultReferenceDate, fakeCount, fakeGenerationJson, fakeReferenceDate, fakeSeed, inferFakeEntity, readEntityRef, readFakeGeneration } from '../../bin/domain/fake-data-config.ts';
import { fakerCalls, fakerSource } from '../../bin/adapters/fake-data-faker.ts';
import { renderBase, renderNote } from '../../bin/adapters/fake-data-plan.ts';
import { loadYaml } from '../../bin/adapters/yaml-runtime.ts';
// The renderers are synchronous helpers behind fakeDataPlan's lazy YAML load; load it once as that entry point does.
await loadYaml();
const repository = resolve(import.meta.dirname, '../..');
const presets = async folder => Promise.all((await readdir(join(repository, 'configs/fake-data', folder))).sort()
  .map(async name => JSON.parse(await readFile(join(repository, 'configs/fake-data', folder, name), 'utf8'))));
/** A transparent stand-in source: every call is recorded, integers cycle through the allowed range. */
function counting(values = {}) {
  let tick = 0; const calls = [];
  return { calls, call: (method, args) => { calls.push([method, args]); return Object.hasOwn(values, method) ? values[method](tick++) : `${method}-${tick++}`; },
    int: (min, max) => min + (tick++ % (max - min + 1)) };
}
const entity = (properties, extra = {}) => ({ schemaVersion: 1, id: 'sample', title: 'Sample', folder: 'Samples', titleProperty: 'name',
  properties: [{ key: 'name', type: 'text', generator: { faker: 'person.fullName' } }, ...properties], ...extra });
const notes = (definition, count, source, base = false) => generateCollection(readFakeEntity(definition), { count, out: 'Fake Data/Samples', base }, source);

test('the domain allowlist and the Faker dispatch name exactly the same methods, and every method runs with its defaults', () => {
  assert.deepEqual(Object.keys(fakerCalls).sort(), Object.keys(fakerMethods).sort());
  const source = fakerSource(3, defaultReferenceDate);
  for (const [method, spec] of Object.entries(fakerMethods)) {
    const type = { text: 'text', number: 'number', boolean: 'checkbox', date: 'date' }[spec.output];
    const { args } = fakerCall(method, method === 'date.between' ? { from: '2020-01-01', to: '2020-12-31' } : undefined, type, method);
    const value = source.call(method, args);
    assert.ok(value !== undefined && value !== null && value !== '', method);
  }
  assert.throws(() => source.call('helpers.fake', {}), /not allowlisted/);
  assert.deepEqual(generatorsFor('checkbox').map(item => item.id), ['datatype.boolean']);
  assert.ok(generatorsFor('date').some(item => item.id === 'date.between') && generatorsFor('tags').some(item => item.id === 'lorem.word'));
});

test('generator references fail closed: unknown paths, unsafe methods, unknown or out-of-range arguments', () => {
  for (const [method, args, type, pattern] of [
    ['helpers.fake', undefined, 'text', /allowlisted/], ['person.__proto__', undefined, 'text', /allowlisted/], ['constructor', undefined, 'text', /allowlisted/],
    [42, undefined, 'text', /allowlisted/], ['number.int', undefined, 'checkbox', /cannot fill a checkbox/],
    ['number.int', { min: 1, step: 2 }, 'number', /unsupported keys: step/], ['number.int', { min: '1' }, 'number', /needs a number/],
    ['number.int', { min: 1.5 }, 'number', /whole number/], ['number.int', { min: 5, max: 1 }, 'number', /lower bound/],
    ['number.float', { min: 1e12 }, 'number', /between -1e9 and 1e9/], ['datatype.boolean', { probability: 2 }, 'checkbox', /between 0 and 1/],
    ['date.between', { from: '2020-02-30', to: '2021-01-01' }, 'date', /YYYY-MM-DD/], ['date.between', { from: '2020-01-01' }, 'date', /to is required/],
    ['date.past', { years: 500 }, 'date', /from 1 to 100/], ['lorem.words', { min: 0 }, 'text', /from 1 to 50/], ['date.recent', [], 'date', /JSON object/],
  ]) assert.throws(() => fakerCall(method, args, type, 'g'), pattern, `${String(method)} ${JSON.stringify(args)}`);
  assert.deepEqual(fakerCall('number.int', { max: 5 }, 'number', 'g'), { faker: 'number.int', args: { min: 0, max: 5 } });
});

test('entity definitions are data: unsafe keys, control characters, unknown fields and dangling references are refused', () => {
  const ok = entity([]);
  for (const [definition, pattern] of [
    [{ ...ok, schemaVersion: 2 }, /schemaVersion/], [{ ...ok, id: 'Not Kebab' }, /kebab-case/], [{ ...ok, run: 'rm -rf /' }, /Unknown fields: run/],
    [{ ...ok, title: 'Bad\u0007' }, /control characters/], [{ ...ok, properties: [] }, /at least one property/],
    [entity([{ key: '__proto__', type: 'text', generator: { value: 'x' } }]), /key must start/], [entity([{ key: 'Constructor', type: 'text', generator: { value: 'x' } }]), /reserved/],
    [entity([{ key: 'NAME', type: 'text', generator: { value: 'x' } }]), /unique keys/], [entity([{ key: 'x', type: 'script', generator: { value: 'x' } }]), /type must be one of/],
    [entity([{ key: 'x', type: 'text', generator: {} }]), /exactly one/], [entity([{ key: 'x', type: 'text', generator: { value: 'a', choices: ['a'] } }]), /exactly one/],
    [entity([{ key: 'x', type: 'text', generator: { faker: 'person.fullName', extra: 1 } }]), /Unknown fields: extra/],
    [entity([{ key: 'x', type: 'text', generator: { choices: ['a', 'a'] } }]), /unique values/], [entity([{ key: 'x', type: 'number', generator: { choices: ['1'] } }]), /must be a number/],
    [entity([{ key: 'x', type: 'checkbox', generator: { value: 'yes' } }]), /true or false/], [entity([{ key: 'x', type: 'date', generator: { value: '01/02/2020' } }]), /YYYY-MM-DD/],
    [entity([{ key: 'x', type: 'datetime', generator: { value: '2020-01-01' } }]), /date and time/], [entity([{ key: 'x', type: 'number', generator: { sequence: 'A' } }]), /prefix/],
    [entity([{ key: 'x', type: 'text', generator: { sequence: 'A/B' } }]), /prefix/], [entity([{ key: 'x', type: 'text', generator: { value: 'a' }, unique: true }]), /varying generator/],
    [entity([{ key: 'x', type: 'tags', generator: { value: 'a' }, unique: true }]), /JSON|array/], [entity([{ key: 'x', type: 'text', generator: { value: 'a' }, required: 'yes' }]), /true or false/],
    [entity([{ key: 'x', type: 'text', generator: { value: 'a' }, items: { min: 1, max: 2 } }]), /only available for list/],
    [entity([{ key: 'x', type: 'list', generator: { value: ['a'] }, items: { min: 3, max: 2 } }]), /0 ≤ min ≤ max ≤ 20/],
    [{ ...ok, titleProperty: 'missing' }, /titleProperty/], [entity([{ key: 'n', type: 'number', generator: { value: 1 } }], { titleProperty: 'n' }), /titleProperty/],
    [{ ...ok, body: '# {{nope}}' }, /not a declared property/], [{ ...ok, body: '{{ name }}' }, /not a declared property/], [{ ...ok, body: 'a\u0000' }, /control characters/],
    [{ ...ok, folder: '../escape' }, /relative folder/], [{ ...ok, folder: 'Notes/.hidden' }, /relative folder/], [{ ...ok, folder: 'a//b' }, /relative folder/],
    [{ ...ok, folder: 'com1' }, /relative folder/], [{ ...ok, folder: 'node_modules/x' }, /relative folder/], [{ ...ok, folder: 'bad#name' }, /relative folder/],
  ]) assert.throws(() => readFakeEntity(definition), pattern, JSON.stringify(definition).slice(0, 160));
  const read = readFakeEntity({ ...ok, description: 'Demo', properties: [...ok.properties, { key: 'bag', label: 'Bag', type: 'list', generator: { value: ['a', 'b'] } }] });
  assert.equal(read.body, '# {{name}}\n'); assert.deepEqual(read.properties[1].items, { min: 1, max: 3 }); assert.equal(read.description, 'Demo');
  assert.equal(JSON.parse(fakeEntityJson(read)).$schema, '../../schemas/fake-data-entity.schema.json');
  assert.equal(fakeId('Reading List'), 'reading-list'); assert.equal(fakeId('Contact', ['contact']), 'contact-2');
  assert.equal(readFakeProperty({ key: 'k', type: 'text', generator: { sequence: '' } }, 'p').generator.sequence, '');
  assert.equal(fakeFolder('Fake Data/People', 'out'), 'Fake Data/People'); assert.throws(() => fakeFolder(' x', 'out'), /relative folder/);
});

test('every shipped entity preset and generation config validates', async () => {
  const entities = (await presets('entities')).map(readFakeEntity);
  assert.deepEqual(entities.map(item => item.id), ['book', 'contact', 'increment', 'learning', 'meeting', 'project', 'risk', 'task']);
  const generations = (await presets('generations')).map(readFakeGeneration);
  assert.deepEqual(generations.map(item => [item.id, item.entity, item.base]), [['contacts-demo', 'contact', true], ['increments-demo', 'increment', true], ['learnings-demo', 'learning', true], ['risks-demo', 'risk', true], ['tasks-board', 'task', true]]);
  assert.deepEqual(fakePropertyTypes, ['text', 'number', 'checkbox', 'date', 'datetime', 'list', 'tags', 'link']);
});

test('one seed always yields byte-identical notes; another seed yields different ones', async () => {
  for (const definition of await presets('entities')) {
    const render = seed => { const c = notes(definition, 12, fakerSource(seed, defaultReferenceDate), true); return [...c.notes.map(renderNote), renderBase(c.base)].join('\u0000'); };
    assert.equal(render(7), render(7), definition.id); assert.notEqual(render(7), render(8), definition.id);
  }
});

test('frontmatter round-trips through YAML with Obsidian-compatible values for every property type', async () => {
  const [, contact, , , meeting, project, , task] = await presets('entities');
  const read = note => { const [, yaml, body] = /^---\n([\s\S]*?)---\n\n([\s\S]*)$/.exec(renderNote(note)); return { properties: parse(yaml), body }; };
  for (const note of notes(contact, 30, fakerSource(1, defaultReferenceDate)).notes) {
    const { properties, body } = read(note);
    assert.deepEqual(properties, note.frontmatter); assert.match(properties.email, /@example\.(?:com|net|org)$/);
    assert.equal(typeof properties.favorite, 'boolean'); assert.ok(properties.tags.every(tag => /^[\p{L}\p{N}_/-]+$/u.test(tag)));
    if (properties.birthday !== undefined) assert.match(properties.birthday, /^\d{4}-\d\d-\d\d$/);
    assert.ok(body.startsWith(`# ${properties.name}\n`) && !Object.hasOwn(properties, 'notes'));
  }
  const meetings = notes(meeting, 5, fakerSource(2, defaultReferenceDate)).notes.map(read);
  assert.ok(meetings.every(({ properties }) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(properties.when) && Array.isArray(properties.attendees) && properties.attendees.length >= 2));
  const projects = notes(project, 20, fakerSource(3, defaultReferenceDate)).notes.map(read);
  assert.ok(projects.some(({ properties }) => /^\[\[[^[\]|#^]+\]\]$/.test(properties.owner)) && projects.some(({ properties }) => !Object.hasOwn(properties, 'owner')));
  assert.ok(projects.every(({ properties }) => Number.isInteger(properties.budget) && typeof properties.archived === 'boolean'));
  for (const { properties } of notes(task, 20, fakerSource(4, defaultReferenceDate)).notes.map(read)) {
    assert.equal(properties.type, 'task'); assert.equal(properties.schema_version, 1); assert.ok(['todo', 'doing', 'done'].includes(properties.status));
    assert.match(properties.id, /^[a-zA-Z0-9-]{1,80}$/); assert.match(properties.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  }
});

test('file names are unique, slugged and stay inside the target folder; values are inert text', () => {
  const definition = entity([{ key: 'title', type: 'text', generator: { choices: ['Same', '{{name}} [[x]]|#^'] } },
    { key: 'link', type: 'link', generator: { value: '[[]]' } }, { key: 'seq', type: 'text', generator: { sequence: 'ID-' } },
    { key: 'n', type: 'number', generator: { value: 3 } }, { key: 'flag', type: 'checkbox', generator: { value: true } },
    { key: 'on', type: 'date', generator: { value: '2026-02-03' } }, { key: 'at', type: 'datetime', generator: { faker: 'date.recent' } },
    { key: 'tags', type: 'tags', generator: { faker: 'lorem.word' }, items: { min: 2, max: 2 } }, { key: 'fixed', type: 'tags', generator: { value: ['A B', '123', '!!'] } },
    { key: 'list', type: 'list', generator: { faker: 'number.int' }, items: { min: 1, max: 1 } }], { titleProperty: 'title', body: 'Seq {{seq}} {{tags}}' });
  const source = counting({ 'person.fullName': () => 'x', 'date.recent': () => new Date('2026-01-02T03:04:05.678Z'), 'lorem.word': tick => ['Hello World', '#9', ''][tick % 3], 'number.int': () => 42 });
  const result = notes(definition, 6, source);
  const names = result.notes.map(note => note.path);
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, 6);
  assert.ok(names.every(name => /^Fake Data\/Samples\/[a-z][a-z0-9-]*\.md$/.test(name)), names.join(' '));
  const first = result.notes[0].frontmatter;
  assert.equal(first.link, '[[link]]'); assert.equal(first.seq, 'ID-0001'); assert.equal(first.n, 3); assert.equal(first.flag, true);
  assert.equal(first.on, '2026-02-03'); assert.equal(first.at, '2026-01-02T03:04:05'); assert.deepEqual(first.fixed, ['a-b', 'tag-123', 'tag-empty']); assert.deepEqual(first.list, ['42']);
  assert.ok(result.notes.some(note => note.frontmatter.title === '{{name}} [[x]]|#^'), 'generated text is never re-expanded');
  assert.equal(renderBody('{{a}} and {{b}}', { a: ['x', 'y'], b: true }), 'x, y and true\n');
  assert.equal(renderBody('{{a}}\n', { a: '{{b}}', b: 'no' }), '{{b}}\n');
});

test('bounds, impossible uniqueness and wrong generator outputs fail closed', () => {
  const ok = entity([]);
  for (const count of [0, 1001, 1.5]) assert.throws(() => notes(ok, count, counting()), /between 1 and 1000/);
  assert.throws(() => notes(entity([{ key: 'k', type: 'text', generator: { choices: ['a', 'b'] }, unique: true }]), 3, counting()), /FAKE_DATA_UNIQUE|only 2 different/);
  assert.throws(() => notes(entity([{ key: 'k', type: 'number', generator: { faker: 'number.int' } }]), 1, counting()), /numeric generator/);
  assert.throws(() => notes(entity([{ key: 'k', type: 'checkbox', generator: { faker: 'datatype.boolean' } }]), 1, counting()), /yes\/no generator/);
  assert.throws(() => notes(entity([{ key: 'k', type: 'date', generator: { faker: 'date.past' } }]), 1, counting({ 'date.past': () => new Date(Number.NaN) })), /no date/);
  const odd = notes(entity([{ key: 'k', type: 'text', generator: { faker: 'lorem.word' } }]), 1, counting({ 'person.fullName': () => ({}), 'lorem.word': () => 'a\u0007\r\nb  c' })).notes[0];
  assert.deepEqual([odd.path, odd.frontmatter.k], ['Fake Data/Samples/sample-draft.md', 'a b c']);
  const body = notes(entity([{ key: 'k', type: 'text', generator: { faker: 'lorem.paragraphs' }, frontmatter: false }], { body: '{{k}}' }), 1, counting({ 'lorem.paragraphs': () => 'one\r\n\r\ntwo' })).notes[0];
  assert.deepEqual([body.body, Object.keys(body.frontmatter)], ['one\n\ntwo\n', ['name']]);
});

test('the Bases file is a table over the notes beside it, with labels as display names', () => {
  const definition = readFakeEntity(entity([{ key: 'my-key', type: 'text', generator: { value: 'v' } }, { key: 'hidden', type: 'text', generator: { value: 'v' }, frontmatter: false }]));
  assert.deepEqual(fakeBase(definition, 'Out'), { path: 'Out/sample.base', data: { filters: { and: ['file.folder == this.file.folder', 'file.ext == "md"'] },
    views: [{ type: 'table', name: 'Sample', order: ['file.name', 'note.name'] }] } });
  const labelled = readFakeEntity(entity([{ key: 'age', label: 'Age', type: 'number', generator: { value: 1 } }]));
  assert.deepEqual(parse(renderBase(fakeBase(labelled, 'Out'))).properties, { 'note.age': { displayName: 'Age' } });
});

test('generation configs and entity references validate fail-closed', () => {
  const config = { schemaVersion: 1, id: 'demo', title: 'Demo', entity: 'contact', count: 5, out: 'Fake Data/Demo', seed: 3 };
  assert.deepEqual(readFakeGeneration(config), { ...config, base: false, referenceDate: '2026-01-01' });
  assert.equal(readFakeGeneration({ ...config, description: 'd', base: true }).description, 'd');
  for (const [value, pattern] of [[{ ...config, schemaVersion: 2 }, /schemaVersion/], [{ ...config, id: 'Demo' }, /kebab/], [{ ...config, base: 'yes' }, /base/],
    [{ ...config, count: 0 }, /count/], [{ ...config, seed: -1 }, /seed/], [{ ...config, referenceDate: '2026-13-01' }, /referenceDate/],
    [{ ...config, out: '/abs' }, /relative folder/], [{ ...config, entity: 'semantic:a b' }, /semantic/], [{ ...config, entity: 'file:x.txt' }, /file:/],
    [{ ...config, entity: 'file:../x.json' }, /relative folder/], [{ ...config, entity: 'Contact' }, /entity id/], [{ ...config, hook: 'x' }, /Unknown fields/]])
    assert.throws(() => readFakeGeneration(value), pattern, JSON.stringify(value));
  assert.deepEqual([readEntityRef('semantic:er-entity-1'), readEntityRef('file:fixtures/e.json')], ['semantic:er-entity-1', 'file:fixtures/e.json']);
  assert.deepEqual([fakeCount(1000), fakeSeed(0), fakeReferenceDate(undefined)], [1000, 0, '2026-01-01']);
  assert.equal(JSON.parse(fakeGenerationJson(readFakeGeneration(config))).$schema, '../../schemas/fake-data-generation.schema.json');
});

test('semantic project entities become generator-ready definitions by type and key name', () => {
  const inferred = inferFakeEntity({ id: 'er-entity-1', slug: 'client', name: 'Client', folder: 'Clients', properties: [
    { key: 'email', type: 'text', required: false }, { key: 'full_name', type: 'text', required: true }, { key: 'city', type: 'text', required: false },
    { key: 'company', type: 'text', required: false }, { key: 'subject', type: 'text', required: false }, { key: 'bio', type: 'text', required: false },
    { key: 'misc', type: 'text', required: false }, { key: 'score', type: 'number', required: true }, { key: 'active', type: 'checkbox', required: false },
    { key: 'since', type: 'date', required: false }, { key: 'seen', type: 'datetime', required: false }, { key: 'labels', type: 'tags', required: false },
    { key: 'items', type: 'list', required: false }] });
  assert.equal(inferred.id, 'client'); assert.equal(inferred.titleProperty, 'full_name'); assert.equal(inferred.folder, 'Clients');
  assert.deepEqual(inferred.properties.map(item => item.generator.faker), ['internet.exampleEmail', 'person.fullName', 'location.city', 'company.name', 'lorem.sentence',
    'lorem.sentence', 'lorem.words', 'number.int', 'datatype.boolean', 'date.past', 'date.recent', 'lorem.word', 'lorem.word']);
  const untitled = inferFakeEntity({ id: 'er-entity-2', slug: 'Bad Slug', name: 'Score card', folder: '../x', properties: [{ key: 'title', type: 'number', required: true }] });
  assert.deepEqual([untitled.id, untitled.folder, untitled.titleProperty, untitled.properties[0].key], ['score-card', 'Score card', 'note_title', 'note_title']);
  assert.equal(inferFakeEntity({ name: 'Bare', folder: '' }).titleProperty, 'title');
  assert.equal(inferFakeEntity({ name: 'Only optional text', properties: [{ key: 'note', type: 'text', required: false }] }).properties[0].required, true);
  assert.equal(inferFakeEntity({ name: '!!!', properties: [] }).folder, 'Fake Data');
});
