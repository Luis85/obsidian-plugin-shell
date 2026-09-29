import type { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import { object, list } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { input, choose, titleInput, confirm, reportError, type Prompts } from './prompts.ts';
type Edit = Record<string, unknown>;
async function page(ui: Prompts, workspace: Workspace): Promise<string> {
  const pages = outline(workspace.document).pages;
  requireSketch(pages.length, 'BRICK_REFERENCE', 'Create a page first.');
  return choose(ui, 'Page', pages.map(item => ({ id: item.id, label: item.title })));
}
async function entity(ui: Prompts, workspace: Workspace, source = false): Promise<string> {
  const data = workspace.document.design[source ? 'dataSources' : 'semantic'];
  const rows = data ? list(object(data)[source ? 'sources' : 'entities'], 'bricks').map(object) : [];
  requireSketch(rows.length, 'BRICK_REFERENCE', 'Create this kind of brick first.');
  return choose(ui, source ? 'Data source' : 'Entity', rows.map(item => ({ id: String(item.id), label: String(item.name) })));
}
async function properties(ui: Prompts): Promise<unknown[]> {
  const rows: unknown[] = [];
  ui.write('This replaces the entity property list. Enter all properties to keep. No existing fields are deleted from source code.\n');
  do {
    rows.push({ key: await input(ui, 'Property key'), type: await choose(ui, 'Property type',
      ['text', 'number', 'checkbox', 'date', 'datetime', 'tags', 'list'].map(id => ({ id, label: id }))), required: await confirm(ui, 'Required property?') });
  } while (await confirm(ui, 'Add another property?'));
  return rows;
}
async function journey(ui: Prompts, workspace: Workspace): Promise<Edit> {
  const title = await titleInput(ui, 'Journey title'), pages = [await page(ui, workspace)];
  while (await confirm(ui, 'Add the next journey step?')) pages.push(await page(ui, workspace));
  return { op: 'journey.add', title, pages };
}
async function operation(ui: Prompts, workspace: Workspace, kind: string): Promise<Edit[]> {
  if (['page.add', 'component.add', 'entity.add', 'sitemap.group'].includes(kind)) return [{ op: kind, title: await titleInput(ui, 'Title') }];
  if (kind === 'page.rename') return [{ op: kind, id: await page(ui, workspace), title: await titleInput(ui, 'New page title') }];
  if (kind === 'component.rename') {
    const components = outline(workspace.document).components;
    requireSketch(components.length, 'BRICK_REFERENCE', 'Create a component first.');
    return [{ op: kind, id: await choose(ui, 'Component', components.map(item => ({ id: item.id, label: item.title }))), title: await titleInput(ui, 'New component title') }];
  }
  if (kind === 'page.layout') return [{ op: kind, id: await page(ui, workspace), layout: await choose(ui, 'Layout', ['stack', 'row', 'grid'].map(id => ({ id, label: id }))) }];
  if (kind === 'page.attach') {
    const id = await page(ui, workspace), components = outline(workspace.document).components;
    const choice = await choose(ui, 'Component to attach', [{ id: 'new', label: 'Create new component' }, ...components.map(item => ({ id: item.id, label: item.title }))]);
    return [{ op: kind, page: id, components: [choice === 'new' ? { title: await titleInput(ui, 'Component title') } : { id: choice }] }];
  }
  if (kind === 'data-source.add') return [{ op: kind, title: await titleInput(ui, 'Data-source title'), kind: await choose(ui, 'Data-source kind (specification only)', ['vault', 'api', 'database'].map(id => ({ id, label: id }))) }];
  if (kind === 'entity.properties') return [{ op: kind, id: await entity(ui, workspace), properties: await properties(ui) }];
  if (kind === 'brick.rename') {
    const source = await choose(ui, 'Brick kind', ['entity', 'data-source'].map(id => ({ id, label: id })));
    return [{ op: kind, kind: source, id: await entity(ui, workspace, source === 'data-source'), title: await titleInput(ui, 'New title') }];
  }
  if (kind === 'sitemap.route') return [{ op: kind, page: await page(ui, workspace), path: await input(ui, 'Route path (for example /orders)') }];
  if (kind === 'sitemap.parent') {
    const id = await choose(ui, 'Move page or group', workspace.document.design.nodes.map(item => ({ id: item.id, label: item.label })));
    const parent = await choose(ui, 'Parent', [{ id: 'root', label: 'Top level' }, ...workspace.document.design.nodes.filter(item => item.id !== id).map(item => ({ id: item.id, label: item.label }))]);
    return [{ op: kind, page: id, parent: parent === 'root' ? null : parent }];
  }
  if (kind === 'sitemap.link') return [{ op: kind, from: await page(ui, workspace), to: await page(ui, workspace), title: await titleInput(ui, 'Navigation label') }];
  return [await journey(ui, workspace)];
}
const labels = {
  'page.add': 'Add page', 'page.rename': 'Rename page', 'page.layout': 'Set page layout',
  'component.add': 'Add component', 'component.rename': 'Rename component', 'page.attach': 'Attach component to page',
  'sitemap.group': 'Add sitemap group', 'sitemap.parent': 'Move page/group in sitemap', 'sitemap.route': 'Set route', 'sitemap.link': 'Link pages',
  'entity.add': 'Add entity', 'entity.properties': 'Edit entity properties', 'data-source.add': 'Add data source',
  'brick.rename': 'Rename entity/data source', 'journey.add': 'Add ordered journey',
};
/** Returns the exact successful operations for the setup request; the normal studio shares the same editor. */
export async function editBricks(ui: Prompts, workspace: Workspace): Promise<Edit[]> {
  const operations: Edit[] = [];
  while (true) {
    const summary = outline(workspace.document);
    ui.write(`\nApplication bricks: ${summary.pages.length} pages, ${summary.components.length} components. Data sources describe contracts; no connections are opened.\n`);
    const action = await choose(ui, 'Application bricks', [...Object.entries(labels).map(([id, label]) => ({ id, label })), { id: 'done', label: 'Done' }]);
    if (action === 'done') return operations;
    try { const edits = await operation(ui, workspace, action); workspace.edit(edits); operations.push(...edits); }
    catch (error) { reportError(ui, error); }
  }
}
