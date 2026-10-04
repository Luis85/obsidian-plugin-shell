import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAuthoringDocument, parseAuthoringDocument, authoringDesignKey, validateCompanionFolders, companionRelativeFolder } from '../../scripts/companion/authoring-contract.ts';
import { selfProject, companionStarterIds, starterDocument } from '../support/starter-documents.mjs';
import { retiredProjectText } from '../support/retired-projects.mjs';

const original = selfProject();
const copy = () => structuredClone(original);
const retired = /only schema 6 is supported\. Earlier formats are not migrated/;

test('every Companion starter is a valid project v6 document and validation never rewrites it', () => {
  for (const id of companionStarterIds()) {
    const input = starterDocument(id), before = structuredClone(input);
    assert.equal(validateAuthoringDocument(input), input, id);
    assert.deepEqual(input, before, id);
    assert.equal(input.schemaVersion, 6); assert.equal(input.design.schema, 6);
  }
});
test('v6 routes and journeys reference canonical nodes without duplicating design data', () => {
  const d = copy(), edge = d.design.links.find(l => l.kind === 'navigate');
  d.design.sitemap = { schema: 1, routes: [{id:'route', surface:edge.from, path:'/work/:recordId'}], journeys: [
    { id: 'journey', name: 'Work', steps: [{id:'start',surface:edge.from,via:null},{id:'next',surface:edge.to,via:edge.id}] },
  ] };
  assert.deepEqual(parseAuthoringDocument(JSON.stringify(d)), d);
  assert.equal(d.design.nodes.length, original.design.nodes.length);
});
test('schema versions 1 to 5 are rejected with an explicit no-migration diagnostic', () => {
  for (const version of [1, 2, 3, 4, 5]) {
    const d = copy(); d.schemaVersion = version; d.design.schema = version;
    assert.throws(() => validateAuthoringDocument(d), error => error.code === 'COMPANION_VERSION' && retired.test(error.message) &&
      error.message.includes('schemaVersion ' + version), 'version ' + version);
  }
});
test('retired v1 to v5 project exports (including detail and visual stores) are rejected, never migrated', () => {
  for (const version of [1, 2, 3, 4, 5]) {
    assert.throws(() => parseAuthoringDocument(retiredProjectText(version)), error => error.code === 'COMPANION_VERSION' && retired.test(error.message), 'version ' + version);
  }
});
test('future, missing or mismatched versions and retired detail designs never pass', () => {
  const future = copy(); future.schemaVersion = future.design.schema = 7;
  assert.throws(() => validateAuthoringDocument(future), /schemaVersion 7/);
  const missing = copy(); delete missing.schemaVersion;
  assert.throws(() => validateAuthoringDocument(missing), /schemaVersion undefined/);
  const mismatch = copy(); mismatch.design.schema = 5;
  assert.throws(() => validateAuthoringDocument(mismatch), /Transfer and design schema versions must match/);
  const detail = copy(); detail.design.detailDesigns = { schema: 2, nextId: 1, documents: [], revisions: [] };
  assert.throws(() => validateAuthoringDocument(detail), /COMPANION_INVALID: Unsupported design envelope/);
  const kind = copy(); kind.kind = 'jev-workspace';
  assert.throws(() => validateAuthoringDocument(kind), /COMPANION_INVALID: Unsupported companion format/);
});
test('v6 runs all visual, style, envelope and JSON safety checks', () => {
  const attacks = [d => d.extra = true, d => d.executable = true,
    d => d.settings.testsFolder = '../tests', d => d.design.visualDesigns.schema = 999,
    d => d.notes.push({bad:true}), d => d.design.sitemap = {schema:1,routes:[{id:'r',surface:'missing',path:'/x'}],journeys:[]},
    d => d.project.id = 'Not Portable', d => d.design.nextId = 0, d => d.design.platform = 'watch',
    d => d.design.nodes.push(structuredClone(d.design.nodes[0])), d => { d.design.designSystem.colors[0].light = 'red;body{}'; },
    d => { d.design.storymaps = { schema: 1, nextId: 1, maps: [], eval: true }; },
    d => { d.design.nativeIntegrations = { schemaVersion: 2, fileTypes: [], contextMenus: [] }; }, d => { d.tooling = { run: true }; }];
  for (const [index, attack] of attacks.entries()) { const d = copy(); attack(d); assert.throws(() => validateAuthoringDocument(d), 'attack ' + index); }
  assert.throws(() => parseAuthoringDocument('{"__proto__":{}}'));
});
test('import bounds apply to exact UTF-8 input including whitespace', () => {
  assert.throws(() => parseAuthoringDocument(' '.repeat(4_000_001)), /limit|bound|4 MB/i);
  assert.throws(() => parseAuthoringDocument('null'));
});
test('folders are portable, contained and non-overlapping', () => {
  assert.deepEqual(validateCompanionFolders({ codebaseFolder: 'product/code', testsFolder: 'product/specs' }), { codebaseFolder: 'product/code', testsFolder: 'product/specs' });
  for (const settings of [{ codebaseFolder: 'src', testsFolder: 'src/tests' }, { codebaseFolder: 'src', testsFolder: 'src' }, { codebaseFolder: '.obsidian', testsFolder: 'tests' }, { codebaseFolder: 'src' }])
    assert.throws(() => validateCompanionFolders(settings), /COMPANION_INVALID/);
  assert.equal(companionRelativeFolder('.', true), true); assert.equal(companionRelativeFolder('.'), false);
  for (const value of ['con', 'a/../b', 'trailing.', 'node_modules', 42]) assert.equal(companionRelativeFolder(value), false, String(value));
});
test('authoring design keys accept exactly the current subsystems and extensions', () => {
  for (const key of ['nodes','links','visualDesigns','sitemap','features','editors','nativeIntegrations']) assert.equal(authoringDesignKey(key),true);
  for (const key of ['run','commands','__proto__','pages','detailDesigns']) assert.equal(authoringDesignKey(key),false);
});
