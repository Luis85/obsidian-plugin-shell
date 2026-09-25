import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../scripts/companion/compiler/model.ts';
import { detailDocuments, componentMembers } from '../../scripts/companion/compiler/detail-model.ts';
import { projectFiles } from '../../scripts/companion/compiler/project-files.ts';
import { detailValue, detailTextValue, visibleDetails } from '../../scripts/companion/runtime/detail-runtime.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(await readFile(new URL('../../docs/concepts/companion/companion-project.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
const docs = d => detailDocuments(projectModel(d));
const review = d => d.design.library.find(c => c.id === 'project-json-review');
const instance = d => d.design.detailDesigns.documents[1].nodes.find(n => n.component);

test('current export compiles page/component detail documents without mutating authoring data', () => {
  const before = JSON.stringify(fixture); const result = docs(fixture);
  assert.equal(result.length, 3); assert.equal(result.filter(d => d.kind === 'page').length, 2);
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(Object.hasOwn(result[0].nodes[0], 'position'), false);
  assert.equal(Object.hasOwn(result[1].nodes.find(n => n.component).component, 'label'), false);
  assert.deepEqual(result[1].nodes.find(n => n.component).props, { title: 'Review imported project', busy: false });
});
test('typed component contract parsing never treats authored declarations as code', () => {
  assert.deepEqual(componentMembers(review(fixture)), { props: { title: 'string', busy: 'boolean' }, events: { select: 'string', cancel: 'undefined' }, slots: ['content'] });
  for (const props of ['title:process.exit()', 'title: string; import x from "x"', '__proto__:string', 'title:string\ntitle:string', 'title:void']) assert.throws(() => componentMembers({ props }), /Unsupported|Duplicate/);
});
test('explicit local false, zero and empty strings override variant defaults', () => {
  const d = clone(); review(d).props += '\ncount:number';
  review(d).variantSpecs = [{ id: 'default', name: 'Default', description: '', props: { title: 'Default', busy: true, count: 4 }, contentOverrides: {} }];
  instance(d).props = { title: '', busy: false, count: 0 };
  assert.deepEqual(docs(d)[1].nodes.find(n => n.component).props, { title: '', busy: false, count: 0 });
  instance(d).props = {};
  assert.deepEqual(docs(d)[1].nodes.find(n => n.component).props, { title: 'Default', busy: true, count: 4 });
});
for (const [name, change, expected] of [
  ['stale version', d => instance(d).component.version = '9.0.0', /stale component/],
  ['missing definition', d => instance(d).component.id = 'missing', /Missing detail component/],
  ['missing variant', d => instance(d).component.variantId = 'missing', /Missing detail variant/],
  ['undeclared prop', d => instance(d).props.unknown = false, /Invalid detail prop/],
  ['wrong prop type', d => instance(d).props.busy = 'false', /Invalid detail prop/],
  ['missing owner', d => d.design.detailDesigns.documents[1].ownerId = 'missing', /Missing detail owner/],
  ['missing navigation target', d => d.design.detailDesigns.documents[2].edges[0].targetSurfaceId = 'missing', /navigation target/],
  ['unknown bound field', d => d.design.detailDesigns.documents[2].nodes[1].binding.field = '0.missing', /binding field/],
  ['inherited bound property', d => d.design.detailDesigns.documents[2].nodes[1].binding.field = 'constructor.name', /binding field/],
  ['missing operation', d => d.design.detailDesigns.documents[2].nodes[1].binding.operationId = 'missing', /readable detail binding/],
  ['lifecycle event', d => d.design.detailDesigns.documents[1].edges[0].event = 'vue:mounted', /Unsupported detail event/],
  ['binding with no destination', d => d.design.detailDesigns.documents[2].nodes[0].binding = { ...d.design.detailDesigns.documents[2].nodes[1].binding }, /explicit text\/input projection/],
  ['disabled-only interaction', d => d.design.detailDesigns.documents[1].nodes[1].visibleIn = ['disabled'], /no enabled visible state/],
  ['undeclared slot', d => d.design.detailDesigns.documents[0].nodes[2].label = 'missing', /Undeclared component slot/],
]) test('detail compiler refuses ' + name, () => { const d = clone(); change(d); assert.throws(() => docs(d), expected); });

test('ambiguous event branching fails rather than choosing a destructive interpretation', () => {
  const d = clone(); const doc = d.design.detailDesigns.documents[1];
  doc.edges.push({ ...doc.edges[0], id: 'detail-edge-19', target: doc.nodes[3].id }); d.design.detailDesigns.nextId = 20;
  assert.throws(() => docs(d), /Ambiguous detail event/);
});
test('hidden ancestor suppresses descendants and recursive malformed runtime data fails closed', () => {
  const doc = docs(fixture)[1]; doc.nodes[0].visibleIn = ['default'];
  assert.equal(visibleDetails(doc, 'error').length, 0);
  assert.deepEqual(visibleDetails(doc, 'default').map(n => n.id), ['detail-node-8', 'detail-node-9', 'detail-node-10']);
  doc.nodes[0].parentId = doc.nodes[1].id; assert.equal(visibleDetails(doc, 'default').length, 0);
});
test('bound values are own-property data paths and never evaluated expressions', () => {
  assert.equal(detailValue([{ title: 'First' }], '0.title'), 'First');
  assert.equal(detailValue(Object.create({ inherited: 'no' }), 'inherited'), undefined);
  assert.equal(detailValue({ value: 0 }, 'value'), 0);
  assert.equal(detailValue({}, 'constructor'), undefined);
  assert.equal(detailValue({ name: 'safe' }, 'name.toUpperCase()'), undefined);
  assert.equal(detailTextValue(false, 'fallback'), 'false'); assert.equal(detailTextValue('', 'fallback'), '');
  assert.equal(detailTextValue(undefined, 'fallback'), 'fallback');
});
test('compiler emits layouts, slots, typed props, source adapters and traceable interaction tests', async () => {
  const entries = new Map((await projectFiles(root, projectModel(fixture))).map(e => [e.path, e.content]));
  const path = 'src/generated/';
  assert.match(entries.get(path + 'presentation/components/details/detail-document-7.vue'), /generated-region/);
  assert.match(entries.get(path + 'presentation/components/details/detail-document-7.vue'), /v-bind="spec.nodes\[2\]!.props"/);
  assert.match(entries.get(path + 'presentation/components/library/project-json-review.vue'), /<slot :name=/);
  assert.match(entries.get(path + 'domain/components/contracts/project-json-review.ts'), /"busy"\?: boolean/);
  assert.match(entries.get(path + 'bootstrap/detail-context.ts'), /defineGAuthoringVaultStore/);
  assert.match(entries.get(path + 'bootstrap/mount.ts'), /provideDetailContext\(app/);
  assert.match(entries.get(path + 'application/interactions/detail-edge-13.ts'), /NotImplementedError/);
  assert.match(entries.get('tests/project/details/detail-document-14.test.ts'), /toHaveBeenCalledWith\("node-17"\)/);
  assert.match(entries.get('tests/project/acceptance/detail-edge-13.test.ts'), /it.todo/);
  const trace = JSON.parse(entries.get('design/detail-traceability.json'));
  assert.equal(trace.documents.length, 3); assert.equal(trace.interactions.filter(e => e.verification === 'todo').length, 2);
});
test('custom folders keep all emitted detail imports relative and payload text inert', async () => {
  const d = clone(); d.settings = { codebaseFolder: 'product/code', testsFolder: 'product/specs' };
  d.design.detailDesigns.documents[1].nodes[1].text = '</script><script>throw Error("injected")</script>{{ dangerous() }}';
  const entries = new Map((await projectFiles(root, projectModel(d))).map(e => [e.path, e.content]));
  assert.ok(entries.has('product/code/generated/presentation/components/details/detail-document-7.vue'));
  const spec = entries.get('product/code/generated/domain/details/detail-document-7.ts'); assert.ok(!spec.includes('</script>')); assert.match(spec, /\\u003c/);
  assert.match(entries.get('product/specs/project/details/detail-document-7.test.ts'), /\.\.\/\.\.\/\.\.\/code\/generated/);
});

test('region and slot interactions retain native listener wiring', async () => {
  const d = clone(); const doc = d.design.detailDesigns.documents[0]; doc.edges[0].source = doc.nodes[0].id;
  const entries = new Map((await projectFiles(root, projectModel(d))).map(e => [e.path, e.content]));
  const component = entries.get('src/generated/presentation/components/library/project-json-review.vue');
  assert.match(component, /data-design-layout="stack"[^>]+v-on="model.listeners\('detail-node-2'\)"/);
  assert.match(component, /<div[^>]+v-on="model.listeners\('detail-node-4'\)"/);
});
