import type { Workspace } from '../application/workspace.ts';
import { loadComponentTemplates } from '../adapters/component-template-repository.ts';
import { pluginComponentTemplates } from '../../plugins/template-contributions.ts';
import type { WorkbenchPluginRuntime } from '../../plugins/runtime.ts';
import { choose, titleInput, confirm, type Prompts } from './prompts.ts';

interface TemplateBrowserOptions {
  root: string;
  frameworkRoot: string;
  plugins?: WorkbenchPluginRuntime;
}

const levels = ['all', 'atom', 'molecule', 'organism', 'template', 'page'] as const;

export async function browseComponentTemplates(
  ui: Prompts,
  workspace: Workspace,
  options: TemplateBrowserOptions,
): Promise<void> {
  const templates = options.plugins
    ? [...await options.plugins.commandContext.templates.list()]
    : (await loadComponentTemplates(options.root, options.frameworkRoot, pluginComponentTemplates())).map(entry => entry.template);
  while (true) {
    const level = await choose(ui, 'Template library', [
      ...levels.map(id => ({ id, label: id === 'all' ? 'All templates' : id })),
      { id: 'back', label: 'Back' },
    ]);
    if (level === 'back') return;

    const selected = templates.filter(template => level === 'all' || template.atomicLevel === level);
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
