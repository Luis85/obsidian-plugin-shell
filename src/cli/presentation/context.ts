import type { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import type { Prompts } from '#tui/prompts.ts';
/** The context column is a projection, never a second editable document. */
export function workspaceContext(ui: Prompts, workspace: Workspace, location = 'Workspace', pageId?: string): void {
  if (!ui.rich) return;
  const model = outline(workspace.document), page = model.pages.find(item => item.id === pageId);
  const details = [`${model.pages.length} pages`, `${model.components.length} reusable components`, '',
    ...(page ? [page.title, ...page.nodes.map(node => `  ${node.title ?? node.id}`)] : model.pages.map(item => item.title))];
  ui.rich.context({ title: model.project.name, location, dirty: workspace.dirty, details });
}
