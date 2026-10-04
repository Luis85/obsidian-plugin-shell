export interface Arguments { command: string; action: string; flags: Record<string, string | boolean> }
export function option(args: Arguments, name: string, fallback = ''): string {
  const value = args.flags[name]; return typeof value === 'string' ? value : fallback;
}
/** Built-in maker command roots and options. The parser and plugin validation share them, so a plugin can never shadow one. */
export const makerCommandIds: readonly string[] = ['sketch', 'prototype', 'studio', 'new', 'settings', 'project-setup', 'first-run', 'brainstorm', 'design', 'wizard', 'form', 'fake-data', 'learn', 'process'];
export const makerBooleanOptions: readonly string[] = ['json', 'no-interaction', 'help', 'no-color', 'base'];
export const makerValueOptions: readonly string[] = ['root', 'project', 'input', 'out', 'kind', 'guide', 'apply', 'ui', 'starter', 'name', 'package', 'entity', 'count', 'seed', 'config', 'step'];
