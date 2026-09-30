import { setupDocumentation } from './docs-setup.ts';
import { companionStarterSet, derivedId, derivedName } from './starter-project.ts';
import { readConfiguration } from './files.ts';
import { requireThat, type Context, type Request, type Result } from './contracts.ts';

type Prompt = (message: string) => Promise<string>;
type Write = (message: string) => void;
type Execute = (request: Request, context: Context) => Promise<Result>;
/** Terminal-only interview. Headless/API callers use explicit source/identity arguments. */
export async function guidedSetup(request: Request, context: Context, prompt: Prompt, write: Write): Promise<Request> {
  const options = { ...request.options }, previous = await readConfiguration(context.root);
  if (!options.input && !options.starter && !options.blank && !previous) {
    const { starters } = await companionStarterSet(context);
    write('Start with a reviewed starter, or import existing project JSON.\n');
    for (const { definition: item } of starters) write(`  ${item.id} — ${item.name} (${item.level})\n`);
    const source = (await prompt('Starter ID, or json [blank]: ')).trim() || 'blank';
    if (source === 'json') {
      options.input = (await prompt('Project JSON path: ')).trim();
      requireThat(options.input, 'INPUT_REQUIRED', 'A JSON import needs a file path. No files were changed.');
    } else {
      requireThat(starters.some(item => item.definition.id === source), 'STARTER_UNKNOWN', 'Choose a listed starter ID. No files were changed.');
      options.starter = source;
    }
  }
  if (!options.input && !previous) {
    const fallback = derivedId(context.root, String(options.starter ?? 'project'));
    options.id ??= (await prompt(`Plugin ID [${fallback}]: `)).trim() || fallback;
    const name = derivedName(String(options.id));
    options.name ??= (await prompt(`Plugin name [${name}]: `)).trim() || name;
    options.author ??= (await prompt('Author: ')).trim();
  }
  if ((options.input || options.starter || options.blank) && options.airship === undefined && options['no-airship'] === undefined &&
      /^y(?:es)?$/i.test((await prompt('Enable optional Airship development tooling? No installation or launch is performed. [y/N] ')).trim())) options.airship = true;
  write('GitHub is optional. Setup stays local and preserves every existing remote. Use your reviewed Git client to connect later.\n');
  return { ...request, options };
}
/** Each effect needs a separate approval. Returning early retains completed state for setup resume. */
export async function continueSetup(context: Context, execute: Execute, prompt: Prompt, render: (value: Result) => void, configured: Result): Promise<Result> {
  let outcome = await setupDocumentation('import', configured, context, execute, prompt, render);
  if (!['ok', 'applied', 'unchanged'].includes(outcome.status)) return outcome;
  for (const [stage, question] of [
    ['generate', 'Review and generate source for the accepted project?'],
    ['install', 'Install the exact lockfile? Registry access and approved dependency hooks may run.'],
    ['verify', 'Run generated-project verification? Trusted project code writes build output and reports.'],
    ['preview', 'Build the offline clickdummy? This does not implement missing business actions.'],
  ]) {
    render(outcome);
    if (!/^y(?:es)?$/i.test((await prompt(question + ' [y/N] ')).trim())) return setupDocumentation('export', outcome, context, execute, prompt, render);
    let generationHash: string | undefined;
    if (stage === 'generate') {
      const plan = await execute({ command: 'generate', args: [], options: {} }, context); render(plan);
      generationHash = (plan.data as { planHash?: string }).planHash;
      if (plan.status !== 'planned' || !generationHash || !/^y(?:es)?$/i.test((await prompt('Apply these reviewed file changes? [y/N] ')).trim())) return plan;
    }
    const current = await execute({ command: 'setup status', args: [], options: {} }, context);
    if (current.status !== 'ok') return current;
    const data = current.data as { resumeHash: string };
    outcome = await execute({ command: 'setup resume', args: [], options: { stage: stage!, yes: true, 'resume-hash': data.resumeHash, ...(generationHash ? { apply: generationHash } : {}) } }, context);
    if (!['ok', 'applied', 'unchanged'].includes(outcome.status)) return outcome;
  }
  return setupDocumentation('export', outcome, context, execute, prompt, render);
}
