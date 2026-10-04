import { object, keys, text, list } from './data.ts';
import { requireSketch, hasControls } from './errors.ts';
import { assertValidated, readForm, type FormField } from './form.ts';
import { definitionId, readCondition, readPath, type FormCondition } from './form-model.ts';
export type StepKind = 'form' | 'guide' | 'action' | 'message' | 'end';
export interface WizardStep {
  id: string; kind: StepKind; title?: string; details?: string[]; when?: FormCondition; barrier?: boolean; interactive?: boolean; retry?: true | string;
  form?: string; fields?: FormField[]; bind?: string; initial?: string;
  guide?: string; agreement?: boolean; action?: string; with?: Record<string, string>; text?: string;
}
export interface WizardDefinition {
  schemaVersion: 1; id: string; version: number; title: string; description?: string;
  context?: { title: string; details: string[] }; cancelMessage?: string; reportErrors?: boolean; steps: WizardStep[];
}
const common = ['id', 'kind', 'title', 'details', 'when', 'barrier', 'retry'];
const kindKeys: Record<StepKind, string[]> = {
  form: ['form', 'fields', 'bind', 'initial'], guide: ['guide', 'initial', 'bind', 'agreement'],
  action: ['action', 'interactive', 'with'], message: ['text'], end: ['text'],
};
const actionName = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
function templates(value: unknown, name: string): string[] {
  return list(value, name, 12).map((item, index) => {
    requireSketch(typeof item === 'string' && item.length <= 300 && !hasControls(item), 'WIZARD_TEXT', `${name}[${index}] needs single-line text (at most 300 characters).`);
    return item;
  });
}
function formStep(item: Record<string, unknown>, name: string): void {
  requireSketch((item.form === undefined) !== (item.fields === undefined), 'WIZARD_STEP', `${name} needs form or fields.`);
  if (item.form !== undefined) requireSketch(definitionId.test(text(item.form, name + '.form', 80)), 'WIZARD_STEP', `${name}.form must be a form id.`);
  else item.fields = readForm({ schemaVersion: 1, id: 'inline', version: 1, title: name, fields: item.fields }).fields;
}
function stepShape(item: Record<string, unknown>, kind: StepKind, name: string): void {
  if (kind === 'form') formStep(item, name);
  if (kind === 'guide') readPath(item.guide, name + '.guide');
  if (kind === 'action') requireSketch(actionName.test(text(item.action, name + '.action', 80)), 'WIZARD_ACTION', `${name}.action must name a registered action such as settings.load.`);
  if (item.with !== undefined) {
    const parameters = object(item.with);
    for (const [key, entry] of Object.entries(parameters)) requireSketch(/^[a-z][a-zA-Z0-9]*$/.test(key) && typeof entry === 'string' && entry.length <= 1000 && !hasControls(entry), 'WIZARD_ACTION', `${name}.with.${key} must be single-line text.`);
  }
  if (kind === 'message') text(item.text, name + '.text', 4000);
  if (kind === 'end' && item.text !== undefined) text(item.text, name + '.text', 4000);
  for (const key of ['bind', 'initial']) if (item[key] !== undefined) readPath(item[key], `${name}.${key}`);
  for (const key of ['barrier', 'interactive', 'agreement']) requireSketch(item[key] === undefined || typeof item[key] === 'boolean', 'WIZARD_STEP', `${name}.${key} must be boolean.`);
}
function readStep(raw: unknown, index: number, known: Set<string>): WizardStep {
  const item = object(raw), name = `steps[${index}]`, kind = item.kind as StepKind;
  requireSketch(Object.hasOwn(kindKeys, String(kind)), 'WIZARD_KIND', `${name}.kind must be form, guide, action, message or end.`);
  keys(item, [...common, ...kindKeys[kind]]);
  const id = text(item.id, name + '.id', 60);
  requireSketch(definitionId.test(id) && !known.has(id), 'WIZARD_STEP', `${name}.id must be a unique kebab-case id.`);
  if (item.title !== undefined) text(item.title, name + '.title', 200);
  if (item.details !== undefined) item.details = templates(item.details, name + '.details');
  if (item.when !== undefined) item.when = readCondition(item.when, name + '.when', 'path');
  requireSketch(item.retry === undefined || item.retry === true || typeof item.retry === 'string', 'WIZARD_STEP', `${name}.retry must be true or a step id.`);
  stepShape(item, kind, name);
  known.add(id);
  assertValidated<WizardStep>(item);
  return item;
}
/** Structural validation; form, action and retry references are checked against the catalog separately. */
export function readWizard(value: unknown): WizardDefinition {
  const wizard = object(value); keys(wizard, ['$schema', 'schemaVersion', 'id', 'version', 'title', 'description', 'context', 'cancelMessage', 'reportErrors', 'steps']);
  requireSketch(wizard.schemaVersion === 1 && Number.isSafeInteger(wizard.version) && Number(wizard.version) > 0, 'WIZARD_VERSION', 'Unsupported wizard version.');
  requireSketch(definitionId.test(text(wizard.id, 'wizard.id', 80)), 'WIZARD_ID', 'Wizard ids are lowercase kebab-case.');
  text(wizard.title, 'wizard.title', 200);
  if (wizard.description !== undefined) text(wizard.description, 'wizard.description', 2000);
  if (wizard.cancelMessage !== undefined) text(wizard.cancelMessage, 'wizard.cancelMessage', 1000);
  requireSketch(wizard.reportErrors === undefined || typeof wizard.reportErrors === 'boolean', 'WIZARD_ERRORS', 'reportErrors must be boolean.');
  if (wizard.context !== undefined) {
    const context = object(wizard.context); keys(context, ['title', 'details']);
    text(context.title, 'context.title', 200); context.details = context.details === undefined ? [] : templates(context.details, 'context.details');
  }
  const known = new Set<string>();
  wizard.steps = list(wizard.steps, 'steps', 80).map((raw, index) => readStep(raw, index, known));
  requireSketch((wizard.steps as WizardStep[]).length > 0, 'WIZARD_STEPS', 'A wizard needs at least one step.');
  for (const step of wizard.steps as WizardStep[]) requireSketch(typeof step.retry !== 'string' || known.has(step.retry), 'WIZARD_RETRY', `${step.id}.retry must name a step of this wizard.`);
  delete wizard.$schema;
  assertValidated<WizardDefinition>(wizard);
  return wizard;
}
/** Every hook a definition needs from code, so a catalog can fail closed before anything is asked. */
export function stepReferences(step: WizardStep): { forms: string[]; actions: string[]; fields: FormField[] } {
  return { forms: step.form ? [step.form] : [], actions: step.action ? [step.action] : [], fields: step.fields ?? [] };
}
