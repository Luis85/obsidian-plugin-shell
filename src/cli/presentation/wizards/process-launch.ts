import { option, type Arguments } from '../../domain/command-options.ts';
import { choose, type Prompts } from '#tui/prompts.ts';
import type { WizardOptions } from '../wizard-runner.ts';
import { startWizard } from './registry.ts';
/** `node bin/app process [new | edit --name <id> | run --name <id>]` in a terminal; bare `process` asks which. */
export async function launchProcess(ui: Prompts, args: Arguments, options: WizardOptions): Promise<string | undefined> {
  const action = args.action || await choose(ui, 'What do you want to do with business processes?', [
    { id: 'run', label: 'Run a process instance' }, { id: 'new', label: 'Create a process' }, { id: 'edit', label: 'Edit a process, its steps, rules and docs' }], 'run');
  const name = option(args, 'name');
  if (action === 'run') return startWizard(ui, 'process-run', options, { name });
  return startWizard(ui, 'process-authoring', options, { mode: action, name });
}
