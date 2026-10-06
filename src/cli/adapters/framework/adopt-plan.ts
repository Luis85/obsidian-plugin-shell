import { join } from 'node:path';
import type { AdoptionReport } from '../../domain/adoption/contracts.ts';
import { planPath, skillName, skillRoots } from '../../domain/adoption/paths.ts';
import { renderPlan } from '../../domain/adoption/plan-render.ts';
import { parseReport } from '../../domain/adoption/report-codec.ts';
import { recommend } from '../../domain/adoption/strategy.ts';
import { parseJsonData } from '../../../../scripts/contracts/json-data.ts';
import { createFilePlan, type FilePlan, type FilePlanEntry } from '../../../../scripts/shared/file-plan.ts';
import { analyzeTarget, translating } from './adopt-operation.ts';
import { exists, hash, readBounded } from './files.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
import { resolveTemplateRoot } from '../template-root.ts';

interface Planned { plan: FilePlan; summary: unknown; conflicts: string[] }
const planMarker = '# Workbench adoption plan:';

async function loadReport(request: Request, context: Context): Promise<{ report: AdoptionReport; source: string }> {
  const file = stringOption(request.options, 'report');
  if (file === undefined) return { report: await analyzeTarget(context, null), source: 'inline-analysis' };
  const bytes = await readBounded(file, 4_000_000);
  return { report: parseReport(parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(bytes))), source: 'report-file' };
}
function outputPath(request: Request): string {
  const out = stringOption(request.options, 'out') ?? planPath;
  requireThat(/\.md$/i.test(out), 'ADOPT_PLAN_OUT', 'The plan output must be a Markdown file (*.md) inside the target.');
  return out;
}
/** An existing different file is a conflict; only an earlier adoption plan can be replaced, and only with --replace. */
async function replacementConflicts(plan: FilePlan, context: Context, replace: boolean): Promise<string[]> {
  const change = plan.changes[0]!;
  if (change.status !== 'update') return [];
  const current = (await readBounded(join(context.root, change.path), 4_000_000)).toString('utf8');
  if (!current.startsWith(planMarker)) return [`${change.path} exists and is not an adoption plan; it is never replaced. Choose another --out path.`];
  return replace ? [] : [`${change.path} already holds a different adoption plan; review the preview and pass --replace to replace it.`];
}
function counts(report: AdoptionReport): Record<string, number> {
  const found = { block: 0, warn: 0, info: 0 };
  for (const item of report.findings) found[item.severity]++;
  return found;
}
export async function adoptPlanPlan(request: Request, context: Context): Promise<Planned> {
  return translating(async () => {
    const { report, source } = await loadReport(request, context);
    const markdown = renderPlan(report), output = outputPath(request);
    const plan = await createFilePlan(context.root, [{ path: output, content: markdown }]);
    const conflicts = await replacementConflicts(plan, context, request.options.replace === true);
    return { plan, conflicts, summary: { target: report.target.name, output, source, recordedAt: report.recordedAt, strategy: recommend(report).primary, findings: counts(report),
      markdownSha256: hash(markdown), bytes: Buffer.byteLength(markdown), notPerformed: 'A plan only: no integration step has run, nothing outside this file was written, and release/qualification are separate.', markdown } };
  });
}
const skillTemplates: ReadonlyArray<[string, string]> = skillRoots.map((root, index) => [`${root}/${skillName}/SKILL.md`, `templates/adoption/${index === 0 ? 'claude' : 'agents'}-skill/SKILL.md`]);
export async function adoptSkillPlan(_request: Request, context: Context): Promise<Planned> {
  const base = await resolveTemplateRoot(context.frameworkRoot);
  const entries: FilePlanEntry[] = [];
  for (const [target, template] of skillTemplates) {
    requireThat(await exists(join(base, template)), 'ADOPT_TEMPLATE_MISSING', `The kit does not contain ${template}.`);
    entries.push({ path: target, content: (await readBounded(join(base, template), 65536)).toString('utf8') });
  }
  const plan = await createFilePlan(context.root, entries);
  const conflicts = plan.changes.filter(change => change.status === 'update').map(change => `${change.path} already exists with different content; it is never overwritten.`);
  return { plan, conflicts, summary: { skill: skillName, files: entries.map(entry => entry.path), overwrite: 'never', notPerformed: 'Only the skill files are written; no project file, instruction or setting is changed.' } };
}
