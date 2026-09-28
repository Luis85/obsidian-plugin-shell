import type { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import { surfaceFor } from '../domain/pages.ts';
import { interactions } from '../domain/interactions.ts';
import { input, choose, selectMany, reportError, type Prompts } from './prompts.ts';
async function addExisting(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const selected = await selectMany(ui, 'Add existing components', outline(workspace.document).components.map(item => ({ id: item.id, label: item.title })));
  workspace.edit([{ op: 'page.attach', page, components: selected.map(id => ({ id })) }]);
}
async function editElement(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const nodes = outline(workspace.document).pages.find(item => item.id === page)!.nodes;
  const id = await choose(ui, 'Choose page element', [...nodes.map(node => ({ id: node.id, label: node.title ?? node.id })), { id: 'back', label: 'Back' }]);
  if (id === 'back') return;
  const op = await choose(ui, 'Edit element', [{ id: 'up', label: 'Move up' }, { id: 'down', label: 'Move down' }, { id: 'remove', label: 'Remove instance (keep library definition)' }, { id: 'back', label: 'Back' }]);
  if (op === 'back') return;
  workspace.edit([op === 'remove' ? { op: 'page.remove', page, id } : { op: 'page.move', page, id, direction: op }]);
}
async function editInteraction(ui: Prompts, workspace: Workspace, page: string): Promise<void> {
  const selected = await choose(ui, 'Choose interaction', [...interactions(workspace.document, page).map(({ interaction }) => ({ id: interaction.id, label: interaction.label })), { id: 'back', label: 'Back' }]);
  if (selected === 'back') return;
  const action = await choose(ui, 'Interaction behavior', ['navigate', 'set-state', 'todo', 'rename', 'remove', 'back'].map(id => ({ id, label: id })));
  if (action === 'back') return;
  if (action === 'rename') { workspace.edit([{ op: 'interaction.rename', page, id: selected, title: await input(ui, 'Interaction title') }]); return; }
  if (action === 'remove') { workspace.edit([{ op: 'interaction.remove', page, id: selected }]); return; }
  const change: Record<string, unknown> = { kind: action };
  if (action === 'navigate') change.target = await choose(ui, 'Destination page', outline(workspace.document).pages.map(item => ({ id: item.id, label: item.title })));
  if (action === 'set-state') change.state = await choose(ui, 'Preview state', ['default', 'loading', 'empty', 'error', 'disabled'].map(id => ({ id, label: id })));
  workspace.edit([{ op: 'interaction.action', page, id: selected, action: change }]);
}
interface PageAction { label: string; run: () => unknown }
function pageActions(ui: Prompts, workspace: Workspace, page: string): Record<string, PageAction> {
  return {
    new: { label: 'Create and add a component', run: async () => workspace.edit([
      { op: 'page.attach', page, components: [{ title: await input(ui, 'Component title') }] },
    ]) },
    existing: { label: 'Add existing components (multi-select)', run: () => addExisting(ui, workspace, page) },
    bulk: { label: 'Bulk-create components from titles', run: async () => workspace.edit([
      { op: 'page.attach', page, components: (await input(ui, 'Component titles separated by semicolons'))
        .split(';').map(title => ({ title: title.trim() })) },
    ]) },
    interaction: { label: 'Add an interaction', run: async () => workspace.edit([
      { op: 'interaction.add', page, title: await input(ui, 'Interaction title') },
    ]) },
    behavior: { label: 'Edit interaction behavior', run: () => editInteraction(ui, workspace, page) },
    element: { label: 'Reorder or remove an element', run: () => editElement(ui, workspace, page) },
    layout: { label: 'Set page layout', run: async () => workspace.edit([
      { op: 'page.layout', id: page, layout: await choose(ui, 'Layout', ['stack', 'row', 'grid'].map(id => ({ id, label: id }))) },
    ]) },
    rename: { label: 'Rename page', run: async () => workspace.edit([
      { op: 'page.rename', id: page, title: await input(ui, 'Page title', surfaceFor(workspace.document, page).label) },
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
    ui.write(`\n${current.title} · ${current.nodes.length} elements · ${current.interactions.length} interactions\n`);
    for (const node of current.nodes) ui.write(`  ${node.title ?? node.id} (${node.id})\n`);
    const action = await choose(ui, 'Sketch this page', choices);
    if (action === 'back') return;
    try { await actions[action]!.run(); }
    catch (error) { reportError(ui, error); }
  }
}
