import { setupDocumentation } from './docs-setup.ts';
import { setupObsidian } from '../../../scripts/framework/obsidian-setup.ts';
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
  if (!options.input && !options.starter && !options.blank && !previous) {
    const { catalog } = await dependencies.starterCatalog(context);
    write('Start with a reviewed starter, or import existing project JSON.\n');
    for (const item of catalog.starters) write(`  ${item.id} — ${item.name} (${item.level})\n`);
    const source = (await prompt('Starter ID, or json [blank]: ')).trim() || 'blank';
    if (source === 'json') {
      options.input = (await prompt('Project JSON path: ')).trim();
      requireThat(options.input, 'INPUT_REQUIRED', 'A JSON import needs a file path. No files were changed.');
    } else {
      requireThat(
        catalog.starters.some(item => item.id === source),
        'STARTER_UNKNOWN',
        'Choose a listed starter ID. No files were changed.',
      );
      options.starter = source;
    }
  }

  if (!options.input && !previous) {
    const fallback = dependencies.derivedId(context.root, String(options.starter ?? 'project'));
    options.id ??= (await prompt(`Plugin ID [${fallback}]: `)).trim() || fallback;
    const name = dependencies.derivedName(String(options.id));
    options.name ??= (await prompt(`Plugin name [${name}]: `)).trim() || name;
    options.author ??= (await prompt('Author: ')).trim();
  }

  if (
    (options.input || options.starter || options.blank)
    && options.airship === undefined
    && options['no-airship'] === undefined
    && parseConfirmation(await prompt(
      'Enable optional Airship development tooling? No installation or launch is performed. [y/N] ',
    )) === true
  ) options.airship = true;

  write('GitHub is optional. Setup stays local and preserves every existing remote. Use your reviewed Git client to connect later.\n');
  return { ...request, options };
}

/** Each effect needs a separate approval. Returning early retains completed state for setup resume. */
export async function continueSetup(
  context: Context,
  execute: Execute,
  prompt: Prompt,
  render: (value: Result) => void,
  configured: Result,
  dependencies: SetupTerminalDependencies = defaults,
): Promise<Result> {
  // Typed notes found in an opted-in Obsidian vault replace the generic import question; each batch is its own reviewed plan.
  const vaultNotes = await dependencies.setupObsidian(context, execute, prompt, render);
  let outcome = configured;
  for (const batch of vaultNotes) {
    outcome = await dependencies.setupDocumentation('import', outcome, context, execute, prompt, render, batch);
    if (!['ok', 'applied', 'unchanged'].includes(outcome.status)) return outcome;
  }
  if (!vaultNotes.length) outcome = await dependencies.setupDocumentation('import', configured, context, execute, prompt, render);
  if (!['ok', 'applied', 'unchanged'].includes(outcome.status)) return outcome;

  for (const [stage, question] of [
    ['generate', 'Review and generate source for the accepted project?'],
    ['install', 'Install the exact lockfile? Registry access and approved dependency hooks may run.'],
    ['verify', 'Run generated-project verification? Trusted project code writes build output and reports.'],
    ['preview', 'Build the offline clickdummy? This does not implement missing business actions.'],
  ] as const) {
    render(outcome);
    if (parseConfirmation(await prompt(question + ' [y/N] ')) !== true) {
      return dependencies.setupDocumentation('export', outcome, context, execute, prompt, render);
    }

    let generationHash: string | undefined;
    if (stage === 'generate') {
      const plan = await execute({ command: 'generate', args: [], options: {} }, context);
      render(plan);
      generationHash = (plan.data as { planHash?: string }).planHash;
      if (
        plan.status !== 'planned'
        || !generationHash
        || parseConfirmation(await prompt('Apply these reviewed file changes? [y/N] ')) !== true
      ) return plan;
    }

    const current = await execute({ command: 'setup status', args: [], options: {} }, context);
    if (current.status !== 'ok') return current;
    const data = current.data as { resumeHash: string };
    outcome = await execute({
      command: 'setup resume',
      args: [],
      options: {
        stage,
        yes: true,
        'resume-hash': data.resumeHash,
        ...(generationHash ? { apply: generationHash } : {}),
      },
    }, context);
    if (!['ok', 'applied', 'unchanged'].includes(outcome.status)) return outcome;
  }

  return dependencies.setupDocumentation('export', outcome, context, execute, prompt, render);
}
