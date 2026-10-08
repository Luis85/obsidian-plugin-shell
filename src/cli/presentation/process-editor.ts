import { requireSketch, slug, SketchError } from '#shared/contracts/sketch-errors.ts';
import { readForm, type FormField } from '../domain/form.ts';
import type { FormValues } from '../domain/form-model.ts';
import { readRuleClause, ruleClauses, ruleText, type RuleExpression } from '../domain/process-rules.ts';
import { processSeverities, type ProcessDoc, type ProcessRole, type ProcessRule, type ProcessStep, type ProcessTransition } from '../domain/process.ts';
import { formDefinition, runForm } from './form-runner.ts';
import { Back, choose, confirm, reportError } from '#tui/prompts.ts';
import type { ActionContext } from './wizard-runner.ts';
/**
 * Authoring views: each form edits a flat view of a role, step or rule, and code turns it back into the definition.
 * Conditions and inline fields are written as short lines; an unchanged line keeps the original JSON exactly, so
 * nested conditions and field details authored in JSON survive an interactive edit.
 */
const textOf = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const linesOf = (value: unknown) => Array.isArray(value) ? value.map(textOf).filter(Boolean) : [];
function notes(text: unknown, previous: ProcessDoc | undefined): { doc?: ProcessDoc } {
  const doc = { ...previous?.file ? { file: previous.file } : {}, ...textOf(text) ? { text: textOf(text) } : {} };
  return doc.file || doc.text ? { doc } : {};
}
const optional = <K extends string>(key: K, value: string) => value ? { [key]: value } : {};
export function roleView(role?: ProcessRole): FormValues {
  return { title: role?.title ?? '', description: role?.description ?? '' };
}
export function roleFromView(view: FormValues, previous: ProcessRole | undefined, used: string[]): ProcessRole {
  return { id: previous?.id ?? slug(textOf(view.title), 'role', used), title: textOf(view.title), ...optional('description', textOf(view.description)) };
}
const simpleKinds = new Set(['text', 'title', 'number', 'boolean', 'list', 'select', 'multi']), requirable = new Set(['text', 'list', 'multi']);
/** `id:kind:Label`, `id:kind*:Label` (required) or `id:select=a/b:Label`. */
function fieldLine(field: FormField): string {
  const choices = field.choices ? '=' + field.choices.map(item => item.id).join('/') : '';
  return `${field.id}:${field.kind}${choices}${field.required ? '*' : ''}:${field.label}`;
}
function parseField(line: string, previous: readonly FormField[]): unknown {
  const match = /^([a-z][a-zA-Z0-9]*):([a-z]+)(?:=([^:*]+))?(\*)?:(.+)$/.exec(line);
  requireSketch(match, 'PROCESS_FIELD_LINE', `${line}: write fields as id:kind:Label, for example decision:select=approve/reject:Decision.`);
  const [, id, kind, choices, required, label] = match, before = previous.find(item => item.id === id && item.kind === kind);
  requireSketch(before || simpleKinds.has(kind!), 'PROCESS_FIELD_LINE', `${line}: ${kind} fields are defined in the process JSON; inline lines support ${[...simpleKinds].join(', ')}.`);
  requireSketch(!required || requirable.has(kind!), 'PROCESS_FIELD_LINE', `${line}: * (required) applies to text, list and multi fields; numbers, choices and titles are always answered.`);
  const field: FormValues = { ...before, id, kind, label: label!.trim(), ...choices ? { choices: choices.split('/').map(item => item.trim()) } : {} };
  delete field.required;
  return required ? { ...field, required: true } : field;
}
function fieldsFromLines(lines: string[], previous: readonly FormField[]): FormField[] {
  return readForm({ schemaVersion: 1, id: 'inline', version: 1, title: 'Step input', fields: lines.map(line => parseField(line, previous)) }).fields;
}
function keptExpressions(expressions: Array<RuleExpression | undefined>): Map<string, RuleExpression> {
  const kept = new Map<string, RuleExpression>();
  for (const expression of expressions) if (expression) {
    kept.set(ruleText(expression), expression);
    for (const child of 'all' in expression ? expression.all : 'any' in expression ? expression.any : []) kept.set(ruleText(child), child);
  }
  return kept;
}
const clause = (line: string, kept: Map<string, RuleExpression>) => kept.get(line) ?? readRuleClause(line);
function transitionLine(transition: ProcessTransition): string {
  return transition.to + (transition.when ? ` if ${ruleText(transition.when)}` : '');
}
function transitionsFromLines(lines: string[], previous: readonly ProcessTransition[]): ProcessTransition[] {
  const kept = keptExpressions(previous.map(item => item.when));
  return lines.map(line => {
    const match = /^(\S+)(?:\s+if\s+(.+))?$/.exec(line);
    requireSketch(match, 'PROCESS_TRANSITION_LINE', `${line}: write a next step as step-id or step-id if path operator value.`);
    const label = previous.find(item => transitionLine(item) === line)?.label;
    return { to: match[1]!, ...match[2] ? { when: clause(match[2].trim(), kept) } : {}, ...label ? { label } : {} };
  });
}
const defined = (value: FormValues): FormValues => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const stepDefaults: FormValues = { title: '', actor: '', description: '', inputMode: 'none', form: '', fieldLines: [], bind: '', outputs: [],
  terminal: false, outcome: '', transitionLines: [], notes: '' };
const inputModeOf = (step: ProcessStep) => step.form ? 'form' : step.fields ? 'fields' : 'none';
export function stepView(step?: ProcessStep): FormValues {
  if (!step) return structuredClone(stepDefaults);
  return { ...stepDefaults, ...defined({ title: step.title, actor: step.actor, description: step.description, form: step.form, bind: step.bind,
    outputs: step.outputs, outcome: step.outcome, fieldLines: step.fields?.map(fieldLine), transitionLines: step.next?.map(transitionLine), notes: step.doc?.text }),
  inputMode: inputModeOf(step), terminal: step.terminal === true };
}
function stepInput(view: FormValues, previous: ProcessStep | undefined): Partial<ProcessStep> {
  if (view.inputMode === 'form') return { form: textOf(view.form) };
  return view.inputMode === 'fields' ? { fields: fieldsFromLines(linesOf(view.fieldLines), previous?.fields ?? []) } : {};
}
function stepFlow(view: FormValues, previous: ProcessStep | undefined): Partial<ProcessStep> {
  if (view.terminal === true) return { terminal: true, ...optional('outcome', textOf(view.outcome)) };
  return { next: transitionsFromLines(linesOf(view.transitionLines), previous?.next ?? []) };
}
export function stepFromView(view: FormValues, previous: ProcessStep | undefined, used: string[]): ProcessStep {
  const outputs = linesOf(view.outputs);
  return { id: previous?.id ?? slug(textOf(view.title), 'step', used), title: textOf(view.title), actor: textOf(view.actor),
    ...optional('description', textOf(view.description)), ...stepInput(view, previous), ...optional('bind', textOf(view.bind)),
    ...outputs.length ? { outputs } : {}, ...stepFlow(view, previous), ...notes(view.notes, previous?.doc) };
}
function expressionLines(expression: RuleExpression | undefined): { combine: 'all' | 'any'; lines: string[] } {
  const flat = ruleClauses(expression);
  return flat ?? { combine: 'all', lines: expression ? [ruleText(expression)] : [] };
}
const ruleDefaults: FormValues = { statement: '', severity: 'block', rationale: '', scope: 'steps', steps: [], whenLines: [], combine: 'all', requireLines: [], notes: '' };
export function ruleView(rule?: ProcessRule): FormValues {
  if (!rule) return structuredClone(ruleDefaults);
  const require = expressionLines(rule.require);
  return { ...ruleDefaults, ...defined({ statement: rule.statement, severity: rule.severity, rationale: rule.rationale, steps: rule.steps, notes: rule.doc?.text }),
    scope: rule.steps ? 'steps' : 'process', whenLines: expressionLines(rule.when).lines, combine: require.combine, requireLines: require.lines };
}
function expressionFrom(lines: string[], combine: unknown, previous: RuleExpression | undefined): RuleExpression | undefined {
  const kept = keptExpressions([previous]);
  if (lines.length === 1 && kept.has(lines[0]!)) return kept.get(lines[0]!);
  const items = lines.map(line => clause(line, kept));
  if (items.length < 2) return items[0];
  return combine === 'any' ? { any: items } : { all: items };
}
export function ruleFromView(view: FormValues, previous: ProcessRule | undefined, used: string[]): ProcessRule {
  const when = expressionFrom(linesOf(view.whenLines), 'all', previous?.when), require = expressionFrom(linesOf(view.requireLines), view.combine, previous?.require);
  requireSketch(require, 'PROCESS_RULE', 'A rule needs at least one requirement condition.');
  return { id: previous?.id ?? slug(textOf(view.statement), 'rule', used), statement: textOf(view.statement), ...optional('rationale', textOf(view.rationale)),
    severity: processSeverities.find(item => item === view.severity) ?? 'block', ...view.scope === 'steps' ? { steps: linesOf(view.steps) } : {},
    ...when ? { when } : {}, require, ...notes(view.notes, previous?.doc) };
}
export interface CollectionSpec<T extends { id: string }> {
  title: string; noun: string; form: string; describe(item: T): string;
  view(item?: T): FormValues; commit(view: FormValues, previous: T | undefined, used: string[]): T;
}
/** Ask one item; an invalid line is reported and the same answers are offered again. Back returns undefined. */
async function askItem<T extends { id: string }>(context: ActionContext, spec: CollectionSpec<T>, items: readonly T[], previous?: T): Promise<T | undefined> {
  const view = spec.view(previous);
  const used = items.filter(item => item !== previous).map(item => item.id);
  while (true) {
    try { await runForm(context.ui, formDefinition(context.env, spec.form), view, context.env); return spec.commit(view, previous, used); }
    catch (error) {
      if (error instanceof Back) return undefined;
      if (!(error instanceof SketchError)) throw error;
      reportError(context.ui, error);
    }
  }
}
async function removeItem<T extends { id: string }>(context: ActionContext, spec: CollectionSpec<T>, items: T[]): Promise<void> {
  const id = await choose(context.ui, `Which ${spec.noun} do you want to remove?`, items.map(item => ({ id: item.id, label: spec.describe(item) })));
  if (await confirm(context.ui, `Remove ${spec.noun} ${id}?`)) items.splice(items.findIndex(item => item.id === id), 1);
}
/** Add, edit and remove items until Done; Back at the menu leaves the step like any other wizard step. */
export async function editCollection<T extends { id: string }>(context: ActionContext, items: T[], spec: CollectionSpec<T>): Promise<T[]> {
  while (true) {
    const choice = await choose(context.ui, `${spec.title} (${items.length})`, [...items.map((item, index) => ({ id: `edit-${index}`, label: `Edit ${spec.describe(item)}` })),
      { id: 'add', label: `Add a ${spec.noun}` }, ...items.length ? [{ id: 'remove', label: `Remove a ${spec.noun}` }, { id: 'done', label: 'Done' }] : []], items.length ? 'done' : 'add');
    if (choice === 'done') return items;
    if (choice === 'remove') { await removeItem(context, spec, items); continue; }
    const index = choice === 'add' ? items.length : Number(choice.slice(5)), item = await askItem(context, spec, items, items[index]);
    if (item) items[index] = item;
  }
}
