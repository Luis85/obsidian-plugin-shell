import { createFilePlan } from '#shared/platform/file-plan.ts';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import { requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import type { LearningPath } from '../domain/learning-path.ts';
import { learningProgressPath, learningSummary, readLearningProgress, type LearningProgress } from '../domain/learning-progress.ts';
import { prepared, type Prepared } from './storage.ts';
import { guardedText, jsonText } from './user-settings.ts';
/**
 * Progress lives in .workbench/learning/<path-id>.json of the learner's project. Like setup checkpoints it is
 * written only through a reviewed, hash-approved file plan whose before-hash must match what was loaded, so a
 * concurrent edit is never overwritten. Unreadable or foreign progress is reported and preserved byte for byte.
 */
export interface LearningProgressSnapshot { progress: LearningProgress | null; beforeHash: string | null }
export async function loadLearningProgress(root: string, path: LearningPath): Promise<LearningProgressSnapshot> {
  const file = learningProgressPath(path.id), snapshot = await guardedText(root, file);
  if (snapshot.content === null) return { progress: null, beforeHash: null };
  try { return { progress: readLearningProgress(parseJsonData(snapshot.content), path), beforeHash: snapshot.beforeHash }; }
  catch (error) {
    throw new SketchError('LEARNING_PROGRESS', `${file} cannot be resumed (${error instanceof Error ? error.message : 'invalid'}); it was left unchanged. Restart explicitly with learn restart --name ${path.id}.`);
  }
}
/** A short, non-throwing summary for listings: invalid progress is shown as such, never repaired. */
export async function learningProgressSummary(root: string, path: LearningPath) {
  try { return learningSummary(path, (await loadLearningProgress(root, path)).progress); }
  catch (error) { return { error: error instanceof SketchError ? error.code : 'LEARNING_PROGRESS' }; }
}
export async function learningProgressPlan(root: string, progress: LearningProgress, beforeHash: string | null): Promise<Prepared> {
  const progressPath = learningProgressPath(progress.path);
  const plan = await createFilePlan(root, [{ path: progressPath, content: jsonText(progress) }]);
  requireSketch(plan.changes[0]!.beforeHash === beforeHash, 'MAKER_STALE', `${progressPath} changed since it was loaded. Nothing was overwritten; reload and continue.`);
  return prepared(plan, { progressPath, path: progress.path, currentStep: progress.currentStep, completed: progress.completed });
}
/** Restarting is explicit: the saved progress, valid or not, is removed through its own reviewed plan. */
export async function restartLearningPlan(root: string, path: LearningPath): Promise<Prepared> {
  const progressPath = learningProgressPath(path.id), snapshot = await guardedText(root, progressPath);
  requireSketch(snapshot.content !== null, 'LEARNING_PROGRESS_MISSING', `No saved progress for ${path.id}.`);
  const plan = await createFilePlan(root, [{ path: progressPath, content: null }]);
  requireSketch(plan.changes[0]!.beforeHash === snapshot.beforeHash, 'MAKER_STALE', `${progressPath} changed during planning.`);
  return prepared(plan, { progressPath, path: path.id, restarted: true });
}
