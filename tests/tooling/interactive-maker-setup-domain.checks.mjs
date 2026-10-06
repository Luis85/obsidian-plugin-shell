import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readSettings, defaultSettings, projectPath, settingsSchema } from '../../src/cli/domain/user-settings.ts';
import { typedPrd } from '../../src/cli/domain/prd-markdown.ts';
import { newDocument, documentText, openDocument } from '../../src/cli/domain/document.ts';
import { runOperations } from '../../src/cli/application/operations.ts';
import { sketchSchema } from '../../src/cli/application/schema.ts';
import { setupSchema } from '../../src/cli/application/setup-schema.ts';
const markdown = '---\ntype: prd\nid: PRD-001\ntitle: "A product"\nstatus: draft\n---\n# Scope\n\nOriginal content.\n';
const project = () => runOperations(newDocument('Example'), [{ op: 'page.add', title: 'Home', as: 'home' }, { op: 'page.add', title: 'Details', as: 'details' }]);
test('settings merge defaults and partial updates, preserve false, and reject unknown/future input', () => {
  const base = readSettings({ schemaVersion: 1 });
  assert.deepEqual(base, defaultSettings); assert.notEqual(base.paths, defaultSettings.paths);
  const next = readSettings({ schemaVersion: 1, paths: { app: 'products/client' }, preferences: { author: 'Alice', ui: 'plain', scanRecursive: false } }, base);
  assert.equal(next.paths.app, 'products/client'); assert.equal(next.paths.prds, 'docs/prds'); assert.equal(next.preferences.scanRecursive, false);
  assert.equal(readSettings({ schemaVersion: 1, preferences: { ui: 'tui' } }).preferences.ui, 'tui');
  for (const input of [null, [], {}, { schemaVersion: 2 }, { schemaVersion: 1, alien: true }, { schemaVersion: 1, paths: { unknown: 'x' } },
    { schemaVersion: 1, preferences: { unknown: true } }, { schemaVersion: 1, preferences: { ui: 'web' } },
    { schemaVersion: 1, preferences: { scanRecursive: 'false' } }, { schemaVersion: 1, preferences: { author: '' } }]) assert.throws(() => readSettings(input));
  assert.equal(settingsSchema.additionalProperties, false);
});
test('portable settings reject traversal, protected roots, reserved paths and path overlaps', () => {
  for (const path of ['/tmp/a', '../a', 'a/../b', './a', 'a//b', 'C:/x', 'a\\b', 'a/con.md', 'a/nul', 'a/a.', 'a/x ', 'a/*', '.git/a', '.obsidian/a', '.framework/a', 'NODE_MODULES/a', '.codex-authoring.lock/a', 'x/\x00']) assert.throws(() => projectPath(path));
  assert.equal(projectPath('docs/Überblick.md'), 'docs/Überblick.md');
  for (const paths of [{ app: 'docs' }, { app: 'DOCS/PRDS' }, { prototypes: 'apps/product/preview' }, { prds: 'configs' },
    { brief: 'project.config.json' }, { project: 'design/project.md' }, { brief: 'docs/brief.json' }]) assert.throws(() => readSettings({ schemaVersion: 1, paths }));
});
test('typed Markdown retains exact original bytes including BOM, CRLF, Unicode and unrelated frontmatter', () => {
  const original = '\uFEFF' + markdown.replaceAll('\n', '\r\n');
  const prd = typedPrd(original, 'one.md');
  assert.equal(prd.markdown, original); assert.equal(prd.id, 'PRD-001'); assert.equal(prd.title, 'A product'); assert.deepEqual(prd.requirements, []);
  assert.equal(typedPrd('---\ntype: PRD # note\ntitle: \'User\'\'s home\'\n---\nBody', 'My Product.md').id, 'my-product');
  assert.equal(typedPrd('---\ntype: "prd" # comment\n---\nBody', 'Überblick.md').title, 'Überblick');
  assert.equal(typedPrd('# Untyped', 'readme.md'), null);
  assert.equal(typedPrd('---\ntype: task\n---\nTask', 'task.md'), null);
  assert.equal(typedPrd('---\nid: Other\n---\nBody', 'other.md'), null);
});
test('malformed or oversized Markdown identity fails without evaluating YAML', () => {
  for (const body of ['---\ntype: prd', '---\ntype: prd\ntype: prd\n---', '---\ntype: prd\nid: ../escape\n---',
    '---\ntype: prd\ntitle: |\n  block\n---', '---\ntype: &x prd\n---', '---\ntype: *x\n---', '---\ntype: [prd]\n---',
    '---\ntype: prd\ntitle: "unterminated\n---', '---\ntype: prd\ntitle: "bad\\q"\n---', "---\ntype: prd\ntitle: 'unterminated\n---",
    markdown + '\0', markdown + 'x'.repeat(250001)]) assert.throws(() => typedPrd(body, 'a.md'));
});
test('all setup bricks round-trip through the existing Companion envelope with stable references', () => {
  const start = project();
  const changed = runOperations(start.document, [
    { op: 'sitemap.group', title: 'Main', as: 'main' }, { op: 'sitemap.parent', page: start.aliases.home, parent: '@main' },
    { op: 'sitemap.route', page: start.aliases.home, path: '/' },
    { op: 'sitemap.link', from: start.aliases.home, to: start.aliases.details, title: 'Details', as: 'nav' },
    { op: 'journey.add', title: 'View details', pages: [start.aliases.home, start.aliases.details], as: 'journey' },
    { op: 'entity.add', title: 'Order', as: 'order' },
    { op: 'entity.properties', id: '@order', properties: [{ key: 'amount', type: 'number', required: true }, { key: 'paid', type: 'checkbox', required: false }] },
    { op: 'data-source.add', title: 'Orders service', kind: 'api', as: 'source' },
    { op: 'brick.rename', kind: 'entity', id: '@order', title: 'Purchase order' },
    { op: 'brick.rename', kind: 'data-source', id: '@source', title: 'Orders API' },
  ]);
  const loaded = openDocument(JSON.parse(documentText(changed.document)));
  assert.equal(loaded.design.nodes[0].parent, changed.aliases.main);
  assert.equal(loaded.design.sitemap.routes[0].path, '/');
  assert.equal(loaded.design.sitemap.journeys[0].steps[1].via, changed.aliases.nav);
  assert.equal(loaded.design.semantic.entities[0].name, 'Purchase order');
  assert.equal(loaded.design.semantic.entities[0].properties[1].required, false);
  assert.equal(loaded.design.dataSources.sources[0].name, 'Orders API');
  assert.deepEqual(loaded.design.dataSources.sources[0].operations, []);
  const relaxed = runOperations(loaded, [{ op: 'sitemap.parent', page: start.aliases.home, parent: null }, { op: 'journey.add', title: 'Unlinked', pages: [start.aliases.details, start.aliases.home] }]);
  assert.equal(relaxed.document.design.sitemap.journeys[1].steps[1].via, null);
  assert.equal(loaded.design.nodes[0].parent, changed.aliases.main);
});
test('brick mutations reject invalid IDs, types, routes, properties and cycles atomically', () => {
  const start = project(), source = runOperations(start.document, [{ op: 'entity.add', title: 'Order', as: 'e' }]);
  const before = documentText(source.document);
  const invalid = [
    { op: 'sitemap.route', page: 'missing', path: '/' }, { op: 'sitemap.route', page: start.aliases.home, path: 'javascript:x' },
    { op: 'sitemap.route', page: start.aliases.home, path: '/details' }, { op: 'sitemap.parent', page: start.aliases.home, parent: start.aliases.home },
    { op: 'sitemap.parent', page: start.aliases.home, parent: 'missing' }, { op: 'sitemap.link', from: 'missing', to: start.aliases.home, title: 'No' },
    { op: 'data-source.add', title: 'Bad', kind: 'executable' }, { op: 'journey.add', title: 'Bad', pages: [] },
    { op: 'journey.add', title: 'Bad', pages: ['missing'] }, { op: 'entity.properties', id: 'missing', properties: [] },
    { op: 'brick.rename', kind: 'page', id: start.aliases.home, title: 'No' }, { op: 'brick.rename', kind: 'entity', id: 'missing', title: 'No' },
    ...['id', 'type', 'constructor', 'prototype', '__proto__', 'bad key'].map(key => ({ op: 'entity.properties', id: source.aliases.e, properties: [{ key, type: 'text', required: true }] })),
    { op: 'entity.properties', id: source.aliases.e, properties: [{ key: 'name', type: 'expression', required: true }] },
    { op: 'entity.properties', id: source.aliases.e, properties: [{ key: 'name', type: 'text', required: 'true' }] },
    { op: 'entity.properties', id: source.aliases.e, properties: [{ key: 'name', type: 'text', required: true }, { key: 'name', type: 'text', required: false }] },
  ];
  for (const value of invalid) { assert.throws(() => runOperations(source.document, [value]), JSON.stringify(value)); assert.equal(documentText(source.document), before); }
  const operations = sketchSchema.properties.operations.items.oneOf;
  assert.ok(operations.some(item => item.properties.op.const === 'entity.add'));
  assert.equal(setupSchema.properties.operations, sketchSchema.properties.operations);
});
