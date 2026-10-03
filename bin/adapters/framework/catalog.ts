import { adoptCommands } from './adopt-catalog.ts';
import { prototypeCommands } from './prototype-catalog.ts';
import { requireThat, OperationError, type Request, type Values } from './contracts.ts';
import { assertJsonData } from '../../../scripts/contracts/json-data.ts';
import { suggestions, didYouMean } from './suggest.ts';
export interface Command {
  id: string; summary: string; options: Record<string, 'value' | 'flag'>;
  maxArgs: number; effect: 'read' | 'plan' | 'process' | 'release' | 'fixtures';
}
const values = (...names: string[]): Record<string, 'value'> => Object.fromEntries(names.map(name => [name, 'value']));
const common = { ...values('root', 'apply', 'plan-out', 'timeout'), json: 'flag', 'no-interaction': 'flag', yes: 'flag', 'dry-run': 'flag', help: 'flag' } as const;
export const commands: readonly Command[] = [
  { id: 'templates list', summary: 'List and filter the canonical component-template library.', options: values('type', 'atomic-level', 'category', 'tag', 'for'), maxArgs: 0, effect: 'read' },
  { id: 'templates search', summary: 'Search component templates by identity, purpose or capability.', options: values('type', 'atomic-level', 'category', 'tag', 'for'), maxArgs: 1, effect: 'read' },
  { id: 'templates show', summary: 'Inspect one complete component-template JSON definition.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'templates tree', summary: 'Inspect the resolved Atomic Design child composition of one template.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'templates validate', summary: 'Validate one template or the complete installed component-template catalog.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'templates schema', summary: 'Print the versioned component-template JSON Schema.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'templates coverage', summary: 'Inspect Atomic Design, category, documentation and composition coverage.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'templates docs', summary: 'Plan deterministic Markdown documentation generated from component-template JSON.', options: values('out'), maxArgs: 0, effect: 'plan' },
  { id: 'templates instantiate', summary: 'Plan adding a component or page template to the canonical Companion project model.', options: values('project', 'name'), maxArgs: 1, effect: 'plan' },
  { id: 'starters coverage', summary: 'Inspect source-derived visual model coverage and explicit interaction gaps; never a native acceptance claim.', options: { 'require-model-coverage': 'flag' }, maxArgs: 1, effect: 'read' },
  { id: 'starters list', summary: 'Discover project-local JSON starters; no bundled fallback.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'starters show', summary: 'Inspect one complete editable starter definition and its processes.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'starters validate', summary: 'Validate one or all installed definitions without writes or execution.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'starters schema', summary: 'Print the versioned starter-definition JSON Schema.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'starters add', summary: 'Plan adding one JSON definition; never executes processes.', options: values('input'), maxArgs: 0, effect: 'plan' },
  { id: 'starters edit', summary: 'Plan replacing one definition from validated JSON.', options: values('input'), maxArgs: 1, effect: 'plan' },
  { id: 'starters pack', summary: 'Create the standalone starter-definition ZIP, separate from the shell.', options: values('out'), maxArgs: 0, effect: 'process' },
  { id: 'starters run', summary: 'Review/explicitly execute processes from a generated project receipt.', options: { ...values('project', 'process'), 'trust-processes': 'flag' }, maxArgs: 0, effect: 'process' },
  { id: 'ui gallery', summary: 'Capture a screenshot gallery (surface x state x scenario x theme x width) with index.json and gallery.html for human review; never acceptance or a baseline.', options: values('target', 'out', 'input'), maxArgs: 0, effect: 'process' },
  { id: 'ui status', summary: 'Report UI implementation progress per surface, interaction and journey from generated files; static analysis only, never an acceptance claim.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'docs import', summary: 'Review typed Markdown files/folders into actual project elements without deleting absent data.', options: values('resolutions'), maxArgs: 32, effect: 'plan' },
  { id: 'docs export', summary: 'Generate complete, lossless application Markdown documentation with conflict protection.', options: values('out'), maxArgs: 0, effect: 'plan' },
  { id: 'docs validate', summary: 'Validate typed documentation and native model references without writing.', options: {}, maxArgs: 32, effect: 'read' },
  { id: 'docs status', summary: 'Inspect documentation drift, missing bindings and export coverage without writing.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'docs schema', summary: 'Discover typed Markdown fields and ownership rules without reading a project.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'docs recover', summary: 'Review or explicitly roll back an interrupted documentation operation; never overwrite intervening edits.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'obsidian status', summary: 'Verify the official Obsidian CLI (1.12.7+) and inspect one explicitly selected vault.', options: values('obsidian-vault'), maxArgs: 0, effect: 'read' },
  { id: 'obsidian files', summary: 'List Markdown files in one explicitly selected vault; never falls back to the active vault.', options: values('obsidian-vault', 'obsidian-folder'), maxArgs: 0, effect: 'read' },
  { id: 'obsidian read', summary: 'Read one non-hidden Markdown file from the explicitly selected vault.', options: values('obsidian-vault', 'obsidian-path'), maxArgs: 0, effect: 'read' },
  { id: 'obsidian prepare', summary: 'Scan configured documentation paths through the official CLI and propose existing reviewed docs-import commands.', options: values('obsidian-vault'), maxArgs: 0, effect: 'read' },
  ...prototypeCommands,
  ...adoptCommands,
  { id: 'handout generate', summary: 'Review create-only generation of the root product-trio handout; never overwrites answers or runs processes.', options: values('prds'), maxArgs: 0, effect: 'plan' },
  { id: 'handout refresh', summary: 'Review source-fingerprint refresh while preserving answers and notes and resetting review checkboxes.', options: values('prds'), maxArgs: 0, effect: 'plan' },
  { id: 'handout validate', summary: 'Validate required handout decisions and source freshness without writes or execution authorization.', options: values('prds'), maxArgs: 0, effect: 'read' },
  { id: 'handout inspect', summary: 'Read structured handout answers, diagnostics and non-authorizing readiness.', options: values('prds'), maxArgs: 0, effect: 'read' },
  { id: 'support report', summary: 'Collect an opt-in, allowlisted local support report without identities, paths, content or network calls.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'project measure', summary: 'Measure bounded model import/export, projection and arrangement locally; no UI or native qualification.', options: values('input', 'samples'), maxArgs: 0, effect: 'read' },
  { id: 'project schema', summary: 'Discover the versioned project-v6 transport schema and semantic validation boundary.', options: values('version'), maxArgs: 0, effect: 'read' },
  { id: 'project validate', summary: 'Validate/migrate complete project JSON without generation or writes; no authored content in reports.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'airship status', summary: 'Read optional Airship configuration and local install state.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'airship enable', summary: 'Review enabling local safe Airship tooling; never installs or launches.', options: values('agent', 'target-port', 'port'), maxArgs: 0, effect: 'plan' },
  { id: 'airship disable', summary: 'Review disabling future Airship launches; preserve installed tooling and edits.', options: {}, maxArgs: 0, effect: 'plan' },
  { id: 'airship install', summary: 'Explicitly install the pinned CLI in an isolated project-local prefix (--yes).', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'airship start', summary: 'Explicitly start the local safe editor against the source preview (--yes).', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'airship doctor', summary: 'Run third-party Airship diagnostics only with --yes.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'compiler check', summary: 'Analyze project JSON without generation or writes; --report-dir explicitly retains diagnostics.', options: { ...values('storybook', 'storybook-stories', 'input', 'output-kind', 'report-dir'), debug: 'flag' }, maxArgs: 0, effect: 'read' },
  { id: 'compiler inspect', summary: 'Inspect normalized IR or an in-memory artifact inventory; never applies a workspace plan.', options: { ...values('storybook', 'storybook-stories', 'input', 'output-kind', 'stage', 'report-dir'), debug: 'flag' }, maxArgs: 0, effect: 'read' },
  { id: 'compiler explain', summary: 'Explain a stable compiler diagnostic code.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'version', summary: 'Report the pinned framework and current Node versions.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'styles inspect', summary: 'Validate saved design tokens and inspect scoped Nuxt UI bindings.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'styles export', summary: 'Plan deterministic CSS, JSON, Markdown or HTML exports.', options: values('input', 'format', 'out'), maxArgs: 0, effect: 'plan' },
  { id: 'help', summary: 'Discover commands without reading project code; --all lists every command.', options: { all: 'flag' }, maxArgs: 2, effect: 'read' },
  { id: 'capabilities', summary: 'Versioned command and maker contracts; no custom-code discovery.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'mcp', summary: 'Start the project-local stdio MCP bridge; setup must opt in and client trust/approval stays external.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'schema', summary: 'Machine-readable operation request/result contracts.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'status', summary: 'Project identity, configuration and readiness observations.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'doctor', summary: 'Read-only toolchain/configuration diagnostics.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config get', summary: 'Read the effective configuration.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config explain', summary: 'Explain persisted configuration and identity authority.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config validate', summary: 'Validate configuration without changes.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'config set', summary: 'Plan a validated configuration update from JSON.', options: values('input'), maxArgs: 0, effect: 'plan' },
  { id: 'setup status', summary: 'Inspect resumable setup progress against actual current input bytes; no processes or writes.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'setup resume', summary: 'Explicitly run one setup stage with fresh input checks and retained interruption/failure history.', options: { ...values('stage', 'resume-hash'), recover: 'flag' }, maxArgs: 0, effect: 'process' },
  { id: 'setup', summary: 'Configure this folder from a verified starter, blank project or JSON; no implicit install.', options: { ...values('id', 'name', 'author', 'version', 'description', 'source', 'tests', 'test-vault', 'config-dir', 'input', 'resolve', 'starter', 'extension', 'extensions'), blank: 'flag', airship: 'flag', 'no-airship': 'flag', mcp: 'flag', 'no-mcp': 'flag' }, maxArgs: 0, effect: 'plan' },
  { id: 'concept schema', summary: 'Discover the data-only concept manifest contract.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'concept inspect', summary: 'Inspect a docs/concepts JSON/HTML input, or return the current project base hash.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'concept import', summary: 'Plan reviewed project, new-feature or base-bound improvement intake. Never executes HTML/source.', options: values('input', 'resolve'), maxArgs: 0, effect: 'plan' },
  { id: 'project inspect', summary: 'Validate a companion export and report compiler obligations.', options: values('input'), maxArgs: 0, effect: 'read' },
  { id: 'project import', summary: 'Review configuration conflicts and accept a design snapshot.', options: values('input', 'resolve'), maxArgs: 0, effect: 'plan' },
  { id: 'new', summary: 'Create a new project in <dir> from a reviewed file or Companion starter, or an exported companion project (--from); previews unless --yes. Project starters run without <dir>: new --starter <id>.', options: { ...values('storybook', 'storybook-stories', 'starter', 'from', 'id', 'name', 'author', 'extension', 'extensions', 'values', 'answers', 'run'), 'trust-processes': 'flag', list: 'flag', install: 'flag', 'inside-vault': 'flag', 'no-git': 'flag', airship: 'flag', 'no-airship': 'flag' }, maxArgs: 1, effect: 'plan' },
  { id: 'generate', summary: 'Plan generation for the configured project in place.', options: values('storybook', 'storybook-stories', 'input', 'output-kind', 'scope'), maxArgs: 0, effect: 'plan' },
  { id: 'make', summary: 'Use the shared maker registry and file planner.', options: { ...values('feature', 'entity', 'folder', 'preset', 'backend', 'event', 'view', 'preference', 'extension', 'format', 'extensions'), document: 'flag', list: 'flag', 'trust-custom': 'flag', check: 'flag' }, maxArgs: 2, effect: 'plan' },
  { id: 'plan inspect', summary: 'Rebuild and compare a saved request plan; never execute it.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'plan apply', summary: 'Rebuild a saved request and apply only its matching reviewed plan.', options: {}, maxArgs: 1, effect: 'plan' },
  { id: 'install', summary: 'Explicit exact-lock npm ci; reviewed lifecycle hooks may run.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'storybook status', summary: 'Inspect the independent story-generation and optional Storybook switches; never installs.', options: {}, maxArgs: 0, effect: 'read' },
  { id: 'storybook install', summary: 'Explicitly install the enabled optional Storybook workspace; first resolution then exact-lock npm ci.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'storybook check', summary: 'Type-check the installed optional Storybook workspace; not a default project gate.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'storybook dev', summary: 'Run the enabled optional Storybook locally; no auto-open, telemetry or cloud publication.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'storybook build', summary: 'Build the enabled optional Storybook to local static files; never publishes.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'clickdummy build', summary: 'Build the generated Vue project as offline HTML with synthetic read data. No native/business writes.', options: { replace: 'flag' }, maxArgs: 0, effect: 'process' },
  { id: 'build', summary: 'Run the existing production bundler.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'test', summary: 'Run unit/project, browser, native qualification or real-Obsidian tests.', options: values('profile'), maxArgs: 0, effect: 'process' },
  { id: 'check', summary: 'Fast daily/agent gate: typecheck, lint and tests; runs every step and summarizes failures. --fast narrows it to a diff (--base <ref>); --plan lists the gates a diff requires. Not verify.', options: { fast: 'flag', plan: 'flag', ...values('base') }, maxArgs: 0, effect: 'process' },
  { id: 'ci', summary: 'Reproduce GitHub Actions jobs locally: list workflows/jobs, print a job\'s exact shell commands (dry run) or run its run: steps with --execute.', options: { ...values('job', 'matrix'), list: 'flag', execute: 'flag' }, maxArgs: 0, effect: 'process' },
  { id: 'check submission', summary: 'Local mirror of documented Obsidian community review rules; runs the project ESLint configuration (trusted project code) and writes nothing.', options: {}, maxArgs: 0, effect: 'process' },
  { id: 'verify', summary: 'Run existing full verification; project scope is explicitly separate.', options: values('profile'), maxArgs: 0, effect: 'process' },
  { id: 'dev', summary: 'Run development watch, UI harness or the real-Obsidian sandbox; cancel with Ctrl-C.', options: values('profile'), maxArgs: 0, effect: 'process' },
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
  test: Object.freeze(['unit', 'project', 'browser', 'native', 'obsidian']), verify: Object.freeze(['full', 'project']), dev: Object.freeze(['watch', 'ui', 'preview', 'obsidian']),
});
export function parameterKinds(entry: Command): Record<string, 'value' | 'flag'> {
  return { ...common, ...entry.options };
}
export function descriptor(id: string): Command {
  const command = commands.find(item => item.id === id);
  if (command) return command;
  const found = suggestions(id, commands.map(item => item.id));
  const error = new OperationError('UNKNOWN_COMMAND', `Unknown command: ${id}.${didYouMean(found, value => `"${value}"`)} Use help.`, found.length === 1 ? `node bin/app help ${found[0]}` : 'node bin/app help');
  error.details = { suggestions: found }; throw error;
}
const aliases = new Map([['-h', '--help'], ['-V', '--version']]);
const safeArgument = (arg: string) => arg.length <= 4096 && !arg.includes('\0');
/** Splits argv into positional words and options known to any command; values follow their option. */
function scanArguments(argv: string[]): { positional: string[]; options: Values } {
  const positional: string[] = [], options: Values = {};
  const available: Record<string, 'value' | 'flag'> = { ...common };
  for (const item of commands) Object.assign(available, item.options);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (!Object.hasOwn(available, key)) throw unknownOption(arg, Object.keys(available));
    requireThat(!Object.hasOwn(options, key), 'INVALID_OPTION', `Repeated option: ${arg}.`);
    if (available[key] === 'flag') { options[key] = true; continue; }
    const value = argv[++i]; requireThat(value !== undefined && !value.startsWith('--'), 'MISSING_VALUE', `Supply a value for ${arg}.`); options[key] = value;
  }
  return { positional, options };
}
/** The longest command id whose words prefix the positional arguments; otherwise the first two words, or help. */
function commandName(positional: string[]): string {
  const known = commands.map(item => item.id).sort((a, b) => b.length - a.length).find(id => id.split(' ').every((word, i) => positional[i] === word));
  return known ?? (positional.length ? positional.slice(0, 2).join(' ') : 'help');
}
export function parseCliArguments(argv: string[]): Request {
  argv = argv.map(arg => aliases.get(arg) ?? arg);
  if (argv[0] === '--version') argv = ['version', ...argv.slice(1)];
  requireThat(argv.length <= 100 && argv.every(safeArgument), 'ARGUMENT_LIMIT', 'Too many or oversized arguments.');
  const { positional, options } = scanArguments(argv);
  const name = commandName(positional);
  const entry = descriptor(name), args = positional.slice(name === 'help' && positional.length === 0 ? 0 : name.split(' ').length);
  return validateFields(entry, args, options);
}
function validOptionValue(kind: 'value' | 'flag' | undefined, value: Values[string]): boolean {
  return kind === 'flag' ? value === true : typeof value === 'string' && safeArgument(value);
}
const validTimeout = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 3_600_000;
function validateFields(entry: Command, args: string[], options: Values): Request {
  requireThat(args.length <= entry.maxArgs && args.every(arg => safeArgument(arg) && !arg.startsWith('--')), 'INVALID_ARGUMENT', `Invalid arguments for ${entry.id}.`);
  const allowed = parameterKinds(entry);
  for (const [key, value] of Object.entries(options)) {
    if (!Object.hasOwn(allowed, key)) throw unknownOption(`--${key}`, Object.keys(allowed), entry.id);
    requireThat(validOptionValue(allowed[key], value), 'INVALID_OPTION', `Invalid value for --${key}.`);
  }
  if (options.apply !== undefined) requireThat(typeof options.apply === 'string' && /^[a-f0-9]{64}$/.test(options.apply), 'INVALID_PLAN_HASH', 'Supply a SHA-256 plan hash.');
  if (options.timeout !== undefined) requireThat(validTimeout(options.timeout), 'INVALID_TIMEOUT', 'Timeout must be 1..3600000 milliseconds.');
  return { command: entry.id, args: [...args], options: { ...options } };
}
function unknownOption(arg: string, available: string[], command?: string): OperationError {
  const found = suggestions(arg.replace(/^--/, ''), available).map(name => '--' + name);
  const error = new OperationError('INVALID_OPTION', `${command ? `${arg} is not supported by ${command}.` : `Unknown option: ${arg}.`}${didYouMean(found)}`, command ? `node bin/app help ${command}` : 'node bin/app help');
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
  const omitted = new Set(['root', 'json', 'no-interaction', 'yes', 'dry-run', 'apply', 'plan-out', 'help', 'install', 'trust-processes']);
  return { command: request.command, args: [...request.args], options: Object.fromEntries(Object.entries(request.options).filter(([key]) => !omitted.has(key)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
