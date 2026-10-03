import type { UiNode, ElementNode, TextNode, SlotNode, ExternalNode, ComponentNode, VisualDesigns, ComponentDefinition, EmitDefinition, PageDefinition, PropDefinition, SlotDefinition } from '../../../scripts/companion/visual/visual-ir.mjs';
import { VISUAL_TAGS, VISUAL_TEXT_ROLES, visualAssert } from '../../../scripts/companion/visual/visual-ir.mjs';
import { visualCatalogEntry, visualReservedExport } from '../../../scripts/companion/visual/visual-catalog.mjs';
import type { VisualSpec } from '../../../templates/companion/runtime/visual-runtime.ts';
import { literal, type Model } from '../../../scripts/companion/compiler/model.ts';
import { relativeImport } from '../../../scripts/companion/compiler/file-code.ts';
import { visualNuxtImports, visualComponentPath, visualPagePath, visualAdapterPath } from '../../../scripts/companion/compiler/visual-model.ts';

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

/** One lowered node: its validated id, shared marker/guard/layout/description attributes and indentation depth. */
interface VcAt { id: string; common: string; depth: number }
function vcElementNode(ctx: Lowering, node: ElementNode, at: VcAt): string {
  const tag = node.tag, { id, common, depth } = at;
  visualAssert(VISUAL_TAGS.includes(tag), `${ctx.where}: node ${id} uses unsupported tag ${JSON.stringify(tag)}.`);
  const open = `<${tag} ${common} v-bind="model.attrs('${id}')" v-on="model.on('${id}')"`;
  return vcVoid.has(tag) ? `${vcPad(depth)}${open} />` : vcBlock(open + '>', `</${tag}>`, vcList(ctx, node.children, depth + 1), depth);
}
function vcTextNode(ctx: Lowering, node: TextNode, at: VcAt): string {
  const role = node.role;
  visualAssert(VISUAL_TEXT_ROLES.includes(role), `${ctx.where}: node ${at.id} uses unsupported text role ${JSON.stringify(role)}.`);
  return `${vcPad(at.depth)}<${role} ${at.common}>{{ model.text('${at.id}') }}</${role}>`;
}
/** Attributes on <slot> become slot props, so the marker, guard and layout live on a wrapper element. */
function vcSlotNode(ctx: Lowering, node: SlotNode, at: VcAt): string {
  const name = vcName(ctx, node.name, vcSlot, `node ${at.id} slot name`), pad = vcPad(at.depth);
  const inner = vcBlock(name === 'default' ? '<slot>' : `<slot name="${name}">`, '</slot>', vcList(ctx, node.fallback, at.depth + 2), at.depth + 1);
  return `${pad}<div ${at.common}>\n${inner}\n${pad}</div>`;
}
function vcExternalNode(ctx: Lowering, node: ExternalNode, at: VcAt): string {
  visualAssert(ctx.component, `${ctx.where}: external node ${at.id} is only valid in a component template.`);
  const adapter = vcName(ctx, node.adapter, vcAdapter, `node ${at.id} adapter`);
  visualAssert(!ctx.externals.includes(adapter), `${ctx.where}: adapter "${adapter}" is used twice.`);
  ctx.externals.push(adapter);
  return `${vcPad(at.depth)}<div ${at.common} class="generated-external" :ref="model.external('${at.id}', createAdapter_${ctx.externals.length - 1})" />`;
}
function vcNuxtNode(ctx: Lowering, entryId: string, at: VcAt, slots: string[]): string {
  const entry: { component: string } | null = visualCatalogEntry(entryId);
  visualAssert(entry, `${ctx.where}: node ${at.id} uses unknown catalog entry ${entryId}.`);
  const name = vcName(ctx, entry.component, vcNuxt, `node ${at.id} catalog component`);
  return vcBlock(`<${name} ${at.common} v-bind="model.props('${at.id}')" v-on="model.on('${at.id}')">`, `</${name}>`, slots, at.depth);
}
function vcProjectNode(ctx: Lowering, ref: { componentId: string; revisionId?: string }, at: VcAt, slots: string[]): string {
  const { id } = at, target = ctx.store.components.find(c => c.id === ref.componentId);
  visualAssert(target, `${ctx.where}: node ${id} references missing component ${ref.componentId}.`);
  if (ref.revisionId !== undefined) vcPinned(ctx, id, target, ref.revisionId);
  const name = vcName(ctx, target.exportName, vcExport, `node ${id} component export name`);
  // Validation refuses these names too (Vue built-ins, generated type names, Nuxt UI imports); lowering never trusts that.
  visualAssert(!visualReservedExport(name), `${ctx.where}: export name ${name} used by node ${id} is reserved in generated components.`);
  ctx.projects.set(name, target);
  const open = `<${name} ${at.common} v-bind="model.props('${id}')" :design-state="model.state.value === 'default' ? undefined : model.state.value" v-on="model.on('${id}')">`;
  return vcBlock(open, `</${name}>`, slots, at.depth);
}
function vcComponentNode(ctx: Lowering, node: ComponentNode, at: VcAt): string {
  const slots = vcSlots(ctx, node.slots, 'node ' + at.id, at.depth + 1);
  return node.ref.kind === 'nuxt-ui' ? vcNuxtNode(ctx, node.ref.entryId, at, slots) : vcProjectNode(ctx, node.ref, at, slots);
}
function vcNode(ctx: Lowering, node: UiNode, depth: number): string {
  const id = vcName(ctx, node.id, vcId, 'node id');
  const described = typeof node.a11y === 'string' && node.a11y !== '' ? ` :aria-description="model.a11y('${id}')"` : '';
  const at: VcAt = { id, depth, common: `data-design-node="${id}" v-if="model.visible('${id}')"${node.layout ? ` :style="model.style('${id}')"` : ''}${described}` };
  switch (node.kind) {
    case 'element': return vcElementNode(ctx, node, at);
    case 'text': return vcTextNode(ctx, node, at);
    case 'slot': return vcSlotNode(ctx, node, at);
    case 'external': return vcExternalNode(ctx, node, at);
    default: return vcComponentNode(ctx, node, at);
  }
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

/** Validated definition id and, for a component, its library id and unreserved export name. */
function vcIdentity(ctx: Lowering, spec: VisualSpec, page: VisualSpec | null): { id: string; libraryId: string } {
  const component = ctx.component, id = vcName(ctx, spec.id, vcId, 'definition id');
  visualAssert(component || page, `${ctx.where}: definition ${id} is neither a page nor a component.`);
  if (!component) return { id, libraryId: '' };
  const libraryId = vcName(ctx, component.libraryId, vcLibrary, 'library id');
  const exportName = vcName(ctx, component.exportName, vcExport, 'export name');
  visualAssert(!visualReservedExport(exportName), `${ctx.where}: export name ${exportName} is reserved in generated components.`);
  return { id, libraryId };
}
/** Explicit imports: Nuxt UI entries, referenced project components (sorted) and external adapters. */
function vcImports(m: Model, ctx: Lowering, roots: UiNode[]): string {
  const nuxt = visualNuxtImports(roots).map(i => `import ${vcName(ctx, i.name, vcNuxt, 'catalog component')} from ${literal(i.path)};`);
  const projects = [...ctx.projects].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, target]) => {
    vcName(ctx, target.libraryId, vcLibrary, name + ' library id');
    return `import ${name} from ${literal(relativeImport(ctx.path, visualComponentPath(m, target)))};`;
  });
  const component = ctx.component;
  const adapters = component ? ctx.externals.map((adapter, i) => `import { createAdapter as createAdapter_${i} } from ${literal(relativeImport(ctx.path, visualAdapterPath(m, component, adapter)))};`) : [];
  return [...nuxt, ...projects, ...adapters].map(line => line + '\n').join('');
}
/** Component-only script parts: the contract type import and the typed emit dispatcher passed to useVisual. */
function vcComponentScript(m: Model, ctx: Lowering, libraryId: string): { contract: string; declared: string } {
  const component = ctx.component;
  if (!component) return { contract: '', declared: '' };
  const emitted = [...component.emits.map(vcEmitCase), "default: throw new Error('VISUAL_EMIT_UNKNOWN');"].map(line => `    ${line}\n`).join('');
  return { contract: `import type { ComponentProps, ComponentEvents, ComponentSlots } from ${literal(relativeImport(ctx.path, `${m.sourceRoot}/domain/components/contracts/${libraryId}.ts`))};\n`,
    declared: `, (${component.emits.length ? 'name, payload' : 'name'}) => {\n  switch (name) {\n${emitted}  }\n}` };
}
function vcSource(m: Model, ctx: Lowering, id: string, body: string, imports: string, script: { contract: string; declared: string }): string {
  const component = ctx.component !== null;
  return `<script setup lang="ts">
import { useVisual } from '../../composables/use-visual.ts';
import type { VisualState, VisualRequest } from '../../../domain/visual-runtime.ts';
${script.contract}import { specification as spec } from ${literal(relativeImport(ctx.path, `${m.sourceRoot}/domain/visual/${id}.ts`))};
${imports}const props = defineProps<${component ? 'ComponentProps & ' : ''}{ designState?: VisualState; designScenario?: string }>();
const emit = defineEmits<${component ? 'ComponentEvents & ' : ''}{ interaction: [request: VisualRequest] }>();
${component ? 'defineSlots<ComponentSlots>();\n' : ''}const model = useVisual(spec, props, request => emit('interaction', request)${script.declared});
</script>
<template>
<section :ref="model.attach" :style="model.theme.value" class="generated-detail" data-design-document="${id}" :data-design-state="model.state.value" :aria-label="${component ? 'spec.exportName' : 'spec.name'}" :aria-busy="model.state.value === 'loading'">
${body}
<p v-if="model.message.value" role="status">{{ model.message.value }}</p>
</section>
</template>
`;
}
const vcWhere = (component: ComponentDefinition | null, page: PageDefinition | null): string =>
  (component ? `Component ${JSON.stringify(component.exportName)}` : `Page ${JSON.stringify(page?.name)}`);
/** The generated file path and the template roots of the definition being lowered. */
function vcTarget(m: Model, component: ComponentDefinition | null, page: PageDefinition | null): { path: string; roots: UiNode[] } {
  if (component) return { path: visualComponentPath(m, component), roots: component.template };
  return page ? { path: visualPagePath(m, page), roots: page.root } : { path: '', roots: [] };
}
/** Lowers one validated page or component definition to its generated Vue single-file component. */
export function visualSfc(m: Model, spec: VisualSpec, store: VisualDesigns): string {
  const component = spec.kind === 'component' && 'template' in spec ? spec : null;
  const page = !component && 'root' in spec ? spec : null;
  const ctx: Lowering = { store, where: vcWhere(component, page), path: '', component, projects: new Map(), externals: [] };
  const { id, libraryId } = vcIdentity(ctx, spec, page);
  if (component && !component.template.length) return vcPlaceholder(libraryId, component.props, component.slots, ctx);
  const { path, roots } = vcTarget(m, component, page);
  ctx.path = path;
  const body = vcList(ctx, roots, 0).join('\n');
  const imports = vcImports(m, ctx, roots);
  return vcSource(m, ctx, id, body, imports, vcComponentScript(m, ctx, libraryId));
}
