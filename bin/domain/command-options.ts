export interface Arguments { command: 'sketch' | 'prototype' | 'studio' | 'new' | 'settings' | 'project-setup' | 'first-run'; action: string; flags: Record<string, string | boolean> }
export function option(args: Arguments, name: string, fallback = ''): string {
  const value = args.flags[name]; return typeof value === 'string' ? value : fallback;
}
