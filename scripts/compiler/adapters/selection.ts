import { parseSelection, selectionClosure, SelectionError, type GenerationSelection, type SelectionNode } from '../domain/selection.ts';
import type { Model } from '../../companion/compiler/model.ts';
import { row, rows } from '../../companion/compiler/model.ts';
import { componentFile, type Entry } from '../../companion/compiler/file-code.ts';
import { visualDefinitions, visualPagePath, visualComponentPath, visualAdapterPath } from '../../companion/compiler/visual-model.ts';
import { visualNodes, visualRoot } from '../../companion/visual/visual-ir.mjs';
import { noteEntity } from '../../companion/compiler/persistence-code.ts';

/** Maps the existing emitter's canonical artifacts; shared registries stay full-project, never truncated. */
export function generationSelection(model: Model, output: readonly Entry[], value?: string): GenerationSelection | undefined {
  const requested = parseSelection(value);
  if (!requested) return undefined;
  const store = visualDefinitions(model), design = row(model.document.design), root = model.sourceRoot, tests = model.testRoot;
  const graph = new Map<string, Set<string>>(), owners = new Map<string, string>(), paths = new Set(output.map(file => file.path));
  const node = (key: string, dependencies: string[] = []): string => {
    const values = graph.get(key) ?? new Set<string>(); dependencies.forEach(value => values.add(value)); graph.set(key, values); return key;
  };
  const own = (key: string, ...files: string[]): void => {
    for (const file of files) if (paths.has(file)) {
      const previous = owners.get(file);
      if (previous && previous !== key) throw new SelectionError('GENERATION_SCOPE_GRAPH', 'Artifact ownership collision at ' + file + '.');
      owners.set(file, key);
    }
  };
  const requirement = (id: string): string[] => model.requirements.filter(item => item.id === id).map(item => 'requirement:' + item.key);
  for (const item of model.requirements) {
    const key = node('requirement:' + item.key);
    own(key, `${root}/application/use-cases/${item.key}.ts`, `${tests}/acceptance/${item.key}.test.ts`);
  }
  for (const entity of model.entities) {
    const key = node('entity:' + entity.id);
    own(key, `${root}/domain/entities/${entity.slug}.ts`, `${tests}/entities/${entity.slug}.test.ts`,
      `${root}/application/documents/${entity.slug}.ts`, `${tests}/persistence/${entity.slug}.test.ts`);
  }
  for (const source of model.sources) {
    const entities = new Set<string>();
    for (const operation of source.operations) {
      for (const name of ['input', 'output']) {
        const shape = row(operation.contract[name]);
        if (shape.mode === 'entity') entities.add('entity:' + String(shape.entity));
      }
      const entity = noteEntity(model, source.id, operation.id); if (entity) entities.add('entity:' + entity.id);
    }
    const key = node('source:' + source.id, [...entities]);
    own(key, `${root}/application/${source.slug}/contracts.ts`, `${root}/application/${source.slug}/service.ts`,
      `${root}/infrastructure/sources/${source.slug}.ts`, `${root}/infrastructure/sources/${source.slug}-http.ts`,
      `${root}/presentation/stores/${source.slug}.ts`, `${tests}/sources/${source.slug}.test.ts`, `design/sources/${source.slug}.json`);
  }
  for (const component of model.components) {
    const id = String(component.id), key = node('component:' + id,
      model.requirements.filter(item => item.components.includes(id)).map(item => 'requirement:' + item.key));
    own(key, `${root}/domain/components/${id}.ts`, `${root}/domain/components/contracts/${id}.ts`,
      `${root}/presentation/components/library/${componentFile(id, 'component')}.vue`);
  }
  for (const screen of model.screens) {
    const key = node('page:' + screen.id, [...screen.components.map(id => 'component:' + id),
      ...model.flows.filter(flow => flow.card === screen.id).map(flow => 'source:' + flow.source),
      ...model.requirements.filter(item => item.nodes.includes(screen.id)).map(item => 'requirement:' + item.key)]);
    own(key, `${root}/presentation/components/screens/${componentFile(screen.slug, 'screen')}.vue`);
  }
  const componentKey = (id: string): string => {
    const component = store.components.find(item => item.id === id);
    if (!component) throw new SelectionError('GENERATION_SCOPE_REFERENCE', 'Missing component definition ' + id + '.');
    return 'component:' + component.libraryId;
  };
  const mapping = (value: unknown, dependencies: Set<string>): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = row(value);
    if (record.kind === 'source') dependencies.add('source:' + String(record.sourceId));
    else if (record.kind === 'object') Object.values(row(record.fields)).forEach(item => mapping(item, dependencies));
  };
  for (const definition of [...store.pages, ...store.components]) {
    const isPage = 'ownerId' in definition, key = isPage ? 'page:' + definition.ownerId : 'component:' + definition.libraryId;
    const dependencies = graph.get(key)!;
    own(key, isPage ? visualPagePath(model, definition) : visualComponentPath(model, definition),
      `${root}/domain/visual/${definition.id}.ts`, `${tests}/ui-effects/${definition.id}.checks.mjs`, `${tests}/visual/${definition.id}-bindings.test.ts`);
    for (const element of visualNodes(visualRoot(definition))) {
      if (element.kind === 'component' && element.ref.kind === 'project') dependencies.add(componentKey(element.ref.componentId));
      if (element.kind === 'external' && !isPage) own(key, visualAdapterPath(model, definition, element.adapter),
        `${tests}/acceptance/${definition.libraryId}-${element.adapter}.adapter.test.ts`);
      if ('props' in element) Object.values(element.props).forEach(value => mapping(value, dependencies));
      if ('attrs' in element) Object.values(element.attrs).forEach(value => mapping(value, dependencies));
      if ('value' in element) mapping(element.value, dependencies);
      if ('events' in element) for (const interaction of element.events) {
        own(key, `${root}/application/interactions/${interaction.id}.ts`, `${tests}/acceptance/${interaction.id}.test.ts`);
        for (const action of interaction.actions) {
          if (action.kind === 'source') { dependencies.add('source:' + action.sourceId); mapping(action.input, dependencies); }
          else if (action.kind === 'emit') mapping(action.payload, dependencies);
        }
      }
    }
    for (const scenario of definition.scenarios) for (const binding of scenario.bindings) dependencies.add('source:' + binding.sourceId);
  }
  // The compiler renders live definitions, even for contract-pinned instances. Historical
  // revision snapshots remain complete in shared design/traceability files; they are not
  // extra live compile edges (unioning them could invent a cycle that is not executed).
  for (const feature of rows(row(design.features ?? {}).items ?? [], 60)) {
    const strings = (name: string): string[] => (feature[name] as string[]);
    node('feature:' + String(feature.id), [...strings('dependsOn').map(id => 'feature:' + id), ...strings('surfaces').map(id => 'page:' + id),
      ...strings('components').map(id => 'component:' + id), ...strings('requirements').flatMap(requirement)]);
  }
  const candidates = new Set<string>();
  const literalKey = requested.kind + ':' + requested.id;
  if (graph.has(literalKey)) candidates.add(literalKey);
  if (requested.kind === 'page') for (const page of store.pages) if (page.id === requested.id) candidates.add('page:' + page.ownerId);
  if (requested.kind === 'component') for (const component of store.components) if (component.id === requested.id) candidates.add('component:' + component.libraryId);
  if (candidates.size > 1) throw new SelectionError('GENERATION_SCOPE_AMBIGUOUS', 'The ID matches different canonical artifacts; select their surface/library ID.');
  const closure = selectionClosure(requested, [...candidates][0] ?? literalKey, [...graph].map(([key, dependencies]): SelectionNode => ({ key, dependencies: [...dependencies] })));
  const included = new Set(closure.included), selectedPaths: string[] = [], sharedPaths: string[] = [], retainedPaths: string[] = [];
  for (const path of [...paths].sort()) {
    const owner = owners.get(path);
    if (!owner) sharedPaths.push(path);
    else if (included.has(owner)) selectedPaths.push(path);
    else retainedPaths.push(path);
  }
  return { ...closure, selectedPaths, sharedPaths, retainedPaths };
}
