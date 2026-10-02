import { brainstormCommand } from './brainstorm.ts';
import { firstRunCommand } from './first-run-command.ts';
import { setupCommand, configuredArguments } from './setup-command.ts';
import { descriptor, parameterKinds } from '../../scripts/framework/catalog.ts';
import { newProjectCommand } from './project-command.ts';
import { savedProjectSelection } from './project-selection.ts';
import { resolve } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { readInput } from '../../scripts/framework/input.ts';
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
import { option, type Arguments } from '../domain/command-options.ts';
export interface CommandContext { root: string; frameworkRoot: string; input: Readable; signal?: AbortSignal; progress?: (message: string) => void; plugins?: WorkbenchPluginRuntime }
const makerHelp = `Shell maker — make first, generate when ready
  node shell.mjs first-run             Optional install → typecheck → test → build → showcase
  node shell.mjs first-run schema --json
  node shell.mjs first-run --input first-run.json --json
  node shell.mjs first-run status --json
  node shell.mjs project-setup         Angular setup in an existing Git + Obsidian vault
  node shell.mjs project-setup schema --json
  node shell.mjs project-setup guide --json
  node shell.mjs project-setup scan --json
  node shell.mjs project-setup --input setup.json --json
  node shell.mjs project-setup status --json
  node shell.mjs project-setup checkpoint --input partial-setup.json --json
  node shell.mjs project-setup resume --json
  node shell.mjs project-setup checkpoint-status --json
  node shell.mjs project-setup discard-checkpoint --json
  node shell.mjs settings              Edit configs/user-settings.json
  node shell.mjs settings show --json
  node shell.mjs settings schema --json
  node shell.mjs settings --input settings.json --json
  node shell.mjs settings migrate --input paths.json --json
  node shell.mjs                       Open saved workspace or create a project (terminal only)
  node shell.mjs new                   Project starter → prototype guide → reviewed package
  node shell.mjs new --starter plugin-angular   Preselect an installed project starter
  node shell.mjs new starters --json   Discover installed project starters (configs/starters beside shell.mjs)
  node shell.mjs new guide --starter plugin-angular --json
  node shell.mjs new validate --input request.json --json
  node shell.mjs new --input request.json --out projects/demo --json
  node shell.mjs new <dir> (--starter <id> | --from <project.json>)  File/Companion starters and exports
  node shell.mjs help new              Directory-creation options and approval policy
  node shell.mjs brainstorm            Guided feature definition, optional prototype/boilerplate and reviewed verification
  node shell.mjs brainstorm guide --json      Discover questions and the two sub-use-case roadmap
  node shell.mjs brainstorm schema --json     Machine-readable request schema
  node shell.mjs brainstorm context --json    Current project identity, saved base hash and existing surfaces
  node shell.mjs brainstorm validate --input feature.json --json
  node shell.mjs brainstorm feature --input feature.json --out brainstorms/my-feature --json
  node shell.mjs brainstorm feature --input feature.json --out brainstorms/my-feature --apply <planHash> --json
  node shell.mjs brainstorm verify --out brainstorms/my-feature --json
  node shell.mjs brainstorm verify --out brainstorms/my-feature --apply <verificationPlanHash> --json
  node shell.mjs sketch                Interactive page/component editor
  node shell.mjs sketch show --json    Inspect saved IDs and page composition
  node shell.mjs sketch schema --json  Discover the versioned transaction schema
  node shell.mjs sketch --input request.json --json
  node shell.mjs sketch generate --out generated/my-plugin --kind obsidian-plugin --json
  node shell.mjs prototype             Data-driven prototype preparation guide
  node shell.mjs prototype guide --json
  node shell.mjs prototype validate --input answers.json --json
  node shell.mjs prototype --input answers.json --out prototypes/my-prototype --json
Add --apply <planHash> to the same command after reviewing its plan. No --yes shortcut.
Options: --root <folder>, --project <relative.json> (design/project.json), --input <file|->,
--out <relative folder>, --kind <obsidian-plugin|clickdummy|project>, --guide <guide.json>,
--starter <project-starter-id> (new, new guide),
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
  const booleans = ['json', 'no-interaction', 'help', 'no-color', ...(extension?.options?.booleans ?? [])];
  const values = ['root', 'project', 'input', 'out', 'kind', 'guide', 'apply', 'ui', 'starter', ...(extension?.options?.values ?? [])];
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
  const builtins = ['sketch', 'prototype', 'studio', 'new', 'settings', 'project-setup', 'first-run', 'brainstorm'];
  requireSketch(extensions.every(item => !builtins.includes(item.id)), 'PLUGIN_COMMAND_CONFLICT', 'A plugin CLI command conflicts with a built-in maker command.');
  const extension = first ? extensions.find(item => item.id === first) : undefined;
  requireSketch(first === undefined || builtins.includes(first) || extension, 'MAKER_COMMAND', 'Use a built-in maker command or a registered plugin command.');
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
    const legacy = args.command === 'new' ? descriptor('new') : undefined;
    const pluginHelp = extensions.length
      ? '\nPlugin commands:\n' + extensions.map(item => `  node shell.mjs ${item.id} — ${item.summary}`).join('\n') + '\n'
      : '';
    return { help: makerHelp + pluginHelp, commands: legacy ? [{ ...legacy, options: parameterKinds(legacy) }] : ['new', 'sketch', 'brainstorm', 'prototype', 'settings', 'project-setup', 'first-run', ...extensions.map(item => item.id)],
      pluginCommands: extensions.map(item => ({ id: item.id, summary: item.summary, options: item.options ?? {} })),
      ...(legacy ? { makerCommands: ['new', 'brainstorm', 'sketch', 'prototype', 'settings', 'project-setup', 'first-run'] } : {}), interactive: false };

}
/** A registered plugin root owns its own help and execution; undefined means a built-in command. */
function pluginExecution(args: Arguments, plugins: CommandContext['plugins']): Record<string, unknown> | Promise<Record<string, unknown>> | undefined {
  const extension = plugins?.cliCommands.find(item => item.id === args.command);
  if (!plugins || !extension) return undefined;
  if (args.flags.help) return { help: extension.summary, command: extension.id, options: extension.options ?? {}, interactive: false };
  return extension.execute({ action: args.action, flags: args.flags }, plugins.commandContext);
}
/** Commands that never read a saved project's configured arguments; undefined means a saved-project command. */
function directCommand(args: Arguments, context: CommandContext): Record<string, unknown> | Promise<Record<string, unknown>> | undefined {
  if (args.flags.help || args.command === 'studio') return helpResult(args, context.plugins?.cliCommands ?? pluginCliCommands());
  if (args.command === 'new') return newProjectCommand(args, context);
  if (args.command === 'first-run') return firstRunCommand(args, context, () => inputData(args, context));
  if (['settings', 'project-setup'].includes(args.command)) return setupCommand(args, context, () => inputData(args, context));
  return undefined;
}
async function savedProjectCommand(input: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const args = await configuredArguments(input, context.root);
  requireSketch(!args.flags.starter, 'PROJECT_OPTION', 'Starter selection is only available on new; saved projects keep project.config.json.');
  return args.command === 'sketch' ? sketch(args, context) : args.command === 'brainstorm' ? brainstormCommand(args, context) : prototype(args, context);
}
export async function execute(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  requireSketch(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  return pluginExecution(args, context.plugins) ?? directCommand(args, context) ?? savedProjectCommand(args, context);
}
