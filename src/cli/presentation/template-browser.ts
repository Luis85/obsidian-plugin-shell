import type { Workspace } from '../application/workspace.ts';
import { loadComponentTemplates } from '../adapters/component-template-repository.ts';
import { pluginComponentTemplates } from '../sdk/template-contributions.ts';
import type { WorkbenchPluginRuntime } from '../sdk/runtime.ts';
import { choose, titleInput, confirm, type Prompts } from '#tui/prompts.ts';

interface TemplateBrowserOptions {
  root: string;
  frameworkRoot: string;
  plugins?: WorkbenchPluginRuntime;
}

const filters = [
  { id: 'all', label: 'All templates' },
  { id: 'components', label: 'Components' },
  { id: 'components-with-children', label: 'Components with children' },
  { id: 'pages', label: 'Pages' },
  { id: 'pages-with-bricks', label: 'Pages with bricks' },
  { id: 'atom', label: 'Atoms' },
  { id: 'molecule', label: 'Molecules' },
  { id: 'organism', label: 'Organisms' },
  { id: 'template', label: 'Layouts / templates' },
] as const;
function matchesFilter(template: { templateType: string; atomicLevel: string }, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'components') return template.templateType === 'component';
  if (filter === 'components-with-children') return template.templateType === 'component-with-children';
  if (filter === 'pages') return template.templateType === 'page';
  if (filter === 'pages-with-bricks') return template.templateType === 'page-with-bricks';
  return template.atomicLevel === filter;
}

export async function browseComponentTemplates(
  ui: Prompts,
  workspace: Workspace,
  options: TemplateBrowserOptions,
): Promise<void> {
  const templates = options.plugins
    ? [...await options.plugins.commandContext.templates.list()]
    : (await loadComponentTemplates(options.root, options.frameworkRoot, pluginComponentTemplates())).map(entry => entry.template);
  while (true) {
    const filter = await choose(ui, 'Template library', [
      ...filters.map(item => ({ id: item.id, label: item.label })),
      { id: 'back', label: 'Back' },
    ]);
    if (filter === 'back') return;

    const selected = templates.filter(template => matchesFilter(template, filter));
    const id = await choose(ui, 'Choose a template', [
      ...selected.map(template => ({
        id: template.id,
        label: template.name + ' · ' + template.category + ' · ' + template.templateType,
      })),
      { id: 'back', label: 'Back' },
    ]);
    if (id === 'back') continue;

    const template = templates.find(item => item.id === id)!;
    ui.write(
      '\n' + template.name + '\n'
      + template.description + '\n'
      + 'Atomic level: ' + template.atomicLevel
      + ' · Type: ' + template.templateType
      + ' · Children: ' + template.children.length
      + ' · Slots: ' + template.slots.length + '\n',
    );
    if (!await confirm(ui, 'Add this template to the current project?')) continue;
    const name = await titleInput(
      ui,
      template.templateType.startsWith('page') ? 'Page title' : 'Component title',
      template.name,
    );
    const result = workspace.instantiateTemplate(
      templates,
      template.id,
      name,
    );
    ui.write('Added ' + template.name + ' as ' + result.id + '.\n');
  }
}
