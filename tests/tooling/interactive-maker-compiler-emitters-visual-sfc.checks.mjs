const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { visualSpecs, visualDefinitions, visualNuxtImports, visualContractTypes, visualLibraryWithoutDefinition, visualPackages, visualComponentName } from '../../scripts/companion/compiler/visual-model.ts';
import { visualSfc } from '../../scripts/companion/compiler/visual-code.ts';
import { visualSources, visualPorts } from '../../scripts/companion/compiler/visual-ports.ts';
import { richVisualDocument, detailDocument, starterDocument, model, recorder } from './compiler-emitters-fixture.mjs';

// Visual definitions to Vue (visual-model.ts, visual-code.ts) and their validated source ports (visual-ports.ts).
const rich = () => { const m = model(richVisualDocument()); return { m, specs: visualSpecs(m), store: visualDefinitions(m) }; };
const visualError = message => ({ message: 'VISUAL_INVALID: ' + message });

test('a page SFC imports Nuxt UI and project components explicitly and binds every node to the runtime model', () => {
  const { m, specs, store } = rich();
  assert.equal(visualSfc(m, specs[0], store), `<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import { specification as spec } from "../../../domain/visual/vp-8.ts";
import UInput from "@nuxt/ui/components/Input.vue";
import ProjectJsonReview from "../library/project-json-review.vue";
const props = defineProps<{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<{ interaction: [request: VisualRequest] }>();
const model = useVisual(spec, props, request => emit('interaction', request));
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vp-8" :data-design-state="model.state.value" :aria-label="spec.name" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-9" v-if="model.visible('vn-9')" :style="model.style('vn-9')" v-bind="model.attrs('vn-9')" v-on="model.on('vn-9')">
  <UInput data-design-node="vn-10" v-if="model.visible('vn-10')" :aria-description="model.a11y('vn-10')" v-bind="model.props('vn-10')" v-on="model.on('vn-10')"></UInput>
  <ProjectJsonReview data-design-node="vn-11" v-if="model.visible('vn-11')" v-bind="model.props('vn-11')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-11')"></ProjectJsonReview>
  <p data-design-node="vn-12" v-if="model.visible('vn-12')">{{ model.text('vn-12') }}</p>
  <p data-design-node="vn-13" v-if="model.visible('vn-13')">{{ model.text('vn-13') }}</p>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
`);
  const page = visualSfc(m, specs[1], store).split('\n');
  assert.deepEqual(page.slice(4, 14).map(line => line.split(' from ')[0]), ['import UBadge', 'import UButton', 'import UCheckbox', 'import UInput', 'import UModal', 'import USelect', 'import USwitch',
    'import UTable', 'import UTextarea', 'import ProjectJsonReview']);
  for (const line of [
    `  <UInput data-design-node="vn-80" v-if="model.visible('vn-80')" :style="model.style('vn-80')" :aria-description="model.a11y('vn-80')" v-bind="model.props('vn-80')" v-on="model.on('vn-80')"></UInput>`,
    `  <span data-design-node="vn-90" v-if="model.visible('vn-90')">{{ model.text('vn-90') }}</span>`,
    `  <UBadge data-design-node="vn-93" v-if="model.visible('vn-93')" v-bind="model.props('vn-93')" v-on="model.on('vn-93')">`, '    <template #default>',
    `      <span data-design-node="vn-94" v-if="model.visible('vn-94')">{{ model.text('vn-94') }}</span>`, '    </template>', '  </UBadge>',
    `  <button data-design-node="vn-96" v-if="model.visible('vn-96')" v-bind="model.attrs('vn-96')" v-on="model.on('vn-96')"></button>`,
    `  <input data-design-node="vn-98" v-if="model.visible('vn-98')" v-bind="model.attrs('vn-98')" v-on="model.on('vn-98')" />`,
    `  <ProjectJsonReview data-design-node="vn-104" v-if="model.visible('vn-104')" v-bind="model.props('vn-104')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('vn-104')"></ProjectJsonReview>`])
    assert.ok(page.includes(line), line);
});

test('a component SFC declares its contract, typed emit guards, slots and external adapters', () => {
  const { m, specs, store } = rich();
  assert.equal(visualSfc(m, specs[2], store), `<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
import type { ComponentProps, ComponentEvents, ComponentSlots } from "../../../domain/components/contracts/project-json-review.ts";
import { specification as spec } from "../../../domain/visual/vc-1.ts";
import UButton from "@nuxt/ui/components/Button.vue";
import { createAdapter as createAdapter_0 } from "./project-json-review/chart.adapter.ts";
import { createAdapter as createAdapter_1 } from "./project-json-review/map.adapter.ts";
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
defineSlots<ComponentSlots>();
const model = useVisual(spec, props, request => emit('interaction', request), (name, payload) => {
  switch (name) {
    case "select": if (typeof payload === "string") { emit("select", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "cancel": if (payload === undefined) { emit("cancel", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "amount": if (typeof payload === "number") { emit("amount", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    case "raw": { emit("raw", payload); return; }
    case "flag": if (typeof payload === "boolean") { emit("flag", payload); return; } throw new Error('VISUAL_EMIT_PAYLOAD');
    default: throw new Error('VISUAL_EMIT_UNKNOWN');
  }
});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="vc-1" :data-design-state="model.state.value" :aria-label="spec.exportName" :aria-busy="model.state.value === 'loading'">
<div data-design-node="vn-2" v-if="model.visible('vn-2')" :style="model.style('vn-2')" v-bind="model.attrs('vn-2')" v-on="model.on('vn-2')">
  <p data-design-node="vn-3" v-if="model.visible('vn-3')">{{ model.text('vn-3') }}</p>
  <div data-design-node="vn-4" v-if="model.visible('vn-4')">
    <slot name="content">
      <p data-design-node="vn-6" v-if="model.visible('vn-6')">{{ model.text('vn-6') }}</p>
    </slot>
  </div>
  <UButton data-design-node="vn-5" v-if="model.visible('vn-5')" :aria-description="model.a11y('vn-5')" v-bind="model.props('vn-5')" v-on="model.on('vn-5')"></UButton>
  <div data-design-node="vn-100" v-if="model.visible('vn-100')">
    <slot>
      <h3 data-design-node="vn-101" v-if="model.visible('vn-101')">{{ model.text('vn-101') }}</h3>
    </slot>
  </div>
  <div data-design-node="vn-70" v-if="model.visible('vn-70')" class="generated-external" :ref="model.external('vn-70', createAdapter_0)" />
  <div data-design-node="vn-74" v-if="model.visible('vn-74')" class="generated-external" :ref="model.external('vn-74', createAdapter_1)" />
  <UButton data-design-node="vn-72" v-if="model.visible('vn-72')" v-bind="model.props('vn-72')" v-on="model.on('vn-72')"></UButton>
</div>
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
`);
  assert.equal(visualContractTypes(store.components[0]), `export interface ComponentProps {
  "title"?: string;
  "busy"?: boolean;
  "count": number;
  "label"?: string;
  "open": boolean;
}
export interface ComponentEvents {
  "select": [payload: string];
  "cancel": [payload: undefined];
  "amount": [payload: number];
  "raw": [payload: unknown];
  "flag": [payload: boolean];
}
export interface ComponentSlots {
  "content"?: () => unknown;
  "default"?: () => unknown;
}
`);
});

test('a component without template nodes keeps the implementation-point placeholder', () => {
  const { m, specs, store } = rich(), spec = { ...specs[2], template: [], slots: [{ name: 'content', required: false }] };
  assert.equal(visualSfc(m, spec, store), `<script setup lang="ts">
import { specification } from '../../../domain/components/project-json-review.ts';
import type { ComponentProps, ComponentEvents } from '../../../domain/components/contracts/project-json-review.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
</script>
<template>
<section class="generated-component" :aria-label="specification.name" :data-design-state="props.designState">
<h3>{{ props.title ?? specification.name }}</h3><p>{{ specification.description }}</p>
<p class="generated-hint">Component implementation point</p>
<slot name="content" />
</section>
</template>
`);
  const untitled = visualSfc(m, { ...spec, props: [], slots: [] }, store);
  assert.ok(untitled.includes('<h3>{{ specification.name }}</h3>') && !untitled.includes('<slot'));
});

test('lowering re-checks every name and reference instead of trusting validation', () => {
  const { m, specs, store } = rich(), page = specs[1], component = specs[2];
  const withRoot = (spec, node) => ({ ...spec, root: [node] }), withTemplate = node => ({ ...component, template: [node] });
  const sfc = spec => () => visualSfc(m, spec, store);
  assert.throws(sfc({ ...page, id: 'bad id' }), visualError('Page "Component library": definition id "bad id" cannot be emitted into a Vue template.'));
  const { root: _root, ...rootless } = page;
  assert.throws(sfc({ ...rootless, kind: 'layout' }), visualError('Page undefined: definition vp-15 is neither a page nor a component.'));
  assert.throws(sfc({ ...component, exportName: 'UButton' }), visualError('Component "UButton": export name UButton is reserved in generated components.'));
  assert.throws(sfc({ ...component, libraryId: 'Bad_Id' }), visualError('Component "ProjectJsonReview": library id "Bad_Id" cannot be emitted into a Vue template.'));
  assert.throws(sfc(withRoot(page, { id: 'n1', kind: 'element', tag: 'script', attrs: {}, children: [], events: [] })), visualError('Page "Component library": node n1 uses unsupported tag "script".'));
  assert.throws(sfc(withRoot(page, { id: 'n1', kind: 'text', role: 'pre', value: { kind: 'literal', value: '' } })), visualError('Page "Component library": node n1 uses unsupported text role "pre".'));
  assert.throws(sfc(withRoot(page, { id: 'n1', kind: 'slot', name: 'Bad name', fallback: [] })), visualError('Page "Component library": node n1 slot name "Bad name" cannot be emitted into a Vue template.'));
  const external = { id: 'n1', kind: 'external', package: 'chart.js', adapter: 'chart', props: {}, events: [] };
  assert.throws(sfc(withRoot(page, external)), visualError('Page "Component library": external node n1 is only valid in a component template.'));
  assert.throws(sfc({ ...component, template: [external, { ...external, id: 'n2' }] }), visualError('Component "ProjectJsonReview": adapter "chart" is used twice.'));
  assert.throws(sfc(withTemplate({ ...external, adapter: 'Chart' })), visualError('Component "ProjectJsonReview": node n1 adapter "Chart" cannot be emitted into a Vue template.'));
  const nuxt = entryId => ({ id: 'n1', kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: {}, slots: {}, events: [] });
  assert.throws(sfc(withRoot(page, nuxt('u-unknown'))), visualError('Page "Component library": node n1 uses unknown catalog entry u-unknown.'));
  const project = ref => ({ id: 'n1', kind: 'component', ref: { kind: 'project', ...ref }, props: {}, slots: { 'Bad slot': [] }, events: [] });
  assert.throws(sfc(withRoot(page, { ...project({ componentId: 'vc-1' }) })), visualError('Page "Component library": node n1 slot name "Bad slot" cannot be emitted into a Vue template.'));
  assert.throws(sfc(withRoot(page, { ...project({ componentId: 'vc-404' }), slots: {} })), visualError('Page "Component library": node n1 references missing component vc-404.'));
  const reserved = { ...store, components: [{ ...store.components[0], exportName: 'UButton' }] };
  assert.throws(() => visualSfc(m, withRoot(page, { ...project({ componentId: 'vc-1' }), slots: {} }), reserved),
    visualError('Page "Component library": export name UButton used by node n1 is reserved in generated components.'));
});

test('pinned instances must still satisfy the pinned revision contract', () => {
  const { m, specs, store } = rich(), page = specs[1];
  const pinned = revisionId => ({ ...page, root: [{ id: 'n1', kind: 'component', ref: { kind: 'project', componentId: 'vc-1', revisionId }, props: {}, slots: {}, events: [] }] });
  assert.throws(() => visualSfc(m, pinned('vr-404'), store), visualError('Page "Component library": node n1 pins ProjectJsonReview revision vr-404, which does not exist.'));
  const live = store.components[0], drifted = { ...store, components: [{ ...live, props: [...live.props.filter(p => p.name !== 'busy'), { name: 'mode', type: 'string', required: true }], slots: [], emits: [] }] };
  assert.throws(() => visualSfc(m, pinned('vr-1'), drifted), visualError('Page "Component library": node n1 pins ProjectJsonReview revision vr-1 (version 1.0.0), but the live contract no longer satisfies it: '
    + 'prop busy: boolean, new required prop mode, slot content, emit select.'));
  assert.ok(visualSfc(m, pinned('vr-1'), store).includes('import ProjectJsonReview from "../library/project-json-review.vue";'));
});

test('the visual model caches validation, applies variant defaults and reports placeholders and pins', () => {
  const { m, specs, store } = rich();
  assert.equal(visualDefinitions(m), store);
  assert.deepEqual(specs.map(spec => [spec.kind, spec.id]), [['page', 'vp-8'], ['page', 'vp-15'], ['component', 'vc-1']]);
  assert.deepEqual(specs[1].root[0].children.find(node => node.id === 'vn-104').props, { count: { kind: 'literal', value: 1 }, open: { kind: 'literal', value: true }, busy: { kind: 'literal', value: true } });
  assert.deepEqual(specs[0].designSystem, m.document.design.designSystem);
  assert.deepEqual(visualNuxtImports(specs[0].root), [{ name: 'UInput', path: '@nuxt/ui/components/Input.vue' }]);
  assert.throws(() => visualNuxtImports([{ id: 'n1', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-nope' }, props: {}, slots: {}, events: [] }]),
    visualError('Node n1 uses unknown catalog entry u-nope.'));
  assert.equal(visualLibraryWithoutDefinition(m).length, m.components.length - 1);
  assert.deepEqual(visualPackages(m, { vue: '3.5.0' }), { 'chart.js': '4.4.0' });
  assert.throws(() => visualPackages(m, { 'chart.js': '4.0.0' }), visualError('chart.js is pinned to 4.0.0 by the framework and 4.4.0 by ProjectJsonReview.'));
  const twice = model(richVisualDocument()); const extra = structuredClone(visualDefinitions(twice).components[0]);
  visualDefinitions(twice).components.push({ ...extra, exportName: 'Second', dependencies: [{ package: 'chart.js', version: '4.5.0', purpose: 'Charts' }, { package: 'a-lib', version: '1.0.0', purpose: 'A' }] });
  assert.throws(() => visualPackages(twice, {}), visualError('chart.js is pinned to 4.4.0 in ProjectJsonReview and 4.5.0 in Second.'));
  visualDefinitions(twice).components.at(-1).dependencies = [{ package: 'z-lib', version: '1.0.0', purpose: 'Z' }, { package: 'a-lib', version: '1.0.0', purpose: 'A' }];
  assert.deepEqual(Object.keys(visualPackages(twice, {})), ['a-lib', 'chart.js', 'z-lib']);
  assert.equal(visualComponentName(store.components[0]), 'ProjectJsonReview');
  assert.equal(visualContractTypes({ props: [], emits: [], slots: [{ name: 'body', required: true }], variants: [] }),
    'export interface ComponentProps {\n}\nexport interface ComponentEvents {\n}\nexport interface ComponentSlots {\n  "body": () => unknown;\n}\n');
});

test('projects without visual designs have an empty store and no specs', async () => {
  const document = await starterDocument('blank'); delete document.design.visualDesigns;
  const m = model(document);
  assert.deepEqual(visualDefinitions(m).pages, []); assert.deepEqual(visualSpecs(m), []); assert.deepEqual(visualSources(m), []);
  const out = recorder(); visualPorts(m, out.add);
  assert.ok(out.text('src/generated/bootstrap/visual-context.ts').startsWith("\nimport type { Pinia } from 'pinia';\n"));
  assert.ok(out.text('src/generated/bootstrap/visual-context.ts').includes('return { ports: [], handle:'));
});

test('visual ports bind one Pinia-backed port per referenced source operation', () => {
  const { m } = rich(), out = recorder(); visualPorts(m, out.add);
  const lines = out.text('src/generated/bootstrap/visual-context.ts').split('\n');
  assert.deepEqual(lines.slice(0, 4), ["import { defineGAuthoringVaultStore } from '../presentation/stores/authoring-vault.ts';", "import * as GAuthoringVaultContracts from '../application/authoring-vault/contracts.ts';",
    "import { defineGRecordWriterStore } from '../presentation/stores/record-writer.ts';", "import * as GRecordWriterContracts from '../application/record-writer/contracts.ts';"]);
  assert.deepEqual(lines.slice(11, 13), ['const GAuthoringVault = defineGAuthoringVaultStore(sources["authoring-vault"])(pinia);', 'const GRecordWriter = defineGRecordWriterStore(sources["record-writer"])(pinia);']);
  assert.equal(lines[14], 'return { ports: [{ sourceId: "ds-source-1", operationId: "ds-operation-6", direction: "read", requiresInput: false,');
  assert.equal(lines[19], `async run(input) { if (!GRecordWriterContracts.isGSaveRecordInput(input)) throw new Error('INVALID_INPUT'); return GRecordWriter["save-record"].execute(input); } },`);
  assert.equal(out.files.get('src/generated/bootstrap/visual-context.ts').ownership, 'managed');
  assert.deepEqual(visualSources(m).map(use => use.operation.id), ['ds-operation-6', 'ds-operation-61', 'ds-operation-62']);
});
