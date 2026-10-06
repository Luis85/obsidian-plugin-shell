/** Pure listing view of normalized workflows: triggers, filters, runner/matrix summary and local reproducibility. */
import { summarizeMatrix, type MatrixSummary } from './ci-matrix.ts';
import { jobRefusals } from './ci-safety.ts';
import type { CiJob, CiWorkflow, PathFilter } from './ci-workflow.ts';
export interface JobSummary {
  id: string; reference: string; name: string; runsOn: string; matrix: MatrixSummary; condition?: string; needs: string[];
  steps: { total: number; run: number; setup: number; external: number };
  /** Local composite actions whose steps are expanded into this job (counted in `steps`). */
  actions: string[];
  /** Only `run:` steps and known setup actions (after expanding local composite actions): every step has a local equivalent. */
  reproducible: boolean; reasons: string[];
  /** False when `--execute` would be refused (secrets, publication, deployment). */
  executable: boolean; refusals: string[];
}
export interface WorkflowSummary {
  file: string; stem: string; name: string; triggers: string[]; schedules: string[]; filters: PathFilter[]; jobs: JobSummary[];
}
function jobSummary(workflow: CiWorkflow, job: CiJob): JobSummary {
  const count = (kind: 'run' | 'setup' | 'external') => job.steps.filter(step => step.kind === kind).length;
  const external = job.steps.filter(step => step.kind === 'external').map(step => `step ${step.index} uses ${step.uses ?? ''} (external, skipped${step.note ? `: ${step.note}` : ''})`);
  const reasons = [...job.blockers.map(reason => `the job ${reason}`), ...external], refusals = jobRefusals(workflow, job);
  return { id: job.id, reference: `${workflow.stem}/${job.id}`, name: job.name ?? job.id, runsOn: job.runsOn, matrix: summarizeMatrix(job.matrix),
    needs: job.needs, steps: { total: job.steps.length, run: count('run'), setup: count('setup'), external: count('external') },
    actions: [...new Set(job.steps.flatMap(step => step.composite ? [step.composite.uses] : []))],
    reproducible: reasons.length === 0, reasons, executable: refusals.length === 0, refusals, ...(job.condition ? { condition: job.condition } : {}) };
}
export function summarizeWorkflow(workflow: CiWorkflow): WorkflowSummary {
  const { file, stem, name, triggers, schedules, filters } = workflow;
  return { file, stem, name, triggers, schedules, filters, jobs: workflow.jobs.map(job => jobSummary(workflow, job)) };
}
