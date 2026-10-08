import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { loadCollection } from '../adapters/collection-catalog.ts';
import { startWizard } from './wizards/registry.ts';
import type { WizardOptions } from './wizard-runner.ts';
import type { Prompts } from '#tui/prompts.ts';
/** `<root> new|edit|review` in a terminal runs the wizard the collection definition names for that action. */
export async function collectionWizard(ui: Prompts, collection: string, action: string, options: WizardOptions): Promise<string | undefined> {
  const { definition } = await loadCollection(options.root, collection);
  const wizard = action === 'new' ? definition.wizards.new : action === 'edit' ? definition.wizards.edit : action === 'review' ? definition.wizards.review : undefined;
  requireSketch(wizard, 'COLLECTION_INTERACTIVE', `${definition.id} has no ${action} wizard.`);
  return startWizard(ui, wizard, options);
}
