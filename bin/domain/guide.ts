import { object, keys, text, list } from './data.ts';
import { requireSketch } from './errors.ts';
export type Answer = string | string[] | boolean;
export type Answers = Record<string, Answer>;
export interface Condition { field: string; equals?: Answer; notEquals?: Answer }
export interface GuideField {
  id: string; label: string; help: string; kind: 'text' | 'list' | 'select' | 'confirm';
  default: Answer; required?: boolean; choices?: string[]; when?: Condition;
}
export interface Guide {
  schemaVersion: 1; id: string; version: number; title: string;
  steps: { title: string; fields: GuideField[] }[];
  constraints: { field: string; equals?: Answer; notEquals?: Answer; message: string }[];
  artifacts: { path: string; template: string }[];
}
export function visible(condition: Condition | undefined, answers: Answers): boolean {
  if (!condition) return true;
  const value = JSON.stringify(answers[condition.field]);
  return condition.equals !== undefined ? value === JSON.stringify(condition.equals) : value !== JSON.stringify(condition.notEquals);
}
function condition(value: unknown, known: Set<string>): void {
  const item = object(value); keys(item, ['field', 'equals', 'notEquals', 'message']);
  requireSketch(known.has(text(item.field, 'condition.field')), 'GUIDE_CONDITION', 'Conditions must reference an earlier declared field.');
  requireSketch((item.equals !== undefined) !== (item.notEquals !== undefined), 'GUIDE_CONDITION', 'Conditions need exactly one equals/notEquals comparison.');
}
function field(value: unknown, known: Set<string>): void {
  const item = object(value); keys(item, ['id', 'label', 'help', 'kind', 'default', 'required', 'choices', 'when']);
  const id = text(item.id, 'field.id');
  requireSketch(/^[a-z][a-zA-Z0-9]*$/.test(id) && !known.has(id) && !['constructor', 'prototype'].includes(id), 'GUIDE_FIELD', 'Field IDs must be safe and unique.');
  text(item.label, 'field.label'); text(item.help, 'field.help', 2000);
  requireSketch(['text', 'list', 'select', 'confirm'].includes(String(item.kind)), 'GUIDE_KIND', 'Unsupported field kind.');
  if (item.required !== undefined) requireSketch(typeof item.required === 'boolean', 'GUIDE_FIELD', 'required must be boolean.');
  if (item.when !== undefined) condition(item.when, known);
  if (item.kind === 'select') {
    const choices = list(item.choices, 'choices');
    requireSketch(choices.length > 0 && choices.every(choice => typeof choice === 'string') && new Set(choices).size === choices.length, 'GUIDE_CHOICES', 'Select fields need unique text choices.');
  }
  known.add(id);
}
export function readGuide(value: unknown): Guide {
  const guide = object(value); keys(guide, ['schemaVersion', 'id', 'version', 'title', 'steps', 'constraints', 'artifacts']);
  requireSketch(guide.schemaVersion === 1 && Number.isSafeInteger(guide.version) && Number(guide.version) > 0, 'GUIDE_VERSION', 'Unsupported guide version.');
  text(guide.id, 'guide.id'); text(guide.title, 'guide.title');
  const known = new Set<string>();
  for (const raw of list(guide.steps, 'steps', 30)) {
    const step = object(raw); keys(step, ['title', 'fields']); text(step.title, 'step.title');
    for (const item of list(step.fields, 'fields', 50)) field(item, known);
  }
  requireSketch(known.has('title'), 'GUIDE_TITLE', 'A guide must declare title.');
  for (const raw of list(guide.constraints, 'constraints')) { condition(raw, known); text(object(raw).message, 'constraint.message', 1000); }
  for (const raw of list(guide.artifacts, 'artifacts')) { const item = object(raw); keys(item, ['path', 'template']); text(item.path, 'artifact.path', 200); text(item.template, 'artifact.template', 50000); }
  assertGuide(guide);
  for (const item of guide.steps.flatMap(step => step.fields)) answer(item, item.default, false);
  return guide;
}
/** All structure is checked above; this assertion keeps consumers on a single validated boundary. */
function assertGuide(value: Record<string, unknown>): asserts value is Record<string, unknown> & Guide {
  requireSketch(Array.isArray(value.steps) && Array.isArray(value.constraints) && Array.isArray(value.artifacts), 'GUIDE_SHAPE', 'Incomplete guide.');
}
function listAnswer(field: GuideField, value: unknown, required: boolean): string[] {
  const items = list(value, field.label).map(item => text(item, field.label, 2000));
  requireSketch(!required || !field.required || items.length > 0, 'GUIDE_ANSWER', `${field.label} needs at least one item.`);
  return items;
}
export function answer(field: GuideField, value: unknown, required = true): Answer {
  if (field.kind === 'confirm') { requireSketch(typeof value === 'boolean', 'GUIDE_ANSWER', `${field.label} needs true/false.`); return value; }
  if (field.kind === 'list') return listAnswer(field, value, required);
  requireSketch(typeof value === 'string' && value.length <= 10000, 'GUIDE_ANSWER', `${field.label} needs bounded text.`);
  if (field.kind === 'select') requireSketch(field.choices?.includes(value), 'GUIDE_ANSWER', `${field.label}: choose ${field.choices?.join(', ')}.`);
  if (required && field.required) text(value, field.label, 10000);
  return value ? text(value, field.label, 10000) : '';
}
export function resolveAnswers(guide: Guide, input: unknown): { answers: Answers; pending: string[] } {
  const source = object(input), answers: Answers = Object.create(null), fields = guide.steps.flatMap(step => step.fields);
  keys(source, fields.map(item => item.id));
  for (const field of fields) {
    if (visible(field.when, answers)) answers[field.id] = answer(field, Object.hasOwn(source, field.id) ? source[field.id] : field.default);
    else requireSketch(source[field.id] === undefined, 'GUIDE_INACTIVE_FIELD', `${field.id} is not active in this guide branch.`);
  }
  const pending = guide.constraints.filter(rule => !visible(rule, answers)).map(rule => rule.message);
  return { answers, pending };
}
function formatAnswer(value: Answer | undefined): string {
  return Array.isArray(value) ? value.map(item => `- ${item}`).join('\n') : String(value);
}
export function guideBrief(guide: Guide, answers: Answers): string {
  return guide.steps.map(step => `## ${step.title}\n\n` + step.fields.filter(field => visible(field.when, answers) && Object.hasOwn(answers, field.id))
    .map(field => `### ${field.label}\n\n${formatAnswer(answers[field.id])}\n`).join('\n')).join('\n');
}
/** Literal token replacement only. A guide can supply data, never executable JS or process commands. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => {
    requireSketch(Object.hasOwn(values, key), 'GUIDE_TOKEN', `Unknown template token ${key}.`);
    return values[key]!;
  });
}
