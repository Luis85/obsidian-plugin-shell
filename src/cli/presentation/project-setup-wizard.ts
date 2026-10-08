import { startWizard } from './wizards/registry.ts';
import type { Prompts } from '#tui/prompts.ts';
interface SetupContext { root: string; frameworkRoot: string; signal?: AbortSignal }
/** configs/wizards/project-setup.json. Git and the vault are preserved; application files are written only after the final review. */
export function projectSetupWizard(ui: Prompts, context: SetupContext): Promise<string | undefined> {
  return startWizard(ui, 'project-setup', { ...context });
}
