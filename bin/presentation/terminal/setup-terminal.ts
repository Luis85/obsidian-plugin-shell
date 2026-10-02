import { setupDocumentation } from './docs-setup.ts';
import { setupObsidian } from './obsidian-setup.ts';
import { starterCatalog, derivedId, derivedName } from '../../../scripts/framework/starter-project.ts';
import { readConfiguration } from '../../adapters/framework/files.ts';
import { requireThat, type Context, type Request, type Result } from '../../adapters/framework/contracts.ts';
import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';

type Prompt = (message: string) => Promise<string>;
type Write = (message: string) => void;
type Execute = (request: Request, context: Context) => Promise<Result>;

interface SetupTerminalDependencies {
  setupDocumentation: typeof setupDocumentation;
  setupObsidian: typeof setupObsidian;
  starterCatalog: typeof starterCatalog;
  derivedId: typeof derivedId;
  derivedName: typeof derivedName;
  readConfiguration: typeof readConfiguration;
}

const defaults: SetupTerminalDependencies = {
  setupDocumentation,
  setupObsidian,
  starterCatalog,
  derivedId,
  derivedName,
  readConfiguration,
};

type Options = Request['options'];
/** Lists the reviewed starters and records the chosen starter or a JSON import path. */
async function chooseSource(options: Options, context: Context, prompt: Prompt, write: Write, dependencies: SetupTerminalDependencies): Promise<void> {
  const { catalog } = await dependencies.starterCatalog(context);
  write('Start with a reviewed starter, or import existing project JSON.\n');
  for (const item of catalog.starters) write(`  ${item.id} — ${item.name} (${item.level})\n`);
  const source = (await prompt('Starter ID, or json [blank]: ')).trim() || 'blank';
  if (source === 'json') {
    options.input = (await prompt('Project JSON path: ')).trim();
    requireThat(options.input, 'INPUT_REQUIRED', 'A JSON import needs a file path. No files were changed.');
    return;
  }
  requireThat(catalog.starters.some(item => item.id === source), 'STARTER_UNKNOWN', 'Choose a listed starter ID. No files were changed.');
  options.starter = source;
}
/** Asks only for identity fields the caller did not supply, defaulting from the folder and starter. */
async function askIdentity(options: Options, context: Context, prompt: Prompt, dependencies: SetupTerminalDependencies): Promise<void> {
  const fallback = dependencies.derivedId(context.root, String(options.starter ?? 'project'));
  options.id ??= (await prompt(`Plugin ID [${fallback}]: `)).trim() || fallback;
  const name = dependencies.derivedName(String(options.id));
  options.name ??= (await prompt(`Plugin name [${name}]: `)).trim() || name;
  options.author ??= (await prompt('Author: ')).trim();
}
async function askAirship(options: Options, prompt: Prompt): Promise<void> {
  if (!(options.input || options.starter || options.blank)) return;
  if (options.airship !== undefined || options['no-airship'] !== undefined) return;
  const answer = await prompt('Enable optional Airship development tooling? No installation or launch is performed. [y/N] ');
  if (parseConfirmation(answer) === true) options.airship = true;
}
async function askMcp(options: Options, prompt: Prompt): Promise<void> {
  if (options.mcp !== undefined || options['no-mcp'] !== undefined) return;
  const answer = await prompt('Enable the project-local Workbench MCP for Claude Code and Codex? This writes project settings but installs no client. [y/N] ');
  if (parseConfirmation(answer) === true) options.mcp = true;
}

/** Terminal-only interview. Headless/API callers use explicit source/identity arguments. */
export async function guidedSetup(
  request: Request,
  context: Context,
  prompt: Prompt,
  write: Write,
  dependencies: SetupTerminalDependencies = defaults,
): Promise<Request> {
  const options = { ...request.options };
  const previous = await dependencies.readConfiguration(context.root);
  if (!options.input && !options.starter && !options.blank && !previous) await chooseSource(options, context, prompt, write, dependencies);
  if (!options.input && !previous) await askIdentity(options, context, prompt, dependencies);
  await askAirship(options, prompt);
  await askMcp(options, prompt);
  write('GitHub is optional. Setup stays local and preserves every existing remote. Use your reviewed Git client to connect later.\n');
  return { ...request, options };
}

const succeeded = (value: Result) => ['ok', 'applied', 'unchanged'].includes(value.status);
type Render = (value: Result) => void;
const stages = [
  ['generate', 'Review and generate source for the accepted project?'],
  ['install', 'Install the exact lockfile? Registry access and approved dependency hooks may run.'],
  ['verify', 'Run generated-project verification? Trusted project code writes build output and reports.'],
  ['preview', 'Build the offline clickdummy? This does not implement missing business actions.'],
] as const;
/** Typed notes found in an opted-in Obsidian vault replace the generic import question; each batch is its own reviewed plan. */
async function importDocumentation(context: Context, execute: Execute, prompt: Prompt, render: Render, configured: Result, dependencies: SetupTerminalDependencies): Promise<Result> {
  const vaultNotes = await dependencies.setupObsidian(context, execute, prompt, render);
  if (!vaultNotes.length) return dependencies.setupDocumentation('import', configured, context, execute, prompt, render);
  let outcome = configured;
  for (const batch of vaultNotes) {
    outcome = await dependencies.setupDocumentation('import', outcome, context, execute, prompt, render, batch);
    if (!succeeded(outcome)) return outcome;
  }
  return outcome;
}
/** The generation plan is reviewed and approved before its hash may be applied by setup resume. */
async function approveGeneration(context: Context, execute: Execute, prompt: Prompt, render: Render): Promise<{ hash?: string; stop?: Result }> {
  const plan = await execute({ command: 'generate', args: [], options: {} }, context);
  render(plan);
  const hash = (plan.data as { planHash?: string }).planHash;
  if (plan.status !== 'planned' || !hash) return { stop: plan };
  if (parseConfirmation(await prompt('Apply these reviewed file changes? [y/N] ')) !== true) return { stop: plan };
  return { hash };
}
/** Resumes one stage against the current audited setup state; a non-ok status read stops the flow. */
async function resumeStage(context: Context, execute: Execute, stage: string, generationHash?: string): Promise<{ outcome?: Result; stop?: Result }> {
  const current = await execute({ command: 'setup status', args: [], options: {} }, context);
  if (current.status !== 'ok') return { stop: current };
  const data = current.data as { resumeHash: string };
  const options = { stage, yes: true, 'resume-hash': data.resumeHash, ...(generationHash ? { apply: generationHash } : {}) };
  return { outcome: await execute({ command: 'setup resume', args: [], options }, context) };
}

/** Each effect needs a separate approval. Returning early retains completed state for setup resume. */
export async function continueSetup(
  context: Context,
  execute: Execute,
  prompt: Prompt,
  render: Render,
  configured: Result,
  dependencies: SetupTerminalDependencies = defaults,
): Promise<Result> {
  let outcome = await importDocumentation(context, execute, prompt, render, configured, dependencies);
  if (!succeeded(outcome)) return outcome;
  for (const [stage, question] of stages) {
    render(outcome);
    if (parseConfirmation(await prompt(question + ' [y/N] ')) !== true) break;
    const generation = stage === 'generate' ? await approveGeneration(context, execute, prompt, render) : {};
    if (generation.stop) return generation.stop;
    const resumed = await resumeStage(context, execute, stage, generation.hash);
    if (resumed.stop) return resumed.stop;
    outcome = resumed.outcome!;
    if (!succeeded(outcome)) return outcome;
  }
  return dependencies.setupDocumentation('export', outcome, context, execute, prompt, render);
}
