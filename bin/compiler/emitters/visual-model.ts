import type { VisualDesigns, PageDefinition, ComponentDefinition, Contract, UiNode } from '../../../scripts/companion/visual/visual-ir.mjs';
import { emptyVisualDesigns, visualNodes, visualAssert } from '../../../scripts/companion/visual/visual-ir.mjs';
import { validateVisualDesigns } from '../../../scripts/companion/visual/visual-validate.mjs';
import { visualCatalogEntry } from '../../../scripts/companion/visual/visual-catalog.mjs';
import { validateCompositionDesignSystem } from '../../../scripts/companion/composition-contract.mjs';
import type { VisualSpec } from '../../../templates/companion/runtime/visual-runtime.ts';
import { literal, row, type Model, type Row } from './model.ts';
import { componentFile } from './file-code.ts';

const validatedStores = new WeakMap<Model, VisualDesigns>();
/** The validated visual-design store (validated once per model); generation stops on the first invalid definition, naming it.
 * Pages may only be owned by, and navigate to, navigable surfaces (group and action nodes host no page). */
export function visualDefinitions(m: Model): VisualDesigns {
  const cached = validatedStores.get(m); if (cached) return cached;
  const store: unknown = row(m.document.design).visualDesigns;
  if (store === undefined) return emptyVisualDesigns();
  const validated: VisualDesigns = validateVisualDesigns(structuredClone(store), {
    surfaces: new Set(m.screens.filter(s => !['group', 'action'].includes(s.kind)).map(s => s.id)),
    library: new Set(m.components.map(c => String(c.id))),
    sources: new Map(m.sources.map(s => [s.id, new Set(s.operations.map(o => o.id))])),
  });
  validatedStores.set(m, validated);
  return validated;
}

/** The contract a project instance renders against: its pinned revision, otherwise the live component. */
function vmContract(store: VisualDesigns, ref: { componentId: string; revisionId?: string }): Contract | undefined {
  return ref.revisionId ? store.revisions.find(r => r.id === ref.revisionId)?.contract : store.components.find(c => c.id === ref.componentId);
}
/** A project instance's variant supplies prop defaults; explicit instance props (including false, 0 and '') win. */
function vmVariantDefaults(store: VisualDesigns, roots: UiNode[]): void {
  for (const node of visualNodes(roots)) {
    if (node.kind !== 'component' || node.ref.kind !== 'project' || node.variantId === undefined) continue;
    const variant = vmContract(store, node.ref)?.variants.find(v => v.id === node.variantId);
    for (const [name, value] of Object.entries(variant?.values ?? {})) if (!Object.hasOwn(node.props, name)) node.props[name] = { kind: 'literal', value };
  }
}
/** Runtime specs for every page, then every component, carrying the exported design system and resolved variant defaults. */
export function visualSpecs(m: Model): VisualSpec[] {
  const store = visualDefinitions(m);
  const designSystem: unknown = row(m.document.design).designSystem;
  validateCompositionDesignSystem(designSystem);
  const specs: VisualSpec[] = [
    ...store.pages.map((page): VisualSpec => ({ ...structuredClone(page), kind: 'page', designSystem })),
    ...store.components.map((component): VisualSpec => ({ ...structuredClone(component), kind: 'component', designSystem })),
  ];
  for (const spec of specs) vmVariantDefaults(store, spec.kind === 'page' ? spec.root : spec.template);
  return specs;
}

/** Library files use the shared multi-word component naming (componentFile), like the placeholders uiCode writes. */
export const visualComponentPath = (m: Model, component: ComponentDefinition): string => `${m.sourceRoot}/presentation/components/library/${componentFile(component.libraryId, 'component')}.vue`;
export const visualPagePath = (m: Model, page: PageDefinition): string => `${m.sourceRoot}/presentation/components/details/${page.id}.vue`;
export const visualDefinitionPath = (m: Model, spec: VisualSpec): string => (spec.kind === 'page' ? visualPagePath(m, spec) : visualComponentPath(m, spec));
/** Extension-owned adapter module for one external node of a component template. */
export const visualAdapterPath = (m: Model, component: ComponentDefinition, adapter: string): string => `${m.sourceRoot}/presentation/components/library/${componentFile(component.libraryId, 'component')}/${adapter}.adapter.ts`;
export const visualComponentName = (component: ComponentDefinition): string => component.exportName;

/** Explicit Nuxt UI component imports for every catalog entry used in the tree (no global plugin). */
export function visualNuxtImports(nodes: UiNode[]): { name: string; path: string }[] {
  const names = new Set<string>();
  for (const node of visualNodes(nodes)) {
    if (node.kind !== 'component' || node.ref.kind !== 'nuxt-ui') continue;
    const entry: { component: string } | null = visualCatalogEntry(node.ref.entryId);
    visualAssert(entry, 'Node ' + node.id + ' uses unknown catalog entry ' + node.ref.entryId + '.');
    names.add(entry.component);
  }
  return [...names].sort().map(name => ({ name, path: '@nuxt/ui/components/' + name.slice(1) + '.vue' }));
}

const visualEventTypes: Record<string, string> = { void: 'undefined', string: 'string', number: 'number', boolean: 'boolean', unknown: 'unknown' };
/** TypeScript contract module for a component: props, emitted events and slots. */
export function visualContractTypes(component: Contract): string {
  const block = (name: string, lines: string[]) => `export interface ${name} {\n${lines.map(line => `  ${line};\n`).join('')}}\n`;
  return block('ComponentProps', component.props.map(p => `${literal(p.name)}${p.required ? '' : '?'}: ${p.type}`))
    + block('ComponentEvents', component.emits.map(e => `${literal(e.name)}: [payload: ${visualEventTypes[e.payloadType]}]`))
    + block('ComponentSlots', component.slots.map(s => `${literal(s.name)}${s.required ? '' : '?'}: () => unknown`));
}

/** Library entries without a component definition keep the implementation placeholder component. */
export function visualLibraryWithoutDefinition(m: Model): Row[] {
  const defined = new Set(visualDefinitions(m).components.map(c => c.libraryId));
  return m.components.filter(c => !defined.has(String(c.id)));
}

/** Exact pins declared by components, sorted; a version differing from the framework's own pin stops generation. */
export function visualPackages(m: Model, frameworkDependencies: Record<string, string>): Record<string, string> {
  const pins = new Map<string, { version: string; exportName: string }>();
  for (const component of visualDefinitions(m).components) for (const dependency of component.dependencies ?? []) {
    const framework = Object.hasOwn(frameworkDependencies, dependency.package) ? frameworkDependencies[dependency.package] : undefined;
    visualAssert(framework === undefined || framework === dependency.version, `${dependency.package} is pinned to ${framework} by the framework and ${dependency.version} by ${component.exportName}.`);
    const first = pins.get(dependency.package);
    visualAssert(!first || first.version === dependency.version, `${dependency.package} is pinned to ${first?.version} in ${first?.exportName} and ${dependency.version} in ${component.exportName}.`);
    pins.set(dependency.package, first ?? { version: dependency.version, exportName: component.exportName });
  }
  return Object.fromEntries([...pins].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, pin]) => [name, pin.version]));
}
