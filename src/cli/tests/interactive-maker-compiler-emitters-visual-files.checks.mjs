const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { visualCode, visualVerification, visualAcceptanceTodo } from '../compiler/emitters/visual-files.ts';
import { visualDefinitions, visualSpecs } from '../compiler/emitters/visual-model.ts';
import { visualRuntimeTests } from '../compiler/emitters/visual-runtime-tests.ts';
import { richVisualDocument, detailDocument, model, recorder, template } from './support/compiler-emitters-fixture.mjs';

// Visual file emission (visual-files.ts) and the generated runtime, binding and adapter suites (visual-runtime-tests.ts).
const emit = async (m = model(richVisualDocument())) => { const out = recorder(); await visualCode(template, m, out.add); return { m, out }; };
const root = 'src/plugin/generated/', domain = root + 'domain/';

test('every definition emits its spec, SFC, contract, hooks, adapters, tests and traceability', async () => {
  const { out } = await emit();
  const managed = ['components/contracts/project-json-review.ts', 'visual/vp-8.ts', 'visual/vp-15.ts', 'visual/vc-1.ts'].map(path => domain + path);
  assert.deepEqual([...out.files].filter(([, entry]) => entry.ownership === 'managed').map(([path]) => path).sort(), [...managed, 'design/visual-traceability.json',
    root + 'bootstrap/visual-context.ts', 'src/plugin/tests/project/ui-effects/vc-1.checks.mjs', 'src/plugin/tests/project/ui-effects/vp-15.checks.mjs', 'src/plugin/tests/project/ui-effects/vp-8.checks.mjs'].sort());
  assert.deepEqual([...out.files.keys()].slice(0, 10), ['detail-controls.ts', 'detail-actions.ts', 'visual-runtime.ts', 'composition-contract.mjs', 'composition-contract.d.mts', 'visual/visual-ir.mjs',
    'visual/visual-ir.d.mts', 'visual/visual-session.mjs', 'visual/visual-session.d.mts'].map(path => domain + path).concat(root + 'presentation/composables/use-visual.ts'));
  assert.deepEqual([...out.files.keys()].filter(path => path.includes('/acceptance/') || path.includes('/interactions/')), ['interactions/vi-14.ts', 'acceptance/vi-14.test.ts',
    'acceptance/vi-88.test.ts', 'acceptance/vi-89.test.ts', 'interactions/vi-95.ts', 'acceptance/vi-95.test.ts', 'acceptance/vi-97.test.ts', 'interactions/vi-7.ts', 'acceptance/vi-7.test.ts',
    'acceptance/vi-71.test.ts', 'acceptance/vi-73.test.ts', 'acceptance/project-json-review-chart.adapter.test.ts', 'acceptance/project-json-review-map.adapter.test.ts']
    .map(path => (path.startsWith('interactions') ? root + 'application/' : 'src/plugin/tests/project/') + path));
  const use = out.text(root + 'presentation/composables/use-visual.ts');
  for (const path of ["'../../domain/detail-controls.ts'", "'../../domain/composition-contract.mjs'", "'../../domain/visual/visual-session.mjs'", "'../../domain/visual/visual-ir.mjs'", "'../../domain/visual-runtime.ts'"])
    assert.ok(use.includes(path), path);
  assert.ok(!use.includes('src/shared/companion/'));
  assert.ok(out.text(domain + 'visual-runtime.ts').includes("'./visual/visual-ir.mjs'"));
  assert.equal(out.text(domain + 'visual/visual-ir.mjs'), await template.text('src/shared/companion/visual/visual-ir.mjs'));
  assert.ok(out.text(domain + 'visual/vp-15.ts').startsWith("import type { VisualPageSpec } from '../visual-runtime.ts';\nexport const specification: VisualPageSpec = {\"id\":\"vp-15\",\"ownerId\":\"node-27\","));
  assert.ok(out.text(domain + 'visual/vc-1.ts').startsWith("import type { VisualComponentSpec } from '../visual-runtime.ts';\nexport const specification: VisualComponentSpec = {\"id\":\"vc-1\","));
  assert.equal(out.text(root + 'presentation/components/screens/components-screen.vue'), `<script setup lang="ts">
import { useScreen } from '../../composables/use-screen.ts';
import Detail from '../details/vp-15.vue';
const props = defineProps<{ designState?: 'default' | 'loading' | 'empty' | 'error' | 'disabled' }>();
const model = useScreen("node-27");
</script>
<template><section class="generated-screen" :aria-labelledby="model.headingId">
<h2 :id="model.headingId">{{ model.screen.label }}</h2><p>{{ model.screen.goal }}</p>
<Detail :design-state="props.designState" />
<button v-for="edge in model.edges" :key="edge.id" type="button" @click="model.follow(edge.id)">{{ edge.label }}</button>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section></template>
`);
  assert.ok(out.text(root + 'presentation/detail-layout.css').startsWith('.generated-detail, .generated-region, .generated-field { display: flex;'));
});

test('hooks, acceptance TODOs and the dispatcher follow each interaction verification kind', async () => {
  const { out } = await emit();
  assert.equal(out.text(root + 'application/interactions/vi-95.ts'), `import type { VisualRequest } from '../../domain/visual-runtime.ts';
import type { Sources } from '../sources.ts';
import { NotImplementedError } from '../../domain/contract.ts';
export const intent = {"definitionId":"vp-15","nodeId":"vn-87","id":"vi-95","event":"focus","label":"Run vi-95","notes":"","acceptance":"","actions":[]};
/** Start with a failing acceptance test. This hook does not infer business rules from prose. */
export const execute: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new NotImplementedError("vp-15", "vi-95"); };
`);
  const todo = text => `import { it } from 'vitest';\n// UI dispatch/navigation tests are separate from this unimplemented business acceptance.\nit.todo(${JSON.stringify(text)});\n`;
  assert.equal(out.text('src/plugin/tests/project/acceptance/vi-97.test.ts'), todo('[vi-97] Run vi-97 — Opens import'));
  assert.equal(out.text('src/plugin/tests/project/acceptance/vi-88.test.ts'), todo('[vi-88] Run vi-88 — implementation required'));
  assert.equal(out.text(root + 'application/visual-interactions.ts'), `import { execute as E0 } from './interactions/vi-14.ts';
import { execute as E1 } from './interactions/vi-95.ts';
import { execute as E2 } from './interactions/vi-7.ts';
import type { VisualRequest } from '../domain/visual-runtime.ts';
import type { Sources } from './sources.ts';
export async function handleVisualInteraction(request: VisualRequest, sources: Sources): Promise<unknown> {
  switch (request.interactionId) {
    case "vi-14": return E0(request, sources);
    case "vi-95": return E1(request, sources);
    case "vi-7": return E2(request, sources);
    default: throw new Error('VISUAL_INTERACTION_UNKNOWN');
  }
}
`);
  const trace = JSON.parse(out.text('design/visual-traceability.json'));
  assert.deepEqual(trace.definitions, [{ id: 'vp-8', kind: 'page', ownerId: 'node-48', component: root + 'presentation/components/details/vp-8.vue' },
    { id: 'vp-15', kind: 'page', ownerId: 'node-27', component: root + 'presentation/components/details/vp-15.vue' },
    { id: 'vc-1', kind: 'component', libraryId: 'project-json-review', component: root + 'presentation/components/library/project-json-review.vue' }]);
  assert.deepEqual(trace.interactions.map(i => [i.id, i.verification, i.implementation !== null, i.test !== null]), [['vi-14', 'business-todo', true, true], ['vi-19', 'navigation', false, false],
    ['vi-82', 'executable-ui-effect', false, false], ['vi-88', 'declarative-action', false, true], ['vi-89', 'declarative-action', false, true], ['vi-95', 'business-todo', true, true],
    ['vi-97', 'navigation', false, true], ['vi-99', 'navigation', false, false], ['vi-7', 'business-todo', true, true], ['vi-71', 'declarative-action', false, true], ['vi-73', 'declarative-action', false, true]]);
  const library = root + 'presentation/components/library/project-json-review';
  assert.deepEqual(trace.adapters, [{ componentId: 'vc-1', nodeId: 'vn-70', package: 'chart.js', adapter: 'chart', path: library + '/chart.adapter.ts' },
    { componentId: 'vc-1', nodeId: 'vn-74', package: 'chart.js', adapter: 'map', path: library + '/map.adapter.ts' }]);
  assert.equal(trace.businessAcceptance, 'not-implemented');
  assert.equal(out.text(library + '/map.adapter.ts'), `import type { VisualExternalAdapter } from "../../../../domain/visual-runtime.ts";
import { NotImplementedError } from "../../../../domain/contract.ts";
// Implement with: import … from "chart.js"
export interface Props extends Record<string, unknown> {
  "zoom": unknown;
}
export function createAdapter(): VisualExternalAdapter<Props> {
  return {
    // Implement mount(el, props, emit), update(props) and destroy(); the stubs declare no unused parameters.
    mount(): void { throw new NotImplementedError("chart.js adapter map", "mount"); },
    update(): void { throw new NotImplementedError("chart.js adapter map", "update"); },
    destroy(): void { throw new NotImplementedError("chart.js adapter map", "destroy"); },
  };
}
`);
});

test('without business hooks the dispatcher declares no unused parameters', async () => {
  const document = detailDocument(), store = document.design.visualDesigns;
  store.pages[0].root[0].children[0].events = []; store.components[0].template[0].children.find(node => node.id === 'vn-5').events[0].actions = [{ kind: 'emit', event: 'cancel', payload: { kind: 'none' } }];
  const { out } = await emit(model(document));
  assert.equal(out.text(root + 'application/visual-interactions.ts'), "import type { VisualRequest } from '../domain/visual-runtime.ts';\nimport type { Sources } from './sources.ts';\n"
    + "export const handleVisualInteraction: (request: VisualRequest, sources: Sources) => Promise<unknown> = async () => { throw new Error('VISUAL_INTERACTION_UNKNOWN'); };\n");
});

test('identifiers that cannot name files and pages without an owner surface are refused', async () => {
  const badId = model(richVisualDocument()); visualDefinitions(badId).pages[0].id = 'vp.8';
  await assert.rejects(emit(badId), { message: 'VISUAL_INVALID: Definition id "vp.8" cannot name a generated file.' });
  const badInteraction = model(richVisualDocument()); visualDefinitions(badInteraction).pages[1].root[0].children[1].events[0].id = 'vi/19';
  await assert.rejects(emit(badInteraction), { message: 'VISUAL_INVALID: Interaction id "vi/19" cannot name a generated file.' });
  const badLibrary = model(richVisualDocument()); visualDefinitions(badLibrary).components[0].libraryId = '../x';
  await assert.rejects(emit(badLibrary), { message: 'VISUAL_INVALID: Library id "../x" cannot name a generated file.' });
  const orphan = model(richVisualDocument()); visualDefinitions(orphan).pages[0].ownerId = 'node-404';
  await assert.rejects(emit(orphan), { message: 'GENERATOR_INVALID: Missing page owner: node-404' });
});

test('interaction verification is derived from the authored action kinds', () => {
  const interaction = (actions, acceptance = '') => ({ id: 'vi-1', event: 'click', label: 'Run', notes: '', acceptance, actions });
  const cases = [[[], 'business-todo', true], [[{ kind: 'navigate', surfaceId: 'a' }], 'navigation', false], [[{ kind: 'navigate', surfaceId: 'a' }], 'navigation', true, 'Accepted'],
    [[{ kind: 'toggle', nodeId: 'a' }, { kind: 'navigate', surfaceId: 'a' }], 'executable-ui-effect', false], [[{ kind: 'focus', nodeId: 'a' }, { kind: 'emit', event: 'x', payload: { kind: 'none' } }], 'declarative-action', true],
    [[{ kind: 'source', sourceId: 's', operationId: 'o', input: { kind: 'none' } }], 'declarative-action', true]];
  for (const [actions, verification, todo, acceptance] of cases) {
    assert.equal(visualVerification(interaction(actions, acceptance)), verification); assert.equal(visualAcceptanceTodo(interaction(actions, acceptance)), todo);
  }
});

test('runtime, fixture-source, binding and adapter suites are generated per definition', async () => {
  const { out } = await emit();
  const runtime = out.text('src/plugin/tests/project/visual-runtime.test.ts').split('\n');
  assert.deepEqual(runtime.slice(6, 9), ['import { useVisual, provideVisualContext, type VisualContext, type VisualPort } from "../../generated/presentation/composables/use-visual.ts";',
    'import type { VisualPageSpec, VisualRequest } from "../../generated/domain/visual-runtime.ts";', 'import type { UiNode, VisualAction, Scenario } from "../../generated/domain/visual/visual-ir.mjs";']);
  assert.equal(out.text('src/plugin/tests/project/fixtures/visual-sources.ts'), `import { createGAuthoringVaultService } from "../../../generated/application/authoring-vault/service.ts";
import { createGRecordWriterService } from "../../../generated/application/record-writer/service.ts";
export function fixtureSources() { return {"authoring-vault": createGAuthoringVaultService({"list-requirements": async () => structuredClone([{"id":"fixture","type":"requirement","title":"fixture"}]),"list-sitemap": async () => structuredClone([{"id":"fixture","type":"screen","title":"fixture"}]),"list-components": async () => structuredClone([{"id":"fixture","type":"component","title":"fixture"}])}),"record-writer": createGRecordWriterService({"save-record": async () => structuredClone({"id":"fixture"}),"touch": async () => structuredClone(false)})}; }
`);
  const bindings = out.text('src/plugin/tests/project/visual/vp-15-bindings.test.ts');
  const checks = bindings.split('\n').filter(line => line.startsWith('it(') || line.startsWith('    expect(wrapper') || line.startsWith('    expect(bound('));
  const node = id => `"[data-design-node=\\"${id}\\"]"`, cell = (id, row, column, text) => `    expect(wrapper.get(${node(id)}).findAll('tbody tr')[${row}]!.findAll('td')[${column}]!.text()).toBe("${text}");`;
  const it = id => `it("[${id}] displays validated source output through the actual Pinia store", async () => {`, rows = '[{"id":"fixture","type":"component","title":"fixture"}]';
  assert.deepEqual(checks, [it('vn-17'), `    expect(wrapper.get(${node('vn-17')}).text()).toBe("[\\n  {\\n    \\"id\\": \\"fixture\\",\\n    \\"type\\": \\"component\\",\\n    \\"title\\": \\"fixture\\"\\n  }\\n]");`,
    it('vn-91'), `    expect(bound(wrapper.findAllComponents({ name: "Table" }), "vn-91", "data")).toEqual(${rows});`, `    expect(wrapper.get(${node('vn-91')}).findAll('tbody tr')).toHaveLength(1);`,
    cell('vn-91', 0, 0, 'fixture'), cell('vn-91', 0, 1, 'fixture'),
    it('vn-92'), `    expect(bound(wrapper.findAllComponents({ name: "Table" }), "vn-92", "data")).toEqual(${rows});`, `    expect(wrapper.get(${node('vn-92')}).findAll('tbody tr')).toHaveLength(1);`,
    cell('vn-92', 0, 0, 'fixture'), cell('vn-92', 0, 1, 'component'), cell('vn-92', 0, 2, 'fixture'),
    it('vn-93'), '    expect(bound(wrapper.findAllComponents({ name: "Badge" }), "vn-93", "label")).toEqual("fixture");',
    it('vn-94'), `    expect(wrapper.get(${node('vn-94')}).text()).toBe("fixture");`,
    it('vn-96'), `    expect(wrapper.get(${node('vn-96')}).attributes("title")).toBe("fixture");`, `    expect(wrapper.find(${node('vn-96')}).exists()).toBe(true);`,
    it('vn-105'), `    expect(wrapper.find(${node('vn-105')}).exists()).toBe(false);`]);
  assert.ok(bindings.includes("import type { ComponentPublicInstance } from 'vue';\nimport { fixtureSources } from '../fixtures/visual-sources.ts';\n"));
  const chart = out.text('src/plugin/tests/project/acceptance/project-json-review-chart.adapter.test.ts').split('\n');
  assert.deepEqual(chart.slice(10, 18), ['it.todo("[project-json-review/chart] implement the chart.js adapter (mount, update, destroy) and its acceptance");',
    'it("[project-json-review/chart] mounts after render, updates on prop changes, routes events and is destroyed on unmount", async () => {',
    '  const wrapper = mount(Subject, { attachTo: document.body, props: { ...{"title":"fixture","busy":false,"count":0,"label":"fixture","open":false}, designState: "default" } });',
    "  await flushPromises(); expect(fake.log).toEqual(['mount']);", '  await wrapper.setProps({ "title": "changed" }); await flushPromises();',
    "  fake.emit(\"select\", 'fixture'); await flushPromises();", '  expect((wrapper.emitted<[VisualRequest]>(\'interaction\') ?? []).map(([request]) => request.interactionId)).toContain("vi-71");',
    '  wrapper.unmount(); expect(fake.log).toEqual(["mount","update","destroy"]);']);
  const map = out.text('src/plugin/tests/project/acceptance/project-json-review-map.adapter.test.ts');
  assert.ok(map.endsWith('it.todo("[project-json-review/map] implement the chart.js adapter (mount, update, destroy) and its acceptance");\n\n'));
});

test('binding suites read external props and project instance props without inventing DOM checks', () => {
  const m = model(richVisualDocument()), specs = visualSpecs(m), out = recorder();
  const component = specs[2], external = component.template[0].children.find(node => node.id === 'vn-70');
  external.props.points = { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: '0.title' };
  const page = specs[1], instance = page.root[0].children.find(node => node.id === 'vn-104');
  instance.props.title = { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: '0.id' };
  visualRuntimeTests(m, specs, [], out.add);
  const checks = path => out.text(path).split('\n').filter(line => line.startsWith('    expect(wrapper') || line.startsWith('    expect(bound('));
  assert.deepEqual(checks('src/plugin/tests/project/visual/vc-1-bindings.test.ts'), ['    expect(wrapper.find("[data-design-node=\\"vn-70\\"]").exists()).toBe(true);']);
  assert.ok(checks('src/plugin/tests/project/visual/vp-15-bindings.test.ts').includes('    expect(bound(wrapper.findAllComponents({ name: "project-json-review" }), "vn-104", "title")).toEqual("fixture");'));
  external.props = { mode: { kind: 'literal', value: 1 } }; external.events = [];
  const lifecycle = recorder(); visualRuntimeTests(m, specs, [{ component, node: external, path: 'x/chart.adapter.ts' }], lifecycle.add);
  const adapter = lifecycle.text('src/plugin/tests/project/acceptance/project-json-review-chart.adapter.test.ts');
  assert.ok(adapter.includes('vi.mock("../../../../../x/chart.adapter.ts", () => ({ createAdapter: () => ({\n'));
  assert.ok(adapter.includes('  await flushPromises(); expect(fake.log).toEqual([\'mount\']);\n  wrapper.unmount(); expect(fake.log).toEqual(["mount","destroy"]);\n'));
});

test('binding cells render primitive values, skip plain objects and adapters receive typed prop updates', () => {
  const m = model(richVisualDocument()), list = m.sources[0].operations.find(op => op.id === 'ds-operation-6');
  list.output = { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, meta: { type: 'object', properties: {}, required: [] }, tags: { type: 'array', items: { type: 'string' } },
    note: { type: ['null', 'string'] }, version: { type: 'string' } }, required: ['title', 'meta', 'tags', 'note'] } };
  const specs = visualSpecs(m), page = specs[1].root[0].children, component = specs[2];
  page.find(node => node.id === 'vn-93').props.label = { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: '0.version' };
  page.find(node => node.id === 'vn-91').props.data = { kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field: '0' };
  const [chart, map] = ['vn-70', 'vn-74'].map(id => component.template[0].children.find(node => node.id === id));
  chart.props = { flag: { kind: 'prop', name: 'busy' } }; chart.events = []; map.props = { zoom: { kind: 'prop', name: 'count' } }; delete map.visibleIn;
  const out = recorder(); visualRuntimeTests(m, specs, [{ component, node: chart, path: 'x/chart.adapter.ts' }, { component, node: map, path: 'x/map.adapter.ts' }], out.add);
  const lines = out.text('src/plugin/tests/project/visual/vp-15-bindings.test.ts').split('\n').filter(line => line.includes('vn-92') || line.includes('vn-93') || line.includes('vn-91')).map(line => line.trim());
  const cell = (column, text) => `expect(wrapper.get("[data-design-node=\\"vn-92\\"]").findAll('tbody tr')[0]!.findAll('td')[${column}]!.text()).toBe(${JSON.stringify(text)});`;
  for (const line of [cell(0, 'fixture'), cell(2, 'fixture'), cell(3, ''), 'expect(bound(wrapper.findAllComponents({ name: "Badge" }), "vn-93", "label")).toEqual(undefined);',
    `expect(wrapper.get("[data-design-node=\\"vn-91\\"]").findAll('tbody tr')).toHaveLength(1);`]) assert.ok(lines.includes(line), line);
  assert.ok(!lines.some(line => line.includes("findAll('td')[1]") && line.includes('vn-92')));
  assert.ok(out.text('src/plugin/tests/project/acceptance/project-json-review-chart.adapter.test.ts').includes('  await wrapper.setProps({ "busy": true }); await flushPromises();\n  wrapper.unmount();'));
  assert.ok(out.text('src/plugin/tests/project/acceptance/project-json-review-map.adapter.test.ts').includes('  await wrapper.setProps({ "count": 1 }); await flushPromises();\n'));
});
