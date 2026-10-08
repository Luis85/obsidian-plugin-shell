import { bindingOf, conditionValue, fieldAnswer, fieldVisible, type FormChoice, type FormDefinition, type FormField } from '../domain/form.ts';
import { getPath, renderText, setPath, type FormValues } from '../domain/form-model.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { DefinitionCatalog } from '../adapters/wizard-catalog.ts';
import { Back, choose, confirm, input, reportError, selectMany, titleInput, type Prompts } from '#tui/prompts.ts';
/**
 * The only code a form definition can reach. Each hook is named in JSON and registered here by the
 * process that owns the data; definitions never carry executable code.
 */
export interface FormHooks {
  /** Providers receive the template data and the asking field, so one provider can serve several fields. */
  choices: Record<string, (data: unknown, field: FormField) => FormChoice[] | Promise<FormChoice[]>>;
  effects: Record<string, (value: FormValues, answer: unknown, field: FormField) => void>;
  prepare: Record<string, (parent: FormValues) => FormValues>;
  commit: Record<string, (value: FormValues, parent: FormValues) => unknown>;
}
export interface FormEnvironment { catalog: DefinitionCatalog; hooks: FormHooks; data?: unknown }
function hook<T>(table: Record<string, T>, name: string, kind: string): T {
  requireSketch(Object.hasOwn(table, name), 'FORM_HOOK', `Unknown ${kind} ${name}.`);
  return table[name]!;
}
export function formDefinition(env: FormEnvironment, id: string): FormDefinition {
  const form = env.catalog.forms.get(id);
  requireSketch(form, 'FORM_UNKNOWN', `Unknown form ${id}.`);
  return form;
}
async function choicesOf(field: FormField, env: FormEnvironment): Promise<FormChoice[]> {
  const items = field.choices ?? await hook(env.hooks.choices, field.choicesFrom!, 'choice provider')(env.data, field);
  return items.map(item => ({ id: item.id, label: renderText(item.label, env.data) }));
}
const separatorOf = (field: FormField) => field.separator ?? ';';
function asText(field: FormField, current: unknown, rich: boolean): string {
  if (Array.isArray(current)) return current.join(rich && field.multiline ? '\n' : field.joiner ?? separatorOf(field));
  return current === undefined || current === null ? '' : String(current);
}
function fromText(field: FormField, raw: string, rich: boolean): unknown {
  if (field.kind === 'number') return raw.trim() === '' ? (field.required === false ? undefined : Number.NaN) : Number(raw);
  if (field.kind !== 'list') return raw;
  return raw.split(rich && field.multiline ? '\n' : separatorOf(field)).map(item => item.trim()).filter(Boolean);
}
async function typedText(ui: Prompts, field: FormField, label: string, current: unknown): Promise<unknown> {
  if (field.kind === 'title') return titleInput(ui, label, asText(field, current, false), field.maxLength ?? 120);
  if (!ui.rich) return fromText(field, await input(ui, label + (field.suffix ?? ''), asText(field, current, false)), false);
  const raw = await ui.rich.text({ title: label, initial: asText(field, current, true),
    ...(field.multiline ? { multiline: true } : {}), ...(field.help ? { help: field.help } : {}),
    validate(value) {
      try { fieldAnswer(field, fromText(field, value, true)); return undefined; }
      catch (error) { return error instanceof Error ? error.message : 'Check this answer.'; }
    } });
  return fromText(field, raw, true);
}
async function promptValue(ui: Prompts, field: FormField, current: unknown, env: FormEnvironment): Promise<unknown> {
  const label = renderText(field.label, env.data);
  if (field.kind === 'confirm') return confirm(ui, label);
  if (field.kind === 'boolean') return await choose(ui, label, [{ id: 'yes', label: field.yes ?? 'Yes' }, { id: 'no', label: field.no ?? 'No' }], current === true ? 'yes' : 'no') === 'yes';
  if (field.kind === 'select') return choose(ui, label, await choicesOf(field, env), typeof current === 'string' ? current : '');
  if (field.kind === 'multi') return selectMany(ui, label, await choicesOf(field, env), Array.isArray(current) ? current.map(String) : []);
  return typedText(ui, field, label, current);
}
/** Plain prompts re-ask after a reported validation error; Back and cancellation always propagate. */
async function askValue(ui: Prompts, field: FormField, current: unknown, env: FormEnvironment): Promise<unknown> {
  while (true) {
    try { return fieldAnswer(field, await promptValue(ui, field, current, env)); }
    catch (error) { if (error instanceof Back) throw error; reportError(ui, error); }
  }
}
async function askRecord(ui: Prompts, field: FormField, value: FormValues, env: FormEnvironment): Promise<void> {
  const record = getPath(value, bindingOf(field));
  requireSketch(record && typeof record === 'object' && !Array.isArray(record), 'FORM_RECORD', `${field.id} is bound to a missing object.`);
  for (const key of Object.keys(record)) {
    const entry: FormField = { id: field.id, kind: 'text', label: renderText(field.label, env.data) + key, ...(field.maxLength ? { maxLength: field.maxLength } : {}) };
    (record as FormValues)[key] = await askValue(ui, entry, (record as FormValues)[key], env);
  }
}
const commitHook = (env: FormEnvironment, name: string) => hook(env.hooks.commit, name, 'commit hook');
/** A prepare hook builds the section value; otherwise a bound section edits a copy and an unbound one edits its parent. */
function sectionValue(field: FormField, parent: FormValues, env: FormEnvironment): FormValues {
  if (field.prepare) return hook(env.hooks.prepare, field.prepare, 'prepare hook')(parent);
  return field.bind ? structuredClone((getPath(parent, field.bind) ?? {}) as FormValues) : parent;
}
function commitSection(field: FormField, form: FormDefinition | undefined, value: FormValues, parent: FormValues, env: FormEnvironment): void {
  const formCommitted = form?.commit ? commitHook(env, form.commit)(value, parent) : value;
  setPath(parent, field.bind!, field.commit ? commitHook(env, field.commit)(formCommitted as FormValues, parent) : formCommitted);
}
/** One pass through the section; false means Back left a gated section, whose gate is asked again. */
async function sectionPass(ui: Prompts, field: FormField, parent: FormValues, env: FormEnvironment, gated: boolean): Promise<boolean> {
  const value = sectionValue(field, parent, env);
  const form = field.form ? formDefinition(env, field.form) : undefined;
  try { await runFields(ui, form?.fields ?? field.fields!, value, env); }
  catch (error) { if (error instanceof Back && gated) return false; throw error; }
  if (field.bind) commitSection(field, form, value, parent, env);
  return true;
}
async function askSection(ui: Prompts, field: FormField, parent: FormValues, env: FormEnvironment): Promise<void> {
  const gate = field.gate ? renderText(field.gate, env.data) : undefined;
  while (true) {
    if (gate && !await confirm(ui, gate)) return;
    if (await sectionPass(ui, field, parent, env, Boolean(gate))) return;
  }
}
async function askField(ui: Prompts, field: FormField, value: FormValues, answers: FormValues, env: FormEnvironment): Promise<void> {
  if (field.kind === 'section') return askSection(ui, field, value, env);
  if (field.kind === 'record') return askRecord(ui, field, value, env);
  const fallback = typeof field.default === 'string' ? renderText(field.default, env.data) : field.default;
  const current = conditionValue(field, value, answers) ?? fallback;
  const answer = await askValue(ui, field, current, env);
  answers[field.id] = answer;
  if (!field.transient) setPath(value, bindingOf(field), answer);
  if (field.effect) hook(env.hooks.effects, field.effect, 'effect')(value, answer, field);
}
/** Back revisits the previous answered field at this level; at the first field it leaves the form. */
export async function runFields(ui: Prompts, fields: readonly FormField[], value: FormValues, env: FormEnvironment): Promise<void> {
  const initial = structuredClone(value), answers: FormValues = Object.create(null), visited: number[] = [];
  let index = 0;
  while (index < fields.length) {
    const field = fields[index]!;
    if (!fieldVisible(field, fields, value, answers, initial)) { index++; continue; }
    try { await askField(ui, field, value, answers, env); visited.push(index++); }
    catch (error) {
      while (visited.length && visited.at(-1)! >= index) visited.pop();
      if (!(error instanceof Back) || !visited.length) throw error;
      index = visited.pop()!;
    }
  }
}
/** Ask every visible field of a form against `value` (edited in place) and return its committed result. */
export async function runForm(ui: Prompts, form: FormDefinition, value: FormValues, env: FormEnvironment): Promise<unknown> {
  await runFields(ui, form.fields, value, env);
  return form.commit ? commitHook(env, form.commit)(value, value) : value;
}
