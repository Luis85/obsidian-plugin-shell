import type { Workspace } from '../application/workspace.ts';
import { loadComponentTemplates } from '../adapters/component-template-repository.ts';
import { filterComponentTemplates } from '../application/component-template-catalog.ts';
import { pluginComponentTemplates } from '../../plugins/template-contributions.ts';
import { choose, titleInput, confirm, type Prompts } from './prompts.ts';

interface TemplateBrowserOptions {
  root: string;
  frameworkRoot: string;
}

const levels = ['all', 'atom', 'molecule', 'organism', 'template', 'page'] as const;

export async function browseComponentTemplates(
  ui: Prompts,
  workspace: Workspace,
  options: TemplateBrowserOptions,
): Promise<void> {
  const entries = await loadComponentTemplates(
    options.root,
    options.frameworkRoot,
    pluginComponentTemplates(),
  );
  while (true) {
    const level = await choose(ui, 'Template library', [
      ...levels.map(id => ({ id, label: id === 'all' ? 'All templates' : id })),
      { id: 'back', label: 'Back' },
    ]);
    if (level === 'back') return;

    const selected = filterComponentTemplates(
      entries,
      level === 'all' ? {} : { atomicLevel: level as Exclude<typeof levels[number], 'all'> },
    );
    const id = await choose(ui, 'Choose a template', [
      ...selected.map(entry => ({
        id: entry.template.id,
        label: entry.template.name + ' · ' + entry.template.category + ' · ' + entry.template.templateType,
      })),
      { id: 'back', label: 'Back' },
    ]);
    if (id === 'back') continue;

    const entry = entries.find(item => item.template.id === id)!;
    const template = entry.template;
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
      entries.map(item => item.template),
      template.id,
      name,
    );
    ui.write('Added ' + template.name + ' as ' + result.id + '.\n');
  }
}
