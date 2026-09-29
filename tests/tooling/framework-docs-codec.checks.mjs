import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { projectEntities } from '../../scripts/application-docs/adapters/model.ts';
import { parseMarkdown, renderMarkdown, generatedSource } from '../../scripts/application-docs/adapters/markdown.ts';
const page = () => projectEntities(projectFixture().project).find(entity => entity.type === 'page');
const header = '---\ndoc_schema: 1\ntype: page\nid: node-1\nproject: documentation-demo\ntitle: Overview\n---\n';
test('every real projected type survives YAML serialization and parsing', () => {
  for (const entity of projectEntities(projectFixture().project)) {
    const source = renderMarkdown(entity), parsed = parseMarkdown(source);
    assert.deepEqual(parsed.entity, entity); assert.equal(renderMarkdown(entity, parsed), source);
  }
});
test('BOM, CRLF, Unicode prose, custom properties and comments survive managed edits', () => {
  const entity = page(), original = '\ufeff' + renderMarkdown(entity).replace('title: Overview', 'title: Overview # keep this comment\ncustom_owner: "José Müller" # keep custom\ncustom_notes: |\n  A multiline note.').replace(/\n/g, '\r\n') + '\r\n## Rationale\r\nÜberblick – 日本語.\r\n';
  const parsed = parseMarkdown(original), changed = { ...entity, title: 'New: title' };
  assert.equal(renderMarkdown(entity, parsed), original);
  const output = renderMarkdown(changed, parsed);
  assert.equal(output[0], '\ufeff'); assert.ok(output.includes('# keep this comment\r\n'));
  assert.ok(output.includes('custom_owner: "José Müller" # keep custom\r\ncustom_notes: |\r\n  A multiline note.'));
  assert.ok(output.endsWith('## Rationale\r\nÜberblick – 日本語.\r\n'));
  assert.equal(parseMarkdown(output).entity.title, 'New: title');
});
test('ordinary notes are skipped but declared unsupported schemas/types fail', () => {
  assert.equal(parseMarkdown('# Ordinary note\n'), null);
  assert.equal(parseMarkdown('---\nowner: Example\n---\n# Note\n'), null);
  assert.throws(() => parseMarkdown(header.replace('doc_schema: 1', 'doc_schema: 999')), /DOCS_VERSION/);
  assert.throws(() => parseMarkdown(header.replace('type: page', 'type: execute')), /DOCS_TYPE/);
  assert.throws(() => parseMarkdown(header.replace('doc_schema: 1\n', '')), /DOCS_VERSION/);
});
for (const [label, text] of [
  ['duplicate keys', 'title: Other\n'], ['explicit tag', 'unsafe: !!str text\n'], ['anchor', 'unsafe: &a [one]\n'],
  ['alias', 'unsafe: *a\n'], ['prototype key', '__proto__: {}\n'], ['constructor key', 'constructor: {}\n'],
  ['non-string identity', 'id: 123\n'],
]) test('reject ' + label + ' without executing or silently coercing data', () => {
  const source = label === 'non-string identity' ? header.replace('id: node-1\n', text) : header.replace('\n---\n', '\n' + text + '---\n');
  assert.throws(() => parseMarkdown(source), /DOCS_/);
});
test('only an explicit shell-data fence is data; nested examples and arbitrary code remain prose', () => {
  const source = header + '\n```yaml\nordinary: example\n```\n\n````markdown\n```yaml shell-data\nthis: is-an-example\n```\n````\n';
  assert.deepEqual(parseMarkdown(source).entity.data, {});
  assert.equal(renderMarkdown(parseMarkdown(source).entity, parseMarkdown(source)), source);
});
for (const [label, body] of [
  ['unclosed block', '```yaml shell-data\nsurface: {}\n'],
  ['two data blocks', '```yaml shell-data\nsurface: {}\n```\n```yaml shell-data\nsurface: {}\n```\n'],
  ['malformed marker', '<!-- shell:generated:end -->\n'],
  ['overlapping regions', '<!-- shell:generated:start -->\n```yaml shell-data\nsurface: {}\n```\n<!-- shell:generated:end -->\n'],
  ['invalid JSON', '```json shell-data\nsurface: {}\n```\n'],
  ['duplicate JSON keys', '```json shell-data\n{"surface":{},"surface":{}}\n```\n'],
  ['unknown structured property', '```yaml shell-data\nrun: dangerous\n```\n'],
]) test('reject ' + label, () => assert.throws(() => parseMarkdown(header + body), /DOCS_/));
test('valid JSON payload and tilde fences are accepted', () => {
  assert.deepEqual(parseMarkdown(header + '~~~json shell-data\n{"surface":{"goal":"Explain"}}\n~~~\n').entity.data, { surface: { goal: 'Explain' } });
});
test('adding structured values does not change authored prose or code', () => {
  const source = header + '\n# Free authored title\n\n```js\nthrow new Error("example only");\n```\n';
  const parsed = parseMarkdown(source), output = renderMarkdown({ ...parsed.entity, data: { surface: { goal: 'Explain' } } }, parsed);
  assert.ok(output.startsWith(source)); assert.equal(parseMarkdown(output).entity.data.surface.goal, 'Explain');
});
test('managed properties belonging to a different type are not silently treated as metadata', () => {
  assert.throws(() => parseMarkdown(header.replace('title: Overview', 'title: Overview\nsource_node_id: vn-1')), /DOCS_FIELD/);
});
test('generated-region bytes are available separately from authored prose', () => {
  const region = '<!-- shell:generated:start -->\nGenerated text\n<!-- shell:generated:end -->\n';
  assert.equal(generatedSource(parseMarkdown(header + '\nAuthored.\n' + region)), region);
});
test('deep and oversized input is bounded', () => {
  assert.throws(() => parseMarkdown(header + 'x'.repeat(4_000_001)), /DOCS_LIMIT/);
  assert.throws(() => parseMarkdown(header + '```yaml shell-data\nsurface: ' + '['.repeat(90) + '0' + ']'.repeat(90) + '\n```\n'), /DOCS_LIMIT/);
});

test('route documents may retain an explanatory title without inventing a runtime route label',()=>{
  const source='---\ndoc_schema: 1\ntype: route\nid: route-1\nproject: demo\ntitle: Human route description\nsurface_id: node-1\npath: /before\n---\n\nMy explanation.\n';
  const parsed=parseMarkdown(source);assert.equal(parsed.entity.title,'/before');const next={...parsed.entity,title:'/after',fields:{...parsed.entity.fields,path:'/after'}};
  const output=renderMarkdown(next,parsed);assert.ok(output.includes('title: Human route description'));assert.equal(parseMarkdown(output).entity.fields.path,'/after');
});
