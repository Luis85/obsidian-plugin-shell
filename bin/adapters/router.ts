export type CliSurface = 'maker' | 'framework' | 'memory';
export interface RoutedArguments { surface: CliSurface; args: string[] }

const legacyNewFlags = new Set([
  '--starter', '--from', '--list', '--id', '--name', '--author', '--extension', '--extensions',
  '--install', '--inside-vault', '--storybook', '--storybook-stories', '--airship', '--no-airship',
  '--yes', '--dry-run', '--plan-out', '--timeout',
]);
const makerCommands = new Set([
  'studio', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run', 'brainstorm',
  '--ui', '--no-color',
]);
const makerHelpCommands = new Set([
  'sketch', 'prototype', 'studio', 'settings', 'project-setup', 'first-run', 'brainstorm',
]);

/** Route without I/O or project reads. Aliases are normalized before selecting the owning surface. */
export function routeArguments(argv: readonly string[]): RoutedArguments {
  let args = [...argv];
  if (args[0] === 'make' && args[1] === 'project') args = ['new', ...args.slice(2)];
  if (args[0] === 'make' && args[1] === 'prototype') args = ['prototype', ...args.slice(2)];
  // Keep `help new` on the framework catalog; `new --help` belongs to the preset maker.
  if (args[0] === 'help' && makerHelpCommands.has(args[1] ?? '')) args = [args[1]!, '--help', ...args.slice(2)];

  if (args[0] === 'memory') return { surface: 'memory', args: args.slice(1) };
  if (args[0] === 'help' && args[1] === 'memory') return { surface: 'memory', args: ['--help', ...args.slice(2)] };

  const next = args[1];
  const legacyPath = Boolean(next && !next.startsWith('--') && !['presets', 'guide', 'validate'].includes(next));
  const legacyNew = args[0] === 'new' && (legacyPath || args.slice(1).some(arg => legacyNewFlags.has(arg)));
  const maker = args.length === 0 || (args[0] === 'new' && !legacyNew) || makerCommands.has(args[0] ?? '');
  return { surface: maker ? 'maker' : 'framework', args };
}
