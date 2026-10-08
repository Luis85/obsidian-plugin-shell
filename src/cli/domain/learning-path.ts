import { object, keys, text, list } from './data.ts';
import { requireSketch, hasControls } from '#shared/contracts/sketch-errors.ts';
import { assertValidated, readForm, type FormField } from './form.ts';
import { definitionId, readCondition, readPath, type FormCondition } from './form-model.ts';
import { readLearningMarkdown, readLearningDocTarget, readLearningContentFile } from './learning-markdown.ts';
/**
 * Learning paths (courses): ordered, step-by-step tutorials in configs/learning/paths. A step may teach with
 * Markdown and documentation links, ask a form, offer a checklist and safe named actions, and decides its own
 * completion through data-only win conditions. Definitions never contain code or shell commands to execute.
 */
export type LearningActionKind = 'wizard' | 'form' | 'command';
export interface LearningAction { id: string; kind: LearningActionKind; label: string; wizard?: string; form?: string; bind?: string; command?: string }
export interface LearningChecklistItem { id: string; label: string; required: boolean }
export type LearningConditionKind = 'checklist-complete' | 'form-valid' | 'answer' | 'file-exists' | 'file-contains' | 'wizard-completed' | 'wizard-check';
export interface LearningCondition { kind: LearningConditionKind; label?: string; when?: FormCondition; file?: string; text?: string; wizard?: string }
export interface LearningStep {
  id: string; title: string; goal: string; markdown?: string | { file: string }; docs?: string[];
  form?: string; fields?: FormField[]; bind?: string; checklist?: LearningChecklistItem[]; actions?: LearningAction[]; winConditions?: LearningCondition[];
}
export interface LearningPath {
  schemaVersion: 1; id: string; version: number; title: string; summary: string; skill: string; audience: string;
  prerequisites: string[]; estimatedMinutes: number; steps: LearningStep[];
}
const conditionKeys: Record<LearningConditionKind, string[]> = {
  'checklist-complete': [], 'form-valid': [], answer: ['path', 'equals', 'notEquals', 'present'],
  'file-exists': ['file'], 'file-contains': ['file', 'text'], 'wizard-completed': ['wizard'], 'wizard-check': ['wizard'],
};
const actionKeys: Record<LearningActionKind, string[]> = { wizard: ['wizard'], form: ['form', 'bind'], command: ['command'] };
/** Display-only commands teach this repository's own CLI; they are shown, never executed. */
const commandPattern = /^(?:node bin\/app|npm run) [A-Za-z0-9 ./:=@<>_-]+$/;
const templatePattern = /^[A-Za-z0-9./_{}|-]+$/;
/** Single-line text; `data.text` alone would also accept newlines. */
export function learningLine(value: unknown, name: string, max: number): string {
  const result = text(value, name, max);
  requireSketch(!hasControls(result), 'LEARNING_TEXT', `${name} must be a single line.`);
  return result;
}
function uniqueId(value: unknown, name: string, known: Set<string>): string {
  const id = learningLine(value, name, 60);
  requireSketch(definitionId.test(id) && !known.has(id), 'LEARNING_ID', `${name} must be a unique kebab-case id.`);
  known.add(id);
  return id;
}
/** File and wizard templates may use inert `{{path}}` answers; the rendered value is checked again before use. */
function template(value: unknown, name: string): string {
  const result = learningLine(value, name, 200);
  requireSketch(templatePattern.test(result) && !result.includes('..'), 'LEARNING_TEMPLATE', `${name} must be a project-relative path or id template.`);
  return result;
}
/** A wizard id, or a template such as `{{plan.wizardId}}` naming the wizard the learner authored. */
function wizardTemplate(value: unknown, name: string): string {
  const id = template(value, name);
  requireSketch(definitionId.test(id) || /^\{\{[A-Za-z][A-Za-z0-9.]*\}\}$/.test(id), 'LEARNING_WIZARD', `${name} must be a wizard id or one {{answer}} template.`);
  return id;
}
function readChecklist(value: unknown, name: string): LearningChecklistItem[] {
  const known = new Set<string>();
  const items = list(value, name, 30).map((raw, index) => {
    const item = object(raw), where = `${name}[${index}]`; keys(item, ['id', 'label', 'required']);
    requireSketch(item.required === undefined || typeof item.required === 'boolean', 'LEARNING_CHECKLIST', `${where}.required must be boolean.`);
    return { id: uniqueId(item.id, where + '.id', known), label: learningLine(item.label, where + '.label', 300), required: item.required !== false };
  });
  requireSketch(items.length > 0, 'LEARNING_CHECKLIST', `${name} needs at least one item.`);
  return items;
}
function readAction(raw: unknown, where: string, known: Set<string>): LearningAction {
  const item = object(raw), kind = item.kind as LearningActionKind;
  requireSketch(Object.hasOwn(actionKeys, String(kind)), 'LEARNING_ACTION', `${where}.kind must be wizard, form or command.`);
  keys(item, ['id', 'kind', 'label', ...actionKeys[kind]]);
  const action: LearningAction = { id: uniqueId(item.id, where + '.id', known), kind, label: learningLine(item.label, where + '.label', 200) };
  if (kind === 'command') {
    action.command = learningLine(item.command, where + '.command', 300);
    requireSketch(commandPattern.test(action.command), 'LEARNING_COMMAND', `${where}.command must be a displayed node bin/app or npm run command line.`);
    return action;
  }
  if (kind === 'wizard') { action.wizard = wizardTemplate(item.wizard, where + '.wizard'); return action; }
  action.form = learningLine(item.form, where + '.form', 80);
  requireSketch(definitionId.test(action.form), 'LEARNING_ACTION', `${where}.form must be a form id.`);
  action.bind = readPath(item.bind, where + '.bind');
  return action;
}
function readWinCondition(raw: unknown, where: string): LearningCondition {
  const item = object(raw), kind = item.kind as LearningConditionKind;
  requireSketch(Object.hasOwn(conditionKeys, String(kind)), 'LEARNING_CONDITION', `${where}.kind is not a supported win condition.`);
  keys(item, ['kind', 'label', ...conditionKeys[kind]]);
  const condition: LearningCondition = { kind };
  if (item.label !== undefined) condition.label = learningLine(item.label, where + '.label', 200);
  if (kind === 'answer') {
    const comparison = Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'kind' && key !== 'label'));
    condition.when = readCondition(comparison, where, 'path');
  }
  if (kind === 'file-exists' || kind === 'file-contains') condition.file = template(item.file, where + '.file');
  if (kind === 'file-contains') condition.text = learningLine(item.text, where + '.text', 300);
  if (item.wizard !== undefined || kind === 'wizard-completed') condition.wizard = wizardTemplate(item.wizard, where + '.wizard');
  return condition;
}
function readStepForm(item: Record<string, unknown>, name: string): void {
  if (item.form === undefined && item.fields === undefined) {
    requireSketch(item.bind === undefined, 'LEARNING_FORM', `${name}.bind needs form or fields.`);
    return;
  }
  requireSketch((item.form === undefined) !== (item.fields === undefined), 'LEARNING_FORM', `${name} needs form or fields, not both.`);
  if (item.form !== undefined) requireSketch(definitionId.test(learningLine(item.form, name + '.form', 80)), 'LEARNING_FORM', `${name}.form must be a form id.`);
  else item.fields = readForm({ schemaVersion: 1, id: 'inline', version: 1, title: name, fields: item.fields }).fields;
  item.bind = readPath(item.bind, name + '.bind');
}
function readStepContent(item: Record<string, unknown>, name: string): void {
  if (typeof item.markdown === 'string') item.markdown = readLearningMarkdown(item.markdown, name + '.markdown', 20000);
  else if (item.markdown !== undefined) {
    const reference = object(item.markdown); keys(reference, ['file']);
    item.markdown = { file: readLearningContentFile(reference.file, name + '.markdown.file') };
  }
  if (item.docs !== undefined) item.docs = list(item.docs, name + '.docs', 20).map((entry, index) => readLearningDocTarget(entry, `${name}.docs[${index}]`));
}
/** Conditions that read a step element need that element; an unreachable condition fails at load time. */
function requireConditionSources(step: LearningStep, name: string): void {
  for (const condition of step.winConditions ?? []) {
    requireSketch(condition.kind !== 'checklist-complete' || step.checklist, 'LEARNING_CONDITION', `${name}: checklist-complete needs a checklist.`);
    requireSketch(condition.kind !== 'form-valid' || step.bind, 'LEARNING_CONDITION', `${name}: form-valid needs a form or fields.`);
    requireSketch(condition.kind !== 'wizard-completed' || step.actions?.some(action => action.wizard === condition.wizard), 'LEARNING_CONDITION',
      `${name}: wizard-completed ${condition.wizard} needs a wizard action in the same step.`);
  }
}
function readStep(raw: unknown, index: number, known: Set<string>): LearningStep {
  const item = object(raw), name = `steps[${index}]`;
  keys(item, ['id', 'title', 'goal', 'markdown', 'docs', 'form', 'fields', 'bind', 'checklist', 'actions', 'winConditions']);
  uniqueId(item.id, name + '.id', known);
  learningLine(item.title, name + '.title', 200);
  text(item.goal, name + '.goal', 1000);
  readStepContent(item, name);
  readStepForm(item, name);
  if (item.checklist !== undefined) item.checklist = readChecklist(item.checklist, name + '.checklist');
  const actions = new Set<string>();
  if (item.actions !== undefined) item.actions = list(item.actions, name + '.actions', 12).map((entry, position) => readAction(entry, `${name}.actions[${position}]`, actions));
  if (item.winConditions !== undefined) item.winConditions = list(item.winConditions, name + '.winConditions', 12).map((entry, position) => readWinCondition(entry, `${name}.winConditions[${position}]`));
  assertValidated<LearningStep>(item);
  requireConditionSources(item, name);
  return item;
}
/** Structural validation; form, wizard, prerequisite, content and documentation references are checked by the catalog. */
export function readLearningPath(value: unknown): LearningPath {
  const path = object(value);
  keys(path, ['$schema', 'schemaVersion', 'id', 'version', 'title', 'summary', 'skill', 'audience', 'prerequisites', 'estimatedMinutes', 'steps']);
  requireSketch(path.schemaVersion === 1 && Number.isSafeInteger(path.version) && Number(path.version) > 0, 'LEARNING_VERSION', 'Unsupported learning path version.');
  requireSketch(definitionId.test(learningLine(path.id, 'path.id', 80)), 'LEARNING_ID', 'Learning path ids are lowercase kebab-case.');
  learningLine(path.title, 'path.title', 200); learningLine(path.skill, 'path.skill', 200); learningLine(path.audience, 'path.audience', 300);
  text(path.summary, 'path.summary', 2000);
  requireSketch(Number.isSafeInteger(path.estimatedMinutes) && Number(path.estimatedMinutes) > 0 && Number(path.estimatedMinutes) <= 6000, 'LEARNING_ESTIMATE', 'estimatedMinutes must be a whole number of minutes.');
  path.prerequisites = list(path.prerequisites ?? [], 'prerequisites', 20).map((entry, index) => {
    const id = learningLine(entry, `prerequisites[${index}]`, 80);
    requireSketch(definitionId.test(id) && id !== path.id, 'LEARNING_PREREQUISITE', `prerequisites[${index}] must name another learning path.`);
    return id;
  });
  requireSketch(new Set(path.prerequisites as string[]).size === (path.prerequisites as string[]).length, 'LEARNING_PREREQUISITE', 'Prerequisites must be unique.');
  const known = new Set<string>();
  path.steps = list(path.steps, 'steps', 60).map((raw, index) => readStep(raw, index, known));
  requireSketch((path.steps as LearningStep[]).length > 0, 'LEARNING_STEPS', 'A learning path needs at least one step.');
  delete path.$schema;
  assertValidated<LearningPath>(path);
  return path;
}
/** Prerequisite cycles, reported as readable chains; unknown prerequisites are reported separately. */
export function learningPrerequisiteIssues(paths: ReadonlyMap<string, LearningPath>): string[] {
  const issues: string[] = [], done = new Set<string>();
  const visit = (id: string, trail: string[]): void => {
    if (trail.includes(id)) { issues.push(`path ${trail[0]}: prerequisite cycle ${[...trail.slice(trail.indexOf(id)), id].join(' → ')}.`); return; }
    if (done.has(id)) return;
    const path = paths.get(id);
    for (const next of path?.prerequisites ?? []) {
      if (paths.has(next)) visit(next, [...trail, id]);
      else issues.push(`path ${id}: unknown prerequisite ${next}.`);
    }
    done.add(id);
  };
  for (const id of paths.keys()) visit(id, []);
  return [...new Set(issues)];
}
