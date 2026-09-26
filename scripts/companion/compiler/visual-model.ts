import type { VisualDesigns, PageDefinition, ComponentDefinition, Contract, UiNode } from '../visual/visual-ir.mjs';
import { emptyVisualDesigns, visualNodes, visualAssert } from '../visual/visual-ir.mjs';
import { validateVisualDesigns } from '../visual/visual-validate.mjs';
import { visualCatalogEntry } from '../visual/visual-catalog.mjs';
import { validateCompositionDesignSystem } from '../composition-contract.mjs';
import type { VisualSpec } from '../runtime/visual-runtime.ts';
import { literal, row, type Model, type Row } from './model.ts';

/** The validated visual-design store; generation stops on the first invalid definition, naming it. */
export function visualDefinitions(m: Model): VisualDesigns {
  const store: unknown = row(m.document.design).visualDesigns;
  if (store === undefined) return emptyVisualDesigns();
  const validated: VisualDesigns = validateVisualDesigns(structuredClone(store), {
    surfaces: new Set(m.screens.map(s => s.id)),
    library: new Set(m.components.map(c => String(c.id))),
    sources: new Map(m.sources.map(s => [s.id, new Set(s.operations.map(o => o.id))])),
  });
  return validated;
}

/** Runtime specs for every page, then every component, carrying the exported design system. */
export function visualSpecs(m: Model): VisualSpec[] {
  const store = visualDefinitions(m);
  const designSystem: unknown = row(m.document.design).designSystem;
  validateCompositionDesignSystem(designSystem);
  return [
    ...store.pages.map((page): VisualSpec => ({ ...page, kind: 'page', designSystem })),
    ...store.components.map((component): VisualSpec => ({ ...component, kind: 'component', designSystem })),
  ];
}

export const visualComponentPath = (m: Model, component: ComponentDefinition): string => `${m.sourceRoot}/presentation/components/library/${component.libraryId}.vue`;
export const visualPagePath = (m: Model, page: PageDefinition): string => `${m.sourceRoot}/presentation/components/details/${page.id}.vue`;
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
