/**
 * Why a CI job must not be executed locally: credentials, publication or deployment, and a runner OS that is not this machine.
 * Dry-run output is always allowed; only `--execute` consults these rules.
 */
import type { CiJob, CiStep, CiWorkflow } from './ci-workflow.ts';
export type RunnerOs = 'Linux' | 'Windows' | 'macOS';
const secretPattern = /\bsecrets(?:\.|\[)|\bgithub\.token\b/i;
/** Commands that publish, tag, push, deploy or mutate a remote. Matched against `run:` text only. */
const publishing: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:npm|pnpm|yarn)\s+publish\b/, 'npm publish'],
  [/\bgh\s+(?:release|api|pr\s+(?:create|merge)|workflow\s+run)\b/, 'gh release/api/pr/workflow command'],
  [/\bgit\s+push\b/, 'git push'],
  [/\bgit\s+tag\s+(?!-l\b|--list\b|-d\b|--delete\b|-v\b|--verify\b)[^\s-]/, 'git tag creation'],
  [/\b(?:vsce|ovsx)\s+publish\b|\btwine\s+upload\b|\bdocker\s+push\b/, 'package or image publication'],
  [/\brelease[: ]operate\b|--authorize\b/, 'guarded release operation'],
];
const publishWords = /(?:^|[^a-z])(?:release|publish|deploy)(?:$|[^a-z])/i;
const publishingActions = /release|publish|deploy/i;
function stepTexts(step: CiStep): string[] {
  return [step.run ?? '', step.uses ?? '', ...Object.values(step.env), ...Object.values(step.inputs)];
}
function secretReasons(workflow: CiWorkflow, job: CiJob): string[] {
  const reasons: string[] = [];
  if ([...Object.values(workflow.env), ...Object.values(job.env)].some(value => secretPattern.test(value))) reasons.push('job environment references secrets');
  for (const step of job.steps) if (stepTexts(step).some(value => secretPattern.test(value))) reasons.push(`step ${step.index} references secrets`);
  return reasons;
}
function stepPublishReasons(step: CiStep): string[] {
  const reasons = publishing.filter(([pattern]) => step.run !== undefined && pattern.test(step.run)).map(([, label]) => `step ${step.index} runs ${label}`);
  if (step.kind === 'external' && step.uses !== undefined && publishingActions.test(step.uses)) reasons.push(`step ${step.index} uses the publishing action ${step.uses}`);
  return reasons;
}
function publishReasons(job: CiJob): string[] {
  const reasons = job.steps.flatMap(stepPublishReasons);
  if (publishWords.test(job.id) || publishWords.test(job.name ?? '')) reasons.push(`job "${job.id}" is named as a release, publish or deploy job`);
  return reasons;
}
/** Safety refusals for `--execute`; empty means the job may run locally (subject to platform and unresolved-input checks). */
export function jobRefusals(workflow: CiWorkflow, job: CiJob): string[] {
  return [...job.blockers.map(reason => `the job ${reason}`), ...secretReasons(workflow, job), ...publishReasons(job)];
}
export function runnerOs(runsOn: string): RunnerOs | null {
  const label = runsOn.toLowerCase();
  if (/ubuntu|linux/.test(label)) return 'Linux';
  if (label.includes('windows')) return 'Windows';
  return label.includes('macos') ? 'macOS' : null;
}
/** `npm ci` or `npm install` into the working tree (not an isolated `--prefix`): running it replaces this checkout's node_modules. */
const installPattern = /(?:^|[\s;&|(])(?:npm|node\s+"?(?:[^"\s]*npm-cli\.js|\$\{?(?:env:)?QUALIFIED_NPM\}?)"?)\s+(?:ci|install|i)\b(?![^\n]*--prefix)/m;
export const installsDependencies = (command: string): boolean => installPattern.test(command);
