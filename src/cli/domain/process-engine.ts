import { evaluateRule, missingRulePaths } from './process-rules.ts';
import type { ProcessDefinition, ProcessRule, ProcessSeverity, ProcessStep, ProcessTransition } from './process.ts';
/** Walking one process instance: rule outcomes per step, transition choice and the audit trail. Pure and shared by simulate and run. */
export type ProcessRuleOutcome = 'passed' | 'violated' | 'acknowledged' | 'not-applicable';
export interface ProcessRuleResult { rule: string; severity: ProcessSeverity; statement: string; outcome: ProcessRuleOutcome; rationale?: string; missing?: string[] }
export interface ProcessAssessment { results: ProcessRuleResult[]; blocking: ProcessRuleResult[]; pending: ProcessRuleResult[] }
export interface ProcessTrailEntry { step: string; title: string; actor: string; rules: ProcessRuleResult[]; transition?: { to: string; label?: string }; issues?: string[] }
export type ProcessRunStatus = 'completed' | 'blocked' | 'needs-acknowledgement' | 'invalid-input' | 'no-transition' | 'loop-limit' | 'stopped';
export interface ProcessRunSummary {
  schemaVersion: 1; process: string; version: number; status: ProcessRunStatus; message: string;
  outcome?: string; stoppedAt?: string; trail: ProcessTrailEntry[]; data: unknown;
}
/** At most this many step visits per instance, so a rework loop driven by unchanged data always ends. */
export const processVisitLimit = 200;
/** Rules scoped to the step plus process-wide rules (no `steps`), in definition order. */
export function processRulesFor(definition: ProcessDefinition, step: string): ProcessRule[] {
  return definition.rules.filter(rule => !rule.steps || rule.steps.includes(step));
}
/**
 * A rule applies unless its `when` is decidedly false (unknown applies: fail closed); an applicable rule passes only
 * when `require` is decidedly true, so missing data violates it and is named in `missing`.
 */
function assessRule(rule: ProcessRule, data: unknown, acknowledged: ReadonlySet<string>): ProcessRuleResult {
  const base = { rule: rule.id, severity: rule.severity, statement: rule.statement, ...rule.rationale ? { rationale: rule.rationale } : {} };
  if (rule.when && evaluateRule(rule.when, data) === false) return { ...base, outcome: 'not-applicable' };
  if (evaluateRule(rule.require, data) === true) return { ...base, outcome: 'passed' };
  const missing = missingRulePaths(rule.require, data);
  const outcome = rule.severity === 'warn' && acknowledged.has(rule.id) ? 'acknowledged' : 'violated';
  return { ...base, outcome, ...missing.length ? { missing } : {} };
}
export function assessStep(definition: ProcessDefinition, step: string, data: unknown, acknowledged: ReadonlySet<string>): ProcessAssessment {
  const results = processRulesFor(definition, step).map(rule => assessRule(rule, data, acknowledged));
  const violated = (severity: ProcessSeverity) => results.filter(item => item.severity === severity && item.outcome === 'violated');
  return { results, blocking: violated('block'), pending: violated('warn') };
}
/** The first transition whose condition is decidedly true; an unknown condition is never taken. */
export function nextTransition(step: ProcessStep, data: unknown): ProcessTransition | undefined {
  return step.next?.find(transition => !transition.when || evaluateRule(transition.when, data) === true);
}
/** Human explanation of a rule result, used by the terminal run and agent output alike. */
export function explainRule(result: ProcessRuleResult): string {
  const missing = result.missing?.length ? ` Missing data: ${result.missing.join(', ')}.` : '';
  return `${result.severity.toUpperCase()} ${result.rule}: ${result.statement}${result.rationale ? ` Why: ${result.rationale}` : ''}${missing}`;
}
export function stepById(definition: ProcessDefinition, id: string): ProcessStep {
  return definition.steps.find(step => step.id === id)!;
}
export function trailEntry(step: ProcessStep, rules: ProcessRuleResult[], transition?: ProcessTransition, issues?: string[]): ProcessTrailEntry {
  return { step: step.id, title: step.title, actor: step.actor, rules,
    ...transition ? { transition: { to: transition.to, ...transition.label ? { label: transition.label } : {} } } : {}, ...issues?.length ? { issues } : {} };
}
export function runSummary(definition: ProcessDefinition, status: ProcessRunStatus, trail: ProcessTrailEntry[], data: unknown, detail: { message: string; outcome?: string; stoppedAt?: string }): ProcessRunSummary {
  return { schemaVersion: 1, process: definition.id, version: definition.version, status, message: detail.message,
    ...detail.outcome ? { outcome: detail.outcome } : {}, ...detail.stoppedAt ? { stoppedAt: detail.stoppedAt } : {}, trail, data };
}
export interface ProcessSimulation { data: unknown; acknowledge: ReadonlySet<string>; inputIssues: (step: ProcessStep, data: unknown) => string[] }
type StepVerdict = { status: ProcessRunStatus; message: string; outcome?: string } | { next: ProcessTransition };
function verdict(step: ProcessStep, assessment: ProcessAssessment, issues: string[], data: unknown): StepVerdict {
  if (issues.length) return { status: 'invalid-input', message: `Step ${step.id} input is invalid: ${issues.join(' ')}` };
  if (assessment.blocking.length) return { status: 'blocked', message: assessment.blocking.map(explainRule).join('\n') };
  if (assessment.pending.length) return { status: 'needs-acknowledgement', message: `Acknowledge to continue: ${assessment.pending.map(explainRule).join('\n')}` };
  if (step.terminal) return { status: 'completed', message: `Completed at ${step.id}${step.outcome ? ` with outcome ${step.outcome}` : ''}.`, ...step.outcome ? { outcome: step.outcome } : {} };
  const next = nextTransition(step, data);
  return next ? { next } : { status: 'no-transition', message: `No transition of ${step.id} applies to the current data.` };
}
/** Non-interactive walk for agents: the same rules and transitions as `process run`, driven by supplied data and acknowledgements. */
export function simulateProcess(definition: ProcessDefinition, simulation: ProcessSimulation): ProcessRunSummary {
  const trail: ProcessTrailEntry[] = [];
  let step = definition.steps[0]!;
  for (let visit = 0; visit < processVisitLimit; visit++) {
    const issues = simulation.inputIssues(step, simulation.data), assessment = assessStep(definition, step.id, simulation.data, simulation.acknowledge);
    const result = verdict(step, assessment, issues, simulation.data);
    trail.push(trailEntry(step, assessment.results, 'next' in result ? result.next : undefined, issues));
    if (!('next' in result)) return runSummary(definition, result.status, trail, simulation.data, { message: result.message, ...result.outcome ? { outcome: result.outcome } : {}, ...result.status === 'completed' ? {} : { stoppedAt: step.id } });
    step = stepById(definition, result.next.to);
  }
  return runSummary(definition, 'loop-limit', trail, simulation.data, { message: `Stopped after ${processVisitLimit} step visits; the data never leaves a loop.`, stoppedAt: step.id });
}
