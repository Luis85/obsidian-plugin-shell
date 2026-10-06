import type { Context } from '../adapters/framework/contracts.ts';
import { startWizard } from './wizards/registry.ts';
import type { Prompts } from '#tui/prompts.ts';
/** configs/wizards/first-run.json. Execution consent is separate from source generation and always defaults to Skip. */
export function firstRunWizard(ui: Prompts, context: Context): Promise<string | undefined> {
  return startWizard(ui, 'first-run', { ...context });
}
