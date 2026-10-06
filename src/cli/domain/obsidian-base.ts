import { requireSketch } from './errors.ts';
import { parseExpression, type BaseNode } from './base-expression-parse.ts';
import { evaluateExpression, expressionIssues, formulaNames, truthy, type BaseNote, type BaseValue } from './base-expression.ts';

/**
 * An Obsidian Bases file read as configuration: global filters, formulas, property display names and views. One
 * selected view turns into a file-collection configuration and deterministic records for fixtures.
 */
export type BaseFilter = { kind: 'expression'; source: string; node: BaseNode } | { kind: 'and' | 'or' | 'not'; items: BaseFilter[] };
export interface BaseSort { property: string; direction: 'ASC' | 'DESC' }
export interface BaseView {
  name: string; type: string; filters: BaseFilter | null; order: string[];
  sort: BaseSort[]; limit: number | null; groupBy: BaseSort | null; ignored: string[];
}
export interface BaseDefinition {
  filters: BaseFilter | null;
  formulas: ReadonlyMap<string, { source: string; node: BaseNode }>;
  displayNames: Readonly<Record<string, string>>;
  views: BaseView[];
  ignored: string[];
}
const BASE_LIMITS = Object.freeze({ views: 50, formulas: 100, filterItems: 200, filterDepth: 20, columns: 100, sortKeys: 10, limit: 10000 });
const TOP_LEVEL = ['filters', 'formulas', 'properties', 'views'];
const VIEW_KEYS = ['type', 'name', 'filters', 'order', 'sort', 'limit', 'groupBy'];

const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const label = (value: unknown, name: string, max = 200): string => {
  requireSketch(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'BASE_FIELD', `${name} needs text (1–${max} characters).`);
  return value;
};

/** `title` means `note.title`; `file.*`, `note.*` and `formula.*` stay as written. */
export function propertyId(value: unknown): string {
  const id = label(value, 'Property');
  const match = /^(?:(note|file|formula)\.)?([^\s.][^\s]*)$/.exec(id);
  requireSketch(match, 'BASE_PROPERTY', `"${id}" is not a property reference such as note.status, file.name or formula.total.`);
  return match[1] ? id : `note.${id}`;
}
interface Budget { filters: number }
function readFilter(value: unknown, budget: Budget, depth = 0): BaseFilter {
  requireSketch(depth <= BASE_LIMITS.filterDepth && ++budget.filters <= BASE_LIMITS.filterItems, 'BASE_LIMIT', `Filters are limited to ${BASE_LIMITS.filterItems} items and ${BASE_LIMITS.filterDepth} levels.`);
  if (typeof value === 'string') return { kind: 'expression', source: value, node: parseExpression(value) };
  requireSketch(plain(value) && Object.keys(value).length === 1, 'BASE_FILTER', 'A filter is an expression or exactly one of and, or, not.');
  const [kind, items] = Object.entries(value)[0]!;
  requireSketch(['and', 'or', 'not'].includes(kind) && Array.isArray(items), 'BASE_FILTER', `Unsupported filter group "${kind}"; use and, or or not with a list.`);
  return { kind: kind as 'and' | 'or' | 'not', items: items.map(item => readFilter(item, budget, depth + 1)) };
}
function readSort(value: unknown, name: string): BaseSort {
  requireSketch(plain(value), 'BASE_SORT', `${name} needs property and direction.`);
  const direction = value.direction === undefined ? 'ASC' : String(value.direction).toUpperCase();
  requireSketch(direction === 'ASC' || direction === 'DESC', 'BASE_SORT', `${name} direction must be ASC or DESC.`);
  return { property: propertyId(value.property), direction };
}
function readList(value: unknown, name: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  requireSketch(Array.isArray(value) && value.length <= max, 'BASE_FIELD', `${name} needs a list of at most ${max} items.`);
  return value;
}
function readLimit(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  requireSketch(Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= BASE_LIMITS.limit, 'BASE_FIELD', `View limit must be an integer from 1 to ${BASE_LIMITS.limit}.`);
  return value as number;
}
function readView(value: unknown, index: number, budget: Budget): BaseView {
  requireSketch(plain(value), 'BASE_VIEW', `View ${index + 1} must be a mapping.`);
  return {
    name: label(value.name, `View ${index + 1} name`), type: label(value.type ?? 'table', `View ${index + 1} type`, 40),
    filters: value.filters === undefined || value.filters === null ? null : readFilter(value.filters, budget),
    order: readList(value.order, 'order', BASE_LIMITS.columns).map(propertyId),
    sort: readList(value.sort, 'sort', BASE_LIMITS.sortKeys).map(item => readSort(item, 'sort')),
    limit: readLimit(value.limit), groupBy: value.groupBy === undefined || value.groupBy === null ? null : readSort(value.groupBy, 'groupBy'),
    ignored: Object.keys(value).filter(key => !VIEW_KEYS.includes(key)).sort(),
  };
}
function readFormulas(value: unknown): Map<string, { source: string; node: BaseNode }> {
  if (value === undefined || value === null) return new Map();
  requireSketch(plain(value) && Object.keys(value).length <= BASE_LIMITS.formulas, 'BASE_FORMULAS', `formulas must map at most ${BASE_LIMITS.formulas} names to expressions.`);
  return new Map(Object.entries(value).map(([name, source]) => {
    requireSketch(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'BASE_FORMULAS', `Formula name "${name}" must be an identifier.`);
    return [name, { source: label(source, `formula.${name}`, 2000), node: parseExpression(String(source)) }];
  }));
}
function readDisplayNames(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  requireSketch(plain(value), 'BASE_PROPERTIES', 'properties must be a mapping.');
  const names: Record<string, string> = {};
  for (const [key, config] of Object.entries(value)) if (plain(config) && typeof config.displayName === 'string') names[propertyId(key)] = config.displayName;
  return names;
}

/** Validates a parsed `.base` YAML value. Expression syntax errors fail here; unsupported functions are view issues. */
export function readBase(value: unknown): BaseDefinition {
  requireSketch(plain(value), 'BASE_SHAPE', 'A .base file must be a YAML mapping.');
  const budget: Budget = { filters: 0 };
  const views = readList(value.views, 'views', BASE_LIMITS.views).map((view, index) => readView(view, index, budget));
  requireSketch(views.length > 0, 'BASE_VIEW', 'The .base file declares no views.');
  requireSketch(new Set(views.map(view => view.name)).size === views.length, 'BASE_VIEW', 'View names must be unique.');
  return {
    filters: value.filters === undefined || value.filters === null ? null : readFilter(value.filters, budget),
    formulas: readFormulas(value.formulas), displayNames: readDisplayNames(value.properties), views,
    ignored: Object.keys(value).filter(key => !TOP_LEVEL.includes(key)).sort(),
  };
}
export function selectView(base: BaseDefinition, name: string | undefined): BaseView {
  requireSketch(name, 'BASE_VIEW_REQUIRED', `Select a view with --view: ${base.views.map(view => view.name).join(', ')}.`);
  const view = base.views.find(item => item.name === name);
  requireSketch(view, 'BASE_VIEW_UNKNOWN', `No view "${name}". Views: ${base.views.map(item => item.name).join(', ')}.`);
  return view;
}

const filterNodes = (filter: BaseFilter | null): BaseNode[] => !filter ? [] : filter.kind === 'expression' ? [filter.node] : filter.items.flatMap(filterNodes);
/** The formulas a view needs, transitively, in first-use order; a cycle is an issue rather than an endless loop. */
function viewFormulas(base: BaseDefinition, view: BaseView, issues: string[]): string[] {
  const roots = [...filterNodes(base.filters), ...filterNodes(view.filters)].flatMap(formulaNames);
  const columns = [...view.order, ...view.sort.map(item => item.property), ...(view.groupBy ? [view.groupBy.property] : [])];
  const pending = [...roots, ...columns.filter(id => id.startsWith('formula.')).map(id => id.slice(8))];
  const seen: string[] = [], visiting = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) { issues.push(`formula.${name} refers to itself through other formulas.`); return; }
    if (seen.includes(name) || !base.formulas.has(name)) return;
    visiting.add(name); formulaNames(base.formulas.get(name)!.node).forEach(visit); visiting.delete(name); seen.push(name);
  };
  pending.forEach(visit);
  return seen;
}
/** Everything that keeps a view from being evaluated exactly; an empty list means the view is supported. */
export function viewIssues(base: BaseDefinition, view: BaseView): string[] {
  const issues: string[] = [], formulas = new Set(base.formulas.keys());
  const used = viewFormulas(base, view, issues);
  const nodes = [...filterNodes(base.filters), ...filterNodes(view.filters), ...used.map(name => base.formulas.get(name)!.node)];
  for (const node of nodes) issues.push(...expressionIssues(node, formulas));
  for (const id of [...view.order, ...view.sort.map(item => item.property), ...(view.groupBy ? [view.groupBy.property] : [])]) {
    if (id.startsWith('formula.') && !formulas.has(id.slice(8))) issues.push(`${id} is not declared in formulas.`);
    if (id.startsWith('file.')) issues.push(...expressionIssues(parseExpression(id), formulas));
  }
  return [...new Set(issues)];
}

/** One note's view of the base: formulas are evaluated lazily, once, and cycles fail instead of recursing. */
export class NoteScope {
  private readonly cache = new Map<string, BaseValue>();
  private readonly active = new Set<string>();
  private readonly base: BaseDefinition;
  readonly note: BaseNote;
  constructor(base: BaseDefinition, note: BaseNote) { this.base = base; this.note = note; }
  formula(name: string): BaseValue {
    if (this.cache.has(name)) return this.cache.get(name)!;
    const formula = this.base.formulas.get(name);
    requireSketch(formula && !this.active.has(name), 'BASE_FORMULA', `formula.${name} is undeclared or cyclic.`);
    this.active.add(name);
    try { const value = evaluateExpression(formula.node, this); this.cache.set(name, value); return value; } finally { this.active.delete(name); }
  }
  property(id: string): BaseValue { return evaluateExpression(parseExpression(id), this); }
  matches(filter: BaseFilter | null): boolean {
    if (!filter) return true;
    if (filter.kind === 'expression') return truthy(evaluateExpression(filter.node, this));
    if (filter.kind === 'and') return filter.items.every(item => this.matches(item));
    return filter.kind === 'or' ? filter.items.some(item => this.matches(item)) : !filter.items.some(item => this.matches(item));
  }
}

/** The narrowest folder a top-level `file.inFolder("…")` filter requires, so ingestion can scan only that folder. */
export function requiredFolder(filter: BaseFilter | null): string | null {
  const candidates = !filter ? [] : filter.kind === 'expression' ? [filter] : filter.kind === 'and' ? filter.items : [];
  for (const item of candidates) {
    const folder = item.kind === 'expression' ? inFolderLiteral(item.node) : null;
    if (folder !== null) return folder;
  }
  return null;
}
function inFolderLiteral(node: BaseNode): string | null {
  if (node.kind !== 'call' || node.args.length !== 1 || node.callee.kind !== 'member' || node.callee.name !== 'inFolder') return null;
  const target = node.callee.target, folder = node.args[0]!;
  const fileTarget = target.kind === 'name' && target.name === 'file';
  return fileTarget && folder.kind === 'literal' && typeof folder.value === 'string' ? folder.value.replace(/\/+$/, '') : null;
}
