import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { startWizard } from './wizards/registry.ts';
import type { Prompts } from '#tui/prompts.ts';
export interface ProjectWizardOptions { root: string; frameworkRoot: string; out?: string; starter?: string; signal?: AbortSignal }
/** configs/wizards/new-project.json. Revisiting the starter never carries approval or stale answers into a different project. */
export async function projectWizard(ui: Prompts, options: ProjectWizardOptions): Promise<string | undefined> {
  requireSketch(!options.signal?.aborted, 'CANCELLED', 'Project creation cancelled.');
  return startWizard(ui, 'new-project', { ...options });
}
