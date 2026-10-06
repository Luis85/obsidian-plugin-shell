import { setupDocumentation } from '../terminal/docs-setup.ts';
import { setupObsidian } from '../terminal/obsidian-setup.ts';
import { companionStarterSet, derivedId, derivedName } from '../../adapters/framework/starter-project.ts';
import { readConfiguration } from '../../adapters/framework/files.ts';
import { readOriginUrl } from '../../adapters/framework/adopt-git.ts';
import { requireThat, type Context, type Request, type Result } from '../../adapters/framework/contracts.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { confirm } from '../prompts.ts';
import type { ActionContext, WizardOptions } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
import { hostingNote, prepareHosting } from './hosting.ts';
type Prompt = (message: string) => Promise<string>;
type Execute = (request: Request, context: Context) => Promise<Result>;
type Render = (value: Result) => void;
export interface SetupTerminalDependencies {
  setupDocumentation: typeof setupDocumentation; setupObsidian: typeof setupObsidian; companionStarterSet: typeof companionStarterSet;
  derivedId: typeof derivedId; derivedName: typeof derivedName; readConfiguration: typeof readConfiguration; readOriginUrl: typeof readOriginUrl;
}
export const setupDefaults: SetupTerminalDependencies = { setupDocumentation, setupObsidian, companionStarterSet, derivedId, derivedName, readConfiguration, readOriginUrl };
/** The terminal callbacks that setup passes into both setup wizards as options; the interview has no execute/render. */
interface SetupOptions extends WizardOptions { dependencies: SetupTerminalDependencies; execute: Execute; prompt: Prompt; render: Render }
function isSetupOptions(value: WizardOptions): value is SetupOptions {
  return typeof value.dependencies === 'object' && value.dependencies !== null && typeof value.prompt === 'function' &&
    ['execute', 'render'].every(key => value[key] === undefined || typeof value[key] === 'function');
}
function setupOptions(context: ActionContext): SetupOptions {
  requireThat(isSetupOptions(context.options), 'WIZARD_OPTIONS', 'Framework setup wizards need the setup terminal callbacks.');
  return context.options;
}
const setupOf = (state: FormValues) => state.setup as Request['options'];
const succeeded = (value: Result) => ['ok', 'applied', 'unchanged'].includes(value.status);
/** The generation plan is reviewed and approved before its hash may be applied by setup resume. */
async function approveGeneration(context: ActionContext): Promise<{ hash?: string; stop?: Result }> {
  const { execute, render } = setupOptions(context), options = setupOptions(context);
  const plan = await execute({ command: 'generate', args: [], options: {} }, options);
  render(plan);
  const hash = (plan.data as { planHash?: string }).planHash;
  if (plan.status !== 'planned' || !hash) return { stop: plan };
  if (!await confirm(context.ui, 'Apply these reviewed file changes?')) return { stop: plan };
  return { hash };
}
/** Resumes one stage against the current audited setup state; a non-ok status read stops the flow. */
async function resumeStage(context: ActionContext, stage: string, generationHash?: string): Promise<Result> {
  const options = setupOptions(context), current = await options.execute({ command: 'setup status', args: [], options: {} }, options);
  if (current.status !== 'ok') return current;
  const data = current.data as { resumeHash: string };
  return options.execute({ command: 'setup resume', args: [], options: { stage, yes: true, 'resume-hash': data.resumeHash, ...(generationHash ? { apply: generationHash } : {}) } }, options);
}
/** Actions behind configs/wizards/framework-setup.json and framework-setup-stages.json. */
export const frameworkSetupModule: WizardModule = {
  hooks: { effects: { 'framework-setup.opt-in': (value, answer, field) => { if (answer === true) value[field.id] = true; } } },
  actions: {
    'framework-setup.prepare': async context => {
      const { dependencies } = setupOptions(context), setup = setupOf(context.state), root = context.options.root;
      const previous = await dependencies.readConfiguration(root);
      const askSource = !setup.input && !setup.starter && !setup.blank && !previous;
      if (askSource) {
        const { starters } = await dependencies.companionStarterSet(setupOptions(context));
        context.ui.write('Start with a reviewed starter, or import existing project JSON.\n');
        for (const { definition: item } of starters) context.ui.write(`  ${item.id} — ${item.name} (${item.level})\n`);
        context.state.starterIds = starters.map(item => item.definition.id);
      }
      Object.assign(context.state, { askSource, previous: Boolean(previous) });
    },
    'framework-setup.source': ({ state }) => {
      const setup = setupOf(state), source = String(state.source || 'blank');
      if (source === 'json') { requireThat(setup.input, 'INPUT_REQUIRED', 'A JSON import needs a file path. No files were changed.'); return; }
      requireThat((state.starterIds as string[]).includes(source), 'STARTER_UNKNOWN', 'Choose a listed starter ID. No files were changed.');
      setup.starter = source;
    },
    /** Only missing answers are asked: an import keeps its identity, and explicit opt-in flags are never asked again. */
    'framework-setup.questions': ({ state }) => {
      const setup = setupOf(state);
      Object.assign(state, { needsIdentity: !setup.input && !state.previous,
        askAirship: Boolean(setup.input || setup.starter || setup.blank) && setup.airship === undefined && setup['no-airship'] === undefined,
        askMcp: setup.mcp === undefined && setup['no-mcp'] === undefined });
    },
    /** Identity defaults come from the folder and starter; supplied identity flags are never asked again. */
    'framework-setup.suggest-id': context => {
      const setup = setupOf(context.state);
      context.state.suggestedId = setupOptions(context).dependencies.derivedId(context.options.root, String(setup.starter ?? 'project'));
    },
    /** A new design (starter, blank or JSON) asks for its hosting platform; an Azure DevOps origin remote only suggests defaults. */
    'framework-setup.hosting': async context => {
      const setup = setupOf(context.state), designed = Boolean(setup.input || setup.starter || setup.blank);
      context.state.designed = designed;
      prepareHosting(context.state, setup, designed ? await setupOptions(context).dependencies.readOriginUrl(context.options.root) : null, designed);
    },
    'framework-setup.hosting-note': ({ ui, state }) => { ui.write(hostingNote(setupOf(state), state.designed === true)); },
    'framework-setup.suggest-name': context => { context.state.suggestedName = setupOptions(context).dependencies.derivedName(String(setupOf(context.state).id)); },
    /** Typed notes found in an opted-in Obsidian vault replace the generic import question; each batch is its own reviewed plan. */
    'framework-setup.import-documentation': async context => {
      const { dependencies, execute, prompt, render } = setupOptions(context), options = setupOptions(context);
      const vaultNotes = await dependencies.setupObsidian(options, execute, prompt, render);
      let outcome = context.state.outcome as Result;
      if (!vaultNotes.length) outcome = await dependencies.setupDocumentation('import', outcome, options, execute, prompt, render);
      for (const batch of vaultNotes) {
        outcome = await dependencies.setupDocumentation('import', outcome, options, execute, prompt, render, batch);
        if (!succeeded(outcome)) break;
      }
      context.state.outcome = outcome;
      if (!succeeded(outcome)) return { end: true };
    },
    /** Each effect needs its own approval; declining stops the remaining stages, a failure ends setup with its result. */
    'framework-setup.stage': async context => {
      const stage = context.step.with?.stage, question = context.step.with?.question;
      requireThat(stage && question, 'WIZARD_ACTION', 'framework-setup.stage needs with.stage and with.question.');
      setupOptions(context).render(context.state.outcome as Result);
      if (!await confirm(context.ui, question)) { context.state.stopped = true; return; }
      const generation = stage === 'generate' ? await approveGeneration(context) : {};
      if (generation.stop) { context.state.outcome = generation.stop; return { end: true }; }
      const outcome = await resumeStage(context, stage, generation.hash);
      context.state.outcome = outcome;
      if (!succeeded(outcome)) return { end: true };
    },
    'framework-setup.export-documentation': async context => {
      const { dependencies, execute, prompt, render } = setupOptions(context), options = setupOptions(context);
      context.state.outcome = await dependencies.setupDocumentation('export', context.state.outcome as Result, options, execute, prompt, render);
    },
  },
};
