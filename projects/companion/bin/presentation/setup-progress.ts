import { loadSetupCheckpoint, resumeSetupCheckpoint, setupCheckpointPlan } from '../adapters/setup-checkpoint.ts';
import type { SetupDraft } from '../domain/setup-checkpoint.ts';
import { choose, confirm, type Prompts } from './prompts.ts';
import { review } from './review.ts';
export async function beginSetupDraft(ui: Prompts, root: string): Promise<SetupDraft | undefined> {
  if (!(await loadSetupCheckpoint(root)).checkpoint) return { schemaVersion: 1, operations: [] };
  const action = await choose(ui, 'Saved setup progress', [
    { id: 'resume', label: 'Resume saved answers (recheck sources and renew approvals)' },
    { id: 'new', label: 'Start over without deleting the checkpoint' },
    { id: 'exit', label: 'Exit without changes' },
  ], 'resume');
  if (action === 'exit') return;
  return action === 'resume' ? resumeSetupCheckpoint(root) : { schemaVersion: 1, operations: [] };
}
export async function pauseSetup(ui: Prompts, root: string, request: SetupDraft, signal?: AbortSignal): Promise<boolean> {
  if (!await confirm(ui, 'Save setup progress and exit?')) return false;
  if (!await review(ui, await setupCheckpointPlan(root, request), signal)) return false;
  ui.write('Setup answers saved. Run project-setup to resume. No application or execution approval was saved.\n');
  return true;
}
