import { SketchError } from '#shared/contracts/sketch-errors.ts';
import { selectView, viewIssues, type BaseView } from '../../domain/obsidian-base.ts';
import { collectRecords } from '../../domain/base-collection.ts';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';

/**
 * `base views` lists a `.base` file's views and whether each can be evaluated exactly; `base ingest` applies one view
 * to the vault's Markdown notes and returns a file-collection configuration with its records, ready for fixtures.
 * Both are read-only: nothing is written, and unsupported Bases features are refused instead of approximated.
 */
function describeView(base: Parameters<typeof viewIssues>[0], view: BaseView) {
  const issues = viewIssues(base, view);
  return { name: view.name, type: view.type, columns: view.order.length ? view.order : ['file.name'], sort: view.sort, groupBy: view.groupBy,
    limit: view.limit, supported: issues.length === 0, issues, ignored: view.ignored };
}
async function run(request: Request, context: Context): Promise<Result> {
  // Loaded on use: the YAML parser is a project dependency, and the CLI must start before `npm ci` in a new project.
  const { loadBase, resolveVault, scanVault } = await import('../obsidian-base.ts');
  const vault = await resolveVault(context.root, stringOption(request.options, 'vault'));
  const loaded = await loadBase(context.root, vault, request.args[0]);
  const base = loaded.definition;
  if (request.command === 'base views') {
    return result(request.command, { base: loaded.source, formulas: [...base.formulas.keys()], views: base.views.map(view => describeView(base, view)), ignored: base.ignored });
  }
  const view = selectView(base, stringOption(request.options, 'view'));
  const scan = await scanVault(vault, base);
  const collected = collectRecords(base, view, scan.notes, loaded.source);
  return result(request.command, {
    collection: collected.collection, records: collected.records,
    summary: { ...scan.scanned, matched: collected.matched, returned: collected.records.length }, skipped: scan.skipped,
  });
}
export async function baseOperation(request: Request, context: Context): Promise<Result> {
  try { return await run(request, context); } catch (error) {
    if (error instanceof SketchError) throw new OperationError(error.code, error.message);
    throw error;
  }
}
