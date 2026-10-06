import { hostname } from 'node:os';
import { join } from 'node:path';
import { createFilePlan, applyFilePlan } from '#shared/platform/file-plan.ts';
import { assertJsonData } from '#shared/contracts/json-data.ts';
import { serializeJson } from '#shared/contracts/serialization.ts';
import { exists, readBounded, hash } from './files.ts';
import { setupSnapshot } from './setup-state.ts';
import { requireThat, result, failure, stringOption, type Context, type Request, type Result } from './contracts.ts';

const path = '.framework/setup-progress.json';
const stages = ['generate', 'install', 'verify', 'preview'] as const;
type Stage = typeof stages[number];
type Attempt = { owner: { pid: number; host: string }; stage: Stage; before: string; after: string | null; status: 'running' | Result['status']; codes: string[] };
type Progress = { schemaVersion: 1; attempts: Attempt[] };
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const statuses = ['running', 'ok', 'planned', 'applied', 'unchanged', 'failed', 'cancelled', 'blocked'];
const exactKeys = (value: object, keys: string) => Object.keys(value).sort().join() === keys;
const validCode = (code: unknown) => typeof code === 'string' && /^[A-Z_0-9]{1,80}$/.test(code);
function validOwner(owner: unknown): boolean {
  if (!owner || typeof owner !== 'object' || !exactKeys(owner, 'host,pid')) return false;
  const { pid, host } = owner as { pid: unknown; host: unknown };
  return Number.isSafeInteger(pid) && (pid as number) > 0 && typeof host === 'string' && host.length <= 255;
}
function validAttempt(entry: Record<string, unknown> | null): boolean {
  if (!entry || !exactKeys(entry, 'after,before,codes,owner,stage,status')) return false;
  return validFingerprints(entry) && statuses.includes(entry.status as string) && validOwner(entry.owner)
    && Array.isArray(entry.codes) && entry.codes.length <= 20 && entry.codes.every(validCode);
}
function validFingerprints(entry: Record<string, unknown>): boolean {
  return stages.includes(entry.stage as Stage) && digest(entry.before) && (entry.after === null || digest(entry.after));
}
async function load(context: Context): Promise<{ progress: Progress; hash: string | null }> {
  if (!await exists(join(context.root, path))) return { progress: { schemaVersion: 1, attempts: [] }, hash: null };
  const bytes = await readBounded(join(context.root, path));
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  assertJsonData(value);
  requireThat(value?.schemaVersion === 1 && exactKeys(value, 'attempts,schemaVersion') && Array.isArray(value.attempts) && value.attempts.length <= 64,
    'SETUP_PROGRESS_INVALID', 'Preserve invalid setup progress; export and investigate it rather than resetting it.');
  for (const entry of value.attempts) requireThat(validAttempt(entry), 'SETUP_PROGRESS_INVALID', 'Invalid setup attempt; no stage was run.');
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
type Snapshot = Awaited<ReturnType<typeof setupSnapshot>>;
type Loaded = Awaited<ReturnType<typeof load>>;
function statusData(loaded: Loaded, snapshot: Snapshot) {
  const last = loaded.progress.attempts.at(-1);
  const current = !last || (last.after ?? last.before) === snapshot.fingerprint;
  return { ...snapshot, current, attempts: loaded.progress.attempts, resumeHash: hash(JSON.stringify({ input: snapshot.fingerprint, progress: loaded.hash })),
    automaticRetry: false, productAcceptance: 'not-inferred', evidenceAuthority: 'local-progress-only', next: last?.status === 'running' ? 'Inspect an interrupted stage before explicit --recover.' : 'Choose --stage generate|install|verify|preview explicitly.' };
}
function selectedStage(request: Request): Stage {
  const selected = stringOption(request.options, 'stage');
  requireThat(stages.includes(selected as Stage), 'SETUP_STAGE_REQUIRED', 'Supply --stage generate, install, verify or preview. Only that stage runs.');
  requireThat(request.options.apply === undefined || selected === 'generate', 'SETUP_STAGE_OPTIONS', '--apply only binds a reviewed generate plan.');
  requireThat(request.options['plan-out'] === undefined, 'SETUP_STAGE_OPTIONS', 'Setup progress is not a portable executable plan.');
  return selected as Stage;
}
function processPresent(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) { return !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'); }
}
/** An interrupted local attempt may be recovered only after its process is gone and --recover is explicit. */
function checkInterrupted(last: Attempt | undefined, request: Request): void {
  const running = last?.status === 'running';
  requireThat(!running || last!.owner.host === hostname(), 'SETUP_OWNER_UNKNOWN', 'An interrupted attempt belongs to another host; inspect and reconcile its effects before starting a new local session.');
  if (running) requireThat(!processPresent(last!.owner.pid), 'SETUP_BUSY', 'The previous setup process is still present; do not recover or run another stage concurrently.');
  requireThat(!running || request.options.recover === true, 'SETUP_INTERRUPTED', 'Previous execution is uncertain. Inspect its effects, then explicitly use --recover with the current resume hash.');
}
function checkStartable(request: Request, context: Context, loaded: Loaded, snapshot: Snapshot, selected: Stage, resumeHash: string): void {
  requireThat(stringOption(request.options, 'resume-hash') === resumeHash, 'SETUP_INPUT_CHANGED', 'Inspect setup status and explicitly approve its current resumeHash. Input or progress may have changed.');
  checkInterrupted(loaded.progress.attempts.at(-1), request);
  requireThat(selected === 'generate' || snapshot.generated, 'SETUP_GENERATION_REQUIRED', 'Generate the independent project before running this stage.');
  requireThat(loaded.progress.attempts.length < 64, 'SETUP_HISTORY_FULL', 'Retain/export setup history before starting a new audited setup session.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Cancelled before starting a stage.');
}
type Execute = (request: Request, context: Context) => Promise<Result>;
async function runStage(request: Request, context: Context, execute: Execute, stage: Stage): Promise<Result> {
  const base = stageRequest(stage);
  const options = { ...base.options, ...(request.options.timeout === undefined ? {} : { timeout: request.options.timeout }), ...(request.options.apply === undefined ? {} : { apply: request.options.apply }) };
  try { return await execute({ ...base, options }, context); }
  catch (error) { return failure(stage, error); }
}
/** A stage outcome counts only if canonical input stayed bound and, except for generate, the source did not move. */
async function verifiedOutcome(request: Request, context: Context, attempt: Attempt, snapshot: Snapshot, outcome: Result): Promise<Result> {
  try {
    const after = await setupSnapshot(context); attempt.after = after.fingerprint;
    requireThat(after.binding === snapshot.binding, 'SETUP_INPUT_CHANGED', 'Canonical input changed during execution; no verified outcome is inferred.');
    requireThat(attempt.stage === 'generate' || after.fingerprint === snapshot.fingerprint, 'SETUP_SOURCE_CHANGED', 'Source changed during execution; rerun verification only after inspecting the new input.');
    return outcome;
  } catch (error) {
    attempt.status = 'blocked'; attempt.codes.push('SETUP_SOURCE_CHANGED');
    return { ...failure(request.command, error), data: { stageOutcome: outcome.status, verification: 'not-current' } };
  }
}
export async function setupProgress(request: Request, context: Context, execute: Execute) {
  const loaded = await load(context), snapshot = await setupSnapshot(context);
  const data = statusData(loaded, snapshot);
  if (request.command === 'setup status') return result(request.command, data);
  const selected = selectedStage(request);
  if (!request.options.yes || request.options['dry-run']) return result(request.command, { ...data, selectedStage: selected, execution: 'not-run', requires: '--yes --resume-hash <resumeHash>' }, 'planned');
  checkStartable(request, context, loaded, snapshot, selected, data.resumeHash);
  const attempt: Attempt = { owner: { pid: process.pid, host: hostname() }, stage: selected, before: snapshot.fingerprint, after: null, status: 'running', codes: [] };
  const progress: Progress = { schemaVersion: 1, attempts: [...loaded.progress.attempts, attempt] };
  const intentHash = await persist(context, progress, loaded.hash);
  const stageOutcome = await runStage(request, context, execute, attempt.stage);
  attempt.status = stageOutcome.status;
  attempt.codes = stageOutcome.diagnostics.map(item => item.code).filter(validCode).slice(0, 20);
  const outcome = await verifiedOutcome(request, context, attempt, snapshot, stageOutcome);
  try { await persist(context, progress, intentHash); }
  catch (error) { return { ...failure(request.command, error), data: { stageOutcome: outcome.status, progress: 'not-recorded', automaticRetry: false } }; }
  return { ...outcome, command: request.command, data: { selectedStage: selected, attempt, execution: outcome.data, automaticRetry: false, productAcceptance: 'not-inferred' } };
}
