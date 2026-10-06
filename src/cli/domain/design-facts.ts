/** Pure parsers for the engineering facts a design folder cites. Unreadable or foreign shapes yield nothing, never guesses. */
export interface StackEntry { name: string; version: string; role: string }
export interface PackageFacts { name: string | null; stack: StackEntry[]; scripts: string[] }
export interface TokenAlias { name: string; value: string }
export interface TokenFacts { file: string; scopes: string[]; aliases: TokenAlias[] }
export interface TraceInteraction { id: string; definitionId: string; nodeId: string; label: string; verification: string; implementation: string | null; test: string | null }
export interface TraceDefinition { id: string; kind: string; owner: string; component: string }
export interface TraceFacts { definitions: TraceDefinition[]; interactions: TraceInteraction[] }
export interface FactSource { path: string; sha256: string; note?: string }
export interface EngineeringFacts {
  /** Every file the guide's facts come from, with its hash at reading time; fingerprint covers all of them. */
  sources: FactSource[]; fingerprint: string;
  codebase: string; tests: string; packageJson: PackageFacts | null; layout: { folder: string; files: number }[];
  components: string[]; libraryUsage: { name: string; uses: number }[]; tokens: TokenFacts | null;
  origins: Map<string, string[]>; trace: TraceFacts | null; limits: { source: number; tests: number } | null;
  docs: { path: string; title: string }[];
  /** Conventional folders that exist under the source root, with the role the architecture gives them. */
  placement: { path: string; role: string }[];
}
/** Folder roles fixed by the shell's architecture (AGENTS.md, PRESENTATION-STRUCTURE.md) and by the project compiler's output layout. */
export const placementRoles: ReadonlyArray<readonly [string, string]> = [
  ['presentation/components', 'Vue single-file components; scripts hold only imports, props and bindings'],
  ['presentation/composables', 'view behaviour as TypeScript composables'], ['presentation/stores', 'per-view state (Pinia)'],
  ['presentation/context', 'injection keys and view types'], ['features', 'feature code, exposed through features/api.ts'],
  ['application', 'framework-free services that own canonical data'], ['domain', 'framework-free rules and contracts'],
  ['styles', 'owned CSS and the token aliases'], ['ui', 'the generated Vue UI'], ['core', 'framework-free project model'],
  ['targets', 'one entrypoint per host target'], ['generated', 'code emitted by the project compiler'],
];
/** Runtime and build packages that decide how a design is implemented; other dependencies are not design-relevant. */
const stackRoles: ReadonlyArray<readonly [string, string]> = [
  ['vue', 'UI framework'], ['@nuxt/ui', 'component library'], ['pinia', 'per-view state'], ['@angular/core', 'UI framework'],
  ['tailwindcss', 'utility CSS (scoped by the build)'], ['@iconify-json/lucide', 'icon set'], ['obsidian', 'host API'],
  ['vite', 'bundler'], ['typescript', 'language'], ['@playwright/test', 'browser tests'], ['vitest', 'unit tests'],
];
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const words = (value: unknown, max = 160): string | null => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null;
const safePath = (value: unknown): string | null => {
  const path = words(value, 240);
  return path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..') ? path : null;
};
export function packageFacts(value: unknown): PackageFacts | null {
  if (!record(value)) return null;
  const versions = { ...(record(value.devDependencies) ? value.devDependencies : {}), ...(record(value.dependencies) ? value.dependencies : {}) };
  const stack = stackRoles.flatMap(([name, role]) => typeof versions[name] === 'string' ? [{ name, version: String(versions[name]), role }] : []);
  const scripts = record(value.scripts) ? Object.keys(value.scripts).filter(name => /^[\w:.-]{1,60}$/.test(name)).sort() : [];
  return { name: words(value.name, 80), stack, scripts };
}
/** Custom properties declared in a token stylesheet, with the selectors that scope them; comments are ignored. */
export function tokenFacts(file: string, css: string): TokenFacts | null {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const scopes = [...source.matchAll(/([^{}]+)\{[^{}]*--[\w-]+\s*:/g)].map(match => match[1]!.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const aliases = [...source.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(match => ({ name: match[1]!, value: match[2]!.trim().replace(/\s+/g, ' ') }));
  return aliases.length ? { file, scopes: [...new Set(scopes)], aliases: aliases.slice(0, 200) } : null;
}
/** One compiler artifact's safe path and the entity IDs it carries. */
function artifactOrigins(artifact: unknown): { path: string; ids: string[] } | null {
  if (!record(artifact) || !Array.isArray(artifact.origins)) return null;
  const path = safePath(artifact.path);
  const ids = artifact.origins.flatMap(origin => { const id = record(origin) ? words(origin.entityId, 80) : null; return id ? [id] : []; });
  return path ? { path, ids } : null;
}
/** design/compiler-origins.json: the generated files that carry each design entity, keyed by entity ID. */
export function originFacts(value: unknown): Map<string, string[]> {
  const files = new Map<string, string[]>();
  if (!record(value) || !Array.isArray(value.artifacts)) return files;
  for (const artifact of value.artifacts.slice(0, 5000)) {
    const found = artifactOrigins(artifact);
    for (const id of found?.ids ?? []) if (!(files.get(id) ?? []).includes(found!.path)) files.set(id, [...(files.get(id) ?? []), found!.path]);
  }
  return files;
}
/** design/visual-traceability.json: page/component definitions and the interaction hooks with their implementation and test files. */
export function traceFacts(value: unknown): TraceFacts | null {
  if (!record(value) || !Array.isArray(value.definitions) || !Array.isArray(value.interactions)) return null;
  const definitions = value.definitions.slice(0, 500).flatMap(item => {
    if (!record(item)) return [];
    const id = words(item.id, 80), kind = words(item.kind, 40), owner = words(item.ownerId ?? item.libraryId, 80), component = safePath(item.component);
    return id && kind && owner && component ? [{ id, kind, owner, component }] : [];
  });
  const interactions = value.interactions.slice(0, 1000).flatMap(item => {
    if (!record(item)) return [];
    const id = words(item.id, 80), definitionId = words(item.definitionId, 80), nodeId = words(item.nodeId, 80);
    return id && definitionId && nodeId ? [{ id, definitionId, nodeId, label: words(item.label) ?? id, verification: words(item.verification, 60) ?? 'unspecified',
      implementation: safePath(item.implementation), test: safePath(item.test) }] : [];
  });
  return { definitions, interactions };
}
/** configs/quality/thresholds.json code-line limits, the budgets an implementation file must fit. */
export function lineLimits(value: unknown): { source: number; tests: number } | null {
  if (!record(value) || !record(value.codeLines)) return null;
  const { source, tests } = value.codeLines;
  return typeof source === 'number' && typeof tests === 'number' ? { source, tests } : null;
}
/** Nuxt UI components a project already uses: the number of files importing or rendering each. */
export function libraryUsage(texts: readonly string[]): { name: string; uses: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const names = [...text.matchAll(/@nuxt\/ui\/components\/([A-Z][A-Za-z]+)\.vue/g), ...text.matchAll(/<U([A-Z][A-Za-z]+)[\s/>]/g)].map(match => 'U' + match[1]!);
    for (const name of new Set(names)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, uses]) => ({ name, uses })).sort((a, b) => b.uses - a.uses || (a.name < b.name ? -1 : 1));
}
/** The first Markdown heading, the title a reader recognises a document by. */
export function documentTitle(markdown: string): string | null {
  return words(/^#{1,2}\s+(.+)$/m.exec(markdown)?.[1], 120);
}
