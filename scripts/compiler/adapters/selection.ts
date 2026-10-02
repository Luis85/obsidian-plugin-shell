import { parseSelection, selectionClosure, SelectionError, type GenerationSelection, type Selection, type SelectionNode } from '../domain/selection.ts';
import type { Model } from '../../companion/compiler/model.ts';
import { row, rows } from '../../companion/compiler/model.ts';
import { componentFile, type Entry } from '../../companion/compiler/file-code.ts';
import { visualDefinitions, visualPagePath, visualComponentPath, visualAdapterPath } from '../../companion/compiler/visual-model.ts';
import { visualNodes, visualRoot } from '../../companion/visual/visual-ir.mjs';
import { noteEntity } from '../../companion/compiler/persistence-code.ts';

type VisualStore = ReturnType<typeof visualDefinitions>;
type VisualDefinition = VisualStore['pages'][number] | VisualStore['components'][number];
type VisualElement = ReturnType<typeof visualNodes>[number];
type Interaction = Extract<VisualElement, { events: unknown }>['events'][number];
/** Mutable dependency graph plus artifact ownership collected while one selection is mapped. */
interface ScopeGraph {
  readonly model: Model; readonly store: VisualStore; readonly design: Record<string, unknown>; readonly root: string; readonly tests: string;
  readonly graph: Map<string, Set<string>>; readonly owners: Map<string, string>; readonly paths: ReadonlySet<string>;
}

function node(scope: ScopeGraph, key: string, dependencies: string[] = []): string {
  const values = scope.graph.get(key) ?? new Set<string>(); dependencies.forEach(value => values.add(value)); scope.graph.set(key, values); return key;
}
function own(scope: ScopeGraph, key: string, ...files: string[]): void {
  for (const file of files.filter(item => scope.paths.has(item))) {
    const previous = scope.owners.get(file);
    if (previous && previous !== key) throw new SelectionError('GENERATION_SCOPE_GRAPH', 'Artifact ownership collision at ' + file + '.');
    scope.owners.set(file, key);
  }
}
function addRequirements(scope: ScopeGraph): void {
  const { model, root, tests } = scope;
  for (const item of model.requirements) {
    own(scope, node(scope, 'requirement:' + item.key), `${root}/application/use-cases/${item.key}.ts`, `${tests}/acceptance/${item.key}.test.ts`);
  }
}
function addEntities(scope: ScopeGraph): void {
  const { model, root, tests } = scope;
  for (const entity of model.entities) {
    own(scope, node(scope, 'entity:' + entity.id), `${root}/domain/entities/${entity.slug}.ts`, `${tests}/entities/${entity.slug}.test.ts`,
      `${root}/application/documents/${entity.slug}.ts`, `${tests}/persistence/${entity.slug}.test.ts`);
  }
}
function sourceEntities(model: Model, source: Model['sources'][number]): string[] {
  const entities = new Set<string>();
  for (const operation of source.operations) {
    for (const name of ['input', 'output']) {
      const shape = row(operation.contract[name]);
      if (shape.mode === 'entity') entities.add('entity:' + String(shape.entity));
    }
    const entity = noteEntity(model, source.id, operation.id); if (entity) entities.add('entity:' + entity.id);
  }
  return [...entities];
}
function addSources(scope: ScopeGraph): void {
  const { model, root, tests } = scope;
  for (const source of model.sources) {
    const key = node(scope, 'source:' + source.id, sourceEntities(model, source));
    own(scope, key, `${root}/application/${source.slug}/contracts.ts`, `${root}/application/${source.slug}/service.ts`,
      `${root}/infrastructure/sources/${source.slug}.ts`, `${root}/infrastructure/sources/${source.slug}-http.ts`,
      `${root}/presentation/stores/${source.slug}.ts`, `${tests}/sources/${source.slug}.test.ts`, `design/sources/${source.slug}.json`);
  }
}
function addComponents(scope: ScopeGraph): void {
  const { model, root } = scope;
  for (const component of model.components) {
    const id = String(component.id), key = node(scope, 'component:' + id,
      model.requirements.filter(item => item.components.includes(id)).map(item => 'requirement:' + item.key));
    own(scope, key, `${root}/domain/components/${id}.ts`, `${root}/domain/components/contracts/${id}.ts`,
      `${root}/presentation/components/library/${componentFile(id, 'component')}.vue`);
  }
}
function addScreens(scope: ScopeGraph): void {
  const { model, root } = scope;
  for (const screen of model.screens) {
    const key = node(scope, 'page:' + screen.id, [...screen.components.map(id => 'component:' + id),
      ...model.flows.filter(flow => flow.card === screen.id).map(flow => 'source:' + flow.source),
      ...model.requirements.filter(item => item.nodes.includes(screen.id)).map(item => 'requirement:' + item.key)]);
    own(scope, key, `${root}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`);
  }
}
function componentKey(scope: ScopeGraph, id: string): string {
  const component = scope.store.components.find(item => item.id === id);
  if (!component) throw new SelectionError('GENERATION_SCOPE_REFERENCE', 'Missing component definition ' + id + '.');
  return 'component:' + component.libraryId;
}
function mapping(value: unknown, dependencies: Set<string>): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const record = row(value);
  if (record.kind === 'source') dependencies.add('source:' + String(record.sourceId));
  else if (record.kind === 'object') Object.values(row(record.fields)).forEach(item => mapping(item, dependencies));
}
function addInteraction(scope: ScopeGraph, key: string, interaction: Interaction, dependencies: Set<string>): void {
  own(scope, key, `${scope.root}/application/interactions/${interaction.id}.ts`, `${scope.tests}/acceptance/${interaction.id}.test.ts`);
  for (const action of interaction.actions) {
    if (action.kind === 'source') { dependencies.add('source:' + action.sourceId); mapping(action.input, dependencies); }
    else if (action.kind === 'emit') mapping(action.payload, dependencies);
  }
}
function elementMappings(element: VisualElement, dependencies: Set<string>): void {
  if ('props' in element) Object.values(element.props).forEach(value => mapping(value, dependencies));
  if ('attrs' in element) Object.values(element.attrs).forEach(value => mapping(value, dependencies));
  if ('value' in element) mapping(element.value, dependencies);
}
function addElement(scope: ScopeGraph, definition: VisualDefinition, key: string, element: VisualElement, dependencies: Set<string>): void {
  const isPage = 'ownerId' in definition;
  if (element.kind === 'component' && element.ref.kind === 'project') dependencies.add(componentKey(scope, element.ref.componentId));
  if (element.kind === 'external' && !isPage) own(scope, key, visualAdapterPath(scope.model, definition, element.adapter),
    `${scope.tests}/acceptance/${definition.libraryId}-${element.adapter}.adapter.test.ts`);
  elementMappings(element, dependencies);
  if ('events' in element) for (const interaction of element.events) addInteraction(scope, key, interaction, dependencies);
}
function addVisualDefinition(scope: ScopeGraph, definition: VisualDefinition): void {
  const isPage = 'ownerId' in definition, key = isPage ? 'page:' + definition.ownerId : 'component:' + definition.libraryId;
  const dependencies = scope.graph.get(key)!;
  own(scope, key, isPage ? visualPagePath(scope.model, definition) : visualComponentPath(scope.model, definition),
    `${scope.root}/domain/visual/${definition.id}.ts`, `${scope.tests}/ui-effects/${definition.id}.checks.mjs`, `${scope.tests}/visual/${definition.id}-bindings.test.ts`);
  for (const element of visualNodes(visualRoot(definition))) addElement(scope, definition, key, element, dependencies);
  for (const scenario of definition.scenarios) for (const binding of scenario.bindings) dependencies.add('source:' + binding.sourceId);
}
// The compiler renders live definitions, even for contract-pinned instances. Historical
// revision snapshots remain complete in shared design/traceability files; they are not
// extra live compile edges (unioning them could invent a cycle that is not executed).
function addFeatures(scope: ScopeGraph): void {
  const { model, design } = scope;
  const requirement = (id: string): string[] => model.requirements.filter(item => item.id === id).map(item => 'requirement:' + item.key);
  for (const feature of rows(row(design.features ?? {}).items ?? [], 60)) {
    const strings = (name: string): string[] => (feature[name] as string[]);
    node(scope, 'feature:' + String(feature.id), [...strings('dependsOn').map(id => 'feature:' + id), ...strings('surfaces').map(id => 'page:' + id),
      ...strings('components').map(id => 'component:' + id), ...strings('requirements').flatMap(requirement)]);
  }
}
/** Resolves a requested ID to its single canonical graph key; design IDs map to their surface/library owner. */
function selectionRoot(scope: ScopeGraph, requested: Selection): string {
  const candidates = new Set<string>();
  const literalKey = requested.kind + ':' + requested.id;
  if (scope.graph.has(literalKey)) candidates.add(literalKey);
  if (requested.kind === 'page') scope.store.pages.filter(page => page.id === requested.id).forEach(page => candidates.add('page:' + page.ownerId));
  if (requested.kind === 'component') scope.store.components.filter(component => component.id === requested.id).forEach(component => candidates.add('component:' + component.libraryId));
  if (candidates.size > 1) throw new SelectionError('GENERATION_SCOPE_AMBIGUOUS', 'The ID matches different canonical artifacts; select their surface/library ID.');
  return [...candidates][0] ?? literalKey;
}
function partitionPaths(scope: ScopeGraph, included: ReadonlySet<string>): Pick<GenerationSelection, 'selectedPaths' | 'sharedPaths' | 'retainedPaths'> {
  const selectedPaths: string[] = [], sharedPaths: string[] = [], retainedPaths: string[] = [];
  for (const path of [...scope.paths].sort()) {
    const owner = scope.owners.get(path);
    if (!owner) sharedPaths.push(path);
    else if (included.has(owner)) selectedPaths.push(path);
    else retainedPaths.push(path);
  }
  return { selectedPaths, sharedPaths, retainedPaths };
}

/** Maps the existing emitter's canonical artifacts; shared registries stay full-project, never truncated. */
export function generationSelection(model: Model, output: readonly Entry[], value?: string): GenerationSelection | undefined {
  const requested = parseSelection(value);
  if (!requested) return undefined;
  const scope: ScopeGraph = { model, store: visualDefinitions(model), design: row(model.document.design), root: model.sourceRoot, tests: model.testRoot,
    graph: new Map(), owners: new Map(), paths: new Set(output.map(file => file.path)) };
  addRequirements(scope); addEntities(scope); addSources(scope); addComponents(scope); addScreens(scope);
  for (const definition of [...scope.store.pages, ...scope.store.components]) addVisualDefinition(scope, definition);
  addFeatures(scope);
  const nodes = [...scope.graph].map(([key, dependencies]): SelectionNode => ({ key, dependencies: [...dependencies] }));
  const closure = selectionClosure(requested, selectionRoot(scope, requested), nodes);
  return { ...closure, ...partitionPaths(scope, new Set(closure.included)) };
}
