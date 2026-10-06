import { object } from './data.ts';
import { SketchError } from './errors.ts';
import { bindingOf, fieldAnswer, fieldVisible, type FormDefinition, type FormField } from './form.ts';
import { getPath, type FormValues } from './form-model.ts';
export interface FormIssue { field: string; code: string; message: string }
type Lookup = (id: string) => FormDefinition | undefined;
/** Where issues are collected and how referenced forms are found while walking nested sections. */
interface Checking { issues: FormIssue[]; lookup: Lookup }
function checkSection(field: FormField, value: FormValues, current: unknown, path: string, where: string, checking: Checking): void {
  const nested = field.bind ? current : value;
  if (nested === undefined) return;
  const fields = field.form ? checking.lookup(field.form)?.fields : field.fields;
  if (!fields) { checking.issues.push({ field: path, code: 'FORM_UNKNOWN', message: `Unknown form ${field.form}.` }); return; }
  walk(fields, object(nested), field.bind ? path + '.' : where, checking);
}
function checkAnswer(field: FormField, current: unknown, path: string, checking: Checking): void {
  const answer = current ?? field.default;
  if (answer !== undefined || field.kind === 'record') { fieldAnswer(field, answer); return; }
  if (field.required || field.kind === 'title') checking.issues.push({ field: path, code: 'FORM_REQUIRED', message: `${field.label} is required.` });
}
function check(field: FormField, value: FormValues, where: string, checking: Checking): void {
  const path = `${where}${bindingOf(field)}`, current = getPath(value, bindingOf(field));
  try {
    if (field.kind === 'section') checkSection(field, value, current, path, where, checking);
    else checkAnswer(field, current, path, checking);
  } catch (error) {
    checking.issues.push({ field: path, code: error instanceof SketchError ? error.code : 'FORM_ANSWER', message: error instanceof Error ? error.message : 'Invalid answer.' });
  }
}
function walk(fields: readonly FormField[], value: FormValues, where: string, checking: Checking): void {
  for (const field of fields) {
    if (field.transient || field.kind === 'confirm' || !fieldVisible(field, fields, value, Object.create(null), value)) continue;
    check(field, value, where, checking);
  }
}
/**
 * Non-interactive validation of a complete value against a form, for agents and scripts. Transient and
 * confirmation fields are human-only; sections without their bound value count as skipped (a declined gate).
 * Choices supplied at runtime by a provider are not checked here.
 */
export function formValueIssues(form: FormDefinition, value: unknown, lookup: Lookup): FormIssue[] {
  const issues: FormIssue[] = [];
  walk(form.fields, object(value), '', { issues, lookup });
  return issues;
}
