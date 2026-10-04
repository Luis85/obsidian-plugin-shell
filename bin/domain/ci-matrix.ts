/** Pure `strategy.matrix` expansion and selection (axes, include, exclude), with explicit failures instead of guesses. */
import { CiError } from './ci-workflow.ts';
import { hasExpression } from './ci-expression.ts';
export type Combination = Readonly<Record<string, string>>;
export type Selector = Readonly<Record<string, string>>;
export interface MatrixChoice { combination: Combination; available: number; mode: 'none' | 'only' | 'default' | 'selected' }
type Data = Record<string, unknown>;
const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const scalar = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
/** `key=value,key=value`; values keep their text (so `group=1` matches the numeric YAML value 1). */
export function parseMatrixSelector(input: string): Selector {
  const selector: Record<string, string> = {};
  for (const part of input.split(',').map(item => item.trim()).filter(Boolean)) {
    const at = part.indexOf('=');
    if (at < 1) throw new CiError('CI_MATRIX_SELECTOR', `--matrix expects key=value pairs separated by commas; got "${part}".`);
    selector[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  if (!Object.keys(selector).length) throw new CiError('CI_MATRIX_SELECTOR', '--matrix expects at least one key=value pair.');
  return selector;
}
const unresolvedMatrix = (what: string, hint = 'key=value'): CiError => new CiError('CI_MATRIX_UNRESOLVED',
  `${what} is computed by a \${{ }} expression and cannot be expanded locally; supply its value with --matrix ${hint}.`);
function axisValues(axis: string, value: unknown, selector: Selector): string[] {
  if (typeof value === 'string' && hasExpression(value)) {
    const chosen = selector[axis];
    if (chosen === undefined) throw unresolvedMatrix(`Matrix axis "${axis}"`, `${axis}=<value>`);
    return [chosen];
  }
  return Array.isArray(value) ? value.map(scalar) : [scalar(value)];
}
function cartesian(axes: Array<[string, string[]]>): Combination[] {
  if (!axes.length) return [];
  return axes.reduce<Combination[]>((combos, [axis, values]) => combos.flatMap(combo => values.map(value => ({ ...combo, [axis]: value }))), [{}]);
}
const entries = (value: unknown, key: string): Combination[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isData)) throw new CiError('CI_UNSUPPORTED', `matrix.${key} must be a list of mappings.`);
  return value.map(item => Object.fromEntries(Object.entries(item).map(([name, field]) => [name, scalar(field)])));
};
const matches = (combo: Combination, pattern: Combination): boolean => Object.entries(pattern).every(([key, value]) => combo[key] === value);
/** An include entry extends the combinations it matches on original axes, or becomes a combination of its own. */
function applyIncludes(base: Combination[], axes: string[], includes: Combination[]): Combination[] {
  const result = [...base], added: Combination[] = [];
  for (const entry of includes) {
    const original = Object.fromEntries(Object.entries(entry).filter(([key]) => axes.includes(key)));
    const indices = base.flatMap((combo, index) => matches(combo, original) ? [index] : []);
    if (!indices.length) { added.push(entry); continue; }
    const extras = Object.fromEntries(Object.entries(entry).filter(([key]) => !axes.includes(key)));
    for (const index of indices) result[index] = { ...result[index]!, ...extras };
  }
  return [...result, ...added];
}
/** All combinations; `selector` supplies values for axes (or a whole matrix) that are only known from `${{ }}` expressions. */
export function expandMatrix(raw: unknown, selector: Selector): Combination[] {
  if (raw === undefined) return [{}];
  if (typeof raw === 'string') {
    if (!hasExpression(raw)) throw new CiError('CI_UNSUPPORTED', 'strategy.matrix must be a mapping.');
    if (!Object.keys(selector).length) throw unresolvedMatrix('The matrix');
    return [selector];
  }
  if (!isData(raw)) throw new CiError('CI_UNSUPPORTED', 'strategy.matrix must be a mapping.');
  const axes: Array<[string, string[]]> = Object.entries(raw).filter(([key]) => !['include', 'exclude'].includes(key))
    .map(([axis, value]) => [axis, axisValues(axis, value, selector)]);
  const excluded = entries(raw.exclude, 'exclude'), base = cartesian(axes).filter(combo => !excluded.some(pattern => matches(combo, pattern)));
  const all = applyIncludes(base, axes.map(([axis]) => axis), entries(raw.include, 'include'));
  return all.length ? all : [{}];
}
export const describeCombination = (combo: Combination): string => Object.entries(combo).map(([key, value]) => `${key}=${value}`).join(',') || '(none)';
/** Picks the combination named by `selector`; without a selector the first one `prefer` accepts (else the first). */
export function chooseCombination(all: Combination[], selector: Selector, raw: unknown, prefer: (combo: Combination) => boolean): MatrixChoice {
  if (raw === undefined) return { combination: {}, available: 1, mode: 'none' };
  const explicit = Object.keys(selector).length > 0, found = explicit ? all.filter(combo => matches(combo, selector)) : all;
  const available = `Available: ${all.slice(0, 12).map(describeCombination).join(' | ')}${all.length > 12 ? ' | ...' : ''}.`;
  if (!found.length) throw new CiError('CI_MATRIX_NO_MATCH', `No matrix combination matches ${describeCombination(selector)}. ${available}`);
  if (explicit && found.length > 1) throw new CiError('CI_MATRIX_AMBIGUOUS', `--matrix ${describeCombination(selector)} matches ${found.length} combinations; add more keys. ${available}`);
  if (explicit) return { combination: found[0]!, available: all.length, mode: 'selected' };
  if (all.length === 1) return { combination: all[0]!, available: 1, mode: 'only' };
  return { combination: all.find(prefer) ?? all[0]!, available: all.length, mode: 'default' };
}
export interface MatrixSummary { axes: string[]; combinations: number | null; computed: boolean }
/** Listing view of a matrix: its axis names and combination count, or `computed` when an expression decides them. */
export function summarizeMatrix(raw: unknown): MatrixSummary {
  if (raw === undefined) return { axes: [], combinations: null, computed: false };
  const axes = isData(raw) ? [...new Set([...Object.keys(raw).filter(key => !['include', 'exclude'].includes(key)),
    ...entries(raw.include, 'include').flatMap(Object.keys)])] : [];
  try { return { axes, combinations: expandMatrix(raw, {}).length, computed: false }; }
  catch (error) {
    if (error instanceof CiError && error.code === 'CI_MATRIX_UNRESOLVED') return { axes, combinations: null, computed: true };
    throw error;
  }
}
