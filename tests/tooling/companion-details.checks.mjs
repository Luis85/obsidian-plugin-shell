import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { emptyDetailDesigns, validateDetailDesigns, DETAIL_NODE_KINDS, DETAIL_STATES } from '../../scripts/companion/detail-contract.mjs';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
const seed = JSON.parse(await readFile('docs/concepts/companion/companion-project.json', 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({ emptyDetailDesigns, validateDetailDesigns, DETAIL_NODE_KINDS, DETAIL_STATES });
vm.runInContext(await readFile('docs/concepts/companion/src/detail-model.js', 'utf8'), context);
const fixture = () => copy(seed.design.detailDesigns);
test('v3 self-project includes page and component designs with bounded stable identities', () => {
  assert.equal(seed.schemaVersion, 3); assert.equal(seed.design.schema, 3);
  const store = validateDetailDesigns(fixture());
  assert.deepEqual(store.documents.map(d => d.kind), ['component', 'page', 'page']);
  assert.ok(store.documents.some(d => d.nodes.some(n => n.binding)));
  assert.ok(store.documents.some(d => d.nodes.some(n => n.component)));
  assert.equal(validateCompanionDocument(seed), seed);
  assert.deepEqual(validateDetailDesigns(emptyDetailDesigns()).documents, []);
});
for (const [name, change] of [
  ['future schema', s => s.schema = 2], ['reused counter', s => s.nextId = 1], ['unsafe counter', s => s.nextId = Number.MAX_SAFE_INTEGER],
  ['unknown store field', s => s.executed = true], ['duplicate owner', s => { const d = copy(s.documents[0]); d.id = 'detail-document-' + s.nextId++; s.documents.push(d); }],
  ['duplicate node ID', s => s.documents[0].nodes[1].id = s.documents[0].nodes[0].id],
  ['unknown kind', s => s.documents[0].nodes[1].kind = 'javascript'], ['empty label', s => s.documents[0].nodes[1].label = '  '],
  ['multiline label', s => s.documents[0].nodes[1].label = 'bad\nlabel'], ['oversized text', s => s.documents[0].nodes[1].text = 'x'.repeat(8001)],
  ['infinite position', s => s.documents[0].nodes[1].position.x = Infinity], ['foreign renderer field', s => s.documents[0].nodes[1].selected = true],
  ['too small dimensions', s => s.documents[0].nodes[1].size.width = 0], ['unknown layout', s => s.documents[0].nodes[0].layout = 'script'],
  ['absent parent', s => s.documents[0].nodes[1].parentId = 'missing'], ['non-region parent', s => s.documents[0].nodes[3].parentId = s.documents[0].nodes[1].id],
  ['cyclic parent', s => s.documents[0].nodes[0].parentId = s.documents[0].nodes[0].id], ['empty states', s => s.documents[0].nodes[1].visibleIn = []],
  ['unknown state', s => s.documents[0].nodes[1].visibleIn = ['accepted']], ['duplicate state', s => s.documents[0].nodes[1].visibleIn = ['default', 'default']],
  ['executable prop', s => s.documents[1].nodes.find(n => n.component).props = { run: {} }],
  ['unsafe prop key', s => s.documents[1].nodes.find(n => n.component).props = JSON.parse('{"constructor":"bad"}')],
  ['unbounded version', s => s.documents[1].nodes.find(n => n.component).component.version = '1'.repeat(50) + '.0.0'],
  ['props on primitive', s => s.documents[0].nodes[1].props = { title: 'bad' }], ['no component reference', s => s.documents[1].nodes.find(n => n.component).component = null],
  ['unknown binding field', s => s.documents[2].nodes.find(n => n.binding).binding.expression = 'run()'],
  ['dangling interaction', s => s.documents[0].edges[0].target = 'missing'], ['self interaction', s => s.documents[0].edges[0].target = s.documents[0].edges[0].source],
  ['duplicate interaction', s => { const e = copy(s.documents[0].edges[0]); e.id = 'detail-edge-' + s.nextId++; s.documents[0].edges.push(e); }],
  ['unsafe trigger', s => s.documents[0].edges[0].event = 'click();alert(1)'], ['too many designs', s => s.documents = Array(201).fill(s.documents[0])],
]) test('rejects ' + name, () => { const s = fixture(); validateDetailDesigns(s); change(s); assert.throws(() => validateDetailDesigns(s), /DETAIL_INVALID/); });
test('direct and transitive component composition cycles are rejected', () => {
  const s = emptyDetailDesigns(), a = context.dtNewDocument(s, 'component', { id: 'a', name: 'A' }), b = context.dtNewDocument(s, 'component', { id: 'b', name: 'B' });
  const ref = id => ({ id, name: id.toUpperCase(), version: '1.0.0' });
  a.nodes.push(context.dtNewNode(s, 'component', null, ref('b'))); validateDetailDesigns(s);
  b.nodes.push(context.dtNewNode(s, 'component', null, ref('a'))); assert.throws(() => validateDetailDesigns(s), /recursive/);
  b.nodes = []; a.nodes[0].component.id = 'a'; assert.throws(() => validateDetailDesigns(s), /recursive/);
});
test('eight containment levels are supported and a ninth is rejected', () => {
  const s = emptyDetailDesigns(), d = context.dtNewDocument(s, 'page', { id: 'p', label: 'Page' }); let parent = null;
  for (let i = 0; i < 8; i++) { const n = context.dtNewNode(s, 'region', parent); d.nodes.push(n); parent = n.id; }
  validateDetailDesigns(s); d.nodes.push(context.dtNewNode(s, 'text', parent)); assert.throws(() => validateDetailDesigns(s), /eight levels/);
});
test('geometry and identity counters do not affect semantic intent; order and content do', () => {
  const a = fixture(), b = copy(a); b.nextId += 99; b.documents[0].nodes[0].position.x += 200; b.documents[0].nodes[0].size.width += 50;
  assert.deepEqual(copy(context.dtSemantic(a)), copy(context.dtSemantic(b)));
  context.dtMoveInOrder(b.documents[0], b.documents[0].nodes[2].id, -1);
  assert.notDeepEqual(copy(context.dtSemantic(a)), copy(context.dtSemantic(b)));
  const c = copy(a); c.documents[0].nodes[1].text += '!'; assert.notDeepEqual(copy(context.dtSemantic(a)), copy(context.dtSemantic(c)));
});
test('duplicate subtree remaps internal identities and arrows, retaining shared references', () => {
  const s = fixture(), d = s.documents[1], old = copy(d), newId = context.dtDuplicateNode(s, d, d.nodes[0].id);
  validateDetailDesigns(s); const ids = new Set(old.nodes.map(n => n.id));
  assert.ok(!ids.has(newId)); assert.equal(d.nodes.length, old.nodes.length * 2); assert.equal(d.edges.length, old.edges.length * 2);
  const clones = d.nodes.filter(n => !ids.has(n.id)); assert.ok(clones.every(n => !n.parentId || !ids.has(n.parentId)));
  assert.deepEqual(copy(clones.find(n => n.component).component), old.nodes.find(n => n.component).component);
  assert.ok(d.edges.slice(old.edges.length).every(e => !ids.has(e.source) && !ids.has(e.target)));
});
test('deleting a region cascades only inside its detail document', () => {
  const s = fixture(), other = JSON.stringify(s.documents[0]), d = s.documents[1]; context.dtRemoveNode(d, d.nodes[0].id);
  assert.deepEqual(d.nodes, []); assert.deepEqual(d.edges, []); assert.equal(JSON.stringify(s.documents[0]), other); validateDetailDesigns(s);
});
test('external missing references remain portable while internal broken references fail', () => {
  const s = fixture(); s.documents[1].ownerId = 'missing-page'; s.documents[1].nodes.find(n => n.component).component.id = 'missing-component';
  s.documents[2].nodes.find(n => n.binding).binding.sourceId = 'missing-source'; s.documents[2].edges[0].targetSurfaceId = 'missing-page';
  const doc = copy(seed); doc.design.detailDesigns = s; assert.equal(validateCompanionDocument(doc), doc);
});
test('legacy v1 and v2 imports remain valid; old envelopes cannot conceal detail designs', () => {
  for (const version of [1, 2]) {
    const d = copy(seed); d.schemaVersion = version; d.design.schema = version; delete d.design.detailDesigns; if (version === 1) delete d.design.storymaps;
    validateCompanionDocument(d); d.design.detailDesigns = fixture(); assert.throws(() => validateCompanionDocument(d), /version 3/);
  }
  const mismatch = copy(seed); mismatch.design.schema = 2; assert.throws(() => validateCompanionDocument(mismatch), /versions must match/);
});
test('real CLI returns exact v3 bytes; malformed detail data produces no output and no writes', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'detail-contract-'));
  try {
    const input = join(vault, 'project.json'), text = JSON.stringify(seed, null, 2) + '\r\n'; await writeFile(input, text);
    const run = () => spawnSync(process.execPath, ['scripts/companion/generate.mjs', '--input', input, '--vault', vault, '--target', 'new-plugin'], { encoding: 'utf8' });
    let result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, text); assert.deepEqual(await readdir(vault), ['project.json']);
    const invalid = copy(seed); invalid.design.detailDesigns.documents[0].nodes[0].parentId = 'missing'; await writeFile(input, JSON.stringify(invalid)); result = run();
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /DETAIL_INVALID/); assert.deepEqual(await readdir(vault), ['project.json']);
  } finally { await rm(vault, { recursive: true, force: true }); }
});

// Exercise production authoring helpers directly; only environment globals are supplied.
for (const module of ['product-model', 'component-variants', 'detail-properties', 'detail-navigation', 'detail-review', 'detail-handoff']) {
  vm.runInContext(await readFile('docs/concepts/companion/src/' + module + '.js', 'utf8'), context);
}
vm.runInContext(await readFile('docs/concepts/companion/src/semantic-model.js', 'utf8'), context);
test('property provenance retains false, zero and empty text as explicit local overrides', () => {
  const d = copy(seed.design), c = d.library[0]; c.props = 'title:string\nbusy:boolean\ncount:number';
  c.variantSpecs = [{ id: 'default', name: 'Default', props: { title: 'Default title', busy: true, count: 10 } }];
  const n = { component: { id: c.id, version: c.version, variantId: 'default' }, props: { title: '', busy: false, count: 0 } };
  const before = JSON.stringify(d), rows = copy(context.dtPropRows(n, d));
  assert.deepEqual(rows.map(r => r.value), ['', false, 0]); assert.ok(rows.every(r => r.source === 'Local override'));
  assert.equal(JSON.stringify(d), before);
});
test('mismatched pins and missing variants never borrow current defaults', () => {
  const d = copy(seed.design), c = d.library[0]; c.props = 'title:string'; c.variantSpecs = [{ id: 'default', props: { title: 'Current default' } }];
  const n = { component: { id: c.id, version: '0.0.0', variantId: 'default' }, props: {} };
  assert.equal(context.dtPropRows(n, d)[0].value, undefined);
  n.component.version = c.version; n.component.variantId = 'missing'; assert.equal(context.dtPropRows(n, d)[0].source, 'Not set');
  n.component.variantId = 'default'; assert.equal(context.dtPropRows(n, d)[0].source, 'Variant default');
});
test('undeclared local props remain identifiable and repairable instead of being dropped', () => {
  const d = copy(seed.design), c = d.library[0], n = { component: { id: c.id, version: c.version, variantId: 'default' }, props: { obsolete: 'Retain me' } };
  c.variantSpecs = [{ id: 'default', props: {} }];
  const row = context.dtPropRows(n, d).find(p => p.name === 'obsolete'); assert.equal(row.value, 'Retain me'); assert.equal(row.compatible, false);
});
for (const invalid of ['null', '[]', '{"x":{}}', '{"x":null}', '{"x":1e999}', '{"__proto__":true}', '{"constructor":true}', '(()=>1)()']) {
  test('typed draft parser refuses unsafe or nonliteral input ' + invalid, () => assert.throws(() => context.dtLiteralProps(invalid)));
}
test('outline search retains ancestor context, excludes siblings and mutates no source', () => {
  const doc = fixture().documents[1], leaf = doc.nodes.find(n => n.kind !== 'region'), before = JSON.stringify(doc);
  leaf.label = 'Unique target'; const input = JSON.stringify(doc), matched = context.dtOutlineMatches(doc, ' unique TARGET ');
  assert.ok(matched.has(leaf.id)); if (leaf.parentId) assert.ok(matched.has(leaf.parentId));
  assert.equal(context.dtOutlineMatches(doc, 'no-match-983').size, 0); assert.equal(context.dtOutlineMatches(doc, '').size, doc.nodes.length);
  assert.equal(JSON.stringify(doc), input); assert.notEqual(before, input);
});
test('state review respects hidden ancestors even when a child declares that state', () => {
  const doc = fixture().documents[1], root = doc.nodes.find(n => n.parentId === null); root.visibleIn = ['default'];
  assert.equal(context.dtVisibleIds(doc, 'error').size, 0); assert.ok(context.dtVisibleIds(doc, 'default').size > 0);
});
test('review findings identify exact node and edge even with duplicate document labels', () => {
  const d = copy(seed.design), doc = d.detailDesigns.documents[1], node = doc.nodes.find(n => n.component);
  node.component.id = 'missing'; doc.edges[0].targetSurfaceId = 'missing-page';
  const issues = context.dtReviewItems(doc, d);
  assert.ok(issues.some(i => i.documentId === doc.id && i.target === 'node/' + node.id));
  assert.ok(issues.some(i => i.target === 'edge/' + doc.edges[0].id && i.message.includes('navigation target missing')));
});
test('Markdown handoff is deterministic, read-only, escaped and excludes diagram coordinates', () => {
  const d = copy(seed.design); for (const c of d.library) c.variantSpecs ||= [{ id: 'default', props: {} }];
  const doc = d.detailDesigns.documents[1]; doc.notes = '<script>alert(1)</script> ![x](https://example.test/a)\n# forged heading';
  const before = JSON.stringify(d), brief = context.dtBrief(doc, d);
  assert.equal(brief, context.dtBrief(doc, d)); assert.equal(JSON.stringify(d), before);
  assert.ok(brief.includes('not implementation or executed-test evidence')); assert.ok(brief.includes(doc.nodes[0].id));
  assert.ok(!brief.includes('<script>')); assert.ok(!brief.includes('![x]')); assert.ok(!brief.includes('\n# forged'));
  for (const node of doc.nodes) { node.position = { x: 42222, y: 32222 }; node.size.width = 1400; }
  assert.equal(brief, context.dtBrief(doc, d));
});
