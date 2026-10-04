import { object } from './data.ts';
import { SketchError } from './errors.ts';
import { bindingOf, fieldAnswer, fieldVisible, type FormDefinition, type FormField } from './form.ts';
import { getPath, type FormValues } from './form-model.ts';
export interface FormIssue { field: string; code: string; message: string }
function check(field: FormField, value: FormValues, where: string, issues: FormIssue[], lookup: (id: string) => FormDefinition | undefined): void {
  const path = `${where}${bindingOf(field)}`, current = getPath(value, bindingOf(field));
  try {
    if (field.kind === 'section') {
      const nested = field.bind ? current : value;
      if (nested === undefined) return;
      const fields = field.form ? lookup(field.form)?.fields : field.fields;
      if (!fields) { issues.push({ field: path, code: 'FORM_UNKNOWN', message: `Unknown form ${field.form}.` }); return; }
      walk(fields, object(nested), field.bind ? path + '.' : where, issues, lookup);
      return;
    }
    const answer = current ?? field.default;
    if (answer === undefined && field.kind !== 'record') {
      if (field.required || field.kind === 'title') issues.push({ field: path, code: 'FORM_REQUIRED', message: `${field.label} is required.` });
      return;
    }
    fieldAnswer(field, answer);
  } catch (error) {
    issues.push({ field: path, code: error instanceof SketchError ? error.code : 'FORM_ANSWER', message: error instanceof Error ? error.message : 'Invalid answer.' });
  }
}
function walk(fields: readonly FormField[], value: FormValues, where: string, issues: FormIssue[], lookup: (id: string) => FormDefinition | undefined): void {
  for (const field of fields) {
    if (field.transient || field.kind === 'confirm' || !fieldVisible(field, fields, value, Object.create(null), value)) continue;
    check(field, value, where, issues, lookup);
  }
}
/**
 * Non-interactive validation of a complete value against a form, for agents and scripts. Transient and
 * confirmation fields are human-only; sections without their bound value count as skipped (a declined gate).
 * Choices supplied at runtime by a provider are not checked here.
 */
export function formValueIssues(form: FormDefinition, value: unknown, lookup: (id: string) => FormDefinition | undefined): FormIssue[] {
  const issues: FormIssue[] = [];
  walk(form.fields, object(value), '', issues, lookup);
  return issues;
}
