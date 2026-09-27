import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateAuthoringDocument, parseAuthoringDocument, migrateAuthoringDocument, authoringDesignKey } from '../../scripts/companion/authoring-contract.ts';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';

const path = new URL('../../docs/concepts/companion/companion-project.json', import.meta.url);
const original = JSON.parse(await readFile(path, 'utf8'));
const copy = () => structuredClone(original);
const upgraded = () => migrateAuthoringDocument(copy()).document;

test('v5 remains valid and migration to v6 is detached and lossless', () => {
  const input = copy(), before = structuredClone(input), result = migrateAuthoringDocument(input);
  assert.equal(validateAuthoringDocument(input), input);
  assert.equal(result.document.schemaVersion, 6); assert.equal(result.document.design.schema, 6);
  const back = structuredClone(result.document); back.schemaVersion = back.design.schema = 5;
  assert.deepEqual(back, before); assert.deepEqual(input, before);
  assert.equal(result.report.fromVersion, 5);
});
test('v6 routes and journeys reference canonical nodes without duplicating design data', () => {
  const d = upgraded(), edge = d.design.links.find(l => l.kind === 'navigate');
  d.design.sitemap = { schema: 1, routes: [{id:'route', surface:edge.from, path:'/work/:recordId'}], journeys: [
    { id: 'journey', name: 'Work', steps: [{id:'start',surface:edge.from,via:null},{id:'next',surface:edge.to,via:edge.id}] },
  ] };
  assert.deepEqual(parseAuthoringDocument(JSON.stringify(d)), d);
  assert.deepEqual(migrateAuthoringDocument(d).document, d);
  assert.equal(d.design.nodes.length, original.design.nodes.length);
});
test('v5 and unsupported versions never smuggle v6 fields through legacy validation', () => {
  const v5 = copy(); v5.design.sitemap = {schema:1,routes:[],journeys:[]};
  assert.throws(() => validateAuthoringDocument(v5));
  const future = upgraded(); future.schemaVersion = future.design.schema = 7;
  assert.throws(() => validateAuthoringDocument(future), /version/i);
  const mismatch = upgraded(); mismatch.design.schema = 5;
  assert.throws(() => validateAuthoringDocument(mismatch));
  assert.throws(() => validateCompanionDocument(upgraded()));
});
test('v6 still runs all existing visual, style, envelope and JSON safety checks', () => {
  const attacks = [d => d.extra = true, d => d.executable = true,
    d => d.settings.testsFolder = '../tests', d => d.design.visualDesigns.schema = 999,
    d => d.notes.push({bad:true}), d => d.design.sitemap = {schema:1,routes:[{id:'r',surface:'missing',path:'/x'}],journeys:[]}];
  for (const attack of attacks) { const d = upgraded(); attack(d); assert.throws(() => validateAuthoringDocument(d)); }
  assert.throws(() => parseAuthoringDocument('{"__proto__":{}}'));
});
test('legacy migration preserves its explicit loss report rather than inventing successful conversion', async () => {
  const d = JSON.parse(await readFile(new URL('../fixtures/companion/detail-v3.json', import.meta.url),'utf8'));
  const migrated = migrateAuthoringDocument(d);
  assert.equal(migrated.document.schemaVersion,6); assert.equal(migrated.report.fromVersion,3);
  assert.ok(migrated.report.legacy); assert.ok(migrated.report.legacy.droppedPositions >= 0);
  assert.equal('detailDesigns' in migrated.document.design,false);
});
test('import bounds apply to exact UTF-8 input including whitespace', () => {
  assert.throws(() => parseAuthoringDocument(' '.repeat(4_000_001)), /limit|bound|4 MB/i);
  assert.throws(() => parseAuthoringDocument('null'));
});

test('authoring design keys accept exactly the extensions in addition to retained subsystem names', () => {
  for (const key of ['nodes','links','visualDesigns','sitemap','features']) assert.equal(authoringDesignKey(key),true);
  for (const key of ['run','commands','__proto__','pages']) assert.equal(authoringDesignKey(key),false);
});
