import { join } from 'node:path';
import { writeFile, mkdir, unlink, rm } from 'node:fs/promises';
import { createFilePlan } from '../../shared/file-plan.ts';
import { docsObject as object, array, insist, stable } from '../domain/contracts.ts';
import { readBytes, decode, documentationDigest as digest, portable } from './filesystem.ts';
interface Change { path: string; beforeHash: string | null; afterHash: string | null; status: string }
interface Plan { root: string; changes: readonly Change[] }
const lockName = '.codex-authoring.lock';
/** Called inside the shared writer lock, after preimages are staged and before the first destination write. */
export function journalHook(plan: Plan) {
  let recorded = false;
  return async (): Promise<void> => {
    if (recorded) return;
    const value = { schemaVersion: 1, kind: 'application-docs-recovery', pid: process.pid,
      changes: plan.changes.map(({ path, beforeHash, afterHash, status }, index) => ({ path, beforeHash, afterHash, status, index })) };
    await writeFile(join(plan.root, lockName, 'docs-journal.json'), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    recorded = true;
  };
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH'); }
}
type Entry = { path: string; content: string | null; encoding?: 'base64' };
const HASH = /^[a-f0-9]{64}$/;
function journalOf(bytes: Buffer) {
  const journal = object(JSON.parse(decode(bytes)));
  insist(journal.schemaVersion === 1 && journal.kind === 'application-docs-recovery' && Number.isSafeInteger(journal.pid) && Number(journal.pid) > 0,
    'DOCS_RECOVERY_JOURNAL', 'Invalid recovery journal.');
  return journal;
}
function journalChange(input: unknown) {
  const change = object(input), path = portable(String(change.path));
  insist(Number.isSafeInteger(change.index) && Number(change.index) >= 0 && Number(change.index) < 10000, 'DOCS_RECOVERY_JOURNAL', 'Invalid preimage index.');
  for (const name of ['beforeHash', 'afterHash']) insist(change[name] === null || typeof change[name] === 'string' && HASH.test(String(change[name])), 'DOCS_RECOVERY_JOURNAL', 'Invalid preimage hash.');
  return { change, path };
}
async function restoreEntry(lock: string, path: string, change: Record<string, unknown>): Promise<Entry> {
  if (change.beforeHash === null) return { path, content: null };
  const before = await readBytes(join(lock, `before-${Number(change.index)}`), 16_000_000);
  insist(before && digest(before) === change.beforeHash, 'DOCS_RECOVERY_PREIMAGE', 'A recovery preimage is missing or altered: ' + path);
  return { path, content: before.toString('base64'), encoding: 'base64' };
}
async function inspectRecovery(root: string) {
  const lock = join(root, lockName), bytes = await readBytes(join(lock, 'docs-journal.json'));
  insist(bytes, 'DOCS_RECOVERY_MISSING', 'No documentation recovery journal exists. Do not discard an unrelated writer lock.');
  const journal = journalOf(bytes);
  insist(!alive(Number(journal.pid)), 'DOCS_RECOVERY_ACTIVE', 'The recorded writer is still running; recovery is refused.');
  const entries: Entry[] = [], observed: Array<{path: string; hash: string | null}> = [];
  for (const input of array(journal.changes)) {
    const { change, path } = journalChange(input);
    const current = await readBytes(join(root, path), 16_000_000), hash = current ? digest(current) : null; observed.push({ path, hash });
    insist(hash === change.beforeHash || hash === change.afterHash, 'DOCS_RECOVERY_CONFLICT', 'Preserving an intervening edit: ' + path);
    if (hash !== change.beforeHash) entries.push(await restoreEntry(lock, path, change));
  }
  const plan = await createFilePlan(root, entries);
  return { lock, entries, plan, hash: digest(stable({ journal: digest(bytes), observed })) };
}
/** Explicit rollback with preimage checks. This is not a filesystem-wide atomic transaction. */
export async function recoverDocuments(root: string, apply: boolean, expected?: string) {
  const preview = await inspectRecovery(root);
  if (!apply) return { status: 'planned' as const, data: { recoveryHash: preview.hash, restore: preview.entries.map(entry => entry.path), action: 'rollback', requires: '--apply <recoveryHash> --yes' } };
  insist(expected === preview.hash, 'DOCS_RECOVERY_STALE', 'Supply the exact current recoveryHash.');
  const guard = join(preview.lock, 'docs-recovery.lock'); await mkdir(guard);
  try {
    const fresh = await inspectRecovery(root); insist(fresh.hash === expected, 'DOCS_RECOVERY_STALE', 'Recovery inputs changed.');
    for (const change of fresh.plan.changes) {
      const current = await readBytes(join(root, change.path), 16_000_000);
      insist((current ? digest(current) : null) === change.beforeHash, 'DOCS_RECOVERY_CONFLICT', 'Preserving an intervening edit: ' + change.path);
      if (change.content === null) await unlink(join(root, change.path));
      else await writeFile(join(root, change.path), Buffer.from(change.content, 'base64'), { flag: current ? 'w' : 'wx' });
    }
    await rm(preview.lock, { recursive: true });
    return { status: 'applied' as const, data: { restored: fresh.entries.map(entry => entry.path), synchronization: 'previous-baseline-restored' } };
  } catch (error) { await rm(guard, { recursive: true, force: true }); throw error; }
}
