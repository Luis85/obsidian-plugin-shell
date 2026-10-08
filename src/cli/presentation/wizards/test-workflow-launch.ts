import { option, type Arguments } from '../../domain/command-options.ts';
import { choose, type Prompts } from '#tui/prompts.ts';
import type { WizardOptions } from '../wizard-runner.ts';
import { startWizard } from './registry.ts';
/** `node bin/app workflow [new | edit --name <id>]` in a terminal; bare `workflow` asks which. */
export async function launchTestWorkflow(ui: Prompts, args: Arguments, options: WizardOptions): Promise<string | undefined> {
  const action = args.action || await choose(ui, 'What do you want to do with browser test workflows?', [
    { id: 'new', label: 'Create a workflow' }, { id: 'edit', label: 'Edit a workflow, its target, test data and steps' }], 'new');
  return startWizard(ui, 'workflow-authoring', options, { mode: action, name: option(args, 'name') });
}
