import { option, type Arguments } from '../../domain/command-options.ts';
import { readWizard } from '../../domain/wizard.ts';
import { choose, type Prompts } from '#tui/prompts.ts';
import { runWizard, type WizardOptions } from '../wizard-runner.ts';
import { wizardCatalog, wizardRegistry } from './registry.ts';
/** A standalone form run is itself a small wizard: fill in, review, and optionally save through a reviewed plan. */
function formWizard(id: string, title: string, out: string) {
  return readWizard({ schemaVersion: 1, id: 'form-' + id, version: 1, title, steps: [
    { id: 'fill', kind: 'form', form: id, bind: 'result' },
    { id: 'review', kind: 'action', action: 'wizard.review', with: { value: 'result', title: 'Review ' + title } },
    ...(out ? [{ id: 'save', kind: 'action', action: 'wizard.save-json', with: { value: 'result', file: out } },
      { id: 'saved', kind: 'end', text: `Form ${id} saved to ${out}.` }] : []),
  ] });
}
/** `node bin/app wizard [--name <id>]` and `node bin/app form [--name <id>] [--out <file.json>]` in a terminal. */
export async function launchDefinition(ui: Prompts, args: Arguments, options: WizardOptions): Promise<string | undefined> {
  const catalog = await wizardCatalog(), kind = args.command;
  const table = kind === 'wizard' ? catalog.wizards : catalog.forms;
  const id = option(args, 'name') || await choose(ui, kind === 'wizard' ? 'Which guided process do you want to run?' : 'Which form do you want to fill in?',
    [...table.values()].map(item => ({ id: item.id, label: item.description ? `${item.title} — ${item.description}` : item.title })));
  if (kind === 'wizard') return runWizard(ui, catalog, wizardRegistry, id, options);
  const form = catalog.forms.get(id), wizard = formWizard(id, form?.title ?? id, option(args, 'out'));
  return runWizard(ui, { ...catalog, wizards: new Map([[wizard.id, wizard]]) }, wizardRegistry, wizard.id, options);
}
