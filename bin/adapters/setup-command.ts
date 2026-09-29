import { loadSetupCheckpoint, setupCheckpointPlan, resumeSetupCheckpoint, discardSetupCheckpointPlan } from './setup-checkpoint.ts';
import { settingsMigrationPlan } from './settings-migration.ts';
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
  if (args.command === 'project-setup' && ['checkpoint', 'resume', 'checkpoint-status', 'discard-checkpoint'].includes(action)) return checkpointCommand(args, context, input);
  if (args.command === 'settings') return settingsCommand(args, context, input);
  const readers: Record<string, () => Promise<Record<string, unknown>> | Record<string, unknown>> = {
    schema: () => ({ schema: setupSchema, example: setupExample, checkpointSchema: { ...setupSchema, title: 'Partial setup answers', required: ['schemaVersion'] } }),
    guide: angularSetupGuide, status: () => setupStatus(context.root), scan: () => scanPrds(context.root),
  };
  if (Object.hasOwn(readers, action)) return readers[action]!();
  requireSketch(!action || action === 'validate', 'SETUP_COMMAND', 'Use project-setup, schema, guide, status, scan or validate.');
  requireSketch(action !== 'validate' || !args.flags.apply, 'SETUP_OPTION', 'Validation never applies a plan.');
  const plan = await projectSetupPlan(context, await input());
  if (action === 'validate') return { valid: true, ...(await applyPrepared(plan)), status: 'validated' };
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
async function settingsCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  const action = args.action;
    if (action === 'schema') return { schema: settingsSchema, defaults: defaultSettings };
    if (action === 'migrate') return applyPrepared(await settingsMigrationPlan(context.root, await input()), option(args, 'apply') || undefined, context.signal);
    if (action === 'show') { const loaded = await loadSettings(context.root); return { settings: loaded.settings, persisted: loaded.content !== null }; }
    requireSketch(!action, 'SETTINGS_COMMAND', 'Use settings, settings show or settings schema.');
    return applyPrepared(await settingsPlan(context.root, await input()), option(args, 'apply') || undefined, context.signal);

}
/** Invocation flags override saved defaults without persisting those overrides. */
export async function configuredArguments(args: Arguments, root: string): Promise<Arguments> {
  if (!['sketch', 'prototype', 'studio'].includes(args.command)) return args;
  if (args.flags.help || ['schema', 'guide'].includes(args.action)) return args;
  const loaded = await loadSettings(root);
  if (loaded.content === null) return args;
  const flags: Arguments['flags'] = { project: loaded.settings.paths.project, ...args.flags };
  const folder = configuredOutput(args);
  if (folder) flags.out ??= loaded.settings.paths[folder];
  return { ...args, flags };
}
function configuredOutput(args: Arguments): 'app' | 'prototypes' | undefined {
  if (args.command === 'prototype') return 'prototypes';
  if (args.command === 'studio') return 'app';
  if (args.command === 'sketch' && ['', 'generate'].includes(args.action)) return 'app';
}

async function checkpointCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  if (args.action === 'checkpoint') return applyPrepared(await setupCheckpointPlan(context.root, await input()), option(args, 'apply') || undefined, context.signal);
  if (args.action === 'discard-checkpoint') {
    requireSketch(!args.flags.input, 'CHECKPOINT_OPTION', 'Discard uses the saved checkpoint, not --input.');
    return applyPrepared(await discardSetupCheckpointPlan(context.root), option(args, 'apply') || undefined, context.signal);
  }
  requireSketch(!args.flags.apply && !args.flags.input, 'CHECKPOINT_OPTION', 'Checkpoint inspection/resume is read-only and uses the saved file.');
  if (args.action === 'checkpoint-status') return { checkpoint: (await loadSetupCheckpoint(context.root)).checkpoint };
  return { request: await resumeSetupCheckpoint(context.root), approved: false, next: 'Review the request, then project-setup --input <request>. Prototype design agreement must be renewed.' };
}

async function scanPrds(root: string) {
  const { settings } = await loadSettings(root);
  const intake = await intakePrds(root, settings, { mode: 'scan' });
  return { prds: intake.prds, ignoredMarkdown: intake.ignored };
}
