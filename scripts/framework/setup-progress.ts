import { hostname } from 'node:os';
import { join } from 'node:path';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
import { assertJsonData } from '../contracts/json-data.mjs';
import { serializeJson } from '../contracts/serialization.ts';
import { exists, readBounded, hash } from './files.ts';
import { setupSnapshot } from './setup-state.ts';
import { requireThat, result, failure, stringOption, type Context, type Request, type Result } from './contracts.ts';

const path = '.framework/setup-progress.json';
const stages = ['generate', 'install', 'verify', 'preview'] as const;
type Stage = typeof stages[number];
type Attempt = { owner: { pid: number; host: string }; stage: Stage; before: string; after: string | null; status: 'running' | Result['status']; codes: string[] };
type Progress = { schemaVersion: 1; attempts: Attempt[] };
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
async function load(context: Context): Promise<{ progress: Progress; hash: string | null }> {
  if (!await exists(join(context.root, path))) return { progress: { schemaVersion: 1, attempts: [] }, hash: null };
  const bytes = await readBounded(join(context.root, path));
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assertJsonData(value);
  requireThat(value?.schemaVersion === 1 && Object.keys(value).sort().join() === 'attempts,schemaVersion' && Array.isArray(value.attempts) && value.attempts.length <= 64,
    'SETUP_PROGRESS_INVALID', 'Preserve invalid setup progress; export and investigate it rather than resetting it.');
  for (const entry of value.attempts) {
    requireThat(entry && Object.keys(entry).sort().join() === 'after,before,codes,owner,stage,status' && stages.includes(entry.stage) && digest(entry.before)
      && (entry.after === null || digest(entry.after)) && ['running', 'ok', 'planned', 'applied', 'unchanged', 'failed', 'cancelled', 'blocked'].includes(entry.status)
      && entry.owner && Object.keys(entry.owner).sort().join() === 'host,pid' && Number.isSafeInteger(entry.owner.pid) && entry.owner.pid > 0 && typeof entry.owner.host === 'string' && entry.owner.host.length <= 255
      && Array.isArray(entry.codes) && entry.codes.length <= 20 && entry.codes.every((code: unknown) => typeof code === 'string' && /^[A-Z_0-9]{1,80}$/.test(code)),
      'SETUP_PROGRESS_INVALID', 'Invalid setup attempt; no stage was run.');
  }
  return { progress: value, hash: hash(bytes) };
}
async function persist(context: Context, progress: Progress, previous: string | null) {
  const content = serializeJson(progress), plan = await createFilePlan(context.root, [{ path, content }]);
  requireThat(plan.changes[0]?.beforeHash === previous, 'SETUP_PROGRESS_CHANGED', 'Another setup operation changed progress; preserve both outcomes and inspect status.');
  await applyFilePlan(plan); return hash(content);
}
function stageRequest(stage: Stage): Request {
  return stage === 'generate' ? { command: 'generate', args: [], options: { yes: true } }
    : stage === 'install' ? { command: 'install', args: [], options: { yes: true } }
    : stage === 'verify' ? { command: 'verify', args: [], options: { profile: 'project' } }
    : { command: 'clickdummy build', args: [], options: {} };
}
export async function setupProgress(request: Request, context: Context, execute: (request: Request, context: Context) => Promise<Result>) {
  const loaded = await load(context), snapshot = await setupSnapshot(context), last = loaded.progress.attempts.at(-1);
  const current = !last || (last.after ?? last.before) === snapshot.fingerprint;
  const data = { ...snapshot, current, attempts: loaded.progress.attempts, resumeHash: hash(JSON.stringify({ input: snapshot.fingerprint, progress: loaded.hash })),
    automaticRetry: false, productAcceptance: 'not-inferred', evidenceAuthority: 'local-progress-only', next: last?.status === 'running' ? 'Inspect an interrupted stage before explicit --recover.' : 'Choose --stage generate|install|verify|preview explicitly.' };
  if (request.command === 'setup status') return result(request.command, data);
  const selected = stringOption(request.options, 'stage');
  requireThat(stages.includes(selected as Stage), 'SETUP_STAGE_REQUIRED', 'Supply --stage generate, install, verify or preview. Only that stage runs.');
  requireThat(request.options.apply === undefined || selected === 'generate', 'SETUP_STAGE_OPTIONS', '--apply only binds a reviewed generate plan.');
  requireThat(request.options['plan-out'] === undefined, 'SETUP_STAGE_OPTIONS', 'Setup progress is not a portable executable plan.');
  if (!request.options.yes || request.options['dry-run']) return result(request.command, { ...data, selectedStage: selected, execution: 'not-run', requires: '--yes --resume-hash <resumeHash>' }, 'planned');
  requireThat(stringOption(request.options, 'resume-hash') === data.resumeHash, 'SETUP_INPUT_CHANGED', 'Inspect setup status and explicitly approve its current resumeHash. Input or progress may have changed.');
  requireThat(last?.status !== 'running' || last.owner.host === hostname(), 'SETUP_OWNER_UNKNOWN', 'An interrupted attempt belongs to another host; inspect and reconcile its effects before starting a new local session.');
  if (last?.status === 'running' && last.owner.host === hostname()) {
    let alive = true;
    try { process.kill(last.owner.pid, 0); } catch (error) { alive = !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'); }
    requireThat(!alive, 'SETUP_BUSY', 'The previous setup process is still present; do not recover or run another stage concurrently.');
  }
  requireThat(last?.status !== 'running' || request.options.recover === true, 'SETUP_INTERRUPTED', 'Previous execution is uncertain. Inspect its effects, then explicitly use --recover with the current resume hash.');
  requireThat(selected === 'generate' || snapshot.generated, 'SETUP_GENERATION_REQUIRED', 'Generate the independent project before running this stage.');
  requireThat(loaded.progress.attempts.length < 64, 'SETUP_HISTORY_FULL', 'Retain/export setup history before starting a new audited setup session.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Cancelled before starting a stage.');
  const attempt: Attempt = { owner: { pid: process.pid, host: hostname() }, stage: selected as Stage, before: snapshot.fingerprint, after: null, status: 'running', codes: [] };
  const progress: Progress = { schemaVersion: 1, attempts: [...loaded.progress.attempts, attempt] };
  const intentHash = await persist(context, progress, loaded.hash);
  let outcome: Result;
  try { outcome = await execute({ ...stageRequest(attempt.stage), options: { ...stageRequest(attempt.stage).options, ...(request.options.timeout === undefined ? {} : { timeout: request.options.timeout }), ...(request.options.apply === undefined ? {} : { apply: request.options.apply }) } }, context); }
  catch (error) { outcome = failure(attempt.stage, error); }
  attempt.status = outcome.status;
  attempt.codes = outcome.diagnostics.map(item => item.code).filter(code => /^[A-Z_0-9]{1,80}$/.test(code)).slice(0, 20);
  try {
    const after = await setupSnapshot(context); attempt.after = after.fingerprint;
    requireThat(after.binding === snapshot.binding, 'SETUP_INPUT_CHANGED', 'Canonical input changed during execution; no verified outcome is inferred.');
    requireThat(attempt.stage === 'generate' || after.fingerprint === snapshot.fingerprint, 'SETUP_SOURCE_CHANGED', 'Source changed during execution; rerun verification only after inspecting the new input.');
  } catch (error) {
    attempt.status = 'blocked'; attempt.codes.push('SETUP_SOURCE_CHANGED');
    outcome = { ...failure(request.command, error), data: { stageOutcome: outcome.status, verification: 'not-current' } };
  }
  try { await persist(context, progress, intentHash); }
  catch (error) { return { ...failure(request.command, error), data: { stageOutcome: outcome.status, progress: 'not-recorded', automaticRetry: false } }; }
  return { ...outcome, command: request.command, data: { selectedStage: selected, attempt, execution: outcome.data, automaticRetry: false, productAcceptance: 'not-inferred' } };
}
