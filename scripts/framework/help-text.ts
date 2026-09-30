import { prototypeCommands } from './prototype-catalog.ts';
/**
 * Explanatory help metadata for the command catalog: groups, the golden path, examples and
 * option documentation. Data only; execution policy stays in catalog.ts and the handlers.
 */
import { commands, profiles, type Command } from './catalog.ts';
/**
 * Explanatory option metadata shared by terminal help and the generated manual.
 * @remarks
 * Accepted kinds belong to the runtime catalog. A description is not an execution policy.
 */
export interface OptionHelp { description: string; values?: readonly string[]; default?: string }
/**
 * User-facing command reference, separate from the executable request contract.
 * @remarks
 * Examples illustrate a workflow; documentation generation never executes them.
 * The manual combines these facts with authored Markdown and source docblocks.
 */
export interface CommandHelp { group: string; usage: string; examples: string[]; optionHelp: Record<string, OptionHelp> }
/** The short first screen of `help`: the daily loop in the order a new plugin author meets it. */
export const goldenPath: ReadonlyArray<{ command: string; example: string; purpose: string }> = [
  { command: 'new', example: 'node shell.mjs new ../folio-tools --starter blank', purpose: 'Create a plugin project from a starter (previews first).' },
  { command: 'install', example: 'node shell.mjs install --yes', purpose: 'Install the exact locked dependencies.' },
  { command: 'dev', example: 'node shell.mjs dev --profile obsidian', purpose: 'Real Obsidian sandbox: rebuild, hot reload, logs (--profile ui: browser harness).' },
  { command: 'test', example: 'node shell.mjs test', purpose: 'Run the unit or generated-project test suite.' },
  { command: 'check', example: 'node shell.mjs check', purpose: 'Fast gate: types, lint, tests (--fast: changed files only).' },
  { command: 'make', example: 'node shell.mjs make list', purpose: 'Add features, entities, views and more through reviewed plans.' },
];
export const groups: ReadonlyArray<{ id: string; title: string; commands: readonly string[] }> = [
  { id: 'prototypes', title: 'Prototype versions and variants', commands: prototypeCommands.map(command => command.id) },
  { id: 'starters', title: 'External project starters', commands: ['starters list', 'starters show', 'starters validate', 'starters schema', 'starters add', 'starters edit', 'starters run', 'starters pack', 'starters coverage'] },
  { id: 'handout', title: 'Product-trio handout', commands: ['handout generate', 'handout refresh', 'handout validate', 'handout inspect'] },
  { id: 'start', title: 'Start a project', commands: ['new', 'setup', 'setup status', 'setup resume', 'project inspect', 'project import', 'project schema', 'project validate', 'project measure', 'generate', 'concept schema', 'concept inspect', 'concept import'] },
  { id: 'develop', title: 'Develop and check', commands: ['install', 'dev', 'build', 'clickdummy build', 'test', 'check', 'check submission', 'make', 'styles inspect', 'styles export'] },
  { id: 'documentation', title: 'Application documentation', commands: ['docs import', 'docs export', 'docs validate', 'docs status', 'docs schema', 'docs recover'] },
  { id: 'storybook', title: 'Optional Storybook', commands: ['storybook status', 'storybook install', 'storybook check', 'storybook dev', 'storybook build'] },
  { id: 'airship', title: 'Optional Airship', commands: ['airship status', 'airship enable', 'airship disable', 'airship install', 'airship start', 'airship doctor'] },
  { id: 'compiler', title: 'Project compiler', commands: ['compiler check', 'compiler inspect', 'compiler explain'] },
  { id: 'plans', title: 'Reviewed plans', commands: ['plan inspect', 'plan apply'] },
  { id: 'inspect', title: 'Inspect/configure', commands: ['status', 'doctor', 'support report', 'version', 'config get', 'config explain', 'config validate', 'config set'] },
  { id: 'vault', title: 'Test vault and data', commands: ['vault prepare', 'plugin install', 'data plan', 'data apply', 'data reset-plan', 'data reset'] },
  { id: 'discovery', title: 'Discovery (agents)', commands: ['help', 'capabilities', 'schema'] },
  { id: 'maintain', title: 'Maintainers', commands: ['verify', 'framework status', 'framework pack', 'framework upgrade', 'release prepare', 'release check', 'release rehearse', 'release operate'] },
];
const common: Record<string, OptionHelp> = {
  json: { description: 'Print exactly one versioned JSON result on stdout.' },
  'dry-run': { description: 'Preview the operation without applying it or launching its process; explicit --plan-out still writes the requested plan file.' },
  yes: { description: 'Apply the freshly rebuilt plan (or run the process) without prompting.' },
  apply: { description: 'Apply only if the rebuilt plan still has this reviewed SHA-256 hash.' },
  'plan-out': { description: 'Save a replayable request plan (for plan inspect/apply).' },
  root: { description: 'Project folder to operate on.', default: 'nearest folder with shell.config.json or shell.mjs' },
  timeout: { description: 'Child-process timeout in milliseconds (1..3600000).', default: '600000' },
  'no-interaction': { description: 'Never prompt, even on a TTY.' },
  help: { description: 'Describe this command instead of running it.' },
};
const specific: Record<string, OptionHelp> = {
  'require-model-coverage': { description: 'Fail unless every shipped visual primitive, action, control kind, state and layout is represented by the selected Companion starter model.' },
  resolutions: { description: 'JSON mapping of exact entity#/field conflict keys to markdown or project. Stale or unused resolutions are rejected.' },
  values: { description: 'Project-relative JSON file containing declared starter input values.' },
  answers: { description: 'Inline JSON input values; cannot be combined with --values.' },
  run: { description: 'Comma-separated declared processes to run after creation, with fresh --trust-processes.' },
  'trust-processes': { description: 'Explicitly trust the reviewed project code and declared process steps; never portable approval.' },
  process: { description: 'One or more comma-separated process IDs from the generated starter receipt.' },
  project: { description: 'Generated project directory containing .workbench/starter.json.' },
  variant: { description: 'Saved variant slug inside the selected prototype version.' },
  'with-prototype': { description: 'Prototype slug of the comparison reference snapshot.' },
  'with-version': { description: 'Version slug of the comparison reference snapshot.' },
  'with-variant': { description: 'Variant slug of the comparison reference snapshot.' },
  label: { description: 'Human-readable label for a prototype version.' },
  'from-prototype': { description: 'Prototype slug of the saved snapshot to restore.' },
  'from-version': { description: 'Version slug of the saved snapshot to restore.' },
  'from-variant': { description: 'Variant slug of the saved snapshot to restore.' },
  'recovery-version': { description: 'New version slug used to preserve the current destination before restoring another snapshot.' },
  as: { description: 'Portable lowercase slug for the new variant.' },
  hypothesis: { description: 'The solution idea or test hypothesis explored by this variant.' },
  status: { description: 'Variant lifecycle status; use prototypes activate for generator selection.', values: ['draft', 'review', 'approved', 'archived'] },
  prds: { description: 'Project-relative PRD folder override; fingerprinted and retained by handout refresh/validation.', default: 'configs/user-settings.json paths.prds, otherwise docs/prds' },
  samples: { description: 'Measured samples per operation, after one cold sample and three retained warmups (3..30).', default: '10' },
  storybook: { description: 'Enable or disable optional Storybook workspace emission. Does not install packages or imply story generation.', values: ['on', 'off'], default: 'project JSON, otherwise off' },
  'storybook-stories': { description: 'Enable or disable CSF story emission. Independent of Storybook installation.', values: ['on', 'off'], default: 'project JSON, otherwise off' },
  airship: { description: 'Opt into Airship tooling in a generated project; no automatic installation or launch.' },
  'no-airship': { description: 'Explicitly disable Airship in an imported or new project.' },
  agent: { description: 'Airship agent backend.', values: ['claude', 'codex', 'opencode'], default: 'claude' },
  'target-port': { description: 'Local source preview TCP port (1024..65535).', default: '5173' },
  port: { description: 'Distinct local Airship proxy TCP port (1024..65535).', default: '5174' },
  stage: { description: 'Compiler inspection stage.', values: ['ir', 'artifacts'], default: 'ir' },
  scope: { description: 'Generation selection: all, feature:<id>, page:<surface-or-design-id>, component:<library-or-design-id>. Shared registries remain complete; excluded artifacts must already exist unchanged in the generated definition.', default: 'all' },
  'output-kind': { description: 'Compiler output; --target remains a folder.', values: ['obsidian-plugin', 'clickdummy'], default: 'obsidian-plugin' },
  'report-dir': { description: 'Explicit new report directory beneath reports/compiler; omitted means no reports are written.' },
  debug: { description: 'Retain bounded compiler error/cause stacks; requires --report-dir and review before sharing.' },
  input: { description: 'Input JSON file (use - for stdin where supported).' },
  format: { description: 'Export format.', values: ['css', 'json', 'markdown', 'html'], default: 'css' },
  out: { description: 'Output file path.' },
  id: { description: 'Plugin ID: lowercase letters, digits and hyphens; must not contain "obsidian" or "plugin".' },
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
  starter: { description: 'Starter ID (see new --list). A project starter (generator project) runs without <dir> via new --starter <id> or new guide --starter <id>.' },
  list: { description: 'List the available entries instead of creating one.' },
  install: { description: 'After writing, run npm ci and project verification in the new folder.' },
  recover: { description: 'After inspecting an interrupted attempt, explicitly acknowledge uncertain previous effects. No automatic retry.' },
  'resume-hash': { description: 'Exact current input/progress digest returned by setup status or setup resume preview.' },
  'inside-vault': { description: 'Allow a target inside a folder that contains .obsidian/ (an Obsidian vault). Refused by default so a personal vault is never used as a project folder.' },
  vault: { description: 'Existing folder that contains the generation target (compatibility mode).' },
  target: { description: 'Target folder relative to --vault (compatibility mode).' },
  extension: { description: 'Custom file suffix without a dot (lowercase, 1–16 letters/digits). Core Obsidian extensions are refused.' },
  extensions: { description: 'Comma-separated lowercase, dotless file-menu filters, for example md,txt.' },
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
  replace: { description: 'Replace the previous local clickdummy only after successful build and static offline validation.' },
  fast: { description: 'Typecheck plus tests related to changed files (git); for agent Stop hooks.' },
};
const profileDefaults: Record<string, string> = { test: 'unit (project when vitest.project.config.mjs exists)', verify: 'full', dev: 'watch' };
const usage: Record<string, string> = {
  'prototypes compare': 'node shell.mjs prototypes compare <prototype> --version <version> --variant <variant> --with-prototype <prototype> --with-version <version> --with-variant <variant> [options]',
  'prototypes prototype-details': 'node shell.mjs prototypes prototype-details <prototype> [--name <name>] [--description <text>] [options]',
  'prototypes version-details': 'node shell.mjs prototypes version-details <prototype> --version <version> --label <label> [options]',
  'prototypes restore-snapshot': 'node shell.mjs prototypes restore-snapshot <prototype> --version <version> --variant <variant> --from-prototype <prototype> --from-version <version> --from-variant <variant> --recovery-version <version> [options]',
  'docs import': 'node shell.mjs docs import [file-or-folder ...] [options]',
  'docs export': 'node shell.mjs docs export [--out <documentation-root>] [options]',
  'docs validate': 'node shell.mjs docs validate [file-or-folder ...] [--json]',
  new: 'node shell.mjs new <dir> (--starter <id> | --from <project.json>) [options]', help: 'node shell.mjs help [command] [--all]',
  'plan inspect': 'node shell.mjs plan inspect <plan-file>', 'plan apply': 'node shell.mjs plan apply <plan-file> --yes',
  make: 'node shell.mjs make <recipe> <name> [options] | make list | make describe <recipe>',
};
const examples: Record<string, string[]> = {
  'starters coverage': ['node shell.mjs starters coverage feature-showcase --json', 'node shell.mjs starters coverage feature-showcase --require-model-coverage --json'],
  'starters list': ['node shell.mjs starters list --json'],
  'starters show': ['node shell.mjs starters show webapp --json'],
  'starters validate': ['node shell.mjs starters validate --json'],
  'starters schema': ['node shell.mjs starters schema --json'],
  'starters add': ['node shell.mjs starters add --input my-starter.json --dry-run'],
  'starters edit': ['node shell.mjs starters edit webapp --input edited-webapp.json --plan-out starter-edit.plan.json'],
  'starters pack': ['node shell.mjs starters pack --out ./workbench-starters.zip --yes'],
  'starters run': ['node shell.mjs starters run --project ../my-app --process verify,build --dry-run', 'node shell.mjs starters run --project ../my-app --process build --yes --trust-processes --apply <planHash>'],
  'prototypes list': ['node shell.mjs prototypes list --json'],
  'prototypes compare': ['node shell.mjs prototypes compare exploration --version v1 --variant main --with-prototype exploration --with-version v1 --with-variant sitemap-b --json'],
  'prototypes prototype-details': ['node shell.mjs prototypes prototype-details exploration --name "Product exploration" --description "Compare navigation variants" --dry-run'],
  'prototypes version-details': ['node shell.mjs prototypes version-details exploration --version v1 --label "Iteration 1" --dry-run'],
  'prototypes restore-snapshot': ['node shell.mjs prototypes restore-snapshot exploration --version v1 --variant sitemap-b --from-prototype exploration --from-version v1 --from-variant main --recovery-version v2 --dry-run'],
  'prototypes create': ['node shell.mjs prototypes create exploration --input design/project.json --dry-run'],
  'prototypes version': ['node shell.mjs prototypes version exploration --version v2 --from v1 --dry-run'],
  'prototypes fork': ['node shell.mjs prototypes fork exploration --version v1 --variant main --as sitemap-b --dry-run'],
  'prototypes save': ['node shell.mjs prototypes save exploration --version v1 --variant sitemap-b --input design/project.json --dry-run'],
  'prototypes details': ['node shell.mjs prototypes details exploration --version v1 --variant sitemap-b --name "Sitemap B" --hypothesis "Alternative navigation" --dry-run'],
  'prototypes status': ['node shell.mjs prototypes status exploration --version v1 --variant sitemap-b --status approved --dry-run'],
  'prototypes activate': ['node shell.mjs prototypes activate exploration --version v1 --variant sitemap-b --dry-run'],
  'prototypes deactivate': ['node shell.mjs prototypes deactivate --dry-run'],
  'prototypes seal': ['node shell.mjs prototypes seal exploration --version v1 --dry-run'],
  'prototypes archive': ['node shell.mjs prototypes archive exploration --dry-run'],
  'prototypes restore': ['node shell.mjs prototypes restore exploration --dry-run'],
  'prototypes import': ['node shell.mjs prototypes import --input prototype-workspace.json --dry-run'],
  'prototypes export': ['node shell.mjs prototypes export --out prototype-workspace.json --dry-run'],
  'prototypes adopt': ['node shell.mjs prototypes adopt --resolve import --dry-run'],
  'prototypes generate': ['node shell.mjs prototypes generate --target generated-preview --dry-run'],
  'docs import': ['node shell.mjs docs import docs/application --dry-run', 'node shell.mjs docs import docs/application --apply <reviewed-hash> --yes'],
  'docs export': ['node shell.mjs docs export --dry-run', 'node shell.mjs docs export --out docs/application --yes'],
  'docs validate': ['node shell.mjs docs validate docs/application --json'],
  'docs status': ['node shell.mjs docs status --json'],
  'docs schema': ['node shell.mjs docs schema --json'],
  'docs recover': ['node shell.mjs docs recover --dry-run', 'node shell.mjs docs recover --apply <recovery-hash> --yes'],
  'handout generate': ['node shell.mjs handout generate --dry-run --json', 'node shell.mjs handout generate --plan-out handout.plan.json --json'],
  'handout refresh': ['node shell.mjs handout refresh --plan-out handout-refresh.plan.json --json'],
  'handout validate': ['node shell.mjs handout validate --json'],
  'handout inspect': ['node shell.mjs handout inspect --json'],
  'airship status': ['node shell.mjs airship status --json'],
  'airship enable': ['node shell.mjs airship enable --agent codex --dry-run', 'node shell.mjs airship enable --yes'],
  'airship disable': ['node shell.mjs airship disable --dry-run', 'node shell.mjs airship disable --yes'],
  'airship install': ['node shell.mjs airship install --dry-run', 'node shell.mjs airship install --yes'],
  'airship start': ['node shell.mjs airship start --dry-run', 'node shell.mjs airship start --yes'],
  'airship doctor': ['node shell.mjs airship doctor --dry-run', 'node shell.mjs airship doctor --yes'],
  'support report': ['node shell.mjs support report --json'],
  'project measure': ['node shell.mjs project measure --input project.json --samples 10 --json'],
  'storybook status': ['node shell.mjs storybook status --json'],
  'storybook install': ['node shell.mjs storybook install --dry-run', 'node shell.mjs storybook install --yes'],
  'storybook check': ['node shell.mjs storybook check'],
  'storybook dev': ['node shell.mjs storybook dev'],
  'storybook build': ['node shell.mjs storybook build'],
  'compiler check': ['node shell.mjs compiler check --input project.json --json'],
  'compiler inspect': ['node shell.mjs compiler inspect --input project.json --stage artifacts --output-kind clickdummy --json'],
  'compiler explain': ['node shell.mjs compiler explain COMPILER_REFERENCE_MISSING'],
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
  'setup status': ['node shell.mjs setup status --json'],
  'setup resume': ['node shell.mjs setup resume --stage verify --dry-run --json', 'node shell.mjs setup resume --stage verify --resume-hash <digest> --yes'],
  setup: ['node shell.mjs setup --starter quick-capture --id capture --name Capture --author Me --dry-run', 'node shell.mjs setup --id folio-tools --name "Folio Tools" --author "Me" --blank --yes', 'node shell.mjs setup --input ./my-project.json --dry-run --json'],
  'concept schema': ['node shell.mjs concept schema --json'],
  'concept inspect': ['node shell.mjs concept inspect --json', 'node shell.mjs concept inspect --input docs/concepts/capture/concept.json'],
  'concept import': ['node shell.mjs concept import --input docs/concepts/capture/concept.json --plan-out concept.plan.json', 'node shell.mjs plan apply concept.plan.json --yes'],
  'project schema': ['node shell.mjs project schema --version 6 --json'],
  'project validate': ['node shell.mjs project validate --input project.json --json'],
  'project inspect': ['node shell.mjs project inspect --input project.json'],
  'project import': ['node shell.mjs project import --input project.json --resolve project --dry-run'],
  new: ['node shell.mjs new --list', 'node shell.mjs new ../folio-tools --starter custom-file-view --extension folio', 'node shell.mjs new ../quick-capture --starter quick-capture --yes', 'node shell.mjs new ../folio-tools --from folio-tools.companion.json', 'node shell.mjs new ../folio-tools --starter blank --storybook on --storybook-stories on'],
  generate: ['node shell.mjs generate --scope feature:workspace --plan-out generation.plan.json', 'node shell.mjs generate --yes'],
  make: ['node shell.mjs make list', 'node shell.mjs make file-extension board --feature documents --extension board', 'node shell.mjs make context-menu inspect --feature documents --extensions md,board', 'node shell.mjs make feature bookmarks --entity bookmark --dry-run'],
  'plan inspect': ['node shell.mjs plan inspect generation.plan.json'], 'plan apply': ['node shell.mjs plan apply generation.plan.json --yes'],
  install: ['node shell.mjs install --yes'], build: ['node shell.mjs build'],
  'clickdummy build': ['node shell.mjs clickdummy build', 'node shell.mjs clickdummy build --replace'],
  test: ['node shell.mjs test', 'node shell.mjs test --profile obsidian', 'node shell.mjs test --profile browser'],
  check: ['node shell.mjs check', 'node shell.mjs check --fast --json'],
  'check submission': ['node shell.mjs check submission', 'node shell.mjs check submission --json'],
  verify: ['node shell.mjs verify --profile project'], dev: ['node shell.mjs dev --profile obsidian', 'node shell.mjs dev', 'node shell.mjs dev --profile ui'],
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
  if (entry.effect === 'process') return ['dry-run', ...(['setup resume', 'starters run', 'docs recover'].includes(entry.id) ? ['apply'] : []), ...(['install', 'storybook install', 'airship install', 'airship start', 'airship doctor', 'framework pack', 'starters pack', 'starters run', 'setup resume', 'docs recover'].includes(entry.id) ? ['yes'] : []), 'timeout', ...shared];
  if (entry.effect === 'fixtures') return ['apply', ...shared];
  if (entry.effect === 'release' || entry.id === 'project measure') return ['dry-run', ...shared];
  return shared;
}
/** A fresh copy on every call: callers can never mutate shared help or execution policy. */
export function commandHelp(entry: Command): CommandHelp {
  const group = groups.find(item => item.commands.includes(entry.id))?.id ?? 'other';
  const optionHelp: Record<string, OptionHelp> = {};
  for (const name of Object.keys(entry.options)) {
    const doc = { ...(specific[name] ?? { description: '' }) };
    if (name === 'profile' && profiles[entry.id]) { doc.values = profiles[entry.id]; doc.default = profileDefaults[entry.id]; }
    if (entry.id === 'setup resume' && name === 'stage') { doc.description = 'Run only this explicitly approved setup stage.'; doc.values = ['generate', 'install', 'verify', 'preview']; delete doc.default; }
    if (entry.id === 'project schema' && name === 'version') { doc.description = 'Published project schema version. Legacy documents use project validate.'; doc.values = ['6']; doc.default = '6'; }
    if (entry.id === 'release prepare' && name === 'version') doc.description = 'Release version x.y.z.';
    if (entry.id === 'make' && name === 'format') { doc.description = 'Custom file content format (file-extension recipe).'; doc.values = ['json', 'text']; doc.default = 'json'; }
    if (entry.id === 'docs export' && name === 'out') { doc.description = 'Documentation root for new files and navigation; registered files keep their locations.'; doc.default = 'configured documentation.root, otherwise docs/application'; }
    if (entry.id.startsWith('prototypes ') && name === 'version') doc.description = 'Portable version slug, for example v1 or v2; distinct from the application release version.';
    if (entry.id === 'prototypes version' && name === 'from') doc.description = 'Source version slug to copy into the new version.';
    if (entry.id.startsWith('prototypes ') && name === 'name') doc.description = 'Prototype or variant display name; its folder slug stays unchanged.';
    if (entry.id === 'prototypes prototype-details' && name === 'description') doc.description = 'Prototype description; changing it does not change folder slugs or saved designs.';
    if (entry.id === 'new' && name === 'from') doc.description = 'Project JSON exported by the companion (instead of --starter).';
    optionHelp[name] = { ...doc, ...(doc.values ? { values: [...doc.values] } : {}) };
  }
  for (const name of commonFor(entry)) optionHelp[name] = { ...common[name]!, ...(name === 'timeout' && ['dev', 'storybook dev'].includes(entry.id) ? { default: '3600000' } : {}), ...(name === 'timeout' && entry.id === 'check' ? { default: '600000 per step' } : {}) };
  if (entry.id === 'starters run') optionHelp.apply!.description = 'Plan hash from the reviewed preview. Without it, --yes --trust-processes plans and runs in one step and cannot detect changes made since an earlier review.';
  const argument = entry.maxArgs ? ' [arguments]' : '';
  return { group, usage: usage[entry.id] ?? `node shell.mjs ${entry.id}${argument}${Object.keys(entry.options).length ? ' [options]' : ''}`, examples: [...(examples[entry.id] ?? [])], optionHelp };
}
export function helpIndex() {
  return { goldenPath: goldenPath.map(item => ({ ...item })), groups: groups.map(item => ({ ...item, commands: [...item.commands] })), commandCount: commands.length };
}
