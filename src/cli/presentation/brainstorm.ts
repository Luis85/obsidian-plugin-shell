import { startWizard } from './wizards/registry.ts';
import type { BrainstormWizardOptions } from './brainstorm-steps.ts';
import type { Prompts } from '#tui/prompts.ts';
/**
 * Feature-first brainstorming flow, defined by configs/wizards/brainstorm.json. Project brainstorming is
 * intentionally left as a separate future use-case rather than hiding the existing preset wizard behind the same label.
 */
export function brainstormWizard(ui: Prompts, options: BrainstormWizardOptions): Promise<string | undefined> {
  return startWizard(ui, 'brainstorm', { ...options });
}
