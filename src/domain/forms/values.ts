import { plainRecord } from '../entity';
import { answerFor, type DataFormIssueCode } from './answers';
import { assignAt, conditionHolds, valueAt, type DataFormDefinition, type DataFormField, type DataFormValues } from './model';

/** A field at its absolute bound path; sections carry their visible children. */
export interface DataFormNode { readonly field: DataFormField; readonly path: string; readonly children?: readonly DataFormNode[] }
export interface DataFormIssue {
  readonly path: string;
  readonly code: DataFormIssueCode;
  /** The field's own `message`, which replaces the generic text. */
  readonly message?: string;
  readonly params?: Readonly<Record<string, number>>;
}
export type DataFormOutcome = { readonly ok: true; readonly value: DataFormValues } | { readonly ok: false; readonly issues: readonly DataFormIssue[] };

/**
 * Conditions compare values in the enclosing scope: a bound section's object, else the form value. An absent
 * `field` sibling counts as its default, which is what an interactive answer would have stored.
 */
function visible(field: DataFormField, fields: readonly DataFormField[], root: unknown, scope: string): boolean {
  const when = field.when;
  if (!when) return true;
  const sibling = fields.find(item => item.id === when.field);
  return conditionHolds(when, valueAt(root, scope + when.target) ?? sibling?.default);
}
function collect(fields: readonly DataFormField[], root: unknown, scope: string, all: boolean): DataFormNode[] {
  const nodes: DataFormNode[] = [];
  for (const field of fields) {
    if (!all && !visible(field, fields, root, scope)) continue;
    const path = scope + (field.bind ?? field.id);
    if (field.kind !== 'section') { nodes.push(Object.freeze({ field, path })); continue; }
    const inner = field.bind === undefined ? scope : `${path}.`;
    nodes.push(Object.freeze({ field, path, children: Object.freeze(collect(field.fields ?? [], root, inner, all)) }));
  }
  return nodes;
}
/** Every field regardless of conditions, for seeding drafts. */
export const allDataFormNodes = (definition: DataFormDefinition): readonly DataFormNode[] => collect(definition.fields, undefined, '', true);
/** Fields whose `when` condition holds for the given (draft) value. */
export const visibleDataFormNodes = (definition: DataFormDefinition, value: unknown): readonly DataFormNode[] => collect(definition.fields, value, '', false);

function issue(node: DataFormNode, code: DataFormIssueCode, params?: Readonly<Record<string, number>>): DataFormIssue {
  return Object.freeze({ path: node.path, code, ...(node.field.message ? { message: node.field.message } : {}), ...(params ? { params } : {}) });
}
function check(nodes: readonly DataFormNode[], source: unknown, output: DataFormValues, issues: DataFormIssue[]): void {
  for (const node of nodes) {
    if (node.children) {
      if (node.field.bind !== undefined) assignAt(output, node.path, {});
      check(node.children, source, output, issues);
      continue;
    }
    const answer = valueAt(source, node.path) ?? node.field.default;
    if (answer === undefined) {
      if (node.field.required === true || node.field.kind === 'title') issues.push(issue(node, 'required'));
      continue;
    }
    const result = answerFor(node.field, answer, true);
    if (result.ok) assignAt(output, node.path, result.value);
    else issues.push(issue(node, result.code, result.params));
  }
}
/**
 * Validates a complete value against a definition. Hidden fields are skipped and never copied; the result
 * holds only visible, normalized values (trimmed text, de-duplicated choices) at their bound paths.
 */
export function readDataFormValue(definition: DataFormDefinition, value: unknown): DataFormOutcome {
  if (!plainRecord(value)) return { ok: false, issues: [Object.freeze({ path: '', code: 'invalid' })] };
  const output: DataFormValues = {}; const issues: DataFormIssue[] = [];
  check(visibleDataFormNodes(definition, value), value, output, issues);
  return issues.length ? { ok: false, issues: Object.freeze(issues) } : { ok: true, value: output };
}
