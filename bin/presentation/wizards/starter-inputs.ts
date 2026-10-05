import { readForm, type FormDefinition } from '../../domain/form.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { derivedId } from '../../adapters/framework/starter-project.ts';
import { inputValue, record } from '../../adapters/starters/validation.ts';
import type { InputValue, StarterDefinition, StarterInput } from '../../adapters/starters/types.ts';
/** The choice that leaves an optional input without a default unset. Positional ids never collide with it. */
const skip = 'skip';
/** Form label and choice-id limits (bin/domain/form.ts); starter text may be longer. */
const labelLimit = 300, idLimit = 80;
/** A generated form for a starter's missing inputs[], the value it edits and how answers become starter values. */
export interface StarterInputForm {
  /** Undefined when every input was already supplied, so nothing is asked. */
  form?: FormDefinition;
  /** Supplied values plus each asked input's default. Literal defaults live here, never in templated field defaults. */
  value: FormValues;
  /** The asked inputs as validated starter values; a skipped optional input without a default stays absent. */
  decode(value: FormValues): Record<string, InputValue>;
}
interface Asked { input: StarterInput; ids?: string[] }
const shortLabel = (text: string) => text.length <= labelLimit ? text : text.slice(0, labelLimit - 1) + '…';
const skippable = (input: StarterInput) => !input.required && input.default === undefined;
/** Choice values become ids when they all can be (so typing a value still works); otherwise ids are positional. */
function choiceIds(choices: readonly InputValue[]): string[] {
  const direct = choices.map(String);
  const usable = new Set(direct).size === direct.length && direct.every(id => id && id === id.trim() && id.length <= idLimit && id !== skip);
  return usable ? direct : choices.map((_choice, index) => `choice-${index + 1}`);
}
function choiceLabel(choice: InputValue, id: string): string {
  const label = String(choice);
  return label.trim() && label.length <= labelLimit ? label : id;
}
/** id defaults to the folder-derived plugin ID; name follows the live id through the `suggestedName` template. */
function fallback(input: StarterInput, definition: StarterDefinition, target: string): InputValue | undefined {
  if (input.id !== 'id') return input.default;
  return derivedId(target, definition.generator.kind === 'companion' ? String(record(definition.generator.document.project).id) : definition.id);
}
function field(input: StarterInput, ids: string[] | undefined): FormValues {
  const base = { id: input.id, label: shortLabel(input.label) };
  if (ids) return { ...base, kind: 'select', choices: [...input.choices!.map((choice, index) => ({ id: ids[index], label: choiceLabel(choice, ids[index]!) })),
    ...(skippable(input) ? [{ id: skip, label: 'Skip (no value)' }] : [])] };
  if (input.type === 'boolean') return { ...base, kind: 'boolean' };
  if (input.type === 'integer') return { ...base, kind: 'number', integer: true, ...(skippable(input) ? { required: false } : {}) };
  return { ...base, kind: 'text', required: input.required, maxLength: 4000, ...(input.id === 'name' ? { default: '{{suggestedName}}' } : {}) };
}
function seed(input: StarterInput, ids: string[] | undefined, value: InputValue | undefined): unknown {
  if (!ids) return input.id === 'name' ? undefined : value;
  const index = value === undefined ? -1 : input.choices!.indexOf(value);
  return index >= 0 ? ids[index] : skippable(input) ? skip : undefined;
}
function decoded(item: Asked, answer: unknown): unknown {
  if (!item.ids) return answer;
  const index = item.ids.indexOf(String(answer));
  return index >= 0 ? item.input.choices![index] : answer === skip ? undefined : answer;
}
/**
 * Pure mapping of a starter's inputs[] to a validated form: string → text, integer → whole number,
 * boolean → Yes/No, choices → select. Inputs already in `values` (from --values, --answers or flags) are not asked.
 */
export function starterInputForm(definition: StarterDefinition, target: string, values: FormValues): StarterInputForm {
  const asked: Asked[] = definition.inputs.filter(input => values[input.id] === undefined)
    .map(input => ({ input, ...(input.choices ? { ids: choiceIds(input.choices) } : {}) }));
  const value: FormValues = { ...values };
  for (const { input, ids } of asked) {
    const initial = seed(input, ids, fallback(input, definition, target));
    if (initial !== undefined) value[input.id] = initial;
  }
  const form = asked.length ? readForm({ schemaVersion: 1, id: 'starter-inputs', version: 1, title: 'Starter inputs',
    fields: asked.map(({ input, ids }) => field(input, ids)) }) : undefined;
  return { ...(form ? { form } : {}), value, decode(answers) {
    const result: Record<string, InputValue> = {};
    for (const item of asked) {
      const answer = decoded(item, answers[item.input.id]);
      if (answer === undefined || (answer === '' && item.input.default === undefined)) continue;
      result[item.input.id] = inputValue(answer, item.input);
    }
    return result;
  } };
}
