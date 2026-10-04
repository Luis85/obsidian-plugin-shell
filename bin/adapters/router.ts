export type CliSurface = 'maker' | 'framework' | 'memory';
export interface RoutedArguments { surface: CliSurface; args: string[] }
/** Registered plugin CLI commands and framework catalog roots, injected so routing itself stays free of I/O. */
export interface RouteExtensions { pluginCommands: ReadonlySet<string>; frameworkRoots: ReadonlySet<string> }

// `new <dir> --starter <id>` creates from file/Companion starters; `new [--starter <id>]` without a directory runs project starters.
const directoryNewFlags = new Set([
  '--from', '--list', '--id', '--name', '--author', '--extension', '--extensions',
  '--install', '--inside-vault', '--no-git', '--storybook', '--storybook-stories', '--airship', '--no-airship',
  '--yes', '--dry-run', '--plan-out', '--timeout', '--values', '--answers', '--run', '--trust-processes',
]);
const makerCommands = new Set([
  'studio', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run', 'brainstorm', 'design', 'wizard', 'form', 'learn',
  '--ui', '--no-color',
]);
const makerHelpCommands = new Set([
  'sketch', 'prototype', 'studio', 'settings', 'project-setup', 'first-run', 'brainstorm', 'design', 'wizard', 'form', 'learn',
]);

function normalizeHelp(argv: readonly string[]): string[] {
  const [first, second] = argv;
  // Keep `help new` on the framework catalog; `new --help` describes the project-starter maker.
  if (first === 'help' && makerHelpCommands.has(second ?? '')) return [second!, '--help', ...argv.slice(2)];
  return [...argv];
}
function memoryArguments(args: string[]): string[] | undefined {
  if (args[0] === 'memory') return args.slice(1);
  if (args[0] === 'help' && args[1] === 'memory') return ['--help', ...args.slice(2)];
  return undefined;
}
function directoryNew(args: string[]): boolean {
  if (args[0] !== 'new') return false;
  const next = args[1];
  const hasDirectory = Boolean(next && !next.startsWith('--') && !['starters', 'guide', 'validate'].includes(next));
  return hasDirectory || args.slice(1).some(arg => directoryNewFlags.has(arg));
}

/** Plugin commands belong to the maker surface; framework commands keep precedence over a plugin with the same root. */
function pluginRoute(args: string[], extensions: RouteExtensions): RoutedArguments | undefined {
  if (args[0] === 'help' && args[1] && extensions.pluginCommands.has(args[1])) return { surface: 'maker', args: [args[1], '--help', ...args.slice(2)] };
  if (args[0] && !extensions.frameworkRoots.has(args[0]) && extensions.pluginCommands.has(args[0])) return { surface: 'maker', args };
  return undefined;
}

/** Route without I/O or project reads. Help topics are normalized before selecting the owning surface. */
export function routeArguments(argv: readonly string[], extensions?: RouteExtensions): RoutedArguments {
  const args = normalizeHelp(argv);
  const memory = memoryArguments(args);
  if (memory) return { surface: 'memory', args: memory };
  const maker = args.length === 0 || (args[0] === 'new' && !directoryNew(args)) || makerCommands.has(args[0] ?? '');
  if (maker) return { surface: 'maker', args };
  return (extensions && pluginRoute(args, extensions)) ?? { surface: 'framework', args };
}
