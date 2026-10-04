/** `node bin/app design`: prepare, sync and inspect per-prototype Claude Design folders. Writes need --apply <planHash>. */
import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { applyPrepared } from './storage.ts';
import { designFolderPlan, designFolderStatus } from './design-folder.ts';
interface DesignContext { root: string; frameworkRoot: string; signal?: AbortSignal }
export async function designCommand(args: Arguments, context: DesignContext): Promise<Record<string, unknown>> {
  const name = option(args, 'name') || undefined;
  if (args.action === 'status' || !args.action) {
    requireSketch(!args.flags.apply, 'DESIGN_OPTION', 'design status is read-only.');
    return designFolderStatus(context.root, context.frameworkRoot, name);
  }
  requireSketch(args.action === 'prepare' || args.action === 'sync', 'MAKER_COMMAND', 'Use design status, design prepare or design sync.');
  requireSketch(name, 'DESIGN_NAME', 'Supply --name <prototype-slug>. design status lists prepared folders.');
  const plan = await designFolderPlan({ root: context.root, frameworkRoot: context.frameworkRoot, name, mode: args.action,
    project: option(args, 'project') || undefined, package: option(args, 'package') || undefined, signal: context.signal });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
