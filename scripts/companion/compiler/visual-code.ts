import type { UiNode, VisualDesigns, ComponentDefinition, EmitDefinition, PropDefinition, SlotDefinition } from '../visual/visual-ir.mjs';
import { VISUAL_TAGS, VISUAL_TEXT_ROLES, visualAssert } from '../visual/visual-ir.mjs';
import { visualCatalogEntry, visualReservedExport } from '../visual/visual-catalog.mjs';
import type { VisualSpec } from '../../../templates/companion/runtime/visual-runtime.ts';
import { literal, type Model } from './model.ts';
import { relativeImport } from './file-code.ts';
import { visualNuxtImports, visualComponentPath, visualPagePath, visualAdapterPath } from './visual-model.ts';

/** Authored names reach template syntax only after matching these patterns; all authored text goes through model.text(). */
const vcId = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/, vcExport = /^[A-Z][A-Za-z0-9]*$/, vcSlot = /^[a-z][A-Za-z0-9-]*$/;
const vcAdapter = /^[a-z][a-z0-9-]*$/, vcLibrary = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, vcNuxt = /^U[A-Z][A-Za-z0-9]*$/;
const vcVoid = new Set(['input', 'img']);

interface Lowering { store: VisualDesigns; where: string; path: string; component: ComponentDefinition | null; projects: Map<string, ComponentDefinition>; externals: string[] }

function vcName(ctx: Lowering, value: unknown, pattern: RegExp, what: string): string {
  visualAssert(typeof value === 'string' && pattern.test(value), `${ctx.where}: ${what} ${JSON.stringify(value)} cannot be emitted into a Vue template.`);
  return value;
}
const vcPad = (depth: number) => '  '.repeat(depth);
function vcBlock(open: string, close: string, inner: string[], depth: number): string {
  return inner.length ? `${vcPad(depth)}${open}\n${inner.join('\n')}\n${vcPad(depth)}${close}` : `${vcPad(depth)}${open}${close}`;
}
const vcList = (ctx: Lowering, nodes: UiNode[], depth: number) => nodes.map(node => vcNode(ctx, node, depth));
function vcSlots(ctx: Lowering, slots: Record<string, UiNode[]>, owner: string, depth: number): string[] {
  return Object.entries(slots).map(([name, nodes]) => vcBlock(`<template #${vcName(ctx, name, vcSlot, owner + ' slot name')}>`, '</template>', vcList(ctx, nodes, depth + 1), depth));
}

function vcNode(ctx: Lowering, node: UiNode, depth: number): string {
  const id = vcName(ctx, node.id, vcId, 'node id');
  const described = typeof node.a11y === 'string' && node.a11y !== '' ? ` :aria-description="model.a11y('${id}')"` : '';
  const common = `data-design-node="${id}" v-if="model.visible('${id}')"${node.layout ? ` :style="model.style('${id}')"` : ''}${described}`;
  const pad = vcPad(depth);
  if (node.kind === 'element') {
    const tag = node.tag;
    visualAssert(VISUAL_TAGS.includes(tag), `${ctx.where}: node ${id} uses unsupported tag ${JSON.stringify(tag)}.`);
    const open = `<${tag} ${common} v-bind="model.attrs('${id}')" v-on="model.on('${id}')"`;
    return vcVoid.has(tag) ? `${pad}${open} />` : vcBlock(open + '>', `</${tag}>`, vcList(ctx, node.children, depth + 1), depth);
  }
  if (node.kind === 'text') {
    const role = node.role;
    visualAssert(VISUAL_TEXT_ROLES.includes(role), `${ctx.where}: node ${id} uses unsupported text role ${JSON.stringify(role)}.`);
    return `${pad}<${role} ${common}>{{ model.text('${id}') }}</${role}>`;
  }
  if (node.kind === 'slot') {
    // Attributes on <slot> become slot props, so the marker, guard and layout live on a wrapper element.
    const name = vcName(ctx, node.name, vcSlot, `node ${id} slot name`);
    const inner = vcBlock(name === 'default' ? '<slot>' : `<slot name="${name}">`, '</slot>', vcList(ctx, node.fallback, depth + 2), depth + 1);
    return `${pad}<div ${common}>\n${inner}\n${pad}</div>`;
  }
  if (node.kind === 'external') {
    visualAssert(ctx.component, `${ctx.where}: external node ${id} is only valid in a component template.`);
    const adapter = vcName(ctx, node.adapter, vcAdapter, `node ${id} adapter`);
    visualAssert(!ctx.externals.includes(adapter), `${ctx.where}: adapter "${adapter}" is used twice.`);
    ctx.externals.push(adapter);
    return `${pad}<div ${common} class="generated-external" :ref="model.external('${id}', createAdapter_${ctx.externals.length - 1})" />`;
  }
  const slots = vcSlots(ctx, node.slots, 'node ' + id, depth + 1);
  if (node.ref.kind === 'nuxt-ui') {
    const entry: { component: string } | null = visualCatalogEntry(node.ref.entryId);
    visualAssert(entry, `${ctx.where}: node ${id} uses unknown catalog entry ${node.ref.entryId}.`);
    const name = vcName(ctx, entry.component, vcNuxt, `node ${id} catalog component`);
    return vcBlock(`<${name} ${common} v-bind="model.props('${id}')" v-on="model.on('${id}')">`, `</${name}>`, slots, depth);
  }
  const componentId = node.ref.componentId, target = ctx.store.components.find(c => c.id === componentId);
  visualAssert(target, `${ctx.where}: node ${id} references missing component ${componentId}.`);
  if (node.ref.revisionId !== undefined) vcPinned(ctx, id, target, node.ref.revisionId);
  const name = vcName(ctx, target.exportName, vcExport, `node ${id} component export name`);
  // Validation refuses these names too (Vue built-ins, generated type names, Nuxt UI imports); lowering never trusts that.
  visualAssert(!visualReservedExport(name), `${ctx.where}: export name ${name} used by node ${id} is reserved in generated components.`);
  ctx.projects.set(name, target);
  const open = `<${name} ${common} v-bind="model.props('${id}')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('${id}')">`;
  return vcBlock(open, `</${name}>`, slots, depth);
}

/** Pinned instances render the live component, so its contract must still satisfy the pinned revision's contract. */
function vcPinned(ctx: Lowering, id: string, live: ComponentDefinition, revisionId: string): void {
  const revision = ctx.store.revisions.find(r => r.id === revisionId && r.componentId === live.id);
  const pin = `node ${id} pins ${live.exportName} revision ${revisionId}`;
  visualAssert(revision, `${ctx.where}: ${pin}, which does not exist.`);
  const pinned = revision.contract;
  const gaps = [
    ...pinned.props.filter(p => !live.props.some(l => l.name === p.name && l.type === p.type)).map(p => `prop ${p.name}: ${p.type}`),
    ...live.props.filter(l => l.required && !pinned.props.some(p => p.name === l.name)).map(l => `new required prop ${l.name}`),
    ...pinned.slots.filter(s => !live.slots.some(l => l.name === s.name)).map(s => `slot ${s.name}`),
    ...pinned.emits.filter(e => !live.emits.some(l => l.name === e.name)).map(e => `emit ${e.name}`),
  ];
  visualAssert(!gaps.length, `${ctx.where}: ${pin} (version ${revision.version}), but the live contract no longer satisfies it: ${gaps.join(', ')}.`);
}

/** A runtime payload guard per declared emit, so the component only emits contract-typed payloads. */
function vcEmitCase(emit: EmitDefinition): string {
  const call = `{ emit(${literal(emit.name)}, payload); return; }`;
  if (emit.payloadType === 'unknown') return `case ${literal(emit.name)}: ${call}`;
  const guard = emit.payloadType === 'void' ? 'payload === undefined' : `typeof payload === ${literal(emit.payloadType)}`;
  return `case ${literal(emit.name)}: if (${guard}) ${call} throw new Error('VISUAL_EMIT_PAYLOAD');`;
}

/** Today's implementation-point component for a definition without template nodes (only the type imports changed). */
function vcPlaceholder(libraryId: string, props: PropDefinition[], slots: SlotDefinition[], ctx: Lowering): string {
  const hasTitle = props.some(p => p.name === 'title' && p.type === 'string');
  return `<script setup lang="ts">
import { specification } from '../../../domain/components/${libraryId}.ts';
import type { ComponentProps, ComponentEvents } from '../../../domain/components/contracts/${libraryId}.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
const props = defineProps<ComponentProps & { designState?: VisualState; designScenario?: string }>();
defineEmits<ComponentEvents & { interaction: [request: VisualRequest] }>();
</script>
<template>
<section class="generated-component" :aria-label="specification.name" :data-design-state="props.designState">
<h3>{{ ${hasTitle ? 'props.title ?? ' : ''}specification.name }}</h3><p>{{ specification.description }}</p>
<p class="generated-hint">Component implementation point</p>
${slots.map(s => `<slot name="${vcName(ctx, s.name, vcSlot, 'slot name')}" />\n`).join('')}</section>
</template>
`;
}

/** Lowers one validated page or component definition to its generated Vue single-file component. */
export function visualSfc(m: Model, spec: VisualSpec, store: VisualDesigns): string {
  const component = spec.kind === 'component' && 'template' in spec ? spec : null;
  const page = !component && 'root' in spec ? spec : null;
  const where = component ? `Component ${JSON.stringify(component.exportName)}` : `Page ${JSON.stringify(page?.name)}`;
  const ctx: Lowering = { store, where, path: '', component, projects: new Map(), externals: [] };
  const id = vcName(ctx, spec.id, vcId, 'definition id');
  visualAssert(component || page, `${where}: definition ${id} is neither a page nor a component.`);
  const libraryId = component ? vcName(ctx, component.libraryId, vcLibrary, 'library id') : '';
  if (component) {
    const exportName = vcName(ctx, component.exportName, vcExport, 'export name');
    visualAssert(!visualReservedExport(exportName), `${where}: export name ${exportName} is reserved in generated components.`);
  }
  if (component && !component.template.length) return vcPlaceholder(libraryId, component.props, component.slots, ctx);
  ctx.path = component ? visualComponentPath(m, component) : page ? visualPagePath(m, page) : '';
  const roots = component ? component.template : page ? page.root : [];
  const body = vcList(ctx, roots, 0).join('\n');
  const nuxtImports = visualNuxtImports(roots);
  const nuxt = nuxtImports.map(i => `import ${vcName(ctx, i.name, vcNuxt, 'catalog component')} from ${literal(i.path)};`);
  const projects = [...ctx.projects].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, target]) => {
    vcName(ctx, target.libraryId, vcLibrary, name + ' library id');
    return `import ${name} from ${literal(relativeImport(ctx.path, visualComponentPath(m, target)))};`;
  });
  const adapters = component ? ctx.externals.map((adapter, i) => `import { createAdapter as createAdapter_${i} } from ${literal(relativeImport(ctx.path, visualAdapterPath(m, component, adapter)))};`) : [];
  const contract = component ? `import type { ComponentProps, ComponentEvents, ComponentSlots } from ${literal(relativeImport(ctx.path, `${m.sourceRoot}/domain/components/contracts/${libraryId}.ts`))};\n` : '';
  const emitted = component ? [...component.emits.map(vcEmitCase), "default: throw new Error('VISUAL_EMIT_UNKNOWN');"].map(line => `    ${line}\n`).join('') : '';
  const declared = component ? `, (${component.emits.length ? 'name, payload' : 'name'}) => {\n  switch (name) {\n${emitted}  }\n}` : '';
  const imports = [...nuxt, ...projects, ...adapters].map(line => line + '\n').join('');
  return `<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
${contract}import { specification as spec } from ${literal(relativeImport(ctx.path, `${m.sourceRoot}/domain/visual/${id}.ts`))};
${imports}const props = defineProps<${component ? 'ComponentProps & ' : ''}{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<${component ? 'ComponentEvents & ' : ''}{ interaction: [request: VisualRequest] }>();
${component ? 'defineSlots<ComponentSlots>();\n' : ''}const model = useVisual(spec, props, request => emit('interaction', request)${declared});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="${id}" :data-design-state="model.state.value" :aria-label="${component ? 'spec.exportName' : 'spec.name'}" :aria-busy="model.state.value === 'loading'">
${body}
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
`;
}
