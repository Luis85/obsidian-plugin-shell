// Visual equivalents of the retired detail-compiler checks: contracts, variant defaults, refusals, visibility and data paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectModel } from '../compiler/emitters/model.ts';
import { visualSpecs, visualContractTypes, visualDefinitions } from '../compiler/emitters/visual-model.ts';
import { visualSfc } from '../compiler/emitters/visual-code.ts';
import { visualSources } from '../compiler/emitters/visual-ports.ts';
import { detailValue } from '../../../templates/companion/runtime/detail-actions.ts';
import { visualTextValue, visualIndex } from '../../../templates/companion/runtime/visual-runtime.ts';
import { visualSession, visualVisible } from '#shared/companion/visual/visual-session.mjs';
import { visualNodes } from '#shared/companion/visual/visual-ir.mjs';
const fixture = JSON.parse(await readFile(new URL('../../shared/testing/fixtures/companion/visual-project.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
const compile = d => { const m = projectModel(d), specs = visualSpecs(m); visualSources(m, specs); return specs; };
const lit = value => ({ kind: 'literal', value });
const store = d => d.design.visualDesigns;
const review = d => store(d).components[0];
const importPage = d => store(d).pages[0].root[0];
const libraryPage = d => store(d).pages[1].root[0];
const instance = d => importPage(d).children.find(n => n.id === 'vn-11');
const bound = d => libraryPage(d).children.find(n => n.id === 'vn-17');
const open = d => libraryPage(d).children.find(n => n.id === 'vn-18');
const confirm = d => review(d).template[0].children.find(n => n.id === 'vn-5');

test('migrated export compiles page/component definitions without mutating authoring data', () => {
  const before = JSON.stringify(fixture), specs = compile(fixture);
  assert.equal(specs.length, 3); assert.equal(specs.filter(s => s.kind === 'page').length, 2);
  assert.equal(JSON.stringify(fixture), before);
  for (const spec of specs) for (const node of visualNodes(spec.kind === 'page' ? spec.root : spec.template)) assert.ok(!['position', 'size', 'parentId'].some(key => Object.hasOwn(node, key)), node.id);
  assert.deepEqual(specs[0].root[0].children.find(n => n.id === 'vn-11').props, { title: lit('Review imported project'), busy: lit(false) });
});
test('typed component contracts are emitted as quoted data and unsafe authored members are refused', () => {
  assert.equal(visualContractTypes(review(fixture)), 'export interface ComponentProps {\n  "title"?: string;\n  "busy"?: boolean;\n}\nexport interface ComponentEvents {\n  "select": [payload: string];\n  "cancel": [payload: undefined];\n}\nexport interface ComponentSlots {\n  "content"?: () => unknown;\n}\n');
  for (const change of [c => c.props.push({ name: 'process.exit()', type: 'string', required: false }), c => c.props.push({ name: '__proto__', type: 'string', required: false }),
    c => c.props.push({ ...c.props[0] }), c => c.props.push({ name: 'nothing', type: 'void', required: false }), c => c.emits.push({ name: 'x; import y', payloadType: 'string' })]) {
    const d = clone(); change(review(d)); assert.throws(() => compile(d), /VISUAL_INVALID/);
  }
});
test('explicit local false, zero and empty strings override variant defaults', () => {
  const d = clone(), props = specs => specs[0].root[0].children.find(n => n.id === 'vn-11').props;
  review(d).props.push({ name: 'count', type: 'number', required: false }); review(d).variants[0].values = { title: 'Default', busy: true, count: 4 };
  Object.assign(instance(d), { variantId: 'default', props: { title: lit(''), busy: lit(false), count: lit(0) } });
  assert.deepEqual(props(compile(d)), { title: lit(''), busy: lit(false), count: lit(0) });
  instance(d).props = {};
  assert.deepEqual(props(compile(d)), { title: lit('Default'), busy: lit(true), count: lit(4) });
  assert.deepEqual(instance(d).props, {});
});
const navigate = d => open(d).events[0].actions[0];
for (const [name, change, expected] of [
  ['missing definition', d => { instance(d).ref.componentId = 'vc-404'; }, /references missing component "vc-404"/],
  ['missing variant', d => { instance(d).variantId = 'missing'; }, /unknown variant/],
  ['reserved export name', d => { review(d).exportName = 'KeepAlive'; }, /Component "KeepAlive": export name KeepAlive is reserved/],
  ['export name of a Nuxt UI component', d => { review(d).exportName = 'UCard'; }, /Component "UCard": export name UCard is reserved/],
  ['undeclared prop', d => { instance(d).props.unknown = lit(false); }, /prop unknown is not declared/],
  ['wrong prop type', d => { instance(d).props.busy = lit('false'); }, /literal must be a boolean/],
  ['missing owner', d => { store(d).pages[0].ownerId = 'missing'; }, /owner surface is missing/],
  ['owner that cannot host a page', d => { d.design.nodes.find(n => n.id === 'node-48').kind = 'action'; }, /owner surface is missing/],
  ['missing navigation target', d => { navigate(d).surfaceId = 'missing'; }, /navigation target is missing/],
  // Its sitemap transitions are removed too, so the visual navigation check (not the sitemap contract) is what refuses it.
  ['navigation to a group', d => { d.design.nodes.find(n => n.id === 'node-17').kind = 'group'; d.design.links = d.design.links.filter(l => l.from !== 'node-17' && l.to !== 'node-17'); }, /navigation target is missing/],
  ['unknown bound field', d => { bound(d).value.field = '0.missing'; }, /field "0\.missing" is not in the output/],
  ['inherited bound property', d => { bound(d).value.field = '0.constructor'; }, /is not in the output/],
  ['evaluated bound expression', d => { bound(d).value.field = '0.title.toUpperCase()'; }, /is not in the output/],
  ['missing operation', d => { bound(d).value.operationId = 'missing'; }, /unknown source operation ds-source-1\/missing/],
  ['write-only binding', d => { d.design.dataSources.sources[0].operations[2].direction = 'write'; d.design.dataSources.flows = d.design.dataSources.flows.filter(f => f.operation !== 'ds-operation-6'); }, /write-only and cannot be read/],
  ['lifecycle event', d => { open(d).events[0].event = 'vue:mounted'; }, /event "vue:mounted" is not declared by this element/],
  ['binding with no value destination', d => { review(d).template[0].children[1].value = bound(d).value; }, /unsupported element fields/],
  ['disabled-only interaction', d => { open(d).visibleIn = ['disabled']; }, /interaction source has no enabled visible state/],
  ['undeclared slot', d => { review(d).template[0].children[1].name = 'missing'; }, /slot "missing" is not declared/],
  ['source input presence', d => { open(d).events[0].actions.push({ kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', input: { kind: 'value', value: 1 } }); }, /takes no input, so map none/],
  ['emit payload presence', d => { confirm(d).events[0].actions.push({ kind: 'emit', event: 'cancel', payload: { kind: 'value', value: 'x' } }); }, /emit cancel payload presence does not match its void contract/],
  ['emit literal type', d => { confirm(d).events[0].actions.push({ kind: 'emit', event: 'select', payload: { kind: 'value', value: 1 } }); }, /emit select literal is not a string/],
  ['scenario fixture shape', d => { store(d).pages[1].scenarios.push({ id: 'sc-x', name: 'Bad', state: 'default', width: 'wide', values: {}, bindings: [{ sourceId: 'ds-source-1', operationId: 'ds-operation-6', value: 'not a list' }] }); }, /scenario "Bad": fixture for ds-source-1\/ds-operation-6 does not match its output/],
]) test('visual generation refuses ' + name, () => { const d = clone(); change(d); assert.throws(() => compile(d), expected); });
test('every interaction declared for one event is kept in order instead of refusing the branch', () => {
  const d = clone(); open(d).events.push({ ...structuredClone(open(d).events[0]), id: 'vi-40', actions: [{ kind: 'set-state', state: 'empty' }] }); store(d).nextId = 41;
  assert.deepEqual(compile(d)[1].root[0].children.find(n => n.id === 'vn-18').events.map(i => i.id), ['vi-19', 'vi-40']);
});
test('hidden ancestors suppress descendants and malformed runtime trees fail closed', () => {
  const [spec] = compile(fixture), ids = ['vn-9', 'vn-10', 'vn-11', 'vn-12', 'vn-13'], shown = state => ids.filter(id => visualVisible(spec, { ...visualSession(), state }, id));
  assert.deepEqual(shown('default'), ['vn-9', 'vn-10', 'vn-11']); assert.deepEqual(shown('error'), ['vn-9', 'vn-10', 'vn-11', 'vn-12']);
  spec.root[0].visibleIn = ['default']; assert.deepEqual(shown('error'), []);
  let deep = { id: 'vn-900', kind: 'element', tag: 'div', attrs: {}, events: [], children: [] };
  for (let i = 0; i < 20; i++) deep = { ...deep, id: 'vn-' + (901 + i), children: [deep] };
  assert.throws(() => visualIndex({ ...spec, root: [deep] }), /VISUAL_DEPTH_LIMIT/);
});
test('bound values are own-property data paths and never evaluated expressions', () => {
  assert.equal(detailValue([{ title: 'First' }], '0.title'), 'First');
  assert.equal(detailValue(Object.create({ inherited: 'no' }), 'inherited'), undefined);
  assert.equal(detailValue({ value: 0 }, 'value'), 0);
  assert.equal(detailValue({}, 'constructor'), undefined);
  assert.equal(detailValue({ name: 'safe' }, 'name.toUpperCase()'), undefined);
  assert.equal(visualTextValue(false, 'fallback'), 'false'); assert.equal(visualTextValue('', 'fallback'), '');
  assert.equal(visualTextValue(undefined, 'fallback'), 'fallback'); assert.equal(visualTextValue({ a: 1 }, ''), '{\n  "a": 1\n}');
});
// Lowering keeps its own refusal for data that reached it without validation: the definition and every instance.
test('lowering refuses reserved export names for the component and for instances of it', () => {
  const m = projectModel(clone()), specs = visualSpecs(m);
  for (const name of ['UButton', 'Slot', 'Transition', 'ComponentEvents']) {
    const s = structuredClone(visualDefinitions(m)), component = { ...structuredClone(specs.find(x => x.kind === 'component')), exportName: name };
    s.components.find(c => c.id === component.id).exportName = name;
    assert.throws(() => visualSfc(m, component, s), new RegExp('VISUAL_INVALID: Component "' + name + '": export name ' + name + ' is reserved in generated components'));
    assert.throws(() => visualSfc(m, specs[0], s), new RegExp('VISUAL_INVALID: Page ".+": export name ' + name + ' used by node vn-11 is reserved in generated components'));
  }
});
