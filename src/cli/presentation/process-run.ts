import { getPath, setPath, type FormValues } from '../domain/form-model.ts';
import { assessStep, explainRule, nextTransition, processVisitLimit, runSummary, stepById, trailEntry, type ProcessRunStatus, type ProcessRunSummary, type ProcessTrailEntry } from '../domain/process-engine.ts';
import type { ProcessDefinition, ProcessStep } from '../domain/process.ts';
import { formDefinition, runFields, runForm } from './form-runner.ts';
import { choose, confirm, input } from '#tui/prompts.ts';
import type { ActionContext } from './wizard-runner.ts';
/**
 * `process run`: walk one instance through its steps in a terminal. Inputs use the form engine; block rules stop the
 * transition with an explanation, warn rules need an explicit acknowledgement, info rules are recorded. Every
 * assessment, including refused ones, enters the audit trail.
 */
interface Walk { context: ActionContext; definition: ProcessDefinition; data: FormValues; acknowledged: Set<string>; trail: ProcessTrailEntry[] }
type Decision = 'continue' | 'retry' | 'stop';
const roleTitle = (definition: ProcessDefinition, id: string) => definition.roles.find(role => role.id === id)?.title ?? id;
async function collect(walk: Walk, step: ProcessStep): Promise<boolean> {
  const { ui, env } = walk.context;
  if (!step.form && !step.fields) return step.outputs?.length ? true : confirm(ui, `Mark "${step.title}" as done?`);
  const value = step.bind ? structuredClone((getPath(walk.data, step.bind) ?? {}) as FormValues) : walk.data;
  const result = step.form ? await runForm(ui, formDefinition(env, step.form), value, env) : (await runFields(ui, step.fields!, value, env), value);
  if (step.bind) setPath(walk.data, step.bind, result);
  return true;
}
/** Declared outputs produced outside a form are asked as JSON (or plain text) values. */
async function outputs(walk: Walk, step: ProcessStep): Promise<void> {
  for (const path of step.outputs ?? []) if (getPath(walk.data, path) === undefined) {
    const raw = await input(walk.context.ui, `Value of ${path} (JSON or text)`);
    let value: unknown = raw;
    try { value = JSON.parse(raw); } catch { value = raw; }
    setPath(walk.data, path, value);
  }
}
const nextMove = (walk: Walk, question: string) => choose(walk.context.ui, question,
  [{ id: 'retry', label: 'Change the answers of this step' }, { id: 'stop', label: 'Stop the run here' }], 'retry');
async function settle(walk: Walk, step: ProcessStep): Promise<Decision> {
  const { ui } = walk.context, assessment = assessStep(walk.definition, step.id, walk.data, walk.acknowledged);
  for (const result of assessment.results.filter(item => item.severity === 'info' && item.outcome === 'violated')) ui.write(`${explainRule(result)} (recorded)\n`);
  if (assessment.blocking.length) {
    ui.write(`\nThis transition is blocked:\n${assessment.blocking.map(explainRule).join('\n')}\n`);
    return await nextMove(walk, 'The process cannot continue until the rule holds.') === 'retry' ? 'retry' : 'stop';
  }
  for (const pending of assessment.pending) {
    ui.write(`\n${explainRule(pending)}\n`);
    if (await confirm(ui, `Acknowledge warning ${pending.rule} and continue?`)) walk.acknowledged.add(pending.rule);
    else return await nextMove(walk, 'The warning was not acknowledged.') === 'retry' ? 'retry' : 'stop';
  }
  return 'continue';
}
function finish(walk: Walk, status: ProcessRunStatus, step: ProcessStep, message: string): ProcessRunSummary {
  walk.context.ui.write(`\n${message}\n`);
  return runSummary(walk.definition, status, walk.trail, walk.data, { message, ...status === 'completed' ? {} : { stoppedAt: step.id }, ...status === 'completed' && step.outcome ? { outcome: step.outcome } : {} });
}
function stopped(walk: Walk, step: ProcessStep): ProcessRunSummary {
  const assessment = assessStep(walk.definition, step.id, walk.data, walk.acknowledged);
  return finish(walk, assessment.blocking.length ? 'blocked' : 'needs-acknowledgement', step, `Stopped at ${step.title}; the audit trail records why.`);
}
/** One visit: collect, assess and either retry, stop, finish or move on. Returns the next step or a summary. */
async function visit(walk: Walk, step: ProcessStep): Promise<ProcessStep | ProcessRunSummary> {
  walk.context.ui.write(`\nStep: ${step.title} (${roleTitle(walk.definition, step.actor)})${step.description ? `\n${step.description}` : ''}\n`);
  if (!await collect(walk, step)) return finish(walk, 'stopped', step, `Stopped before ${step.title} was done.`);
  await outputs(walk, step);
  const decision = await settle(walk, step), results = assessStep(walk.definition, step.id, walk.data, walk.acknowledged).results;
  if (decision !== 'continue') { walk.trail.push(trailEntry(step, results)); return decision === 'retry' ? step : stopped(walk, step); }
  if (step.terminal) { walk.trail.push(trailEntry(step, results)); return finish(walk, 'completed', step, `${walk.definition.title} completed${step.outcome ? `: ${step.outcome}` : ''}.`); }
  const transition = nextTransition(step, walk.data);
  walk.trail.push(trailEntry(step, results, transition));
  if (!transition) return finish(walk, 'no-transition', step, `No transition of ${step.title} applies to the answers.`);
  return stepById(walk.definition, transition.to);
}
export async function walkProcess(context: ActionContext, definition: ProcessDefinition): Promise<ProcessRunSummary> {
  const walk: Walk = { context, definition, data: Object.create(null), acknowledged: new Set(), trail: [] };
  let current: ProcessStep | ProcessRunSummary = definition.steps[0]!;
  for (let count = 0; count < processVisitLimit && !('trail' in current); count++) current = await visit(walk, current);
  return 'trail' in current ? current : finish(walk, 'loop-limit', current, `Stopped after ${processVisitLimit} step visits.`);
}
