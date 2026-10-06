import { object, keys, list } from './data.ts';
import { requireSketch } from './errors.ts';
import { definitionId, type FormValues } from './form-model.ts';
import type { LearningPath, LearningStep } from './learning-path.ts';
/**
 * Learner progress for one path: where the learner is, which steps were completed and when, the answers
 * given to step forms, ticked checklist items and wizards run to their end from a step action.
 * It holds no approval of any kind; every save is a separately reviewed file plan.
 */
export interface LearningProgress {
  schemaVersion: 1; producer: 'workbench-learning-progress'; path: string; pathVersion: number; currentStep: string;
  completed: Record<string, string>; answers: FormValues; checklists: Record<string, string[]>; wizards: Record<string, string>; updatedAt: string;
}
/** Personal learner state beside the other Workbench state; ignored by Git (see .gitignore). */
const learningProgressFolder = '.workbench/learning';
export const learningProgressPath = (id: string) => `${learningProgressFolder}/${id}.json`;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function time(value: unknown, name: string): string {
  requireSketch(typeof value === 'string' && timestamp.test(value) && !Number.isNaN(Date.parse(value)), 'LEARNING_PROGRESS', `${name} must be an ISO timestamp.`);
  return value;
}
const record = <T>(): Record<string, T> => Object.create(null);
export function learningStep(path: LearningPath, id: string): LearningStep {
  const step = path.steps.find(item => item.id === id);
  requireSketch(step, 'LEARNING_STEP', `Unknown step ${id} in ${path.id}; use learn show --name ${path.id}.`);
  return step;
}
export function newLearningProgress(path: LearningPath, now: string): LearningProgress {
  return { schemaVersion: 1, producer: 'workbench-learning-progress', path: path.id, pathVersion: path.version, currentStep: path.steps[0]!.id,
    completed: record(), answers: record(), checklists: record(), wizards: record(), updatedAt: now };
}
function readCompleted(value: unknown, path: LearningPath): Record<string, string> {
  const result = record<string>();
  for (const [id, at] of Object.entries(object(value))) { learningStep(path, id); result[id] = time(at, `completed.${id}`); }
  return result;
}
function readChecklists(value: unknown, path: LearningPath): Record<string, string[]> {
  const result = record<string[]>();
  for (const [id, raw] of Object.entries(object(value))) {
    const items = learningStep(path, id).checklist ?? [];
    const ticked = list(raw, `checklists.${id}`, 30);
    requireSketch(ticked.every(item => items.some(entry => entry.id === item)), 'LEARNING_PROGRESS', `checklists.${id} names unknown checklist items.`);
    result[id] = [...new Set(ticked.map(String))];
  }
  return result;
}
function readWizards(value: unknown): Record<string, string> {
  const result = record<string>();
  for (const [id, at] of Object.entries(object(value))) {
    requireSketch(definitionId.test(id), 'LEARNING_PROGRESS', 'wizards must be keyed by wizard id.');
    result[id] = time(at, `wizards.${id}`);
  }
  return result;
}
/**
 * Saved progress must still match the path: every step and checklist item it names exists. A learning path may
 * gain a new version (wording, extra steps) without losing progress; anything that no longer matches fails closed
 * and the saved bytes are left untouched until the learner restarts explicitly.
 */
export function readLearningProgress(value: unknown, path: LearningPath): LearningProgress {
  const raw = object(value);
  keys(raw, ['schemaVersion', 'producer', 'path', 'pathVersion', 'currentStep', 'completed', 'answers', 'checklists', 'wizards', 'updatedAt']);
  requireSketch(raw.schemaVersion === 1 && raw.producer === 'workbench-learning-progress', 'LEARNING_PROGRESS', 'Unknown learning progress file; its bytes are preserved.');
  requireSketch(raw.path === path.id, 'LEARNING_PROGRESS', `Progress belongs to ${String(raw.path)}, not ${path.id}.`);
  requireSketch(Number.isSafeInteger(raw.pathVersion) && Number(raw.pathVersion) > 0, 'LEARNING_PROGRESS', 'pathVersion must be a positive whole number.');
  const current = learningStep(path, String(raw.currentStep)).id;
  const answers = object(raw.answers);
  return { schemaVersion: 1, producer: 'workbench-learning-progress', path: path.id, pathVersion: Number(raw.pathVersion), currentStep: current,
    completed: readCompleted(raw.completed, path), answers: structuredClone(answers), checklists: readChecklists(raw.checklists, path),
    wizards: readWizards(raw.wizards), updatedAt: time(raw.updatedAt, 'updatedAt') };
}
/** Steps are learned in order: a step opens once every earlier step is completed. */
export function learningStepOpen(path: LearningPath, progress: LearningProgress, id: string): boolean {
  const index = path.steps.indexOf(learningStep(path, id));
  return path.steps.slice(0, index).every(step => Object.hasOwn(progress.completed, step.id));
}
/** Record completion and move to the next step (the last step stays current once the path is finished). */
export function completeLearningStep(path: LearningPath, progress: LearningProgress, id: string, now: string): LearningProgress {
  requireSketch(learningStepOpen(path, progress, id), 'LEARNING_ORDER', `Complete the steps before ${id} first.`);
  const next = structuredClone(progress), index = path.steps.indexOf(learningStep(path, id));
  if (!Object.hasOwn(next.completed, id)) next.completed[id] = now;
  next.currentStep = path.steps[index + 1]?.id ?? id;
  next.pathVersion = path.version; next.updatedAt = now;
  return next;
}
export interface LearningSummary { totalSteps: number; completedSteps: number; currentStep: string | null; finished: boolean; started: boolean }
export function learningSummary(path: LearningPath, progress: LearningProgress | null): LearningSummary {
  const completed = progress ? path.steps.filter(step => Object.hasOwn(progress.completed, step.id)).length : 0;
  return { totalSteps: path.steps.length, completedSteps: completed, currentStep: progress?.currentStep ?? null,
    finished: completed === path.steps.length, started: progress !== null };
}
/** Agent input for `learn complete-step`: the step's form answers, ticked checklist items and an optional completion time. */
export interface LearningStepInput { answers?: FormValues; checklist?: string[]; completedAt?: string }
export function readLearningStepInput(value: unknown, step: LearningStep): LearningStepInput {
  const raw = object(value), input: LearningStepInput = {};
  keys(raw, ['schemaVersion', 'answers', 'checklist', 'completedAt']);
  requireSketch(raw.schemaVersion === 1, 'LEARNING_INPUT', 'Expected learning step input schemaVersion 1.');
  if (raw.answers !== undefined) {
    requireSketch(step.bind, 'LEARNING_INPUT', `Step ${step.id} has no form; remove answers.`);
    input.answers = structuredClone(object(raw.answers));
  }
  if (raw.checklist !== undefined) {
    const items = step.checklist ?? [], ticked = list(raw.checklist, 'checklist', 30);
    requireSketch(items.length && ticked.every(id => items.some(item => item.id === id)), 'LEARNING_INPUT', `checklist must name items of step ${step.id}.`);
    input.checklist = [...new Set(ticked.map(String))];
  }
  if (raw.completedAt !== undefined) input.completedAt = time(raw.completedAt, 'completedAt');
  return input;
}
