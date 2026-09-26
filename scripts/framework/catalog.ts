import { requireThat, OperationError, type Request, type Values } from './contracts.ts';
import { assertJsonData } from '../contracts/json-data.mjs';
import { suggestions, didYouMean } from './suggest.ts';
export interface Command {
  id: string; summary: string; options: Record<string, 'value' | 'flag'>;
  maxArgs: number; effect: 'read' | 'plan' | 'process' | 'release' | 'fixtures';
}
const values = (...names: string[]): Record<string, 'value'> => Object.fromEntries(names.map(name => [name, 'value']));
const common = { ...values('root', 'apply', 'plan-out', 'timeout'), json: 'flag', 'no-interaction': 'flag', yes: 'flag', 'dry-run': 'flag', help: 'flag' } as const;
export const commands: readonly Command[] = [
  { id: 'version', summary: 'Report the pinned framework and current Node versions.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'styles inspect', summary: 'Validate saved design tokens and inspect scoped Nuxt UI bindings.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'styles export', summary: 'Plan deterministic CSS, JSON, Markdown or HTML exports.', options: values('input', 'format', 'out'), maxArgs: 0, effect: 'plan' },
  { id: 'help', summary: 'Discover commands without reading project code; --all lists every command.', options: { all: 'flag' }, maxArgs: 2, effect: 'read' },
  { id: 'capabilities', summary: 'Versioned command and maker contracts; no custom-code discovery.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'schema', summary: 'Machine-readable operation request/result contracts.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'status', summary: 'Project identity, configuration and readiness observations.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'doctor', summary: 'Read-only toolchain/configuration diagnostics.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config get', summary: 'Read the effective configuration.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config explain', summary: 'Explain persisted configuration and identity authority.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config validate', summary: 'Validate configuration without changes.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config set', summary: 'Plan a validated configuration update from JSON.', options: values('input'), maxArgs: 0, effect: 'plan' },
  { id: 'setup', summary: 'Configure this project; optional JSON intake. No implicit install.', options: { ...values('id', 'name', 'author', 'version', 'description', 'source', 'tests', 'test-vault', 'config-dir', 'input', 'resolve'), blank: 'flag' }, maxArgs: 0, effect: 'plan' },
  { id: 'project inspect', summary: 'Validate a companion export and report compiler obligations.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'project import', summary: 'Review configuration conflicts and accept a design snapshot.', options: values('input', 'resolve'), maxArgs: 0, effect: 'plan' },
  { id: 'new', summary: 'Create a new plugin project from a reviewed starter; previews unless --yes.', options: { ...values('starter', 'id', 'name', 'author'), list: 'flag', install: 'flag' }, maxArgs: 1, effect: 'plan' },
  { id: 'generate', summary: 'Plan the existing project compiler; --vault/--target retain compatibility.', options: values('input', 'vault', 'target'), maxArgs: 0, effect: 'plan' },
  { id: 'make', summary: 'Use the shared maker registry and file planner.', options: { ...values('feature', 'entity', 'folder', 'preset', 'backend', 'event', 'view', 'preference'), document: 'flag', list: 'flag', 'trust-custom': 'flag' }, maxArgs: 2, effect: 'plan' },
  { id: 'plan inspect', summary: 'Rebuild and compare a saved request plan; never execute it.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'plan apply', summary: 'Rebuild a saved request and apply only its matching reviewed plan.', options: {}, maxArgs: 1, effect: 'plan' },
  { id: 'install', summary: 'Explicit exact-lock npm ci; reviewed lifecycle hooks may run.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'build', summary: 'Run the existing production bundler.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'test', summary: 'Run unit/project, browser or native qualification.', options: values('profile'), maxArgs: 0, effect: 'process' },
  { id: 'check', summary: 'Fast daily/agent gate: typecheck, lint and tests; runs every step and summarizes failures. Not verify.', options: { fast: 'flag' }, maxArgs: 0, effect: 'process' },
  { id: 'check submission', summary: 'Read-only local mirror of documented Obsidian community review rules.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'verify', summary: 'Run existing full verification; project scope is explicitly separate.', options: values('profile'), maxArgs: 0, effect: 'process' },
  { id: 'dev', summary: 'Run development watch or UI harness; cancel with Ctrl-C.', options: values('profile'), maxArgs: 0, effect: 'process' },
  { id: 'vault prepare', summary: 'Plan a marker in the configured isolated test vault.', options: {}, maxArgs: 0, effect: 'plan' },
  { id: 'plugin install', summary: 'Install exact built assets into the approved test vault; never enable.', options: {}, maxArgs: 0, effect: 'plan' },
  { id: 'data plan', summary: 'Shared owned test-data plan; never touches production sources.', options: values('input'), maxArgs: 0, effect: 'fixtures' },
  { id: 'data apply', summary: 'Shared owned test-data apply; never touches production sources.', options: values('input'), maxArgs: 0, effect: 'fixtures' },
  { id: 'data reset-plan', summary: 'Shared owned test-data reset-plan; never touches production sources.', options: values('input'), maxArgs: 0, effect: 'fixtures' },
  { id: 'data reset', summary: 'Shared owned test-data reset; never touches production sources.', options: values('input'), maxArgs: 0, effect: 'fixtures' },
  { id: 'framework status', summary: 'Inspect the pinned kit and its integrity.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'framework pack', summary: 'Build a deterministic compiled developer-kit ZIP locally.', options: values('out'), maxArgs: 0, effect: 'process' },
  { id: 'framework upgrade', summary: 'Plan an explicit kit replacement; preserves consumer edits.', options: values('from'), maxArgs: 0, effect: 'plan' },
  { id: 'release prepare', summary: 'Plan source version and release-note changes.', options: values('version', 'notes-file'), maxArgs: 0, effect: 'plan' },
  { id: 'release check', summary: 'Inspect packaging and optionally validate a retained release plan.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'release rehearse', summary: 'Run existing fixed-candidate rehearsal; no public promotion.', options: values('commit', 'version'), maxArgs: 0, effect: 'process' },
  { id: 'release operate', summary: 'Use the existing guarded release executor and separate authorization.', options: { ...values('input', 'authorize'), execute: 'flag' }, maxArgs: 0, effect: 'release' },
];
for (const entry of commands) { Object.freeze(entry.options); Object.freeze(entry); }
Object.freeze(commands);
/** Accepted --profile values; help renders these same lists. */
export const profiles: Readonly<Record<string, readonly string[]>> = Object.freeze({
  test: Object.freeze(['unit', 'project', 'browser', 'native']), verify: Object.freeze(['full', 'project']), dev: Object.freeze(['watch', 'ui']),
});
export function parameterKinds(entry: Command): Record<string, 'value' | 'flag'> {
  return { ...common, ...entry.options };
}
export function descriptor(id: string): Command {
  const command = commands.find(item => item.id === id);
  if (command) return command;
  const found = suggestions(id, commands.map(item => item.id));
  const error = new OperationError('UNKNOWN_COMMAND', `Unknown command: ${id}.${didYouMean(found, value => `"${value}"`)} Use help.`, found.length === 1 ? `node shell.mjs help ${found[0]}` : 'node shell.mjs help');
  error.details = { suggestions: found }; throw error;
}
export function parseCliArguments(argv: string[]): Request {
  argv = argv.map(arg => arg === '-h' ? '--help' : arg === '-V' ? '--version' : arg);
  if (argv[0] === '--version') argv = ['version', ...argv.slice(1)];
  requireThat(argv.length <= 100 && argv.every(arg => arg.length <= 4096 && !arg.includes('\0')), 'ARGUMENT_LIMIT', 'Too many or oversized arguments.');
  const positional: string[] = [], options: Values = {};
  const available: Record<string, 'value' | 'flag'> = { ...common };
  for (const item of commands) Object.assign(available, item.options);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (!Object.hasOwn(available, key)) throw unknownOption(arg, Object.keys(available));
    requireThat(!Object.hasOwn(options, key), 'INVALID_OPTION', `Repeated option: ${arg}.`);
    if (available[key] === 'flag') options[key] = true;
    else { const value = argv[++i]; requireThat(value !== undefined && !value.startsWith('--'), 'MISSING_VALUE', `Supply a value for ${arg}.`); options[key] = value; }
  }
  const name = commands.map(item => item.id).sort((a, b) => b.length - a.length)
    .find(id => id.split(' ').every((word, i) => positional[i] === word)) ?? (positional.length ? positional.slice(0, 2).join(' ') : 'help');
  const entry = descriptor(name), args = positional.slice(name === 'help' && positional.length === 0 ? 0 : name.split(' ').length);
  return validateFields(entry, args, options);
}
function validateFields(entry: Command, args: string[], options: Values): Request {
  requireThat(args.length <= entry.maxArgs && args.every(arg => arg.length <= 4096 && !arg.includes('\0') && !arg.startsWith('--')), 'INVALID_ARGUMENT', `Invalid arguments for ${entry.id}.`);
  const allowed = parameterKinds(entry);
  for (const [key, value] of Object.entries(options)) {
    if (!Object.hasOwn(allowed, key)) throw unknownOption(`--${key}`, Object.keys(allowed), entry.id);
    requireThat(allowed[key] === 'flag' ? value === true : typeof value === 'string' && value.length <= 4096 && !value.includes('\0'), 'INVALID_OPTION', `Invalid value for --${key}.`);
  }
  if (options.apply !== undefined) requireThat(typeof options.apply === 'string' && /^[a-f0-9]{64}$/.test(options.apply), 'INVALID_PLAN_HASH', 'Supply a SHA-256 plan hash.');
  if (options.timeout !== undefined) requireThat(typeof options.timeout === 'string' && /^\d+$/.test(options.timeout) && Number(options.timeout) > 0 && Number(options.timeout) <= 3_600_000, 'INVALID_TIMEOUT', 'Timeout must be 1..3600000 milliseconds.');
  return { command: entry.id, args: [...args], options: { ...options } };
}
function unknownOption(arg: string, available: string[], command?: string): OperationError {
  const found = suggestions(arg.replace(/^--/, ''), available).map(name => '--' + name);
  const error = new OperationError('INVALID_OPTION', `${command ? `${arg} is not supported by ${command}.` : `Unknown option: ${arg}.`}${didYouMean(found)}`, command ? `node shell.mjs help ${command}` : 'node shell.mjs help');
  error.details = { suggestions: found }; return error;
}
export function validateRequest(value: unknown): Request {
  assertJsonData(value);
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_REQUEST', 'Expected an operation request.');
  const input = value as Record<string, unknown>;
  requireThat(Object.keys(input).every(key => ['command', 'args', 'options'].includes(key)) && typeof input.command === 'string' && Array.isArray(input.args), 'INVALID_REQUEST', 'Malformed operation request.');
  requireThat(input.args.every(arg => typeof arg === 'string'), 'INVALID_REQUEST', 'Arguments must be strings.');
  requireThat(input.options !== null && typeof input.options === 'object' && !Array.isArray(input.options), 'INVALID_REQUEST', 'Options must be an object.');
  // A structured request is not a shell argument string. Never reinterpret data
  // fields as another command or flags, especially --yes or --trust-custom.
  return validateFields(descriptor(input.command), input.args, input.options as Values);
}
export function canonicalRequest(request: Request): Request {
  // --install requests a later process step; it never becomes part of a file plan or saved approval.
  const omitted = new Set(['root', 'json', 'no-interaction', 'yes', 'dry-run', 'apply', 'plan-out', 'help', 'install']);
  return { command: request.command, args: [...request.args], options: Object.fromEntries(Object.entries(request.options).filter(([key]) => !omitted.has(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
