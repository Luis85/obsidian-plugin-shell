import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { analyzeInventory } from '../../application/adoption/analyze.ts';
import { AdoptionError, type AdoptionReport } from '../../domain/adoption/contracts.ts';
import { documentationDirectory } from '../../domain/adoption/paths.ts';
import { serializeJson } from '#shared/contracts/serialization.ts';
import { applyFilePlan, createFilePlan } from '#shared/platform/file-plan.ts';
import { realpath } from 'node:fs/promises';
import { readGit } from './adopt-git.ts';
import { scanProject } from './adopt-scan.ts';
import { readTargets } from './adopt-targets.ts';
import { hash } from './files.ts';
import { OperationError, requireThat, result, stringOption, type Context, type Request, type Result } from './contracts.ts';

/** Domain refusals keep their stable code on the operation protocol. */
export async function translating<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) {
    if (error instanceof AdoptionError) throw new OperationError(error.code, error.message);
    throw error;
  }
}
/** Read-only analysis of the context root. `recordedAt` is null for an inline analysis that is never stored. */
export async function analyzeTarget(context: Context, recordedAt: string | null): Promise<AdoptionReport> {
  const scanned = await scanProject(context.root, undefined, context.signal);
  const git = await readGit(context.root, context.signal);
  const inventory = { name: basename(context.root), files: scanned.files, texts: scanned.texts, git, scan: scanned.scan };
  return analyzeInventory(inventory, await readTargets(context.frameworkRoot), recordedAt);
}
interface Destination { root: string; path: string }
/** A report may be written outside the target, or inside it only under docs/workbench. */
async function destination(context: Context, requested: string): Promise<Destination> {
  const absolute = resolve(context.root, requested);
  const inside = relative(context.root, absolute);
  requireThat(inside !== '', 'ADOPT_OUT_PATH', '--out must name a file, not the target folder.');
  if (inside === '..' || inside.startsWith('..' + sep) || isAbsolute(inside)) {
    return { root: await realpath(dirname(absolute)).catch(() => { throw new OperationError('ADOPT_OUT_PARENT', 'The folder of --out must already exist.'); }), path: basename(absolute) };
  }
  const posix = inside.split(sep).join('/');
  requireThat(posix.startsWith(documentationDirectory + '/') && posix.endsWith('.json'), 'ADOPT_OUT_INSIDE_TARGET', `Inside the target a report may only be written to ${documentationDirectory}/*.json; choose a path outside the project to leave it untouched.`);
  return { root: context.root, path: posix };
}
async function writeReport(context: Context, requested: string, report: AdoptionReport, replace: boolean): Promise<{ path: string; sha256: string }> {
  const place = await destination(context, requested);
  const content = serializeJson(report);
  const plan = await createFilePlan(place.root, [{ path: place.path, content }]);
  requireThat(replace || !plan.changes.some(change => change.status === 'update'), 'ADOPT_OUT_EXISTS', 'Refusing to replace an existing different file; pass --replace to overwrite a previous report.');
  await applyFilePlan(plan);
  return { path: resolve(place.root, place.path), sha256: hash(content) };
}
export async function adoptAnalyze(request: Request, context: Context): Promise<Result> {
  return translating(async () => {
    const out = stringOption(request.options, 'out');
    requireThat(!request.options['dry-run'] || out === undefined, 'ADOPT_DRY_RUN_OUT', '--dry-run cannot be combined with --out; analysis alone never writes.');
    const report = await analyzeTarget(context, new Date().toISOString());
    const written = out === undefined ? null : await writeReport(context, out, report, request.options.replace === true);
    return result(request.command, { report, written });
  });
}
