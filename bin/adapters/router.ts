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

function normalizeAliases(argv: readonly string[]): string[] {
  const [first, second] = argv;
  if (first === 'make' && second === 'project') return ['new', ...argv.slice(2)];
  if (first === 'make' && second === 'prototype') return ['prototype', ...argv.slice(2)];
  // Keep `help new` on the framework catalog; `new --help` belongs to the preset maker.
  if (first === 'help' && makerHelpCommands.has(second ?? '')) return [second!, '--help', ...argv.slice(2)];
  return [...argv];
}
function memoryArguments(args: string[]): string[] | undefined {
  if (args[0] === 'memory') return args.slice(1);
  if (args[0] === 'help' && args[1] === 'memory') return ['--help', ...args.slice(2)];
  return undefined;
}
function legacyNew(args: string[]): boolean {
  if (args[0] !== 'new') return false;
  const next = args[1];
  const legacyPath = Boolean(next && !next.startsWith('--') && !['presets', 'guide', 'validate'].includes(next));
  return legacyPath || args.slice(1).some(arg => legacyNewFlags.has(arg));
}

/** Route without I/O or project reads. Aliases are normalized before selecting the owning surface. */
export function routeArguments(argv: readonly string[]): RoutedArguments {
  const args = normalizeAliases(argv);
  const memory = memoryArguments(args);
  if (memory) return { surface: 'memory', args: memory };
  const maker = args.length === 0 || (args[0] === 'new' && !legacyNew(args)) || makerCommands.has(args[0] ?? '');
  return { surface: maker ? 'maker' : 'framework', args };
}
