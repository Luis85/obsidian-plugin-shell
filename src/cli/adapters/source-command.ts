/**
 * `node bin/app source list|graph|check` read the source manifest; `source check --fix|link|unlink` (and add, rename and
 * remove in source-scaffold.ts) build reviewed file plans on the shared plan engine: preview by default, written only
 * with --apply <planHash> or --yes. Modeled on `hosting show|set`.
 */
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { findCycle, importAliases, topologicalOrder, type SourceFinding, type SourceManifest } from '../domain/source-projects.ts';
import { dependents, linkProjects, unlinkProjects } from '../domain/source-projects-edit.ts';
import { requireThat, result, type Context, type Request, type Result } from './framework/contracts.ts';
import { derivedChanges, derivedEntries } from './source-derived.ts';
import { crossImports, sourceCheck } from './source-check.ts';
import { domain, readSourceState, repositoryAliases, sourceManifestFile } from './source-workspace.ts';
import { sourceAddPlan, sourceRemovePlan } from './source-scaffold.ts';
import { sourceRenamePlan } from './source-rename.ts';
import { declaredManifest, manifestEntry, selected, type SourcePlanned } from './source-plan-support.ts';

/** The runnable fix of a finding; a manual finding names its repair in the message instead. */
const fixCommand = (finding: SourceFinding): string | undefined => finding.next ?? (finding.fix === 'check --fix' ? 'source check --fix' : undefined);

function sourceList(state: Awaited<ReturnType<typeof readSourceState>>) {
  const aliases = importAliases(state.manifest);
  return { manifest: state.declared ? 'declared' : 'implicit', file: sourceManifestFile,
    projects: state.manifest.projects.map(project => ({ name: project.name, kind: project.kind, path: project.path, references: project.references,
      ...(project.platform ? { platform: project.platform } : {}), alias: Object.hasOwn(aliases, `#${project.name}/*`) ? `#${project.name}/*` : null,
      dependents: dependents(state.manifest, project.name) })),
    next: state.declared ? 'source check' : 'source check --fix (writes the manifest for the implicit project)' };
}
function sourceGraph(manifest: SourceManifest) {
  const cycle = findCycle(manifest);
  return { order: cycle ? null : topologicalOrder(manifest), cycle,
    adjacency: Object.fromEntries(manifest.projects.map(project => [project.name, [...project.references]])),
    dependents: Object.fromEntries(manifest.projects.map(project => [project.name, dependents(manifest, project.name)])) };
}
async function checkResult(request: Request, context: Context): Promise<Result> {
  const report = await sourceCheck(context.root);
  const findings = report.findings.map(item => { const next = fixCommand(item); return next ? { ...item, next } : item; });
  return { ...result(request.command, { manifest: report.declared ? 'declared' : 'missing', projects: report.manifest?.projects.length ?? 0,
    findings, fixable: findings.filter(item => item.fix === 'check --fix').length,
    next: findings.length ? (findings.some(item => item.fix === 'check --fix') ? 'source check --fix' : findings.find(item => item.next)?.next ?? 'source check, after the manual repairs listed') : null },
  findings.length ? 'blocked' : 'ok'),
  diagnostics: findings.map(item => ({ code: item.code, message: item.message, ...(item.next ? { next: item.next } : {}) })) };
}
/** Read-only `source list`, `source graph` and `source check` (without --fix). */
export async function sourceRead(request: Request, context: Context): Promise<Result> {
  if (request.command === 'source check') return checkResult(request, context);
  const state = await readSourceState(context.root);
  return result(request.command, request.command === 'source graph' ? { manifest: state.declared ? 'declared' : 'implicit', ...sourceGraph(state.manifest) } : sourceList(state));
}
export const isSourceRead = (request: Request): boolean =>
  ['source list', 'source graph'].includes(request.command) || (request.command === 'source check' && request.options.fix !== true);

async function fixPlan(_request: Request, context: Context): Promise<SourcePlanned> {
  const report = await sourceCheck(context.root);
  requireThat(report.manifest, 'SOURCE_MANIFEST_INVALID', `${sourceManifestFile} is invalid; repair it by hand (it is never overwritten), then source check.`);
  if (!report.declared) {
    requireThat(report.manifest.projects.length, 'SOURCE_NOTHING_TO_DECLARE', 'There is no src/plugin or src/main.ts to declare; create a project with source add <name> --kind <kind>.');
    return { plan: await createFilePlan(context.root, [manifestEntry(report.manifest)]), conflicts: [],
      summary: { manifest: 'implicit project declared', projects: report.manifest.projects, moved: 'nothing', next: 'source check' } };
  }
  const blocking = report.findings.filter(item => item.code === 'SOURCE_CYCLE' || item.code === 'SOURCE_UNKNOWN_REFERENCE');
  requireThat(!blocking.length, blocking[0]?.code ?? 'SOURCE_CYCLE', `${blocking.map(item => item.message).join(' ')} Derived files are regenerated only from a valid graph.`);
  const remaining = report.findings.filter(item => item.fix !== 'check --fix');
  return { plan: await createFilePlan(context.root, derivedEntries(report.changes)), conflicts: [],
    summary: { regenerated: report.changes.filter(change => change.content !== null).map(change => change.path),
      remaining: remaining.map(item => ({ code: item.code, project: item.project ?? null, message: item.message, next: fixCommand(item) ?? null })),
      next: remaining.length ? 'fix the remaining findings by hand, then source check' : 'source check' } };
}
function pair(request: Request, usage: string): [string, string] {
  const [from, to] = request.args;
  requireThat(from && to && request.args.length === 2, 'SOURCE_ARGUMENTS', `Supply both projects: ${usage}.`);
  return [from, to];
}
async function referencePlan(context: Context, manifest: SourceManifest, from: string, summary: Record<string, unknown>): Promise<SourcePlanned> {
  const path = manifest.projects.find(project => project.name === from)!.path;
  const changes = selected(await derivedChanges(context.root, manifest), file => file === `${path}/tsconfig.json` || file === `${path}/tests/tsconfig.json`);
  return { plan: await createFilePlan(context.root, [manifestEntry(manifest), ...changes.entries]), conflicts: [],
    summary: { ...summary, manual: changes.manual, otherDrift: changes.otherDrift, next: changes.otherDrift ? 'source check --fix (other derived files drift)' : 'source check' } };
}
async function linkPlan(request: Request, context: Context): Promise<SourcePlanned> {
  const [from, to] = pair(request, 'source link <from> <to>');
  const manifest = await domain(async () => linkProjects(await declaredManifest(context), from, to));
  return referencePlan(context, manifest, from, { link: { from, to } });
}
async function unlinkPlan(request: Request, context: Context): Promise<SourcePlanned> {
  const [from, to] = pair(request, 'source unlink <from> <to>');
  const current = await declaredManifest(context), manifest = await domain(() => unlinkProjects(current, from, to));
  const project = current.projects.find(item => item.name === from)!;
  const remaining = (await crossImports(context.root, current, project, await repositoryAliases(context.root, current))).filter(item => item.to === to);
  requireThat(!remaining.length, 'SOURCE_IMPORTS_REMAIN', `${from} still imports ${to}: ${remaining.slice(0, 5).map(item => `${item.file}:${item.line} (${item.specifier})`).join(', ')}${remaining.length > 5 ? ` and ${remaining.length - 5} more` : ''}. Remove those imports first.`);
  return referencePlan(context, manifest, from, { unlink: { from, to } });
}
/** Planners of the writing `source` commands, merged into the planning table. */
export const sourcePlanners: Record<string, (request: Request, context: Context) => Promise<SourcePlanned>> = {
  'source check': fixPlan, 'source link': linkPlan, 'source unlink': unlinkPlan,
  'source add': sourceAddPlan, 'source rename': sourceRenamePlan, 'source remove': sourceRemovePlan,
};
