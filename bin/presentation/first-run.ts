import { firstRunPlan } from '../adapters/first-run-plan.ts';
import { executeFirstRun } from '../adapters/first-run.ts';
import { loadSettings } from '../adapters/user-settings.ts';
import { choose, confirm, input, safe, type Prompts } from './prompts.ts';
import type { Context } from '../adapters/framework/contracts.ts';
/** Execution consent is separate from source generation and always defaults to Skip. */
export async function firstRunWizard(ui: Prompts, context: Context): Promise<string | undefined> {
  const mode = await choose(ui, 'First run of the new application', [
    { id: 'skip', label: 'Skip — keep the generated source without running it' },
    { id: 'verify', label: 'Install dependencies, type-check, test and build' },
    { id: 'showcase', label: 'Install dependencies, check, build and showcase the application' },
  ], 'skip');
  if (mode === 'skip') return;
  const { settings } = await loadSettings(context.root);
  const options = { ...settings.preferences.firstRun, schemaVersion: 1, mode, openBrowser: false };
  if (mode === 'showcase') {
    options.openBrowser = await choose(ui, 'Open showcase in the default browser?', [{ id: 'no', label: 'No — show the local URL' }, { id: 'yes', label: 'Yes — open after startup succeeds' }], settings.preferences.firstRun.openBrowser ? 'yes' : 'no') === 'yes';
    options.port = Number(await input(ui, 'Local showcase port', String(options.port)));
  }
  const plan = await firstRunPlan(context.root, options);
  const summary = [plan.app, ...plan.review, ...plan.steps.map(step => 'npm ' + step.args.join(' ')), 'Execution plan hash: ' + plan.planHash].join('\n');
  if (ui.rich) await ui.rich.review('Review first-run execution', [{ title: 'Commands and effects', body: summary }, { title: 'Package and scripts', body: JSON.stringify(plan.package, null, 2) }]);
  else ui.write(summary + '\nPackage and scripts:\n' + JSON.stringify(plan.package, null, 2) + '\n');
  if (plan.blockers.length) { ui.write(plan.blockers.join('\n') + '\nNo dependency or application process was started. Run node bin/app first-run after switching toolchains.\n'); return; }
  if (!await confirm(ui, 'Execute this reviewed first run?')) return;
  ui.write('Execution starts now. Ctrl+C stops the current process or closes a ready showcase.\n');
  const result = await executeFirstRun(plan, plan.planHash, { ...context, progress: message => ui.write(safe(message)) });
  const completion = `First run completed. Results: ${String(result.reportPath)}. ${mode === 'showcase' ? 'The local showcase is stopped. ' : ''}Use sketch to continue editing.\n`;
  ui.write(completion); return completion;
}
