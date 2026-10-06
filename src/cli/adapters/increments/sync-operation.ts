/** `pr sync`: three-way merge of a published pull request with the platform; conflicts block before any write. */
import { serializeJson as json } from '../../../../scripts/contracts/serialization.ts';
import { hash } from '../framework/files.ts';
import { OperationError, result, type Context, type Request, type Result } from '../framework/contracts.ts';
import { setPullRequestBinding } from '../../domain/increments/pull-request-document.ts';
import { parseSyncRecord, syncRecordPath } from '../../domain/increments/sync-record.ts';
import type { Side } from '../../domain/increments/sync-merge.ts';
import { applySync, previewSync, type SyncPreview } from '../../application/increments/sync.ts';
import { withRemoteLock } from './remote-lock.ts';
import { linkResolver, knownStatus, writeStatus, writeView } from './remote-view.ts';
import { inputRaw, option } from './inputs.ts';
import { applying, load, localBefore, planHash, recordLocally, requireFresh, syncRecord, uncertain, type Loaded } from './remote-support.ts';

const side = (value: unknown, what: string): Side => {
  if (value !== 'local' && value !== 'remote') throw new OperationError('INVALID_OPTION', `${what} takes local or remote.`);
  return value;
};
/** `--resolutions`: an inline JSON object or a project JSON file mapping conflict keys to local or remote. */
async function resolutions(request: Request, context: Context): Promise<Record<string, Side> | undefined> {
  const value = option(request, 'resolutions');
  if (value === undefined) return undefined;
  const text = value.trim().startsWith('{') ? value : await inputRaw({ ...request, options: { input: value } }, context);
  let parsed: unknown;
  try { parsed = JSON.parse(text ?? ''); } catch { throw new OperationError('INVALID_OPTION', '--resolutions must be a JSON object of conflict keys to local or remote.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new OperationError('INVALID_OPTION', '--resolutions must be a JSON object.');
  return Object.fromEntries(Object.entries(parsed).map(([key, choice]) => [key, side(choice, `Resolution ${key}`)]));
}
interface Planned { loaded: Loaded; preview: SyncPreview; before: Record<string, string | null>; result: Result & { data: { planHash: string } } }
async function syncPlan(request: Request, context: Context): Promise<Planned> {
  const loaded = await load(request, context), binding = loaded.pull.model.binding;
  if (!binding) throw new OperationError('PR_NOT_PUBLISHED', `${loaded.pull.id} is not published yet.`, `node bin/app pr publish ${loaded.pull.id} --dry-run`);
  const recordText = await loaded.session.ws.read(syncRecordPath(loaded.pull.id));
  if (recordText === null) throw new OperationError('PR_SYNC_RECORD_INVALID', `${syncRecordPath(loaded.pull.id)} is missing; it is written by pr publish and committed with the document.`);
  const prefer = option(request, 'prefer'), chosen = await resolutions(request, context);
  const preview = await previewSync(loaded.remote, { view: loaded.view, localStatus: knownStatus(loaded.pull.model.status), record: parseSyncRecord(recordText),
    number: binding.number, resolve: linkResolver(loaded.files), hash, today: loaded.session.ws.now().toISOString().slice(0, 10),
    ...(prefer ? { prefer: side(prefer, '--prefer') } : {}), ...(chosen ? { resolutions: chosen } : {}) });
  const before = await localBefore(loaded), outcome = preview.outcome, patch = outcome.remotePatch;
  const hashValue = planHash(context, request, { localBefore: before, remote: { number: binding.number, revision: preview.pull.revision },
    merged: { patch: patch ? hash(json(patch)) : null, view: hash(json(outcome.view)), status: outcome.localStatus } });
  const data = { planHash: hashValue, remote: { number: preview.pull.number, url: preview.pull.url, state: preview.pull.state, revision: preview.pull.revision, unmanagedChars: outcome.unmanagedChars },
    merge: outcome.report, pullOnly: outcome.pullOnly, conflicts: outcome.conflicts, remoteWrite: { title: patch?.title !== undefined, body: patch?.body !== undefined },
    localWrite: outcome.localChanged, changes: Object.entries(before).map(([path, beforeHash]) => ({ path, beforeHash })), warnings: [...loaded.target.warnings, ...outcome.warnings] };
  const status = outcome.status === 'blocked' ? 'blocked' : outcome.status === 'unchanged' ? 'unchanged' : 'planned';
  const diagnostics = outcome.conflicts.map(conflict => ({ code: 'PR_SYNC_CONFLICT', message: `${conflict.key}: changed on both sides (${conflict.kind}).`, next: `Rerun with --prefer ${conflict.allowed.join('|')} or --resolutions '{"${conflict.key}":"${conflict.allowed[0]}"}'.` }));
  return { loaded, preview, before, result: { ...result(request.command, data, status), diagnostics } };
}
export async function sync(request: Request, context: Context): Promise<Result> {
  if (!applying(request)) return (await syncPlan(request, context)).result;
  return withRemoteLock(context.root, request.args[0] ?? '', async () => {
    const { loaded, preview, before, result: planned } = await syncPlan(request, context);
    if (planned.status !== 'planned') return planned;
    requireFresh(request, planned.data.planHash);
    const applied = await applySync(loaded.remote, preview);
    if (applied.status === 'uncertain') throw uncertain(applied.step, applied.message, applied.code);
    const outcome = preview.outcome, now = loaded.session.ws.now().toISOString().replace(/\.\d{3}Z$/, 'Z'), binding = loaded.pull.model.binding!;
    const written = await recordLocally(loaded, before, async session => {
      const text = writeStatus(writeView(loaded.pull.text, loaded.view, outcome.view), loaded.pull.model.status, outcome.localStatus);
      session.write(loaded.pull.path, setPullRequestBinding(text, { ...binding, lastSyncedAt: now }));
      session.touch(loaded.increment.id);
      session.write(syncRecordPath(loaded.pull.id), syncRecord(loaded, outcome.view, outcome.localStatus, applied.pull, now));
    });
    return { ...planned, status: 'applied', data: { ...planned.data, applied: written } };
  }, context.increments?.lockDirectory);
}
