export interface Arguments { command: string; action: string; flags: Record<string, string | boolean> }
export function option(args: Arguments, name: string, fallback = ''): string {
  const value = args.flags[name]; return typeof value === 'string' ? value : fallback;
}
/** Note-collection command roots (configs/collections): root → collection id. A new collection adds one entry. */
export const collectionCommandRoots: Readonly<Record<string, string>> = Object.freeze({ risk: 'risk' });
/** Built-in maker command roots and options. The parser and plugin validation share them, so a plugin can never shadow one. */
export const makerCommandIds: readonly string[] = ['sketch', 'prototype', 'studio', 'new', 'settings', 'project-setup', 'first-run', 'brainstorm', 'design', 'wizard', 'form', 'fake-data', 'learn', 'process', ...Object.keys(collectionCommandRoots)];
export const makerBooleanOptions: readonly string[] = ['json', 'no-interaction', 'help', 'no-color', 'base', 'overdue'];
export const makerValueOptions: readonly string[] = ['root', 'project', 'input', 'out', 'kind', 'guide', 'apply', 'ui', 'starter', 'name', 'package', 'entity', 'count', 'seed', 'config', 'step',
  'id', 'as-of', 'status', 'dimension', 'category', 'level'];
