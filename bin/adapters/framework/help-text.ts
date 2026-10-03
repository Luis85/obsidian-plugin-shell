import { defaultVaultConfigDirectory } from '../../domain/host-paths.ts';
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
  { command: 'new', example: 'node bin/app new ../folio-tools --starter blank', purpose: 'Create a plugin project from a starter (previews first).' },
  { command: 'install', example: 'node bin/app install --yes', purpose: 'Install the exact locked dependencies.' },
  { command: 'dev', example: 'node bin/app dev --profile obsidian', purpose: 'Real Obsidian sandbox: rebuild, hot reload, logs (--profile ui: browser harness).' },
  { command: 'test', example: 'node bin/app test', purpose: 'Run the unit or generated-project test suite.' },
  { command: 'check', example: 'node bin/app check', purpose: 'Fast gate: types, lint, tests (--fast: changed files only).' },
  { command: 'make', example: 'node bin/app make list', purpose: 'Add features, entities, views and more through reviewed plans.' },
];
export const groups: ReadonlyArray<{ id: string; title: string; commands: readonly string[] }> = [
  { id: 'templates', title: 'Component template library', commands: ['templates list', 'templates search', 'templates show', 'templates tree', 'templates validate', 'templates schema', 'templates coverage', 'templates docs', 'templates instantiate'] },
  { id: 'prototypes', title: 'Prototype versions and variants', commands: prototypeCommands.map(command => command.id) },
  { id: 'starters', title: 'External project starters', commands: ['starters list', 'starters show', 'starters validate', 'starters schema', 'starters add', 'starters edit', 'starters run', 'starters pack', 'starters coverage'] },
  { id: 'ui', title: 'Generated UI progress and evidence', commands: ['ui status', 'ui gallery'] },
  { id: 'handout', title: 'Product-trio handout', commands: ['handout generate', 'handout refresh', 'handout validate', 'handout inspect'] },
  { id: 'start', title: 'Start a project', commands: ['new', 'setup', 'setup status', 'setup resume', 'project inspect', 'project import', 'project schema', 'project validate', 'project measure', 'generate', 'concept schema', 'concept inspect', 'concept import'] },
  { id: 'adopt', title: 'Adopt an existing project', commands: ['adopt analyze', 'adopt plan', 'adopt skill'] },
  { id: 'develop', title: 'Develop and check', commands: ['install', 'dev', 'build', 'clickdummy build', 'test', 'check', 'check submission', 'ci', 'make', 'styles inspect', 'styles export'] },
  { id: 'documentation', title: 'Application documentation', commands: ['docs import', 'docs export', 'docs validate', 'docs status', 'docs schema', 'docs recover'] },
  { id: 'obsidian-cli', title: 'Optional Obsidian CLI', commands: ['obsidian status', 'obsidian files', 'obsidian read', 'obsidian prepare'] },
  { id: 'storybook', title: 'Optional Storybook', commands: ['storybook status', 'storybook install', 'storybook check', 'storybook dev', 'storybook build'] },
  { id: 'airship', title: 'Optional Airship', commands: ['airship status', 'airship enable', 'airship disable', 'airship install', 'airship start', 'airship doctor'] },
  { id: 'agent-mcp', title: 'Optional local agent MCP', commands: ['mcp'] },
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
  root: { description: 'Project folder to operate on.', default: 'nearest folder with shell.config.json or bin/app' },
  timeout: { description: 'Child-process timeout in milliseconds (1..3600000).', default: '600000' },
  'no-interaction': { description: 'Never prompt, even on a TTY.' },
  help: { description: 'Describe this command instead of running it.' },
};
const specific: Record<string, OptionHelp> = {
  type: { description: 'Component-template type filter.', values: ['component', 'component-with-children', 'page', 'page-with-bricks'] },
  'atomic-level': { description: 'Atomic Design level filter.', values: ['atom', 'molecule', 'organism', 'template', 'page'] },
  category: { description: 'Exact component-template category filter.' },
  tag: { description: 'Exact component-template tag filter.' },
  for: { description: 'Application archetype recommendation filter, for example editor or obsidian-plugin.' },
  'require-model-coverage': { description: 'Fail unless every shipped visual primitive, action, control kind, state and layout is represented by the selected Companion starter model.' },
  resolutions: { description: 'JSON mapping of exact entity#/field conflict keys to markdown or project. Stale or unused resolutions are rejected.' },
  'obsidian-vault': { description: 'Exact Obsidian vault name or ID. Required on every adapter call; the active vault is never used implicitly.' },
  'obsidian-folder': { description: 'Optional vault-relative folder for Markdown listing.' },
  'obsidian-path': { description: 'Vault-relative, non-hidden Markdown file path to read.' },
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
  mcp: { description: 'Enable the project-local Workbench MCP for Claude Code and Codex (setup-owned config; client trust and tool approval stay external).' },
  'no-mcp': { description: 'Remove unchanged setup-owned MCP configuration; edited files are preserved and refused. Without either flag setup preserves the current state.' },
  agent: { description: 'Airship agent backend.', values: ['claude', 'codex', 'opencode'], default: 'claude' },
  'target-port': { description: 'Local source preview TCP port (1024..65535).', default: '5173' },
  port: { description: 'Distinct local Airship proxy TCP port (1024..65535).', default: '5174' },
  stage: { description: 'Compiler inspection stage.', values: ['ir', 'artifacts'], default: 'ir' },
  scope: { description: 'Generation selection: all, feature:<id>, page:<surface-or-design-id>, component:<library-or-design-id>. Shared registries remain complete; excluded artifacts must already exist unchanged in the generated definition.', default: 'all' },
  'output-kind': { description: 'Compiler output kind.', values: ['obsidian-plugin', 'clickdummy'], default: 'obsidian-plugin' },
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
  'config-dir': { description: 'Host configuration directory name inside the test vault.', default: defaultVaultConfigDirectory },
  resolve: { description: 'Which side wins a configured/imported identity conflict.', values: ['project', 'import'] },
  blank: { description: 'Create an inert minimal design instead of importing one.' },
  starter: { description: 'Starter ID (see new --list). A project starter (generator project) runs without <dir> via new --starter <id> or new guide --starter <id>.' },
  list: { description: 'List the available entries instead of creating one.' },
  install: { description: 'After writing, run npm ci and project verification in the new folder.' },
  recover: { description: 'After inspecting an interrupted attempt, explicitly acknowledge uncertain previous effects. No automatic retry.' },
  'resume-hash': { description: 'Exact current input/progress digest returned by setup status or setup resume preview.' },
  'inside-vault': { description: `Allow a target inside a folder that contains ${defaultVaultConfigDirectory}/ (an Obsidian vault). Refused by default so a personal vault is never used as a project folder.` },
  'no-git': { description: 'Do not run git init and the initial commit in a new project folder (skipped automatically inside an existing git work tree or without git).' },
  target: { description: 'Output folder relative to the project root.' },
  report: { description: 'Adoption report JSON (workbench-adoption-report/v1) to render instead of analyzing the target again.' },
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
  check: { description: 'Read-only: compare the pending locale draft (make locale <name> --check) with the current base keys; plans and writes nothing.' },
  profile: { description: 'Execution profile.' },
  from: { description: 'Extracted replacement kit folder.' },
  'notes-file': { description: 'Release-notes Markdown file.' },
  commit: { description: 'Fixed source commit to rehearse.' },
  authorize: { description: 'Separately reviewed candidate authorization digest.' },
  execute: { description: 'Request candidate writes (still requires --authorize).' },
  all: { description: 'List every command with its summary, grouped.' },
  replace: { description: 'Replace the previous local clickdummy only after successful build and static offline validation.' },
  fast: { description: 'Typecheck plus tests related to changed files (git), with eslint/lint on those files and the node --test suites they select; for agent Stop hooks.' },
  base: { description: 'With --fast or --plan: diff merge-base(<ref>, HEAD) to the working tree, committed or not. Default origin/main when it exists, else HEAD.' },
  plan: { description: 'List, without running anything, the gates the diff requires: exact commands, why each applies, estimated duration, prerequisites and CI coverage; ends with npm run verify.' },
  job: { description: 'Job to reproduce, as <workflow-file-stem>/<job-id> (for example ci/baseline); see ci --list.' },
  matrix: { description: 'Matrix combination to reproduce as comma-separated key=value pairs (for example os=ubuntu-latest); required when an expression computes the matrix.' },
};
const profileDefaults: Record<string, string> = { test: 'unit (project when configs/testing/vitest.project.config.mjs exists)', verify: 'full', dev: 'watch' };
const usage: Record<string, string> = {
  'adopt analyze': 'node bin/app adopt analyze [--target <dir>] [--out <report.json>] [--replace] [--json]',
  'adopt plan': 'node bin/app adopt plan [--target <dir>] [--report <report.json>] [--out <plan.md>] [--replace] [--yes | --apply <sha256>] [--json]',
  'adopt skill': 'node bin/app adopt skill [--target <dir>] [--yes | --apply <sha256>] [--json]',
  'prototypes compare': 'node bin/app prototypes compare <prototype> --version <version> --variant <variant> --with-prototype <prototype> --with-version <version> --with-variant <variant> [options]',
  'prototypes prototype-details': 'node bin/app prototypes prototype-details <prototype> [--name <name>] [--description <text>] [options]',
  'prototypes version-details': 'node bin/app prototypes version-details <prototype> --version <version> --label <label> [options]',
  'prototypes restore-snapshot': 'node bin/app prototypes restore-snapshot <prototype> --version <version> --variant <variant> --from-prototype <prototype> --from-version <version> --from-variant <variant> --recovery-version <version> [options]',
  'docs import': 'node bin/app docs import [file-or-folder ...] [options]',
  'docs export': 'node bin/app docs export [--out <documentation-root>] [options]',
  'docs validate': 'node bin/app docs validate [file-or-folder ...] [--json]',
  ci: 'node bin/app ci (--list | --job <workflow-file-stem>/<job-id> [--matrix key=value,...] [--execute]) [--json]',
  'obsidian status': 'node bin/app obsidian status --obsidian-vault <name-or-id> [--json]',
  'obsidian files': 'node bin/app obsidian files --obsidian-vault <name-or-id> [--obsidian-folder <folder>] [--json]',
  'obsidian read': 'node bin/app obsidian read --obsidian-vault <name-or-id> --obsidian-path <note.md> [--json]',
  'obsidian prepare': 'node bin/app obsidian prepare --obsidian-vault <name-or-id> [--json]',
  new: 'node bin/app new <dir> (--starter <id> | --from <project.json>) [options]', help: 'node bin/app help [command] [--all]',
  'plan inspect': 'node bin/app plan inspect <plan-file>', 'plan apply': 'node bin/app plan apply <plan-file> --yes',
  make: 'node bin/app make <recipe> <name> [options] | make list | make describe <recipe>',
};
const examples: Record<string, string[]> = {
  'adopt analyze': ['node bin/app adopt analyze --target ../legacy-app', 'node bin/app adopt analyze --target ../legacy-app --json --out ../legacy-report.json'],
  'adopt plan': ['node bin/app adopt plan --target ../legacy-app', 'node bin/app adopt plan --target ../legacy-app --apply <sha256>', 'node bin/app adopt plan --report ../legacy-report.json --target ../legacy-app --dry-run'],
  'adopt skill': ['node bin/app adopt skill --target ../legacy-app --dry-run', 'node bin/app adopt skill --target ../legacy-app --yes'],
  'templates list': ['node bin/app templates list --atomic-level organism --json', 'node bin/app templates list --for editor --json'],
  'templates search': ['node bin/app templates search table --json'],
  'templates show': ['node bin/app templates show organism.data-table --json'],
  'templates tree': ['node bin/app templates tree page.dashboard --json'],
  'templates validate': ['node bin/app templates validate --json'],
  'templates schema': ['node bin/app templates schema --json'],
  'templates coverage': ['node bin/app templates coverage --json'],
  'templates docs': ['node bin/app templates docs --dry-run --json', 'node bin/app templates docs --yes'],
  'templates instantiate': ['node bin/app templates instantiate organism.data-table --project design/project.json --dry-run'],
  'starters coverage': ['node bin/app starters coverage feature-showcase --json', 'node bin/app starters coverage feature-showcase --require-model-coverage --json'],
  'ui gallery': ['node bin/app ui gallery', 'node bin/app ui gallery --target clickdummy --json', 'node bin/app ui gallery --out reports/ui-gallery'],
  'ui status': ['node bin/app ui status', 'node bin/app ui status --json', 'node bin/app ui status --root ../my-app --json'],
  'starters list': ['node bin/app starters list --json'],
  'starters show': ['node bin/app starters show webapp --json'],
  'starters validate': ['node bin/app starters validate --json'],
  'starters schema': ['node bin/app starters schema --json'],
  'starters add': ['node bin/app starters add --input my-starter.json --dry-run'],
  'starters edit': ['node bin/app starters edit webapp --input edited-webapp.json --plan-out starter-edit.plan.json'],
  'starters pack': ['node bin/app starters pack --out ./workbench-starters.zip --yes'],
  'starters run': ['node bin/app starters run --project ../my-app --process verify,build --dry-run', 'node bin/app starters run --project ../my-app --process build --yes --trust-processes --apply <planHash>'],
  'prototypes list': ['node bin/app prototypes list --json'],
  'prototypes compare': ['node bin/app prototypes compare exploration --version v1 --variant main --with-prototype exploration --with-version v1 --with-variant sitemap-b --json'],
  'prototypes prototype-details': ['node bin/app prototypes prototype-details exploration --name "Product exploration" --description "Compare navigation variants" --dry-run'],
  'prototypes version-details': ['node bin/app prototypes version-details exploration --version v1 --label "Iteration 1" --dry-run'],
  'prototypes restore-snapshot': ['node bin/app prototypes restore-snapshot exploration --version v1 --variant sitemap-b --from-prototype exploration --from-version v1 --from-variant main --recovery-version v2 --dry-run'],
  'prototypes create': ['node bin/app prototypes create exploration --input design/project.json --dry-run'],
  'prototypes version': ['node bin/app prototypes version exploration --version v2 --from v1 --dry-run'],
  'prototypes fork': ['node bin/app prototypes fork exploration --version v1 --variant main --as sitemap-b --dry-run'],
  'prototypes save': ['node bin/app prototypes save exploration --version v1 --variant sitemap-b --input design/project.json --dry-run'],
  'prototypes details': ['node bin/app prototypes details exploration --version v1 --variant sitemap-b --name "Sitemap B" --hypothesis "Alternative navigation" --dry-run'],
  'prototypes status': ['node bin/app prototypes status exploration --version v1 --variant sitemap-b --status approved --dry-run'],
  'prototypes activate': ['node bin/app prototypes activate exploration --version v1 --variant sitemap-b --dry-run'],
  'prototypes deactivate': ['node bin/app prototypes deactivate --dry-run'],
  'prototypes seal': ['node bin/app prototypes seal exploration --version v1 --dry-run'],
  'prototypes archive': ['node bin/app prototypes archive exploration --dry-run'],
  'prototypes restore': ['node bin/app prototypes restore exploration --dry-run'],
  'prototypes import': ['node bin/app prototypes import --input prototype-workspace.json --dry-run'],
  'prototypes export': ['node bin/app prototypes export --out prototype-workspace.json --dry-run'],
  'prototypes adopt': ['node bin/app prototypes adopt --resolve import --dry-run'],
  'prototypes generate': ['node bin/app prototypes generate --dry-run'],
  'docs import': ['node bin/app docs import docs/application --dry-run', 'node bin/app docs import docs/application --apply <reviewed-hash> --yes'],
  'docs export': ['node bin/app docs export --dry-run', 'node bin/app docs export --out docs/application --yes'],
  'docs validate': ['node bin/app docs validate docs/application --json'],
  'docs status': ['node bin/app docs status --json'],
  'docs schema': ['node bin/app docs schema --json'],
  'docs recover': ['node bin/app docs recover --dry-run', 'node bin/app docs recover --apply <recovery-hash> --yes'],
  'obsidian status': ['node bin/app obsidian status --obsidian-vault "My Vault" --json'],
  'obsidian files': ['node bin/app obsidian files --obsidian-vault "My Vault" --obsidian-folder docs/application --json'],
  'obsidian read': ['node bin/app obsidian read --obsidian-vault "My Vault" --obsidian-path docs/application/project.md --json'],
  'obsidian prepare': ['node bin/app obsidian prepare --obsidian-vault "My Vault" --json'],
  'handout generate': ['node bin/app handout generate --dry-run --json', 'node bin/app handout generate --plan-out handout.plan.json --json'],
  'handout refresh': ['node bin/app handout refresh --plan-out handout-refresh.plan.json --json'],
  'handout validate': ['node bin/app handout validate --json'],
  'handout inspect': ['node bin/app handout inspect --json'],
  'airship status': ['node bin/app airship status --json'],
  'airship enable': ['node bin/app airship enable --agent codex --dry-run', 'node bin/app airship enable --yes'],
  'airship disable': ['node bin/app airship disable --dry-run', 'node bin/app airship disable --yes'],
  'airship install': ['node bin/app airship install --dry-run', 'node bin/app airship install --yes'],
  'airship start': ['node bin/app airship start --dry-run', 'node bin/app airship start --yes'],
  'airship doctor': ['node bin/app airship doctor --dry-run', 'node bin/app airship doctor --yes'],
  'support report': ['node bin/app support report --json'],
  'project measure': ['node bin/app project measure --input project.json --samples 10 --json'],
  'storybook status': ['node bin/app storybook status --json'],
  'storybook install': ['node bin/app storybook install --dry-run', 'node bin/app storybook install --yes'],
  'storybook check': ['node bin/app storybook check'],
  'storybook dev': ['node bin/app storybook dev'],
  'storybook build': ['node bin/app storybook build'],
  'compiler check': ['node bin/app compiler check --input project.json --json'],
  'compiler inspect': ['node bin/app compiler inspect --input project.json --stage artifacts --output-kind clickdummy --json'],
  'compiler explain': ['node bin/app compiler explain COMPILER_REFERENCE_MISSING'],
  version: ['node bin/app --version --json'],
  'styles inspect': ['node bin/app styles inspect --input design/project.json'],
  'styles export': ['node bin/app styles export --input design/project.json --format css --dry-run', 'node bin/app styles export --input design/project.json --format html --yes'],
  help: ['node bin/app help check', 'node bin/app help --all'],
  capabilities: ['node bin/app capabilities --json'],
  schema: ['node bin/app schema --json'],
  status: ['node bin/app status', 'node bin/app status --json'],
  doctor: ['node bin/app doctor'],
  'config get': ['node bin/app config get --json'], 'config explain': ['node bin/app config explain'],
  'config validate': ['node bin/app config validate'], 'config set': ['node bin/app config set --input config.json --dry-run'],
  'setup status': ['node bin/app setup status --json'],
  'setup resume': ['node bin/app setup resume --stage verify --dry-run --json', 'node bin/app setup resume --stage verify --resume-hash <digest> --yes'],
  setup: ['node bin/app setup --starter quick-capture --id capture --name Capture --author Me --dry-run', 'node bin/app setup --id folio-tools --name "Folio Tools" --author "Me" --blank --yes', 'node bin/app setup --input ./my-project.json --dry-run --json'],
  'concept schema': ['node bin/app concept schema --json'],
  'concept inspect': ['node bin/app concept inspect --json', 'node bin/app concept inspect --input docs/concepts/capture/concept.json'],
  'concept import': ['node bin/app concept import --input docs/concepts/capture/concept.json --plan-out concept.plan.json', 'node bin/app plan apply concept.plan.json --yes'],
  'project schema': ['node bin/app project schema --version 6 --json'],
  'project validate': ['node bin/app project validate --input project.json --json'],
  'project inspect': ['node bin/app project inspect --input project.json'],
  'project import': ['node bin/app project import --input project.json --resolve project --dry-run'],
  new: ['node bin/app new --list', 'node bin/app new ../folio-tools --starter custom-file-view --extension folio', 'node bin/app new ../quick-capture --starter quick-capture --yes', 'node bin/app new ../folio-tools --from folio-tools.companion.json', 'node bin/app new ../folio-tools --starter blank --storybook on --storybook-stories on'],
  generate: ['node bin/app generate --scope feature:workspace --plan-out generation.plan.json', 'node bin/app generate --yes'],
  make: ['node bin/app make list', 'node bin/app make file-extension board --feature documents --extension board', 'node bin/app make context-menu inspect --feature documents --extensions md,board', 'node bin/app make feature bookmarks --entity bookmark --dry-run'],
  'plan inspect': ['node bin/app plan inspect generation.plan.json'], 'plan apply': ['node bin/app plan apply generation.plan.json --yes'],
  install: ['node bin/app install --yes'], build: ['node bin/app build'],
  mcp: ['node bin/app mcp'],
  'clickdummy build': ['node bin/app clickdummy build', 'node bin/app clickdummy build --replace'],
  test: ['node bin/app test', 'node bin/app test --profile obsidian', 'node bin/app test --profile browser'],
  check: ['node bin/app check', 'node bin/app check --fast --json', 'node bin/app check --fast --base origin/main', 'node bin/app check --plan --json'],
  'check submission': ['node bin/app check submission', 'node bin/app check submission --json'],
  ci: ['node bin/app ci --list --json', 'node bin/app ci --job ci/baseline --matrix os=ubuntu-latest', 'node bin/app ci --job ci/baseline --matrix os=ubuntu-latest --execute --json'],
  verify: ['node bin/app verify --profile project'], dev: ['node bin/app dev --profile obsidian', 'node bin/app dev', 'node bin/app dev --profile ui'],
  'vault prepare': ['node bin/app vault prepare --yes'], 'plugin install': ['node bin/app plugin install --dry-run'],
  'data plan': ['node bin/app data plan --input test-data-manifest.json'], 'data apply': ['node bin/app data apply --input test-data-manifest.json --apply <approval-hash>'],
  'data reset-plan': ['node bin/app data reset-plan --input test-data-manifest.json'], 'data reset': ['node bin/app data reset --input test-data-manifest.json --apply <approval-hash>'],
  'framework status': ['node bin/app framework status'], 'framework pack': ['node bin/app framework pack --out ./plugin-framework.zip --yes'],
  'framework upgrade': ['node bin/app framework upgrade --from ../extracted-kit --dry-run'],
  'release prepare': ['node bin/app release prepare --version 1.0.0 --notes-file notes.md --dry-run'], 'release check': ['node bin/app release check'],
  'release rehearse': ['node bin/app release rehearse --commit <sha> --version 1.0.0'], 'release operate': ['node bin/app release operate --input release-operation.json --dry-run'],
};
function commonFor(entry: Command): string[] {
  const shared = ['json', 'root', 'no-interaction', 'help'];
  if (entry.effect === 'plan') return ['dry-run', 'yes', 'apply', 'plan-out', ...shared];
  if (entry.effect === 'process') return ['dry-run', ...(['setup resume', 'starters run', 'docs recover'].includes(entry.id) ? ['apply'] : []), ...(['install', 'storybook install', 'airship install', 'airship start', 'airship doctor', 'framework pack', 'starters pack', 'starters run', 'setup resume', 'docs recover'].includes(entry.id) ? ['yes'] : []), 'timeout', ...shared];
  if (entry.effect === 'fixtures') return ['apply', ...shared];
  if (entry.effect === 'release' || entry.id === 'project measure') return ['dry-run', ...shared];
  return shared;
}
type OptionOverride = [(id: string, name: string) => boolean, (doc: OptionHelp, id: string) => void];
const option = (id: string, option: string) => (entryId: string, name: string) => entryId === id && name === option;
const prototypeOption = (option: string) => (entryId: string, name: string) => entryId.startsWith('prototypes ') && name === option;
const describe = (description: string) => (doc: OptionHelp) => { doc.description = description; };
/** Command-specific option documentation, applied in order over the shared descriptions. */
const optionOverrides: OptionOverride[] = [
  [(id, name) => name === 'profile' && Boolean(profiles[id]), (doc, id) => { doc.values = profiles[id]; doc.default = profileDefaults[id]; }],
  [option('ci', 'list'), describe('List workflows and their jobs: triggers, path filters, runner/matrix summary and local reproducibility.')],
  [option('ci', 'execute'), describe('Run the job\'s run: steps locally through bash, stopping at the first failure. Refused for secrets, publication or deployment. Without it the job is only printed.')],
  [option('setup resume', 'stage'), doc => { doc.description = 'Run only this explicitly approved setup stage.'; doc.values = ['generate', 'install', 'verify', 'preview']; delete doc.default; }],
  [option('project schema', 'version'), doc => { doc.description = 'Published project schema version. Legacy documents use project validate.'; doc.values = ['6']; doc.default = '6'; }],
  [option('release prepare', 'version'), describe('Release version x.y.z.')],
  [option('make', 'format'), doc => { doc.description = 'Custom file content format (file-extension recipe).'; doc.values = ['json', 'text']; doc.default = 'json'; }],
  [option('docs export', 'out'), doc => { doc.description = 'Documentation root for new files and navigation; registered files keep their locations.'; doc.default = 'configured documentation.root, otherwise docs/application'; }],
  [option('templates docs', 'out'), doc => { doc.description = 'Generated component-library Markdown root. JSON remains authoritative.'; doc.default = 'docs/generated/component-library'; }],
  [option('templates instantiate', 'project'), doc => { doc.description = 'Canonical Companion project JSON to update through a reviewed plan.'; doc.default = 'design/project.json'; }],
  [prototypeOption('version'), describe('Portable version slug, for example v1 or v2; distinct from the application release version.')],
  [option('prototypes version', 'from'), describe('Source version slug to copy into the new version.')],
  [prototypeOption('name'), describe('Prototype or variant display name; its folder slug stays unchanged.')],
  [option('prototypes prototype-details', 'description'), describe('Prototype description; changing it does not change folder slugs or saved designs.')],
  [option('ui gallery', 'target'), doc => { doc.description = 'What to capture: the served harness (this framework) or the built clickdummy.html (generated project).'; doc.values = ['harness', 'clickdummy']; doc.default = 'harness'; }],
  [option('ui gallery', 'out'), doc => { doc.description = 'Gallery folder relative to the project root; previous captures there are replaced.'; doc.default = 'reports/ui-gallery'; }],
  [option('ui gallery', 'input'), doc => { doc.description = 'Built clickdummy file relative to the project root (--target clickdummy only).'; doc.default = 'clickdummy.html'; }],
  [(id, name) => id.startsWith('adopt ') && name === 'target', describe('Folder to analyze or adopt into. Defaults to --root, then the current directory; no shell.config.json is needed.')],
  [option('adopt analyze', 'out'), describe('Write the report JSON here: outside the project, or inside it only as docs/workbench/*.json. A different existing file is refused without --replace.')],
  [option('adopt plan', 'out'), doc => { doc.description = 'Markdown file for the plan, relative to the target; only an earlier adoption plan can be replaced.'; doc.default = 'docs/workbench/ADOPTION-PLAN.md'; }],
  [(id, name) => id.startsWith('adopt ') && name === 'replace', describe('Replace an earlier report or adoption plan; never replaces an unrelated file.')],
  [option('new', 'from'), describe('Project JSON exported by the companion (instead of --starter).')],
  [option('templates docs', 'out'), doc => { doc.description = 'Folder for generated component-library Markdown.'; doc.default = 'docs/generated/component-library'; }],
  [option('templates instantiate', 'project'), doc => { doc.description = 'Canonical Companion project JSON file to update.'; doc.default = 'design/project.json'; }],
  [option('templates instantiate', 'name'), describe('Optional instance/component/page title override; the template name is the default.')],
];
function optionDoc(entry: Command, name: string): OptionHelp {
  const doc = { ...(specific[name] ?? { description: '' }) };
  for (const [applies, apply] of optionOverrides) if (applies(entry.id, name)) apply(doc, entry.id);
  return { ...doc, ...(doc.values ? { values: [...doc.values] } : {}) };
}
function timeoutDefault(entry: Command): Partial<OptionHelp> {
  if (['dev', 'storybook dev'].includes(entry.id)) return { default: '3600000' };
  return ['check', 'ci'].includes(entry.id) ? { default: '600000 per step' } : {};
}
/** A fresh copy on every call: callers can never mutate shared help or execution policy. */
export function commandHelp(entry: Command): CommandHelp {
  const group = groups.find(item => item.commands.includes(entry.id))?.id ?? 'other';
  const optionHelp: Record<string, OptionHelp> = {};
  for (const name of Object.keys(entry.options)) optionHelp[name] = optionDoc(entry, name);
  for (const name of commonFor(entry)) optionHelp[name] = { ...common[name]!, ...(name === 'timeout' ? timeoutDefault(entry) : {}) };
  if (entry.id === 'starters run') optionHelp.apply!.description = 'Plan hash from the reviewed preview. Without it, --yes --trust-processes plans and runs in one step and cannot detect changes made since an earlier review.';
  return { group, usage: usageLine(entry), examples: [...(examples[entry.id] ?? [])], optionHelp };
}
function usageLine(entry: Command): string {
  const argument = entry.maxArgs ? ' [arguments]' : '';
  return usage[entry.id] ?? `node bin/app ${entry.id}${argument}${Object.keys(entry.options).length ? ' [options]' : ''}`;
}
export function helpIndex() {
  return { goldenPath: goldenPath.map(item => ({ ...item })), groups: groups.map(item => ({ ...item, commands: [...item.commands] })), commandCount: commands.length };
}
