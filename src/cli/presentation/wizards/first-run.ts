import { firstRunPlan } from '../../adapters/first-run-plan.ts';
import { executeFirstRun } from '../../adapters/first-run.ts';
import { loadSettings } from '../../adapters/user-settings.ts';
import { safe } from '../prompts.ts';
import type { FormValues } from '../../domain/form-model.ts';
import type { WizardModule } from './module.ts';
type Plan = Awaited<ReturnType<typeof firstRunPlan>>;
/** Actions behind configs/wizards/first-run.json. Blockers end the wizard before any process starts. */
export const firstRunModule: WizardModule = {
  actions: {
    'first-run.preferences': async ({ state, options }) => {
      const { settings } = await loadSettings(options.root);
      const preferences = settings.preferences.firstRun;
      state.options = { ...preferences, schemaVersion: 1, mode: state.mode, openBrowser: state.mode === 'showcase' && preferences.openBrowser };
    },
    'first-run.plan': async ({ ui, state, options }) => {
      const plan = await firstRunPlan(options.root, state.options as FormValues);
      const summary = [plan.app, ...plan.review, ...plan.steps.map(step => 'npm ' + step.args.join(' ')), 'Execution plan hash: ' + plan.planHash].join('\n');
      if (ui.rich) await ui.rich.review('Review first-run execution', [{ title: 'Commands and effects', body: summary }, { title: 'Package and scripts', body: JSON.stringify(plan.package, null, 2) }]);
      else ui.write(summary + '\nPackage and scripts:\n' + JSON.stringify(plan.package, null, 2) + '\n');
      if (plan.blockers.length) {
        ui.write(plan.blockers.join('\n') + '\nNo dependency or application process was started. Run node bin/app first-run after switching toolchains.\n');
        return { end: true };
      }
      state.plan = plan;
    },
    'first-run.execute': async ({ ui, state, options }) => {
      const plan = state.plan as Plan;
      ui.write('Execution starts now. Ctrl+C stops the current process or closes a ready showcase.\n');
      const result = await executeFirstRun(plan, plan.planHash, { ...options, progress: message => ui.write(safe(message)) });
      const completion = `First run completed. Results: ${String(result.reportPath)}. ${state.mode === 'showcase' ? 'The local showcase is stopped. ' : ''}Use sketch to continue editing.\n`;
      ui.write(completion);
      return { end: true, completion };
    },
  },
};
