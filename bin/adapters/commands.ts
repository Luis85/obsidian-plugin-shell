import { brainstormCommand } from './brainstorm.ts';
import { firstRunCommand } from './first-run-command.ts';
import { designCommand } from './design-command.ts';
import { definitionCommand } from './wizard-command.ts';
import { fakeDataCommand } from './fake-data-command.ts';
import { learningCommand } from './learning-command.ts';
import { processCommand } from './process-command.ts';
import { testWorkflowCommand } from './test-workflow-command.ts';
import { collectionCommand } from './collection-command.ts';
import { candidateCommand } from './release-candidate-command.ts';
import { setupCommand, configuredArguments } from './setup-command.ts';
import { descriptor, parameterKinds } from './framework/catalog.ts';
import { newProjectCommand } from './project-command.ts';
import { savedProjectSelection } from './project-selection.ts';
import { resolve } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { readInput } from '../../scripts/shared/input.ts';
import type { Readable } from 'node:stream';
import { newDocument, documentText } from '../domain/document.ts';
import { object, keys } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { runOperations, operationCatalog } from '../application/operations.ts';
import { outline } from '../application/summary.ts';
import { sketchSchema } from '../application/schema.ts';
import { guideInput, prototypePlan } from './prototype.ts';
import { prototypeContext } from './prototype-context.ts';
import { readSnapshot, readData, savePlan, applyPrepared } from './storage.ts';
import { boilerplatePlan } from './compiler.ts';
import { pluginCliCommands, type WorkbenchPluginRuntime } from '../../plugins/runtime.ts';
import type { PluginCliCommand } from '../../plugins/api.ts';
export { option, type Arguments } from '../domain/command-options.ts';
import { collectionCommandRoots, makerBooleanOptions, makerCommandIds, makerValueOptions, option, type Arguments } from '../domain/command-options.ts';
export interface CommandContext { root: string; frameworkRoot: string; input: Readable; signal?: AbortSignal; progress?: (message: string) => void; plugins?: WorkbenchPluginRuntime }
const makerHelp = `Workbench CLI — maker commands: make first, generate when ready
  node bin/app first-run             Optional install → typecheck → test → build → showcase
  node bin/app first-run schema --json
  node bin/app first-run --input first-run.json --json
  node bin/app first-run status --json
  node bin/app project-setup         Angular setup in an existing Git + Obsidian vault
  node bin/app project-setup schema --json
  node bin/app project-setup guide --json
  node bin/app project-setup scan --json
  node bin/app project-setup --input setup.json --json
  node bin/app project-setup status --json
  node bin/app project-setup checkpoint --input partial-setup.json --json
  node bin/app project-setup resume --json
  node bin/app project-setup checkpoint-status --json
  node bin/app project-setup discard-checkpoint --json
  node bin/app settings              Edit configs/user-settings.json
  node bin/app settings show --json
  node bin/app settings schema --json
  node bin/app settings --input settings.json --json
  node bin/app settings migrate --input paths.json --json
  node bin/app                       Open saved workspace or create a project (terminal only)
  node bin/app new                   Project starter → prototype guide → reviewed package
  node bin/app new --starter plugin-angular   Preselect an installed project starter
  node bin/app new starters --json   Discover installed project starters (configs/starters in the package root)
  node bin/app new guide --starter plugin-angular --json
  node bin/app new validate --input request.json --json
  node bin/app new --input request.json --out projects/demo --json
  node bin/app new <dir> (--starter <id> | --from <project.json>)  File/Companion starters and exports
  node bin/app help new              Directory-creation options and approval policy
  node bin/app brainstorm            Guided feature definition, optional prototype/boilerplate and reviewed verification
  node bin/app brainstorm guide --json      Discover questions and the two sub-use-case roadmap
  node bin/app brainstorm schema --json     Machine-readable request schema
  node bin/app brainstorm context --json    Current project identity, saved base hash and existing surfaces
  node bin/app brainstorm validate --input feature.json --json
  node bin/app brainstorm feature --input feature.json --out brainstorms/my-feature --json
  node bin/app brainstorm feature --input feature.json --out brainstorms/my-feature --apply <planHash> --json
  node bin/app brainstorm verify --out brainstorms/my-feature --json
  node bin/app brainstorm verify --out brainstorms/my-feature --apply <verificationPlanHash> --json
  node bin/app sketch                Interactive page/component editor
  node bin/app sketch show --json    Inspect saved IDs and page composition
  node bin/app sketch schema --json  Discover the versioned transaction schema
  node bin/app sketch --input request.json --json
  node bin/app sketch generate --out generated/my-plugin --kind obsidian-plugin --json
  node bin/app prototype             Data-driven prototype preparation guide
  node bin/app prototype guide --json
  node bin/app prototype validate --input answers.json --json
  node bin/app prototype --input answers.json --out prototypes/my-prototype --json
  node bin/app design status --json  Claude Design folders under docs/design (configurable paths.design)
  node bin/app design prepare --name my-prototype --json   Prepare docs/design/my-prototype for Claude Design
  node bin/app design sync --name my-prototype --json      Regenerate its context; design work is never touched
  node bin/app wizard                Choose and run a data-driven guided process (configs/wizards)
  node bin/app wizard --name settings              Run one wizard by id
  node bin/app wizard list --json    Wizards and forms with their steps, fields and reference issues
  node bin/app wizard show --name first-run --json
  node bin/app wizard check --json   Validate every definition and the code hooks it names
  node bin/app form --name project-identity --out answers/identity.json   Fill in a form; save through a reviewed plan
  node bin/app form list --json      Reusable data-driven forms (configs/forms)
  node bin/app form show --name user-settings --json
  node bin/app form validate --name project-identity --input identity.json --json
  node bin/app fake-data             Generate seeded fake notes (frontmatter + Markdown), an optional .base and a reusable config
  node bin/app fake-data entities --json      Built-in, project (configs/fake-data/entities) and saved-project entities
  node bin/app fake-data show --name contact --json
  node bin/app fake-data validate --input entity.json --json
  node bin/app fake-data save-entity --input entity.json --json
  node bin/app fake-data --entity contact --count 25 --out "Fake Data/Contacts" --seed 7 --base --json
  node bin/app fake-data configs --json       Saved generation configs (configs/fake-data/generations)
  node bin/app fake-data show-config --name contacts-demo --json
  node bin/app fake-data --config contacts-demo [--count 50] [--out <folder>] [--seed 9] --json
  node bin/app fake-data save-config --input generation.json --json
  node bin/app learn                 Follow a step-by-step learning path (configs/learning/paths); resume later
  node bin/app learn list --json     Learning paths with your progress; learn show --name <id> --json
  node bin/app learn check --json    Validate every path, its content, forms, wizards and documentation links
  node bin/app learn status --name author-a-wizard --json             Progress and win conditions per step
  node bin/app learn complete-step --name <id> --step <step> --input step.json --json   Plan a step completion
  node bin/app learn restart --name <id> --json                       Plan removing saved progress
  node bin/app process               Run, create or edit a data-driven business process (configs/processes)
  node bin/app process run --name release-approval   Walk an instance: inputs, business rules, transitions, audit trail
  node bin/app process new | process edit --name release-approval   Author steps, rules and docs; reviewed save
  node bin/app process list --json   Processes with steps, rules and findings
  node bin/app process show --name release-approval --json
  node bin/app process check --json  Validate structure, references, graph health and doc links
  node bin/app process save --input process.json --json   Reviewed plan for configs/processes/<id>.json
  node bin/app process docs --name release-approval --out docs/processes --json   Regenerate Markdown docs; authored text kept
  node bin/app process simulate --name release-approval --input data.json --json   Agent walk with rule outcomes
  node bin/app workflow new | workflow edit --name sign-up   Author a browser test workflow (configs/tests/workflows); reviewed save
  node bin/app workflow list --json  Workflows with target, steps, assertions and findings; workflow show --name sign-up --json
  node bin/app workflow check --json Definitions, targets, fake data, templates and up-to-date notes in docs/tests/workflows
  node bin/app workflow save --input workflow.json --json   Reviewed plan for the definition and its documentation note
  node bin/app workflow docs [--name sign-up] --json        Regenerate documentation notes; hand-written text kept
  node bin/app workflow run --name sign-up [--target <loopback-url|folder>] --json   Headless Chromium run; report in reports/workflows
  node bin/app workflow record --name sign-up --json        Plan recording the latest run result in the note
  node bin/app workflow export --name sign-up --out tests/e2e/workflows --json   Plan an equivalent @playwright/test spec
  node bin/app risk new|edit --id RISK-0001|review   Guided risk capture, edit and review (terminal; folder: paths.risks)
  node bin/app risk list [--status <id>] [--dimension <id>] [--category <id>] [--level <id>] [--overdue] --json
  node bin/app risk show --id RISK-0001 --json
  node bin/app risk new --input risk.json --json             Plan a new risk note (next free id); then --apply <planHash>
  node bin/app risk update --id RISK-0001 --input changes.json --json   Changed fields and status transitions
  node bin/app risk check --json     Schema, model values, derived score/level, duplicate ids, overdue and open-risk gaps
  node bin/app risk report [--base] --json   Regenerate <risks>/risk-register.md (and risks.base) through review
  node bin/app risk model --json     The effective collection definition (configs/collections/risk.json)
  node bin/app learning new|edit --id LRN-0001|review   Lessons learned: guided capture, edit and review (terminal; folder: paths.learnings)
  node bin/app learning list [--status <id>] [--category <id>] [--impact <id>] [--overdue] --json
  node bin/app learning show --id LRN-0001 --json
  node bin/app learning new --input learning.json --json     Plan a new learning note (next free id); then --apply <planHash>
  node bin/app learning update --id LRN-0001 --input changes.json --json   Changed fields and draft → validated → applied transitions
  node bin/app learning check --json  Schema, vocabularies, risk id format, duplicate ids, overdue follow-ups, validated without follow-up
  node bin/app learning report [--base] --json   Regenerate <learnings>/learnings.md (and learnings.base) through review
  node bin/app learning model --json  The effective collection definition (configs/collections/learning.json)
  node bin/app release-item new|edit --id ITEM-0001|review   Release items: guided capture, edit and review (terminal; folder: paths.releaseItems)
  node bin/app release-item list [--status <id>] [--kind <id>] [--priority <id>] [--overdue] --json
  node bin/app release-item show --id ITEM-0001 --json
  node bin/app release-item new --input release-item.json --json   Plan a new release item note (next free id); then --apply <planHash>
  node bin/app release-item update --id ITEM-0001 --input changes.json --json   Changed fields and proposed → ready transitions
  node bin/app release-item check --json   Schema, kinds, source paths and ids, risk ids, duplicate ids, ready without acceptance
  node bin/app release-item report [--base] --json   Regenerate <releaseItems>/release-items.md (and release-items.base) through review
  node bin/app release-item model --json   The effective collection definition (configs/collections/release-item.json)
  node bin/app candidate new [--version 1.0.0]   Release candidate: version, target date, owner and ready release items (terminal)
  node bin/app candidate new --version 1.0.0 [--input candidate.json] --json   Plan <releaseCandidates>/1.0.0/README.md (and the release items it includes)
  node bin/app candidate list --json | candidate show --version 1.0.0 --json | candidate check --json
  node bin/app candidate add|remove --version 1.0.0 --item ITEM-0001 --json   Include a ready release item or return it to ready (draft only)
  node bin/app candidate status --version 1.0.0 --to <draft|frozen|qualified|released|abandoned> --json   Checked transitions; frozen locks the release items
  node bin/app candidate docs --version 1.0.0 --json   Regenerate the generated README blocks; authored sections are kept
These maker commands apply only with --apply <planHash> on the same command after reviewing its plan; they have no --yes shortcut.
Framework commands (setup, make <recipe>, generate, new <dir>, ...) accept --yes or --apply <planHash>: node bin/app help.
Options: --root <folder>, --project <relative.json> (design/project.json), --input <file|->,
--out <relative folder>, --kind <obsidian-plugin|clickdummy|project>, --guide <guide.json>,
--starter <project-starter-id> (new, new guide), --step <step-id> (learn complete-step), --name <prototype-slug> and --package <prepared folder> (design),
--entity <id|semantic:id|file:path.json>, --count <1-1000>, --seed <0-2147483647>, --config <id> and --base (fake-data),
--id <id>, --as-of <YYYY-MM-DD>, --status/--dimension/--category/--level <id>, --overdue and --base (risk),
--status/--category/--impact <id> with the same --id, --as-of, --overdue and --base (learning; learn is the separate course runner),
--status/--kind/--priority <id> with the same options (release-item), --version <x.y.z[-rc.N]>, --item <id>, --to <status> and --as-of (candidate),
--target <loopback-url|static-folder|prototypes/<slug>> (workflow run),
--json, --no-interaction, --ui <auto|tui|plain>, --no-color, --help. Stdin/CI never prompts. Ctrl-C exits 130; :back cancels a step.
Sketch transactions contain schemaVersion:1, title (new projects only), and operations.
Operation IDs accept @aliases from earlier creation steps. Only titles are required to create things.
Use collection.add with title, a vault-relative path and an entity reference to provision managed Markdown List/Create/Update/Delete operations.
Use page.collection-table to insert a Collection-backed UTable, page.bind for typed source bindings and interaction.action kind=source for CRUD calls.
First-run guide: bin/FIRST-RUN.md. Execution is separately approved; generated source is kept on failure.
All existing shell setup/make/generate/check commands remain available.
Workbench plugins registered in plugins/registry.ts may add top-level CLI commands and Studio/TUI actions.
`;
function parseFlags(tokens: string[], extension?: PluginCliCommand): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = Object.create(null);
  const booleans = [...makerBooleanOptions, ...(extension?.options?.booleans ?? [])];
  const values = [...makerValueOptions, ...(extension?.options?.values ?? [])];
  while (tokens.length) {
    const flag = tokens.shift()!;
    requireSketch(flag.startsWith('--'), 'MAKER_ARGUMENT', `Unexpected argument ${flag}.`);
    const key = flag.slice(2);
    requireSketch(!Object.hasOwn(flags, key), 'MAKER_ARGUMENT', `Duplicate option --${key}.`);
    if (booleans.includes(key)) flags[key] = true;
    else {
      requireSketch(values.includes(key) && tokens[0] && !tokens[0].startsWith('--'), 'MAKER_ARGUMENT', `Unknown option or missing value: ${flag}.`);
      flags[key] = tokens.shift()!;
    }
  }
  return flags;
}
export function parseArguments(argv: string[], extensions: readonly PluginCliCommand[] = pluginCliCommands()): Arguments {
  const tokens = [...argv];
  const first = tokens[0]?.startsWith('-') ? undefined : tokens.shift();
  requireSketch(extensions.every(item => !makerCommandIds.includes(item.id)), 'PLUGIN_COMMAND_CONFLICT', 'A plugin CLI command conflicts with a built-in maker command.');
  const extension = first ? extensions.find(item => item.id === first) : undefined;
  requireSketch(first === undefined || makerCommandIds.includes(first) || extension, 'MAKER_COMMAND', 'Use a built-in maker command or a registered plugin command.');
  const command = first ?? 'studio';
  const action = tokens[0] && !tokens[0].startsWith('-') ? tokens.shift()! : '';
  const flags = parseFlags(tokens, extension);
  requireSketch(flags.ui === undefined || ['auto', 'tui', 'plain'].includes(String(flags.ui)), 'MAKER_UI', 'Use --ui auto, tui or plain.');
  return { command, action, flags };
}
async function inputData(args: Arguments, context: CommandContext): Promise<unknown> {
  const input = option(args, 'input');
  requireSketch(input, 'MAKER_INPUT_REQUIRED', 'Use --input <file|-> for non-interactive authoring. Discover inputs with sketch schema or prototype guide.');
  return input === '-' ? parseJsonData(await readInput(context.input, context.signal)) : readData(resolve(context.root, input));
}
async function generate(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const path = option(args, 'project', 'design/project.json');
  const snapshot = await readSnapshot(context.root, path);
  requireSketch(snapshot.document, 'MAKER_PROJECT_MISSING', 'Save a sketch before generating.');
  const selected = await savedProjectSelection(context.root);
  const kind = option(args, 'kind', selected ? 'project' : 'obsidian-plugin');
  requireSketch(['obsidian-plugin', 'clickdummy', 'project'].includes(kind), 'MAKER_KIND', 'Use project, obsidian-plugin or clickdummy.');
  requireSketch(kind !== 'project' || selected, 'MAKER_KIND', 'Project output needs a validated project.config.json from a project starter (run new).');
  const out = option(args, 'out', `generated/${snapshot.document.project.id}`);
  const plan = await boilerplatePlan(context.root, context.frameworkRoot, out, snapshot.document, kind as 'project' | 'obsidian-plugin' | 'clickdummy', context.signal, kind === 'project' ? selected : undefined);
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
async function editSketch(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const path = option(args, 'project', 'design/project.json');
  const snapshot = await readSnapshot(context.root, path);
  const input = object(await inputData(args, context)); keys(input, ['schemaVersion', 'title', 'operations']);
  requireSketch(input.schemaVersion === 1, 'MAKER_VERSION', 'Expected sketch schemaVersion 1.');
  requireSketch(!snapshot.document || input.title === undefined || input.title === snapshot.document.project.name, 'MAKER_PROJECT_EXISTS', 'An existing project cannot be replaced by supplying another title.');
  requireSketch(snapshot.document || typeof input.title === 'string', 'MAKER_TITLE', 'A new project needs only a title.');
  const current = snapshot.document ?? newDocument(String(input.title));
  const result = runOperations(current, input.operations);
  const plan = await savePlan(context.root, path, result.document, snapshot.beforeHash);
  return applyPrepared({ ...plan, data: { ...plan.data, aliases: result.aliases, created: result.created } }, option(args, 'apply') || undefined, context.signal);
}
async function sketch(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  if (args.action === 'schema') return { schema: sketchSchema, operations: operationCatalog };
  if (args.action === 'generate') return generate(args, context);
  if (!args.action) return editSketch(args, context);
  requireSketch(args.action === 'show' || args.action === 'export', 'MAKER_COMMAND', 'Unknown sketch action.');
  const path = option(args, 'project', 'design/project.json');
  const snapshot = await readSnapshot(context.root, path);
  requireSketch(snapshot.document, 'MAKER_PROJECT_MISSING', 'Create a sketch first.');
  return args.action === 'show'
    ? { ...outline(snapshot.document), projectPath: path, projectHash: snapshot.beforeHash }
    : { document: snapshot.document, content: documentText(snapshot.document) };
}
async function prototype(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const { guide, selection } = await prototypeContext(context.root, option(args, 'guide') || undefined);
  if (args.action === 'guide') return { guide, selection, input: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: Object.fromEntries(guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => [field.id, field.default])) } };
  const input = await inputData(args, context);
  if (args.action === 'validate') { const result = guideInput(guide, input); return { ...result, ready: !result.pending.length }; }
  requireSketch(!args.action, 'MAKER_COMMAND', 'Unknown prototype action.');
  const snapshot = await readSnapshot(context.root, option(args, 'project', 'design/project.json'));
  const plan = await prototypePlan({ ...context, guide, input, out: option(args, 'out', 'prototypes/prepared-prototype'), baseline: snapshot.document, selection });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
function helpResult(args: Arguments, extensions: readonly PluginCliCommand[]): Record<string, unknown> {
    const newCommand = args.command === 'new' ? descriptor('new') : undefined;
    const pluginHelp = extensions.length
      ? '\nPlugin commands:\n' + extensions.map(item => `  node bin/app ${item.id} — ${item.summary}`).join('\n') + '\n'
      : '';
    return { help: makerHelp + pluginHelp, commands: newCommand ? [{ ...newCommand, options: parameterKinds(newCommand) }] : ['new', 'sketch', 'brainstorm', 'prototype', 'design', 'settings', 'project-setup', 'first-run', 'wizard', 'form', 'fake-data', 'learn', 'process', 'candidate', 'workflow', ...Object.keys(collectionCommandRoots), ...extensions.map(item => item.id)],
      pluginCommands: extensions.map(item => ({ id: item.id, summary: item.summary, options: item.options ?? {} })),
      ...(newCommand ? { makerCommands: ['new', 'brainstorm', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run'] } : {}), interactive: false };

}
type CommandResult = Record<string, unknown> | Promise<Record<string, unknown>>;
/** A registered plugin root owns its own help and execution; undefined means a built-in command. */
function pluginExecution(args: Arguments, plugins: CommandContext['plugins']): CommandResult | undefined {
  const extension = plugins?.cliCommands.find(item => item.id === args.command);
  if (!plugins || !extension) return undefined;
  if (args.flags.help) return { help: extension.summary, command: extension.id, options: extension.options ?? {}, interactive: false };
  return extension.execute({ action: args.action, flags: args.flags }, plugins.commandContext);
}
/** Note-collection roots (configs/collections) share one engine command; their help stays with the maker help. */
function collectionExecution(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> | undefined {
  const id = args.flags.help || !Object.hasOwn(collectionCommandRoots, args.command) ? undefined : collectionCommandRoots[args.command];
  return id === undefined ? undefined : collectionCommand(id, args, context, () => inputData(args, context));
}
type Executor = (args: Arguments, context: CommandContext) => CommandResult;
type InputCommand = (args: Arguments, context: CommandContext, input: () => Promise<unknown>) => CommandResult;
const withInput = (command: InputCommand): Executor => (args, context) => command(args, context, () => inputData(args, context));
/**
 * Commands that never read a saved project's configured arguments, one entry per command. `learn` reads only
 * configs/learning and the learner's progress; every --help stays with the shared maker help.
 */
const directCommands: Readonly<Record<string, Executor>> = {
  new: newProjectCommand,
  'first-run': withInput(firstRunCommand),
  design: designCommand,
  wizard: definitionCommand,
  form: definitionCommand,
  'fake-data': withInput(fakeDataCommand),
  settings: withInput(setupCommand),
  'project-setup': withInput(setupCommand),
  learn: learningCommand,
  process: processCommand,
  candidate: withInput(candidateCommand),
  workflow: testWorkflowCommand,
};
/** Undefined means a saved-project command. */
function directCommand(args: Arguments, context: CommandContext): CommandResult | undefined {
  if (args.flags.help || args.command === 'studio') return helpResult(args, context.plugins?.cliCommands ?? pluginCliCommands());
  return Object.hasOwn(directCommands, args.command) ? directCommands[args.command]!(args, context) : undefined;
}
async function savedProjectCommand(input: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const args = await configuredArguments(input, context.root);
  requireSketch(!args.flags.starter, 'PROJECT_OPTION', 'Starter selection is only available on new; saved projects keep project.config.json.');
  return args.command === 'sketch' ? sketch(args, context) : args.command === 'brainstorm' ? brainstormCommand(args, context) : prototype(args, context);
}
export async function execute(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  requireSketch(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  return pluginExecution(args, context.plugins) ?? collectionExecution(args, context) ?? directCommand(args, context) ?? savedProjectCommand(args, context);
}
