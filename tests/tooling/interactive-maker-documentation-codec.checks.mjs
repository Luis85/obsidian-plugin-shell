const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { parseMarkdown, renderMarkdown, generatedSource } from '../../src/cli/documentation/adapters/markdown.ts';

// Drives the typed Markdown codec (src/cli/documentation/adapters/markdown.ts) through its refusal paths under the maker floors.
const header = (extra = '') => `---\ndoc_schema: 1\ntype: page\nid: node-1\nproject: demo\ntitle: Overview\nsurface_kind: view\n${extra}---\n`;
const dataBlock = (body = 'surface:\n  goal: a\n', info = 'yaml shell-data', fence = '```') => `${fence}${info}\n${body}${fence}\n`;
const page = (overrides = {}) => ({ type: 'page', id: 'node-1', project: 'demo', title: 'Overview', fields: { surface_kind: 'view' }, data: { surface: { goal: 'a' } }, ...overrides });
const generated = '<!-- shell:generated:start -->\nGenerated text\n<!-- shell:generated:end -->\n';
const fails = (source, code) => assert.throws(() => parseMarkdown(source, 'doc.md'), { code });

test('plain notes are skipped while typed frontmatter needs the current schema and a known type', () => {
  assert.equal(parseMarkdown('# Just a note\n'), null);
  assert.equal(parseMarkdown('---\ntitle: Note\ntags: [a]\n---\nBody\n'), null);
  const parsed = parseMarkdown('﻿' + header() + '\n' + dataBlock() + generated);
  assert.deepEqual(parsed.entity, page()); assert.equal(generatedSource(parsed), generated);
  assert.equal(generatedSource(parseMarkdown(header())), null);
  assert.deepEqual(parseMarkdown(header()).entity.data, {});
  fails('---\ndoc_schema: 1\ntype: page\n', 'DOCS_FRONTMATTER');
  fails('---\ndoc_schema: 2\ntype: page\n---\n', 'DOCS_VERSION');
  fails('---\ndoc_schema: 1\ntype: gadget\n---\n', 'DOCS_TYPE');
  fails(header('owner_id: node-2\n'), 'DOCS_FIELD');
  fails(header().replace('id: node-1', 'id: 5'), 'DOCS_FIELD');
  fails(header().replace('title: Overview\n', ''), 'DOCS_FIELD');
  fails('---\n' + 'x'.repeat(4_000_001) + '\n---\n', 'DOCS_LIMIT');
});

test('only core-schema YAML is accepted in frontmatter and shell-data', () => {
  fails(header('surface_kind: view\n'), 'DOCS_YAML');
  fails(header('custom: &anchor 1\nother: *anchor\n'), 'DOCS_YAML_ALIAS');
  fails(header('custom: !!str tagged\n'), 'DOCS_YAML_TAG');
  fails(header() + dataBlock('%YAML 1.2\n---\nsurface: {}\n'), 'DOCS_YAML_DIRECTIVE');
  fails(header() + dataBlock('surface:\n  size: .inf\n'), 'DOCS_NUMBER');
  let nested = 'leaf'; for (let level = 0; level < 82; level++) nested = `[${nested}]`;
  fails(header('custom: ' + nested + '\n'), 'DOCS_LIMIT');
});

test('fenced regions are parsed line by line so examples never become managed data', () => {
  const example = '````markdown\n' + dataBlock('surface: {goal: ignored}\n') + '````\n';
  assert.deepEqual(parseMarkdown(header() + example + dataBlock()).entity.data, { surface: { goal: 'a' } });
  assert.deepEqual(parseMarkdown(header() + '~~~\n```yaml shell-data\n~~~\n').entity.data, {});
  assert.deepEqual(parseMarkdown(header() + '```js `inline`\n' + dataBlock()).entity.data, { surface: { goal: 'a' } });
  assert.deepEqual(parseMarkdown(header() + dataBlock('{"surface": {"goal": "j"}}\n', 'json shell-data', '~~~')).entity.data, { surface: { goal: 'j' } });
  fails(header() + dataBlock('{"surface": }\n', 'json shell-data'), 'DOCS_JSON');
  fails(header() + dataBlock() + dataBlock(), 'DOCS_DATA_DUPLICATE');
  fails(header() + dataBlock('surface: {}\n', 'yaml shell-data extra'), 'DOCS_DATA_FENCE');
  fails(header() + '```yaml shell-data\nsurface: {}\n', 'DOCS_MARKERS');
  fails(header() + generated + generated, 'DOCS_MARKERS');
  fails(header() + '<!-- shell:generated:end -->\n', 'DOCS_MARKERS');
  fails(header() + '<!-- shell:generated:start -->\n', 'DOCS_MARKERS');
  fails(header() + '<!-- shell:generated:start -->\n' + dataBlock() + '<!-- shell:generated:end -->\n', 'DOCS_MARKERS');
});

test('new documents render a reviewed draft that parses back to the same entity', () => {
  const source = renderMarkdown(page({ title: 'A [linked] <title>' }), undefined, generated);
  assert.match(source, /^---\ndoc_schema: 1\n/); assert.match(source, /# A linked title\n/); assert.ok(source.endsWith('\n' + generated));
  assert.deepEqual(parseMarkdown(source).entity, page({ title: 'A [linked] <title>' }));
  assert.ok(!renderMarkdown(page()).includes('shell:generated'));
});

test('rendering an existing document rewrites only managed spans and keeps authored bytes', () => {
  const original = parseMarkdown(header('visual_id: vp-1\ncustom: keep # comment\n') + '\nProse stays.\n' + dataBlock() + generated);
  assert.equal(renderMarkdown(original.entity, original), original.source);
  const next = page({ title: 'Renamed', fields: { surface_kind: 'modal' }, data: { surface: { goal: 'b' } } });
  const source = renderMarkdown(next, original, '<!-- shell:generated:start -->\nNew\n<!-- shell:generated:end -->\n');
  assert.match(source, /title: "Renamed"/); assert.match(source, /surface_kind: "modal"/); assert.ok(!source.includes('visual_id'));
  assert.match(source, /custom: keep # comment/); assert.match(source, /Prose stays\./); assert.match(source, /New\n/);
  assert.deepEqual(parseMarkdown(source).entity, next);
  const appended = renderMarkdown(page({ fields: { surface_kind: 'view', visual_id: 'vp-2' } }), parseMarkdown(header() + 'Body\n'));
  assert.match(appended, /visual_id: "vp-2"\n---\n/); assert.match(appended, /Body\n\n```yaml shell-data\nsurface:\n {2}goal: a\n```\n$/);
  const crlf = parseMarkdown(header().replace(/\n/g, '\r\n') + dataBlock().replace(/\n/g, '\r\n'));
  const crlfOut = renderMarkdown(page({ data: { surface: { goal: 'c' } } }), crlf);
  assert.ok(!/[^\r]\n/.test(crlfOut)); assert.equal(parseMarkdown(crlfOut).entity.data.surface.goal, 'c');
  assert.equal(renderMarkdown(page(), parseMarkdown(header() + dataBlock()), generated), header() + dataBlock());
});

test('route titles stay authored while their managed path is rewritten', () => {
  const route = '---\ndoc_schema: 1\ntype: route\nid: route-1\nproject: demo\ntitle: Home route\nsurface_id: node-1\npath: /home\n---\n';
  const parsed = parseMarkdown(route);
  assert.equal(parsed.entity.title, '/home');
  const source = renderMarkdown({ ...parsed.entity, title: '/start', fields: { surface_id: 'node-1', path: '/start' } }, parsed);
  assert.match(source, /title: Home route/); assert.match(source, /path: "\/start"/);
});
