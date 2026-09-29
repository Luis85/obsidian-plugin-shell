import type { Arguments, CommandContext } from './commands.ts';
import { option } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { loadProjectCatalog, loadProjectGuide, projectInput, projectCreatePlan } from './project-create.ts';
import { applyPrepared } from './storage.ts';
/** Compatibility for reviewed PR43 requests; never silently rewrite their selected runtime. */
export async function legacyProjectCommand(args: Arguments, context: CommandContext, input: unknown): Promise<Record<string, unknown>> {
  const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
  if (args.action === 'validate') {
    requireSketch(!args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Validation never writes; omit --apply and --out.');
    return projectInput(catalog, guide, input);
  }
  const plan = await projectCreatePlan({ ...context, catalog, guide, input, out: option(args, 'out', 'projects/prepared-project') });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
