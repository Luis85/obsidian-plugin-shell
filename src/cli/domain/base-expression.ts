import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { BaseNode } from './base-expression-parse.ts';

/**
 * Static support check and deterministic evaluation for the Bases expression subset. Anything outside the subset is
 * reported before evaluation, so a filter is never silently treated as matching or not matching.
 */
export type BaseValue = string | number | boolean | null | BaseValue[] | { [key: string]: BaseValue };
export interface BaseNote {
  path: string;
  properties: Record<string, BaseValue>;
  tags: readonly string[];
  size: number;
}
export interface BaseScope {
  note: BaseNote;
  formula(name: string): BaseValue;
}
const NAMESPACES = ['note', 'file', 'formula'] as const;
type Namespace = typeof NAMESPACES[number];
interface NamespaceRef { namespace: Namespace }
type Evaluated = BaseValue | NamespaceRef;

const FILE_FIELDS = ['name', 'basename', 'path', 'folder', 'ext', 'size', 'tags'];
const FILE_METHODS = ['inFolder', 'hasTag', 'hasProperty'];
const VALUE_METHODS = ['contains', 'containsAny', 'containsAll', 'startsWith', 'endsWith', 'isEmpty', 'lower', 'upper', 'trim', 'toString'];
const NONDETERMINISTIC = ['ctime', 'mtime', 'now', 'today'];

const isNamespace = (value: unknown): value is NamespaceRef => typeof value === 'object' && value !== null && !Array.isArray(value) && 'namespace' in value && Object.keys(value).length === 1;

/** Every unsupported construct in `node`, as human-readable issues; formulas are the declared formula names. */
export function expressionIssues(node: BaseNode, formulas: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  const visit = (current: BaseNode): void => {
    const issue = nodeIssue(current, formulas);
    if (issue) issues.push(issue);
    for (const child of children(current)) visit(child);
  };
  visit(node);
  return [...new Set(issues)];
}
/** The formula names an expression reads through `formula.<name>`. */
export function formulaNames(node: BaseNode): string[] {
  const names: string[] = [];
  const visit = (current: BaseNode): void => {
    if (current.kind === 'member' && current.target.kind === 'name' && current.target.name === 'formula') names.push(current.name);
    children(current).forEach(visit);
  };
  visit(node);
  return names;
}
function children(node: BaseNode): BaseNode[] {
  if (node.kind === 'member') return [node.target];
  if (node.kind === 'index') return [node.target, node.index];
  if (node.kind === 'call') return [node.callee, ...node.args];
  if (node.kind === 'list') return node.items;
  if (node.kind === 'unary') return [node.operand];
  return node.kind === 'binary' ? [node.left, node.right] : [];
}
function nodeIssue(node: BaseNode, formulas: ReadonlySet<string>): string | null {
  if (node.kind === 'call') return callIssue(node);
  return node.kind === 'member' && node.target.kind === 'name' ? memberIssue(node.target.name, node.name, formulas) : null;
}
function memberIssue(owner: string, name: string, formulas: ReadonlySet<string>): string | null {
  if (owner === 'formula') return formulas.has(name) ? null : `formula.${name} is not declared in formulas.`;
  if (owner !== 'file' || FILE_FIELDS.includes(name) || FILE_METHODS.includes(name)) return null;
  return NONDETERMINISTIC.includes(name) ? `file.${name} is not supported: ingested fixtures must not depend on file-system timestamps.` : `file.${name} is not supported.`;
}
function functionIssue(name: string, args: number): string | null {
  if (name !== 'if') return `${name}() is not supported.`;
  return args >= 2 && args <= 3 ? null : 'if() takes a condition, a value and an optional fallback.';
}
function callIssue(node: Extract<BaseNode, { kind: 'call' }>): string | null {
  const callee = node.callee;
  if (callee.kind === 'name') return functionIssue(callee.name, node.args.length);
  if (callee.kind !== 'member') return 'Only named functions and methods can be called.';
  const owner = callee.target.kind === 'name' && (NAMESPACES as readonly string[]).includes(callee.target.name) ? callee.target.name : null;
  if (owner === 'file') return FILE_METHODS.includes(callee.name) ? null : `file.${callee.name}() is not supported.`;
  if (owner) return `${owner}.${callee.name}() is not a method; read a property such as ${owner}.${callee.name} instead.`;
  return VALUE_METHODS.includes(callee.name) ? null : `.${callee.name}() is not supported.`;
}

export function truthy(value: BaseValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}
function same(left: BaseValue, right: BaseValue): boolean {
  return left === right || (typeof left === 'object' && typeof right === 'object' && JSON.stringify(left) === JSON.stringify(right));
}
type Comparable = number | string;
const COMPARE: Record<string, (a: Comparable, b: Comparable) => boolean> = { '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
const MATH: Record<string, (a: number, b: number) => number> = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b, '%': (a, b) => a % b };
function ordered(operator: string, left: BaseValue, right: BaseValue): boolean {
  if (typeof left !== typeof right || (typeof left !== 'number' && typeof left !== 'string')) return false;
  return COMPARE[operator]!(left, right as Comparable);
}
function arithmetic(operator: string, left: BaseValue, right: BaseValue): BaseValue {
  if (operator === '+' && (typeof left === 'string' || typeof right === 'string')) return `${text(left)}${text(right)}`;
  if (typeof left !== 'number' || typeof right !== 'number') return null;
  const value = MATH[operator]!(left, right);
  return Number.isFinite(value) ? value : null;
}
const BINARY: Record<string, (left: BaseValue, right: BaseValue) => BaseValue> = {
  '==': (l, r) => same(l, r), '!=': (l, r) => !same(l, r),
  ...Object.fromEntries(['<', '<=', '>', '>='].map(op => [op, (l: BaseValue, r: BaseValue) => ordered(op, l, r)])),
  ...Object.fromEntries(['+', '-', '*', '/', '%'].map(op => [op, (l: BaseValue, r: BaseValue) => arithmetic(op, l, r)])),
};
const text = (value: BaseValue): string => value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const strings = (values: BaseValue[]): string[] => values.map(text);

function fileField(note: BaseNote, name: string): BaseValue {
  const slash = note.path.lastIndexOf('/'), file = note.path.slice(slash + 1), dot = file.lastIndexOf('.');
  const fields: Record<string, BaseValue> = { name: file, basename: dot > 0 ? file.slice(0, dot) : file, path: note.path,
    folder: slash < 0 ? '' : note.path.slice(0, slash), ext: dot > 0 ? file.slice(dot + 1) : '', size: note.size, tags: [...note.tags] };
  return fields[name] ?? null;
}
function hasTag(note: BaseNote, wanted: string): boolean {
  const tag = wanted.replace(/^#/, '').toLowerCase();
  return note.tags.some(item => item.toLowerCase() === tag || item.toLowerCase().startsWith(tag + '/'));
}
function fileMethod(note: BaseNote, name: string, args: BaseValue[]): BaseValue {
  if (name === 'inFolder') { const folder = text(args[0] ?? '').replace(/\/+$/, ''); return folder === '' || note.path.startsWith(folder + '/'); }
  if (name === 'hasTag') return strings(args).some(tag => hasTag(note, tag));
  return Object.hasOwn(note.properties, text(args[0] ?? ''));
}
function contains(target: BaseValue, needle: BaseValue): boolean {
  return Array.isArray(target) ? target.some(item => same(item, needle)) : text(target).includes(text(needle));
}
const VALUE: Record<string, (target: BaseValue, args: BaseValue[]) => BaseValue> = {
  contains: (target, args) => contains(target, args[0] ?? null),
  containsAny: (target, args) => args.some(arg => contains(target, arg)),
  containsAll: (target, args) => args.every(arg => contains(target, arg)),
  startsWith: (target, args) => text(target).startsWith(text(args[0] ?? '')),
  endsWith: (target, args) => text(target).endsWith(text(args[0] ?? '')),
  isEmpty: target => !truthy(target) && target !== 0 && target !== false,
  lower: target => text(target).toLowerCase(), upper: target => text(target).toUpperCase(),
  trim: target => text(target).trim(), toString: (target: BaseValue) => text(target),
};

function valueMember(target: BaseValue, name: string): BaseValue {
  if (name === 'length' && (Array.isArray(target) || typeof target === 'string')) return target.length;
  return target !== null && typeof target === 'object' && !Array.isArray(target) ? target[name] ?? null : null;
}

class Evaluator {
  private readonly scope: BaseScope;
  constructor(scope: BaseScope) { this.scope = scope; }
  value(node: BaseNode): BaseValue {
    const result = this.evaluate(node);
    if (isNamespace(result)) requireSketch(false, 'BASE_EXPRESSION', `"${result.namespace}" needs a property, for example ${result.namespace}.name.`);
    return result;
  }
  private evaluate(node: BaseNode): Evaluated {
    switch (node.kind) {
      case 'literal': return node.value;
      case 'name': return this.name(node.name);
      case 'member': return this.member(this.evaluate(node.target), node.name);
      case 'index': return this.index(this.value(node.target), this.value(node.index));
      case 'call': return this.call(node);
      case 'list': return node.items.map(item => this.value(item));
      case 'unary': return this.unary(node);
      default: return this.binary(node);
    }
  }
  private name(name: string): Evaluated {
    return (NAMESPACES as readonly string[]).includes(name) ? { namespace: name as Namespace } : this.scope.note.properties[name] ?? null;
  }
  private unary(node: Extract<BaseNode, { kind: 'unary' }>): BaseValue {
    const operand = this.value(node.operand);
    return node.operator === '!' ? !truthy(operand) : arithmetic('-', 0, operand);
  }
  private binary(node: Extract<BaseNode, { kind: 'binary' }>): BaseValue {
    if (node.operator === '&&') { const left = this.value(node.left); return truthy(left) ? this.value(node.right) : left; }
    if (node.operator === '||') { const left = this.value(node.left); return truthy(left) ? left : this.value(node.right); }
    return BINARY[node.operator]!(this.value(node.left), this.value(node.right));
  }
  private member(target: Evaluated, name: string): BaseValue {
    return isNamespace(target) ? this.namespaceMember(target.namespace, name) : valueMember(target, name);
  }
  private namespaceMember(namespace: Namespace, name: string): BaseValue {
    if (namespace === 'note') return this.scope.note.properties[name] ?? null;
    return namespace === 'file' ? fileField(this.scope.note, name) : this.scope.formula(name);
  }
  private index(target: BaseValue, index: BaseValue): BaseValue {
    if (Array.isArray(target) && typeof index === 'number') return target[index] ?? null;
    return target !== null && typeof target === 'object' && !Array.isArray(target) && typeof index === 'string' ? target[index] ?? null : null;
  }
  private call(node: Extract<BaseNode, { kind: 'call' }>): BaseValue {
    const callee = node.callee;
    if (callee.kind === 'name') return truthy(this.value(node.args[0]!)) ? this.value(node.args[1]!) : node.args[2] ? this.value(node.args[2]) : null;
    requireSketch(callee.kind === 'member', 'BASE_EXPRESSION', 'Only named functions and methods can be called.');
    const args = node.args.map(arg => this.value(arg));
    const target = this.evaluate(callee.target);
    if (isNamespace(target) && target.namespace === 'file') return fileMethod(this.scope.note, callee.name, args);
    return VALUE[callee.name]!(target as BaseValue, args);
  }
}
/** Evaluates a parsed, issue-free expression against one note. */
export function evaluateExpression(node: BaseNode, scope: BaseScope): BaseValue {
  return new Evaluator(scope).value(node);
}
