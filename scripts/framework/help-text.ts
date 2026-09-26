/**
 * Explanatory help metadata for the command catalog: groups, the golden path, examples and
 * option documentation. Data only; execution policy stays in catalog.ts and the handlers.
 */
import { commands, profiles, type Command } from './catalog.ts';
export interface OptionHelp { description: string; values?: readonly string[]; default?: string }
export interface CommandHelp { group: string; usage: string; examples: string[]; optionHelp: Record<string, OptionHelp> }
/** The short first screen of `help`: the daily loop in the order a new plugin author meets it. */
export const goldenPath: ReadonlyArray<{ command: string; example: string; purpose: string }> = [
  { command: 'new', example: 'node shell.mjs new ../my-plugin --starter blank', purpose: 'Create a plugin project from a starter (previews first).' },
  { command: 'install', example: 'node shell.mjs install --yes', purpose: 'Install the exact locked dependencies.' },
  { command: 'dev', example: 'node shell.mjs dev', purpose: 'Rebuild on change; --profile ui opens the browser harness.' },
  { command: 'test', example: 'node shell.mjs test', purpose: 'Run the unit or generated-project test suite.' },
  { command: 'check', example: 'node shell.mjs check', purpose: 'Fast gate: types, lint, tests (--fast: changed files only).' },
  { command: 'make', example: 'node shell.mjs make list', purpose: 'Add features, entities, views and more through reviewed plans.' },
];
export const groups: ReadonlyArray<{ id: string; title: string; commands: readonly string[] }> = [
  { id: 'start', title: 'Start a project', commands: ['new', 'setup', 'project inspect', 'project import', 'generate'] },
  { id: 'develop', title: 'Develop and check', commands: ['install', 'dev', 'build', 'test', 'check', 'check submission', 'make', 'styles inspect', 'styles export'] },
  { id: 'plans', title: 'Reviewed plans', commands: ['plan inspect', 'plan apply'] },
  { id: 'inspect', title: 'Inspect/configure', commands: ['status', 'doctor', 'version', 'config get', 'config explain', 'config validate', 'config set'] },
  { id: 'vault', title: 'Test vault and data', commands: ['vault prepare', 'plugin install', 'data plan', 'data apply', 'data reset-plan', 'data reset'] },
  { id: 'discovery', title: 'Discovery (agents)', commands: ['help', 'capabilities', 'schema'] },
  { id: 'maintain', title: 'Maintainers', commands: ['verify', 'framework status', 'framework pack', 'framework upgrade', 'release prepare', 'release check', 'release rehearse', 'release operate'] },
];
const common: Record<string, OptionHelp> = {
  json: { description: 'Print exactly one versioned JSON result on stdout.' },
  'dry-run': { description: 'Preview only; never write or launch the step.' },
  yes: { description: 'Apply the freshly rebuilt plan (or run the process) without prompting.' },
  apply: { description: 'Apply only if the rebuilt plan still has this reviewed SHA-256 hash.' },
  'plan-out': { description: 'Save a replayable request plan (for plan inspect/apply).' },
  root: { description: 'Project folder to operate on.', default: 'nearest folder with shell.config.json or shell.mjs' },
  timeout: { description: 'Child-process timeout in milliseconds (1..3600000).', default: '600000' },
  'no-interaction': { description: 'Never prompt, even on a TTY.' },
  help: { description: 'Describe this command instead of running it.' },
};
const specific: Record<string, OptionHelp> = {
  input: { description: 'Input JSON file (use - for stdin where supported).' },
  format: { description: 'Export format.', values: ['css', 'json', 'markdown', 'html'], default: 'css' },
  out: { description: 'Output file path.' },
  id: { description: 'Plugin ID: lowercase letters, digits and hyphens; must not contain "obsidian".' },
  name: { description: 'Plugin display name.' },
  author: { description: 'Author name.' },
  version: { description: 'Semantic version x.y.z.' },
  description: { description: 'Plugin description.' },
  source: { description: 'Source folder.', default: 'src' },
  tests: { description: 'Tests folder.', default: 'tests' },
  'test-vault': { description: 'Isolated test-vault folder.', default: '.test-vault' },
  'config-dir': { description: 'Host configuration directory name inside the test vault.', default: '.obsidian' },
  resolve: { description: 'Which side wins a configured/imported identity conflict.', values: ['project', 'import'] },
  blank: { description: 'Create an inert minimal design instead of importing one.' },
  starter: { description: 'Starter ID (see new --list).' },
  list: { description: 'List the available entries instead of creating one.' },
  install: { description: 'After writing, run npm ci and project verification in the new folder.' },
  vault: { description: 'Existing folder that contains the generation target (compatibility mode).' },
  target: { description: 'Target folder relative to --vault (compatibility mode).' },
  feature: { description: 'Existing feature that receives the generated piece.' },
  entity: { description: 'Entity name for feature/entity makers.' },
  folder: { description: 'Vault folder for note-backed entities.' },
  preset: { description: 'Entity field preset.', values: ['title', 'task', 'project'], default: 'title' },
  backend: { description: 'Entity storage backend.', values: ['domain', 'markdown', 'plugin-data'], default: 'domain for entity without --document, otherwise markdown' },
  event: { description: 'Event name for event/listener makers.' },
  view: { description: 'View name for view/component makers.' },
  preference: { description: 'Preference key for setting makers.' },
  document: { description: 'Note-backed entity (requires the markdown backend).' },
  'trust-custom': { description: 'Allow a reviewed custom maker to execute local code.' },
  profile: { description: 'Execution profile.' },
  from: { description: 'Extracted replacement kit folder.' },
  'notes-file': { description: 'Release-notes Markdown file.' },
  commit: { description: 'Fixed source commit to rehearse.' },
  authorize: { description: 'Separately reviewed candidate authorization digest.' },
  execute: { description: 'Request candidate writes (still requires --authorize).' },
  all: { description: 'List every command with its summary, grouped.' },
  fast: { description: 'Typecheck plus tests related to changed files (git); for agent Stop hooks.' },
};
const profileDefaults: Record<string, string> = { test: 'unit (project when vitest.project.config.mjs exists)', verify: 'full', dev: 'watch' };
const usage: Record<string, string> = {
  new: 'node shell.mjs new <dir> --starter <id> [options]', help: 'node shell.mjs help [command] [--all]',
  'plan inspect': 'node shell.mjs plan inspect <plan-file>', 'plan apply': 'node shell.mjs plan apply <plan-file> --yes',
  make: 'node shell.mjs make <recipe> <name> [options] | make list | make describe <recipe>',
};
const examples: Record<string, string[]> = {
  version: ['node shell.mjs --version --json'],
  'styles inspect': ['node shell.mjs styles inspect --input design/project.json'],
  'styles export': ['node shell.mjs styles export --input design/project.json --format css --dry-run', 'node shell.mjs styles export --input design/project.json --format html --yes'],
  help: ['node shell.mjs help check', 'node shell.mjs help --all'],
  capabilities: ['node shell.mjs capabilities --json'],
  schema: ['node shell.mjs schema --json'],
  status: ['node shell.mjs status', 'node shell.mjs status --json'],
  doctor: ['node shell.mjs doctor'],
  'config get': ['node shell.mjs config get --json'], 'config explain': ['node shell.mjs config explain'],
  'config validate': ['node shell.mjs config validate'], 'config set': ['node shell.mjs config set --input config.json --dry-run'],
  setup: ['node shell.mjs setup --id my-plugin --name "My Plugin" --author "Me" --blank --yes', 'node shell.mjs setup --input ./my-project.json --dry-run --json'],
  'project inspect': ['node shell.mjs project inspect --input project.json'],
  'project import': ['node shell.mjs project import --input project.json --resolve project --dry-run'],
  new: ['node shell.mjs new --list', 'node shell.mjs new ../quick-capture --starter quick-capture --yes'],
  generate: ['node shell.mjs generate --plan-out generation.plan.json', 'node shell.mjs generate --yes'],
  make: ['node shell.mjs make list', 'node shell.mjs make feature bookmarks --entity bookmark --dry-run'],
  'plan inspect': ['node shell.mjs plan inspect generation.plan.json'], 'plan apply': ['node shell.mjs plan apply generation.plan.json --yes'],
  install: ['node shell.mjs install --yes'], build: ['node shell.mjs build'],
  test: ['node shell.mjs test', 'node shell.mjs test --profile browser'],
  check: ['node shell.mjs check', 'node shell.mjs check --fast --json'],
  'check submission': ['node shell.mjs check submission', 'node shell.mjs check submission --json'],
  verify: ['node shell.mjs verify --profile project'], dev: ['node shell.mjs dev', 'node shell.mjs dev --profile ui'],
  'vault prepare': ['node shell.mjs vault prepare --yes'], 'plugin install': ['node shell.mjs plugin install --dry-run'],
  'data plan': ['node shell.mjs data plan --input test-data-manifest.json'], 'data apply': ['node shell.mjs data apply --input test-data-manifest.json --apply <approval-hash>'],
  'data reset-plan': ['node shell.mjs data reset-plan --input test-data-manifest.json'], 'data reset': ['node shell.mjs data reset --input test-data-manifest.json --apply <approval-hash>'],
  'framework status': ['node shell.mjs framework status'], 'framework pack': ['node shell.mjs framework pack --out ./plugin-framework.zip --yes'],
  'framework upgrade': ['node shell.mjs framework upgrade --from ../extracted-kit --dry-run'],
  'release prepare': ['node shell.mjs release prepare --version 1.0.0 --notes-file notes.md --dry-run'], 'release check': ['node shell.mjs release check'],
  'release rehearse': ['node shell.mjs release rehearse --commit <sha> --version 1.0.0'], 'release operate': ['node shell.mjs release operate --input release-operation.json --dry-run'],
};
function commonFor(entry: Command): string[] {
  const shared = ['json', 'root', 'no-interaction', 'help'];
  if (entry.effect === 'plan') return ['dry-run', 'yes', 'apply', 'plan-out', ...shared];
  if (entry.effect === 'process') return ['dry-run', ...(['install', 'framework pack'].includes(entry.id) ? ['yes'] : []), 'timeout', ...shared];
  if (entry.effect === 'fixtures') return ['apply', ...shared];
  if (entry.effect === 'release') return ['dry-run', ...shared];
  return shared;
}
/** A fresh copy on every call: callers can never mutate shared help or execution policy. */
export function commandHelp(entry: Command): CommandHelp {
  const group = groups.find(item => item.commands.includes(entry.id))?.id ?? 'other';
  const optionHelp: Record<string, OptionHelp> = {};
  for (const name of Object.keys(entry.options)) {
    const doc = { ...(specific[name] ?? { description: '' }) };
    if (name === 'profile' && profiles[entry.id]) { doc.values = profiles[entry.id]; doc.default = profileDefaults[entry.id]; }
    if (entry.id === 'release prepare' && name === 'version') doc.description = 'Release version x.y.z.';
    optionHelp[name] = { ...doc, ...(doc.values ? { values: [...doc.values] } : {}) };
  }
  for (const name of commonFor(entry)) optionHelp[name] = { ...common[name]!, ...(name === 'timeout' && entry.id === 'dev' ? { default: '3600000' } : {}), ...(name === 'timeout' && entry.id === 'check' ? { default: '600000 per step' } : {}) };
  const argument = entry.maxArgs ? ' [arguments]' : '';
  return { group, usage: usage[entry.id] ?? `node shell.mjs ${entry.id}${argument}${Object.keys(entry.options).length ? ' [options]' : ''}`, examples: [...(examples[entry.id] ?? [])], optionHelp };
}
export function helpIndex() {
  return { goldenPath: goldenPath.map(item => ({ ...item })), groups: groups.map(item => ({ ...item, commands: [...item.commands] })), commandCount: commands.length };
}
