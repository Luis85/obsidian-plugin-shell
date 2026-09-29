import { settingsSchema, defaultSettings } from '../domain/user-settings.ts';
import { requireSketch } from '../domain/errors.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import { applyPrepared } from './storage.ts';
import { loadSettings, settingsPlan } from './user-settings.ts';
import { angularSetupGuide, setupSchema, setupExample, setupStatus, projectSetupPlan } from './project-setup.ts';
import { intakePrds } from './prd-intake.ts';
import type { CommandContext } from './commands.ts';
export async function setupCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  requireSketch(!['project', 'out', 'guide', 'kind', 'preset', 'framework', 'targets'].some(key => args.flags[key]), 'SETUP_OPTION', 'Configure setup paths in settings or the setup request; the target is Angular webapp.');
  const action = args.action;
  if (args.command === 'settings') {
    if (action === 'schema') return { schema: settingsSchema, defaults: defaultSettings };
    if (action === 'show') { const loaded = await loadSettings(context.root); return { settings: loaded.settings, persisted: loaded.content !== null }; }
    requireSketch(!action, 'SETTINGS_COMMAND', 'Use settings, settings show or settings schema.');
    return applyPrepared(await settingsPlan(context.root, await input()), option(args, 'apply') || undefined, context.signal);
  }
  if (action === 'schema') return { schema: setupSchema, example: setupExample };
  if (action === 'guide') return angularSetupGuide();
  if (action === 'status') return setupStatus(context.root);
  if (action === 'scan') {
    const { settings } = await loadSettings(context.root);
    const intake = await intakePrds(context.root, settings, { mode: 'scan' });
    return { prds: intake.prds, ignoredMarkdown: intake.ignored };
  }
  requireSketch(!action || action === 'validate', 'SETUP_COMMAND', 'Use project-setup, schema, guide, status, scan or validate.');
  requireSketch(action !== 'validate' || !args.flags.apply, 'SETUP_OPTION', 'Validation never applies a plan.');
  const plan = await projectSetupPlan(context, await input());
  if (action === 'validate') return { valid: true, ...(await applyPrepared(plan)), status: 'validated' };
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
/** Invocation flags override saved defaults without persisting those overrides. */
export async function configuredArguments(args: Arguments, root: string): Promise<Arguments> {
  if (!['sketch', 'prototype', 'studio'].includes(args.command) || args.flags.help || args.action === 'schema' || args.action === 'guide') return args;
  const loaded = await loadSettings(root);
  if (loaded.content === null) return args;
  const flags = { ...args.flags };
  flags.project ??= loaded.settings.paths.project;
  if (args.command === 'prototype') flags.out ??= loaded.settings.paths.prototypes;
  if (args.command === 'studio' || (args.command === 'sketch' && (args.action === 'generate' || !args.action))) flags.out ??= loaded.settings.paths.app;
  return { ...args, flags };
}
