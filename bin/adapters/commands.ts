import { descriptor, parameterKinds } from '../../scripts/framework/catalog.ts';
import { loadProjectCatalog as loadLegacyCatalog, savedLegacyProjectSelection as savedLegacySelection, presetBoilerplatePlan } from './project-create.ts';
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
import { loadGuide, guideInput, prototypePlan } from './prototype.ts';
import { readSnapshot, readData, savePlan, applyPrepared } from './storage.ts';
import { boilerplatePlan } from './compiler.ts';
export { option, type Arguments } from '../domain/command-options.ts';
import { option, type Arguments } from '../domain/command-options.ts';
export interface CommandContext { root: string; frameworkRoot: string; input: Readable; signal?: AbortSignal }
export const makerHelp = `Shell maker — make first, generate when ready
  node shell.mjs                       Open saved workspace or create a project (terminal only)
  node shell.mjs new                   Preset → framework → prototype guide
  node shell.mjs new presets --json    Discover project presets and compatible frameworks
  node shell.mjs new guide --preset plugin-angular --json
  node shell.mjs new validate --input request.json --json
  node shell.mjs new --input request.json --out projects/demo --json
  node shell.mjs new <dir> (--starter <id> | --from <project.json>)  Legacy creation
  node shell.mjs help new              Legacy options and approval policy
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
--preset <id>, --framework <nuxtui|vanilla|angular|none>, --targets <comma-separated> (new guide/TUI),
--json, --no-interaction, --ui <auto|tui|plain>, --no-color, --help. Stdin/CI never prompts. Ctrl-C exits 130; :back cancels a step.
Sketch transactions contain schemaVersion:1, title (new projects only), and operations.
Operation IDs accept @aliases from earlier creation steps. Only titles are required to create things.
All existing shell setup/make/generate/check commands remain available.
`;
function parseFlags(tokens: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = Object.create(null);
  const booleans = ['json', 'no-interaction', 'help', 'no-color'];
  const values = ['root', 'project', 'input', 'out', 'kind', 'guide', 'apply', 'ui', 'preset', 'framework', 'targets'];
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
export function parseArguments(argv: string[]): Arguments {
  const tokens = [...argv];
  const first = tokens[0]?.startsWith('-') ? undefined : tokens.shift();
  requireSketch(first === undefined || first === 'sketch' || first === 'prototype' || first === 'studio' || first === 'new', 'MAKER_COMMAND', 'Use new, sketch, prototype or studio.');
  const command = first ?? 'studio';
  const action = tokens[0] && !tokens[0].startsWith('-') ? tokens.shift()! : '';
  const flags = parseFlags(tokens);
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
  const catalog = await loadLegacyCatalog(), legacy = await savedLegacySelection(context.root, catalog);
  requireSketch(!selected || !legacy, 'PROJECT_CONFIG_CONFLICT', 'Both project.config.json and shell.project.json exist; reconcile the project selection before generating.');
  if (legacy && !args.flags.kind) {
    const plan = await presetBoilerplatePlan(context.root, context.frameworkRoot, option(args, 'out', `generated/${snapshot.document.project.id}`), snapshot.document, legacy, catalog, context.signal);
    return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
  }
  const kind = option(args, 'kind', selected ? 'project' : 'obsidian-plugin');
  requireSketch(['obsidian-plugin', 'clickdummy', 'project'].includes(kind), 'MAKER_KIND', 'Use project, obsidian-plugin or clickdummy.');
  requireSketch(kind !== 'project' || selected, 'MAKER_KIND', 'Project output needs a validated project.config.json.');
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
  const selected = option(args, 'guide');
  const guide = await loadGuide(selected ? resolve(context.root, selected) : undefined);
  if (args.action === 'guide') return { guide, input: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: Object.fromEntries(guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => [field.id, field.default])) } };
  const input = await inputData(args, context);
  if (args.action === 'validate') { const result = guideInput(guide, input); return { ...result, ready: !result.pending.length }; }
  requireSketch(!args.action, 'MAKER_COMMAND', 'Unknown prototype action.');
  const snapshot = await readSnapshot(context.root, option(args, 'project', 'design/project.json'));
  const plan = await prototypePlan({ ...context, guide, input, out: option(args, 'out', 'prototypes/prepared-prototype'), baseline: snapshot.document });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
export async function execute(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  requireSketch(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  if (args.flags.help || args.command === 'studio') {
    const legacy = args.command === 'new' ? descriptor('new') : undefined;
    return { help: makerHelp, commands: legacy ? [{ ...legacy, options: parameterKinds(legacy) }] : ['new', 'sketch', 'prototype'],
      ...(legacy ? { makerCommands: ['new', 'sketch', 'prototype'] } : {}), interactive: false };
  }
  if (args.command === 'new') return newProjectCommand(args, context);
  requireSketch(!['preset', 'framework', 'targets'].some(key => args.flags[key]), 'PROJECT_OPTION', 'Project selection flags are only available on new.');
  return args.command === 'sketch' ? sketch(args, context) : prototype(args, context);
}
