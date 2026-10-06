import { reportSchemaId, type AdoptionReport } from './contracts.ts';
import { phaseFive, phaseFour, phaseSix } from './plan-delivery.ts';
import { currentState } from './plan-current-state.ts';
import { gates, questions, risks, rollback, untouched } from './plan-governance.ts';
import { bullets, code, document, plain } from './plan-markdown.ts';
import { phaseOne, phaseThree, phaseTwo, phaseZero } from './plan-phases.ts';
import { recommend, type Recommendation, type StrategyOption } from './strategy.ts';

const recorded = (report: AdoptionReport): string => report.recordedAt ? code(report.recordedAt) : 'computed inline when this plan was generated (not stored)';
function header(report: AdoptionReport, recommendation: Recommendation): string[][] {
  return [[`# Workbench adoption plan: ${plain(report.target.name)}`],
    ['> **This is a plan, not a completed integration.** Generating this file changed nothing else in the project. Workbench release, qualification and publication are separate decisions that this plan neither makes nor implies; passing any gate below is evidence for that gate only.'],
    bullets([`Report schema: ${code(reportSchemaId)}`, `Report recorded: ${recorded(report)}`, `Recommended strategy: **${recommendation.primary}**`, 'Status: draft for the owner; refine with project knowledge before approving any phase'])];
}
function summary(report: AdoptionReport, recommendation: Recommendation): string[][] {
  const counts = { block: 0, warn: 0, info: 0 };
  for (const item of report.findings) counts[item.severity]++;
  const blockers = report.findings.filter(item => item.severity === 'block');
  return [['## 1. Summary and recommendation', '', `**${plain(recommendation.headline)}**`],
    bullets([`Findings: ${counts.block} blocking, ${counts.warn} warnings, ${counts.info} informational (section 2).`, 'Start with phases 0 to 3: they add files only under the paths in section 6 and never edit legacy source.', 'Every phase is previewed first and written only after approval; the legacy code is not edited until phase 4, and then in at most one router file and one flag entry.',
      ...recommendation.options.filter(option => option.id === recommendation.primary).flatMap(option => option.reasons.map(plain))]),
    ...(blockers.length ? [['Blocking findings (they rule out the options they name; they do not stop design-only use):'], bullets(blockers.map(item => `${code(item.id)}: ${plain(item.message)}`))] : [])];
}
const fitText = { recommended: 'recommended', possible: 'possible', 'not-advised': 'not advised for this project' } as const;
function option(item: StrategyOption): string[] {
  return [`### Option ${item.id}: ${item.title} (${fitText[item.fit]})`, '', plain(item.summary), '', 'Why:', ...bullets(item.reasons.map(plain)), '', 'Limits:', ...bullets(item.limits.map(plain))];
}
function strategies(recommendation: Recommendation): string[][] {
  return [['## 3. Integration strategy options', '', `Recommended: **option ${recommendation.primary}**. The phases below are written for it; the other options reuse phases 0 to 3 unchanged.`], ...recommendation.options.map(option)];
}
/** The whole integration plan as Markdown. Deterministic: the same report always yields the same bytes. */
export function renderPlan(report: AdoptionReport): string {
  const recommendation = recommend(report);
  return document([
    ...header(report, recommendation), ...summary(report, recommendation), ...currentState(report), ...strategies(recommendation),
    ['## 4. Phased steps', '', 'Each phase lists exact commands, the files it adds or changes and acceptance checks. Commands prefixed with the kit path need Node for the kit; `<planHash>` is printed by the preview of the same command.'],
    ...phaseZero(report), ...phaseOne(report), ...phaseTwo(report), ...phaseThree(report), ...phaseFour(report, recommendation), ...phaseFive(report), ...phaseSix(report, recommendation),
    ...risks(report), ...untouched(report), ...gates(report), ...rollback(), ...questions(report, recommendation),
  ]);
}
