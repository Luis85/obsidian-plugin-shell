import { firstRunDefaults, firstRunSchema } from '../domain/first-run.ts';
import { requireSketch } from '../domain/errors.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import { loadSettings } from './user-settings.ts';
import { firstRunPlan, firstRunReport } from './first-run-plan.ts';
import { executeFirstRun } from './first-run.ts';
import type { CommandContext } from './commands.ts';
export async function firstRunCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>) {
  requireSketch(!['project', 'out', 'guide', 'kind', 'starter', 'config'].some(key => args.flags[key]), 'FIRST_RUN_OPTION', 'First run uses the saved application path. Configure options with a first-run JSON request.');
  if (['schema', 'status'].includes(args.action)) requireSketch(!args.flags.input && !args.flags.apply, 'FIRST_RUN_OPTION', 'Discovery and status are read-only.');
  if (args.action === 'schema') return { schema: firstRunSchema, defaults: firstRunDefaults, example: { schemaVersion: 1, mode: 'showcase', openBrowser: false } };
  if (args.action === 'status') {
    const { settings } = await loadSettings(context.root);
    return { report: (await firstRunReport(context.root, settings.paths.firstRunReport)).report, observed: 'last-recorded-result-not-live-acceptance', reportPath: settings.paths.firstRunReport };
  }
  requireSketch(!args.action, 'FIRST_RUN_COMMAND', 'Use first-run, first-run schema or first-run status.');
  const plan = await firstRunPlan(context.root, await input());
  return executeFirstRun(plan, option(args, 'apply') || undefined, context);
}
