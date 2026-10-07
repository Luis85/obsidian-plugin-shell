/** Pure resolution and rewriting of module specifiers between source projects (repository-relative POSIX paths). */
export type AliasPrefixes = ReadonlyArray<readonly [prefix: string, target: string]>;
export interface ProjectLocation { name: string; path: string }

/** Collapses `.` and `..` segments; a path that climbs above the repository root yields null. */
export function normalizePath(path: string): string | null {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') { if (!parts.length) return null; parts.pop(); continue; }
    parts.push(part);
  }
  return parts.join('/');
}
const directory = (path: string): string => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const isRelative = (specifier: string): boolean => /^\.\.?(?:\/|$)/.test(specifier);

/** `package.json` `imports` patterns (`"#name/*": "./path/*"`) as prefix pairs; conditional or exact entries are not prefixes. */
export function aliasPrefixes(imports: unknown): Array<[string, string]> {
  if (!imports || typeof imports !== 'object' || Array.isArray(imports)) return [];
  return Object.entries(imports as Record<string, unknown>)
    .filter((entry): entry is [string, string] => entry[0].startsWith('#') && entry[0].endsWith('/*') && typeof entry[1] === 'string' && /^\.\/.*\/\*$/.test(entry[1]))
    .map(([key, value]) => [key.slice(0, -1), normalizePath(value.slice(2, -1)) + '/']);
}

/** The repository-relative target of a specifier, or null for packages, builtins and anything outside the repository. */
export function resolveSpecifier(from: string, specifier: string, aliases: AliasPrefixes): string | null {
  const bare = specifier.split('?')[0]!;
  const alias = aliases.find(([prefix]) => bare.startsWith(prefix));
  if (alias) return normalizePath(alias[1] + bare.slice(alias[0].length));
  if (!isRelative(bare)) return null;
  return normalizePath(`${directory(from)}/${bare}`);
}

/** The project owning a repository-relative path: the longest declared path that contains it. */
export function projectForPath<T extends ProjectLocation>(projects: readonly T[], path: string): T | null {
  let found: T | null = null;
  for (const project of projects) {
    if ((path === project.path || path.startsWith(`${project.path}/`)) && (!found || project.path.length > found.path.length)) found = project;
  }
  return found;
}

const within = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);
const moved = (path: string, from: string, to: string): string => within(path, from) ? to + path.slice(from.length) : path;
function relativeSpecifier(fromFile: string, target: string): string {
  const a = directory(fromFile).split('/').filter(Boolean), b = target.split('/');
  let shared = 0;
  while (shared < a.length && shared < b.length - 1 && a[shared] === b[shared]) shared++;
  const text = [...a.slice(shared).map(() => '..'), ...b.slice(shared)].join('/');
  return text.startsWith('..') ? text : `./${text}`;
}
export interface ProjectRename { fromPath: string; toPath: string; fromAlias?: string; toAlias?: string }
/**
 * The specifier a file needs after a project folder (and its `#alias/`) is renamed, or null when it stays valid.
 * `file` is the file's path before the move; files inside the moved folder move with it.
 */
export function renamedSpecifier(file: string, specifier: string, rename: ProjectRename, aliases: AliasPrefixes): string | null {
  const [bare, ...query] = specifier.split('?');
  const suffix = query.length ? `?${query.join('?')}` : '';
  if (rename.fromAlias && rename.toAlias && bare!.startsWith(rename.fromAlias)) return rename.toAlias + bare!.slice(rename.fromAlias.length) + suffix;
  if (!isRelative(bare!)) return null;
  const target = resolveSpecifier(file, bare!, aliases);
  if (target === null) return null;
  const nextFile = moved(file, rename.fromPath, rename.toPath), nextTarget = moved(target, rename.fromPath, rename.toPath);
  if (resolveSpecifier(nextFile, bare!, aliases) === nextTarget) return null;
  return relativeSpecifier(nextFile, nextTarget) + suffix;
}
