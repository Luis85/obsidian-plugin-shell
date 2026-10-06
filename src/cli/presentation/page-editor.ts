import type { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import { pageNodes, surfaceFor } from '../domain/pages.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { interactions } from '../domain/interactions.ts';
import { workspaceContext } from './context.ts';
import { titleInput, bulkTitles, choose, selectMany, input, reportError, type Prompts } from '#tui/prompts.ts';
interface SavedSource { id: string; name: string; kind: string; status?: string; operations: { id: string; slug: string; name: string; direction: string; input?: { mode?: string } }[] }
function availableSources(workspace: Workspace): SavedSource[] {
  const saved = workspace.document.design.dataSources as { sources?: SavedSource[] } | undefined;
  return (saved?.sources ?? []).filter(source => source.status !== 'deprecated');
}
async function bindPageNode(ui: Prompts, workspace: Workspace, page: string, nodeId: string): Promise<void> {
  const node = pageNodes(workspace.document, page).find(item => item.id === nodeId);
  requireSketch(node && ['text','component','external'].includes(node.kind), 'SOURCE_BIND_NODE', 'Select a component or text element.');
  const prop = node.kind === 'text' ? '@value' : await input(ui, 'Prop to bind (e.g. data)', node.kind === 'component' && node.ref.kind === 'nuxt-ui' && node.ref.entryId === 'u-table' ? 'data' : '');
  const sources = availableSources(workspace).filter(source => source.operations.some(op => op.direction !== 'write'));
  requireSketch(sources.length, 'SOURCE_BIND_SOURCE', 'Declare a read source or Collection first.');
  const sourceId = await choose(ui, 'Read source', sources.map(source => ({ id: source.id, label: source.name })));
  const operations = sources.find(source => source.id === sourceId)!.operations.filter(op => op.direction !== 'write');
  const operation = await choose(ui, 'Read operation', operations.map(op => ({ id: op.id, label: op.name })));
  const field = await input(ui, 'Output field path (blank binds the complete result)');
  workspace.edit([{ op: 'page.bind', page, node: nodeId, prop, source: sourceId, operation, field }]);
}
async function addCollectionTable(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const sources = availableSources(workspace).filter(source => source.kind === 'collection' && source.operations.some(op => op.slug === 'list'));
  requireSketch(sources.length, 'COLLECTION_REQUIRED', 'Declare an entity and Collection before inserting its table.');
  const source = await choose(ui, 'Markdown collection', sources.map(item => ({ id: item.id, label: item.name })));
  const title = await titleInput(ui, 'Table name');
  workspace.edit([{ op: 'page.collection-table', page, source, title }]);
}
async function addExisting(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const selected = await selectMany(ui, 'Add existing components', outline(workspace.document).components.map(item => ({ id: item.id, label: item.title })));
  workspace.edit([{ op: 'page.attach', page, components: selected.map(id => ({ id })) }]);
}
async function editElement(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const nodes = outline(workspace.document).pages.find(item => item.id === page)!.nodes;
  const id = await choose(ui, 'Choose page element', [...nodes.map(node => ({ id: node.id, label: node.title ?? node.id })), { id: 'back', label: 'Back' }]);
  if (id === 'back') return;
  const op = await choose(ui, 'Edit element', [{ id: 'up', label: 'Move up' }, { id: 'down', label: 'Move down' }, { id: 'remove', label: 'Remove instance (keep library definition)' }, { id: 'bind', label: 'Bind prop to a data source / Collection' }, { id: 'back', label: 'Back' }]);
  if (op === 'back') return;
  if (op === 'bind') { await bindPageNode(ui, workspace, page, id); return; }
  workspace.edit([op === 'remove' ? { op: 'page.remove', page, id } : { op: 'page.move', page, id, direction: op }]);
}
async function sourceAction(ui: Prompts, workspace: Workspace): Promise<Record<string, unknown>> {
  const sources = availableSources(workspace).filter(source => source.operations.length > 0);
  requireSketch(sources.length, 'SOURCE_ACTION', 'Declare a source with operations before connecting an interaction.');
  const source = await choose(ui, 'Call source', sources.map(item => ({ id: item.id, label: item.name })));
  const selectedSource = sources.find(item => item.id === source)!;
  const operation = await choose(ui, 'Call operation', selectedSource.operations.map(op => ({ id: op.id, label: op.name + ' · ' + op.direction })));
  const port = selectedSource.operations.find(op => op.id === operation)!;
  if (port.input?.mode === 'none') return { kind: 'source', source, operation, input: { kind: 'none' } };
  const kind = await choose(ui, 'Input mapping', [{ id: 'event', label: 'Pass event payload (validate in generated service)' },
    { id: 'value', label: 'Enter a fixed JSON payload' }]);
  const mapping = kind === 'event' ? { kind: 'event' } : { kind: 'value', value: JSON.parse(await input(ui, 'Fixed JSON input (values, requestId/revision as required)', '{}')) };
  return { kind: 'source', source, operation, input: mapping };
}
async function editInteraction(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const selected = await choose(ui, 'Choose interaction', [...interactions(workspace.document, page).map(({ interaction }) => ({ id: interaction.id, label: interaction.label })), { id: 'back', label: 'Back' }]);
  if (selected === 'back') return;
  const action = await choose(ui, 'Interaction behavior', ['navigate', 'set-state', 'source', 'todo', 'rename', 'remove', 'back'].map(id => ({ id, label: id })));
  if (action === 'back') return;
  if (action === 'rename') { workspace.edit([{ op: 'interaction.rename', page, id: selected, title: await titleInput(ui, 'Interaction title') }]); return; }
  if (action === 'remove') { workspace.edit([{ op: 'interaction.remove', page, id: selected }]); return; }
  if (action === 'source') { workspace.edit([{ op: 'interaction.action', page, id: selected, action: await sourceAction(ui, workspace) }]); return; }
  const change: Record<string, unknown> = { kind: action };
  if (action === 'navigate') change.target = await choose(ui, 'Destination page', outline(workspace.document).pages.map(item => ({ id: item.id, label: item.title })));
  if (action === 'set-state') change.state = await choose(ui, 'Preview state', ['default', 'loading', 'empty', 'error', 'disabled'].map(id => ({ id, label: id })));
  workspace.edit([{ op: 'interaction.action', page, id: selected, action: change }]);
}
interface PageAction { label: string; run: () => unknown }
function pageActions(ui: Prompts, workspace: Workspace, page: string): Record<string, PageAction> {
  return {
    new: { label: 'Create and add a component', run: async () => workspace.edit([
      { op: 'page.attach', page, components: [{ title: await titleInput(ui, 'Component title') }] },
    ]) },
    existing: { label: 'Add existing components (multi-select)', run: () => addExisting(ui, workspace, page) },
    table: { label: 'Insert a table backed by a Markdown Collection', run: () => addCollectionTable(ui, workspace, page) },
    bulk: { label: 'Bulk-create components from titles', run: async () => workspace.edit([
      { op: 'page.attach', page, components: (await bulkTitles(ui)).map(title => ({ title })) },
    ]) },
    interaction: { label: 'Add an interaction', run: async () => workspace.edit([
      { op: 'interaction.add', page, title: await titleInput(ui, 'Interaction title') },
    ]) },
    behavior: { label: 'Edit interaction behavior', run: () => editInteraction(ui, workspace, page) },
    element: { label: 'Reorder or remove an element', run: () => editElement(ui, workspace, page) },
    layout: { label: 'Set page layout', run: async () => workspace.edit([
      { op: 'page.layout', id: page, layout: await choose(ui, 'Layout', ['stack', 'row', 'grid'].map(id => ({ id, label: id }))) },
    ]) },
    rename: { label: 'Rename page', run: async () => workspace.edit([
      { op: 'page.rename', id: page, title: await titleInput(ui, 'Page title', surfaceFor(workspace.document, page).label) },
    ]) },
    undo: { label: 'Undo', run: () => workspace.undo() },
    redo: { label: 'Redo', run: () => workspace.redo() },
  };
}
export async function editPage(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const actions = pageActions(ui, workspace, page);
  const choices = [...Object.entries(actions).map(([id, action]) => ({ id, label: action.label })),
    { id: 'back', label: 'Back to workspace' }];
  while (true) {
    const current = outline(workspace.document).pages.find(item => item.id === page);
    if (!current) return;
    workspaceContext(ui, workspace, `Page / ${current.title}`, page);
    if (!ui.rich) {
      ui.write(`\n${current.title} · ${current.nodes.length} elements · ${current.interactions.length} interactions\n`);
      for (const node of current.nodes) ui.write(`  ${node.title ?? node.id} (${node.id})\n`);
    }
    const action = await choose(ui, 'Sketch this page', choices);
    if (action === 'back') return;
    try { await actions[action]!.run(); }
    catch (error) { reportError(ui, error); }
  }
}
