/** Pure generation selection: canonical identities and explicit dependency closure, never paths or effects. */
export type SelectionKind = 'feature' | 'page' | 'component';
export interface Selection { kind: SelectionKind; id: string }
export interface SelectionNode { key: string; dependencies: readonly string[] }
export interface SelectionClosure { requested: Selection; root: string; included: string[]; dependencies: Array<{ from: string; to: string }> }
export interface GenerationSelection extends SelectionClosure { selectedPaths: string[]; sharedPaths: string[]; retainedPaths: string[] }
export class SelectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(code + ': ' + message); this.code = code; this.name = 'SelectionError'; }
}
const sorted = (values: Iterable<string>): string[] => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 180 && !/[\u0000-\u001f\u007f]/u.test(value);
export function parseSelection(value?: string): Selection | null {
  if (value === undefined || value === 'all') return null;
  const match = /^(feature|page|component):(.+)$/u.exec(value);
  if (!match || !identity(match[2]) || match[2].length > 120) throw new SelectionError('GENERATION_SCOPE_INVALID', 'Use all, feature:<id>, page:<surface-or-design-id>, or component:<library-or-design-id>.');
  return { kind: match[1] as SelectionKind, id: match[2] };
}
/** The graph contains compile dependencies, not navigation transitions. Navigation cycles remain legal. */
export function selectionClosure(requested: Selection, root: string, nodes: readonly SelectionNode[]): SelectionClosure {
  if (nodes.length > 5000) throw new SelectionError('GENERATION_SCOPE_LIMIT', 'Too many dependency records.');
  const graph = new Map<string, readonly string[]>(); let edges = 0;
  for (const node of nodes) {
    if (!identity(node.key) || graph.has(node.key) || !Array.isArray(node.dependencies) || node.dependencies.some(key => !identity(key)))
      throw new SelectionError('GENERATION_SCOPE_GRAPH', 'Malformed or duplicate dependency record.');
    edges += node.dependencies.length;
    if (edges > 120000) throw new SelectionError('GENERATION_SCOPE_LIMIT', 'Too many dependency references.');
    graph.set(node.key, sorted(new Set(node.dependencies)));
  }
  if (!graph.has(root)) throw new SelectionError('GENERATION_SCOPE_UNKNOWN', 'No canonical artifact matches ' + requested.kind + ':' + requested.id + '.');
  const included = new Set<string>(), active = new Set<string>(), dependencies: Array<{ from: string; to: string }> = [];
  function visit(key: string): void {
    if (active.has(key)) throw new SelectionError('GENERATION_SCOPE_CYCLE', 'Compile dependency cycle at ' + key + '.');
    if (included.has(key)) return;
    const children = graph.get(key);
    if (!children) throw new SelectionError('GENERATION_SCOPE_REFERENCE', 'Missing compile dependency ' + key + '.');
    active.add(key);
    for (const child of children) { dependencies.push({ from: key, to: child }); visit(child); }
    active.delete(key); included.add(key);
  }
  visit(root);
  dependencies.sort((a, b) => (a.from + '\n' + a.to) < (b.from + '\n' + b.to) ? -1 : 1);
  return { requested: { ...requested }, root, included: sorted(included), dependencies };
}
