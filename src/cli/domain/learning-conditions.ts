import { hasPortableProjectSegments, hasProtectedProjectRoot } from '#shared/platform/project-path.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { FormDefinition } from './form.ts';
import { getPath, matches, renderText, definitionId, type FormCondition, type FormValues } from './form-model.ts';
import { formValueIssues } from './form-values.ts';
import type { LearningCondition, LearningConditionKind, LearningStep } from './learning-path.ts';
import type { LearningProgress } from './learning-progress.ts';
/** One evaluated win condition. A step counts as completed only when every condition is met. */
export interface LearningCheck { kind: LearningConditionKind; label: string; met: boolean; detail?: string }
export type LearningFormLookup = (id: string) => FormDefinition | undefined;
function comparison(when: FormCondition): string {
  if (when.present !== undefined) return when.present ? 'is answered' : 'is not answered';
  return when.equals !== undefined ? `equals ${JSON.stringify(when.equals)}` : `is not ${JSON.stringify(when.notEquals)}`;
}
const defaults: Record<LearningConditionKind, (condition: LearningCondition) => string> = {
  'checklist-complete': () => 'All required checklist items are ticked',
  'form-valid': () => 'The step form is complete and valid',
  answer: condition => `Answer ${condition.when!.path} ${comparison(condition.when!)}`,
  'file-exists': condition => `File ${condition.file} exists`,
  'file-contains': condition => `File ${condition.file} contains ${JSON.stringify(condition.text)}`,
  'wizard-completed': condition => `Wizard ${condition.wizard} was run to its end from this step`,
  'wizard-check': condition => condition.wizard ? `wizard check passes and lists ${condition.wizard}` : 'wizard check passes',
};
const placeholders = /\{\{([A-Za-z][A-Za-z0-9.]*)(?:\|([^}]*))?\}\}/g;
/** Every `{{path}}` without a fallback names a given answer; otherwise the condition cannot be decided yet. */
function missingAnswer(template: string, progress: LearningProgress): string | undefined {
  for (const [, path, fallback] of template.matchAll(placeholders)) {
    const value = getPath(progress.answers, path!);
    if (fallback === undefined && (value === undefined || value === null || value === '')) return path;
  }
  return undefined;
}
/** Renders a template against the learner's answers (literal substitution) and refuses missing answers. */
export function learningAnswered(template: string, progress: LearningProgress): string {
  const missing = missingAnswer(template, progress);
  requireSketch(missing === undefined, 'LEARNING_ANSWER', `Answer ${missing} in an earlier step first.`);
  return renderText(template, progress.answers);
}
/** Labels render answers once they exist and otherwise keep the template visible. */
export function learningConditionLabel(condition: LearningCondition, progress: LearningProgress): string {
  const label = condition.label ?? defaults[condition.kind](condition);
  return missingAnswer(label, progress) === undefined ? renderText(label, progress.answers) : label;
}
/** A rendered file template must stay a portable project-relative path outside protected roots. */
export function learningFile(condition: LearningCondition, progress: LearningProgress): string {
  const file = learningAnswered(condition.file!, progress);
  requireSketch(hasPortableProjectSegments(file) && !hasProtectedProjectRoot(file), 'LEARNING_FILE', `${file} is not a safe project-relative file.`);
  return file;
}
export function learningWizardId(template: string, progress: LearningProgress): string {
  const id = learningAnswered(template, progress);
  requireSketch(definitionId.test(id), 'LEARNING_WIZARD', `${id} is not a wizard id (lowercase kebab-case).`);
  return id;
}
/** The form a step asks: a catalog form or its inline fields. */
export function learningStepForm(step: LearningStep, lookup: LearningFormLookup): FormDefinition | undefined {
  if (step.fields) return { schemaVersion: 1, id: 'inline', version: 1, title: step.title, fields: step.fields };
  return step.form ? lookup(step.form) : undefined;
}
function checklistResult(step: LearningStep, progress: LearningProgress): [boolean, string | undefined] {
  const ticked = progress.checklists[step.id] ?? [];
  const open = (step.checklist ?? []).filter(item => item.required && !ticked.includes(item.id)).map(item => item.label);
  return [!open.length, open.length ? 'Still open: ' + open.join('; ') : undefined];
}
function formResult(step: LearningStep, progress: LearningProgress, lookup: LearningFormLookup): [boolean, string | undefined] {
  const value = getPath(progress.answers, step.bind!), form = learningStepForm(step, lookup);
  if (!form) return [false, `Unknown form ${step.form}.`];
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) return [false, 'Fill in the step form first.'];
  const issues = formValueIssues(form, value, lookup);
  return [!issues.length, issues.length ? issues.map(issue => issue.message).join(' ') : undefined];
}
/**
 * Conditions decided from progress alone. File and catalog conditions need the project and return undefined here;
 * the adapter evaluates them with bounded, link-refusing reads.
 */
export function learningProgressCheck(step: LearningStep, condition: LearningCondition, progress: LearningProgress, lookup: LearningFormLookup): [boolean, string | undefined] | undefined {
  switch (condition.kind) {
    case 'checklist-complete': return checklistResult(step, progress);
    case 'form-valid': return formResult(step, progress, lookup);
    case 'answer': return [matches(condition.when, getPath(progress.answers, condition.when!.path!)), undefined];
    case 'wizard-completed': return [Object.hasOwn(progress.wizards, learningWizardId(condition.wizard!, progress)), undefined];
    default: return undefined;
  }
}
/** Merge answers given for one step (or one action) into the shared answers object at its bind path. */
export function learningAnswersAt(progress: LearningProgress, bind: string): FormValues {
  const current = getPath(progress.answers, bind);
  return current !== null && typeof current === 'object' && !Array.isArray(current) ? structuredClone(current as FormValues) : Object.create(null);
}
