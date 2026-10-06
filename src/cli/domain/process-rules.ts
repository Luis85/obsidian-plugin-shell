import { object, keys, list } from './data.ts';
import { requireSketch, hasControls } from '#shared/contracts/sketch-errors.ts';
import { getPath, matches, readPath } from './form-model.ts';
/**
 * The business-rule expression language: inert JSON, never code. A comparison reads one dotted path of the
 * process data; `all`, `any` and `not` combine comparisons with three-valued (Kleene) logic, where a missing
 * or wrongly typed value is `null` (unknown). Only `present` is always decided.
 */
export type RuleScalar = string | number | boolean;
type RuleOperator = 'equals' | 'notEquals' | 'in' | 'notIn' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'present' | 'matches';
export interface RuleComparison {
  path: string; length?: boolean; equals?: RuleScalar; notEquals?: RuleScalar; in?: RuleScalar[]; notIn?: RuleScalar[];
  contains?: RuleScalar; gt?: number; gte?: number; lt?: number; lte?: number; present?: boolean; matches?: string;
}
export type RuleExpression = { all: RuleExpression[] } | { any: RuleExpression[] } | { not: RuleExpression } | RuleComparison;
/** `null` means unknown: the data needed to decide is missing or has the wrong type. */
export type RuleTruth = boolean | null;
const ruleOperators: readonly RuleOperator[] = ['equals', 'notEquals', 'in', 'notIn', 'contains', 'gt', 'gte', 'lt', 'lte', 'present', 'matches'];
const numeric = new Set<RuleOperator>(['gt', 'gte', 'lt', 'lte']);
const limits = { depth: 6, nodes: 60, items: 20, pattern: 100, text: 10000 };
interface Budget { nodes: number }
const isScalar = (value: unknown): value is RuleScalar => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
function scalar(value: unknown, name: string): RuleScalar {
  requireSketch(isScalar(value) && (typeof value !== 'number' || Number.isFinite(value)) && (typeof value !== 'string' || (value.length <= 2000 && !hasControls(value))),
    'PROCESS_RULE', `${name} must be a string, finite number or boolean.`);
  return value;
}
/** Wildcard patterns only (`*` any run, `?` one character), always anchored to the whole value: no regular expressions. */
function pattern(value: unknown, name: string): string {
  requireSketch(typeof value === 'string' && value.length > 0 && value.length <= limits.pattern && !hasControls(value), 'PROCESS_RULE', `${name} needs a wildcard pattern of 1–${limits.pattern} characters.`);
  return value;
}
function listOperand(operator: RuleOperator, value: unknown, name: string): RuleScalar[] {
  const items = list(value, `${name}.${operator}`, limits.items).map((item, index) => scalar(item, `${name}.${operator}[${index}]`));
  requireSketch(items.length > 0, 'PROCESS_RULE', `${name}.${operator} needs at least one value.`);
  return items;
}
function scalarOperand(operator: RuleOperator, value: unknown, name: string, length: boolean): RuleScalar {
  const result = scalar(value, `${name}.${operator}`);
  requireSketch(typeof result === 'number' || !(numeric.has(operator) || length), 'PROCESS_RULE', `${name}.${operator} needs a number.`);
  return result;
}
function operand(operator: RuleOperator, value: unknown, name: string, length: boolean): RuleComparison[RuleOperator] {
  if (operator === 'present') { requireSketch(typeof value === 'boolean', 'PROCESS_RULE', `${name}.present must be boolean.`); return value; }
  if (operator === 'matches') return pattern(value, name + '.matches');
  if (operator === 'in' || operator === 'notIn') return listOperand(operator, value, name);
  return scalarOperand(operator, value, name, length);
}
function readComparison(item: Record<string, unknown>, name: string): RuleComparison {
  keys(item, ['path', 'length', ...ruleOperators]);
  const path = readPath(item.path, name + '.path');
  const present = ruleOperators.filter(key => item[key] !== undefined);
  requireSketch(present.length === 1, 'PROCESS_RULE', `${name} needs exactly one of ${ruleOperators.join(', ')}.`);
  requireSketch(item.length === undefined || item.length === true, 'PROCESS_RULE', `${name}.length must be true when present.`);
  const operator = present[0]!, length = item.length === true;
  requireSketch(!length || numeric.has(operator) || operator === 'equals' || operator === 'notEquals', 'PROCESS_RULE', `${name}.length compares a count with equals, notEquals, gt, gte, lt or lte.`);
  return { path, ...(length ? { length } : {}), [operator]: operand(operator, item[operator], name, length) };
}
function readGroup(items: unknown, name: string, depth: number, budget: Budget): RuleExpression[] {
  const result = list(items, name, limits.items).map((item, index) => readNode(item, `${name}[${index}]`, depth + 1, budget));
  requireSketch(result.length > 0, 'PROCESS_RULE', `${name} needs at least one condition.`);
  return result;
}
function readNode(value: unknown, name: string, depth: number, budget: Budget): RuleExpression {
  requireSketch(depth <= limits.depth && ++budget.nodes <= limits.nodes, 'PROCESS_RULE_LIMIT', `${name}: conditions nest at most ${limits.depth} levels and ${limits.nodes} nodes.`);
  const item = object(value);
  if (Object.hasOwn(item, 'all')) { keys(item, ['all']); return { all: readGroup(item.all, name + '.all', depth, budget) }; }
  if (Object.hasOwn(item, 'any')) { keys(item, ['any']); return { any: readGroup(item.any, name + '.any', depth, budget) }; }
  if (Object.hasOwn(item, 'not')) { keys(item, ['not']); return { not: readNode(item.not, name + '.not', depth + 1, budget) }; }
  return readComparison(item, name);
}
/** Structural validation: unknown keys, unsafe paths, mixed operators, control characters and size limits fail closed. */
export function readRuleExpression(value: unknown, name: string): RuleExpression {
  return readNode(value, name, 0, { nodes: 0 });
}
function operatorOf(comparison: RuleComparison): RuleOperator {
  return ruleOperators.find(key => comparison[key] !== undefined)!;
}
/** Linear-memory wildcard match with single backtracking point; lengths are bounded, so time is bounded too. */
function wildcard(text: string, mask: string): boolean {
  const value = [...text], shape = [...mask];
  let position = 0, index = 0, star = -1, mark = 0;
  while (position < value.length) {
    if (index < shape.length && (shape[index] === '?' || shape[index] === value[position])) { position++; index++; }
    else if (index < shape.length && shape[index] === '*') { star = index++; mark = position; }
    else if (star >= 0) { index = star + 1; position = ++mark; }
    else return false;
  }
  while (shape[index] === '*') index++;
  return index === shape.length;
}
const sameScalar = (left: unknown) => (right: RuleScalar) => matches({ equals: right }, left);
const scalarCheck = (check: (current: RuleScalar) => boolean) => (current: unknown): RuleTruth => isScalar(current) ? check(current) : null;
const numberCheck = (check: (current: number) => boolean) => (current: unknown): RuleTruth => typeof current === 'number' ? check(current) : null;
function containment(current: unknown, expected: RuleScalar): RuleTruth {
  if (Array.isArray(current)) return current.some(item => matches({ equals: expected }, item));
  return typeof current === 'string' && typeof expected === 'string' ? current.includes(expected) : null;
}
type Check = (comparison: RuleComparison) => (current: unknown) => RuleTruth;
/** One decision per operator; `present` is handled before a missing value turns the result unknown. */
const checks: Record<Exclude<RuleOperator, 'present'>, Check> = {
  equals: comparison => current => matches({ equals: comparison.equals! }, current),
  notEquals: comparison => current => matches({ notEquals: comparison.notEquals! }, current),
  in: comparison => scalarCheck(current => comparison.in!.some(sameScalar(current))),
  notIn: comparison => scalarCheck(current => !comparison.notIn!.some(sameScalar(current))),
  contains: comparison => current => containment(current, comparison.contains!),
  matches: comparison => current => typeof current === 'string' && current.length <= limits.text ? wildcard(current, comparison.matches!) : null,
  gt: comparison => numberCheck(current => current > comparison.gt!),
  gte: comparison => numberCheck(current => current >= comparison.gte!),
  lt: comparison => numberCheck(current => current < comparison.lt!),
  lte: comparison => numberCheck(current => current <= comparison.lte!),
};
function measured(comparison: RuleComparison, current: unknown): unknown {
  if (!comparison.length) return current;
  return typeof current === 'string' || Array.isArray(current) ? current.length : undefined;
}
function compare(comparison: RuleComparison, raw: unknown): RuleTruth {
  const operator = operatorOf(comparison);
  if (operator === 'present') return matches({ present: comparison.present! }, raw);
  const current = measured(comparison, raw);
  return current === undefined || current === null ? null : checks[operator](comparison)(current);
}
function combine(items: RuleTruth[], decisive: boolean): RuleTruth {
  if (items.includes(decisive)) return decisive;
  return items.includes(null) ? null : !decisive;
}
/** Kleene logic: `all` is false when any part is false, `any` true when any part is true, otherwise unknown wins over the default. */
export function evaluateRule(expression: RuleExpression, data: unknown): RuleTruth {
  if ('all' in expression) return combine(expression.all.map(item => evaluateRule(item, data)), false);
  if ('any' in expression) return combine(expression.any.map(item => evaluateRule(item, data)), true);
  if ('not' in expression) { const inner = evaluateRule(expression.not, data); return inner === null ? null : !inner; }
  return compare(expression, getPath(data, expression.path));
}
/** Every data path an expression reads, in order of appearance. */
export function rulePaths(expression: RuleExpression): string[] {
  if ('all' in expression) return expression.all.flatMap(rulePaths);
  if ('any' in expression) return expression.any.flatMap(rulePaths);
  if ('not' in expression) return rulePaths(expression.not);
  return [expression.path];
}
/** Paths an expression reads whose value is currently absent; explains an unknown result. */
export function missingRulePaths(expression: RuleExpression, data: unknown): string[] {
  return [...new Set(rulePaths(expression).filter(path => getPath(data, path) === undefined || getPath(data, path) === null))];
}
function comparisonText(comparison: RuleComparison): string {
  const operator = operatorOf(comparison), subject = comparison.path + (comparison.length ? ' length' : '');
  if (operator === 'present') return `${subject} ${comparison.present ? 'present' : 'missing'}`;
  return `${subject} ${operator} ${JSON.stringify(comparison[operator])}`;
}
/** One-line text without semicolons (the plain list separator): `path operator value`, `path present`, `all(a, b)`, `any(a, b)`, `not(a)`. */
export function ruleText(expression: RuleExpression): string {
  if ('all' in expression) return `all(${expression.all.map(ruleText).join(', ')})`;
  if ('any' in expression) return `any(${expression.any.map(ruleText).join(', ')})`;
  if ('not' in expression) return `not(${ruleText(expression.not)})`;
  return comparisonText(expression);
}
function clauseOperand(operator: RuleOperator, raw: string): unknown {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  if ((operator === 'in' || operator === 'notIn') && !Array.isArray(parsed)) return raw.split(',').map(item => item.trim()).filter(Boolean);
  return parsed;
}
/**
 * Parse one authored clause such as `review.decision equals "approve"`, `checks.failed length lte 0`, `notes present`
 * or `notes missing`. The operand is JSON when it parses, otherwise the literal text; nothing is evaluated.
 */
export function readRuleClause(line: string): RuleComparison {
  const match = /^\s*(\S+)\s+(length\s+)?(\S+)(?:\s+(.+?))?\s*$/.exec(line);
  requireSketch(match, 'PROCESS_CLAUSE', `Write a condition as "path operator value", for example: review.decision equals "approve".`);
  const [, path, length, word, rest] = match;
  if (word === 'present' || word === 'missing') {
    requireSketch(rest === undefined && !length, 'PROCESS_CLAUSE', `${line.trim()}: present and missing take no value.`);
    return readComparison({ path, present: word === 'present' }, 'condition');
  }
  requireSketch(ruleOperators.includes(word as RuleOperator) && rest !== undefined, 'PROCESS_CLAUSE', `${line.trim()}: use one of ${ruleOperators.join(', ')} (or missing) followed by a value.`);
  const operator = word as RuleOperator;
  return readComparison({ path, ...(length ? { length: true } : {}), [operator]: clauseOperand(operator, rest) }, 'condition');
}
/** A flat condition list for authoring prompts, or undefined when the expression nests deeper than one combinator. */
export function ruleClauses(expression: RuleExpression | undefined): { combine: 'all' | 'any'; lines: string[] } | undefined {
  if (!expression) return { combine: 'all', lines: [] };
  if ('not' in expression) return undefined;
  const combinator = 'any' in expression ? 'any' : 'all';
  const items = 'all' in expression ? expression.all : 'any' in expression ? expression.any : [expression];
  if (items.some(item => 'all' in item || 'any' in item || 'not' in item)) return undefined;
  return { combine: combinator, lines: items.map(ruleText) };
}
