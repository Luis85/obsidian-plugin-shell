import { join } from 'node:path';
import { learningAnswered, learningConditionLabel, learningFile, learningProgressCheck, learningWizardId, type LearningCheck } from '../domain/learning-conditions.ts';
import type { LearningCondition, LearningStep } from '../domain/learning-path.ts';
import type { LearningProgress } from '../domain/learning-progress.ts';
import { hookNames } from '../presentation/wizards/registry.ts';
import { guardedText } from './user-settings.ts';
import { catalogIssues, loadCatalog, type DefinitionCatalog } from './wizard-catalog.ts';
/** What a win condition may read: the learner's project root and the shipped form/wizard definitions. */
export interface LearningCheckContext { root: string; definitions: DefinitionCatalog }
/** file-contains compares at most this many characters; a larger file never counts as containing the text. */
const fileLimit = 1_000_000;
const message = (error: unknown) => error instanceof Error ? error.message : 'Check failed.';
/** Bounded, symlink-refusing read inside the project root; a plain substring test, never a pattern. */
async function fileCheck(root: string, condition: LearningCondition, progress: LearningProgress): Promise<[boolean, string | undefined]> {
  const file = learningFile(condition, progress), { content } = await guardedText(root, file);
  if (content === null) return [false, `${file} does not exist yet.`];
  if (condition.kind === 'file-exists') return [true, undefined];
  if (content.length > fileLimit) return [false, `${file} is larger than ${fileLimit} characters.`];
  const needle = learningAnswered(condition.text!, progress);
  return content.includes(needle) ? [true, undefined] : [false, `${file} does not contain ${JSON.stringify(needle)} yet.`];
}
/** The same validation as `node bin/app wizard check`, run on the project's own configs/ folder. */
async function wizardCheck(root: string, condition: LearningCondition, progress: LearningProgress): Promise<[boolean, string | undefined]> {
  const wizard = condition.wizard ? learningWizardId(condition.wizard, progress) : undefined;
  const catalog = await loadCatalog(join(root, 'configs')), issues = catalogIssues(catalog, hookNames());
  if (issues.length) return [false, issues.join(' ')];
  return wizard && !catalog.wizards.has(wizard) ? [false, `wizard check passes, but configs/wizards/${wizard}.json is missing.`] : [true, undefined];
}
async function decide(context: LearningCheckContext, step: LearningStep, condition: LearningCondition, progress: LearningProgress): Promise<[boolean, string | undefined]> {
  const local = learningProgressCheck(step, condition, progress, id => context.definitions.forms.get(id));
  if (local) return local;
  return condition.kind === 'wizard-check' ? wizardCheck(context.root, condition, progress) : fileCheck(context.root, condition, progress);
}
/** Every win condition of a step, in order. A failing check is reported as unmet with its reason, never thrown. */
export async function evaluateLearningStep(context: LearningCheckContext, step: LearningStep, progress: LearningProgress): Promise<LearningCheck[]> {
  const checks: LearningCheck[] = [];
  for (const condition of step.winConditions ?? []) {
    let result: [boolean, string | undefined];
    try { result = await decide(context, step, condition, progress); }
    catch (error) { result = [false, message(error)]; }
    const [met, detail] = result;
    checks.push({ kind: condition.kind, label: learningConditionLabel(condition, progress), met, ...(detail ? { detail } : {}) });
  }
  return checks;
}
