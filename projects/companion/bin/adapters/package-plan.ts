import { preserveResolvedLock } from './resolved-lock.ts';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hash, readBounded } from './framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { object, list, text, keys } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { prepared, type Entry, type Prepared } from './storage.ts';
import { reservedOutputFolder } from '../compiler/domain/template-inputs.ts';
function receipt(value: unknown): Map<string, string> {
  const input = object(value); keys(input, ['schemaVersion', 'files']);
  requireSketch(input.schemaVersion === 1, 'MAKER_RECEIPT', 'Unsupported maker receipt.');
  const records = list(input.files, 'receipt.files', 5000).map(raw => {
    const item = object(raw); keys(item, ['path', 'sha256']);
    const path = text(item.path, 'receipt.path', 300), digest = text(item.sha256, 'receipt.sha256');
    requireSketch(/^[a-f0-9]{64}$/.test(digest), 'MAKER_RECEIPT', 'Invalid receipt hash.');
    return [path, digest] as const;
  });
  requireSketch(new Set(records.map(([path]) => path.toLowerCase())).size === records.length, 'MAKER_RECEIPT', 'Duplicate receipt entries.');
  return new Map(records);
}
/** New source output must not recursively become an input to the framework snapshot. */
export function outputBoundary(root: string, frameworkRoot: string, out: string): void {
  const target = relative(resolve(frameworkRoot), resolve(root, out));
  if (target.startsWith('..') || isAbsolute(target)) return;
  const first = target.split(/[\\/]/)[0];
  requireSketch(first && !reservedOutputFolder(first), 'MAKER_OUTPUT', 'Inside a framework checkout, use prototypes/<name> or generated/<name>, not a template input directory.');
}
/** Compiler emission stays separate from package persistence. Edited/foreign files are never silently adopted. */
export async function packagePlan(root: string, out: string, entries: Entry[], data: Record<string, unknown>): Promise<Prepared> {
  requireSketch(entries.length > 0 && entries.length <= 4999, 'MAKER_PACKAGE_LIMIT', 'Package exceeds the supported file count.');
  const receiptPath = `${out}/.maker/receipt.json`;
  const inspected = await createFilePlan(root, [{ path: receiptPath, content: null }]);
  const previousHash = inspected.changes[0]!.beforeHash;
  let previous = new Map<string, string>();
  if (previousHash) {
    const bytes = await readBounded(join(root, receiptPath), 4_000_000);
    requireSketch(hash(bytes) === previousHash, 'MAKER_STALE', 'Package receipt changed while reading.');
    previous = receipt(parseJsonData(bytes.toString('utf8')));
  }
  entries = await preserveResolvedLock(root, out, entries, previous);
  const candidates = await createFilePlan(root, entries.map(entry => ({ ...entry, path: `${out}/${entry.path}` })));
  for (const [index, change] of candidates.changes.entries()) {
    const old = previous.get(entries[index]!.path);
    requireSketch(!(old && change.beforeHash === null), 'MAKER_FILE_REMOVED', `Previously generated file was removed: ${change.path}. Use a new output folder or restore it.`);
    requireSketch(change.status === 'create' || change.status === 'unchanged' || (old && change.beforeHash === old), 'MAKER_FILE_CONFLICT', `Preserve edited or unowned file: ${change.path}. Reconcile it or choose another output folder.`);
  }
  const owned = new Map(previous);
  candidates.changes.forEach((change, index) => owned.set(entries[index]!.path, change.afterHash!));
  const content = JSON.stringify({ schemaVersion: 1, files: [...owned].map(([path, sha256]) => ({ path, sha256 })) }, null, 2) + '\n';
  const plan = await createFilePlan(root, [...entries.map(entry => ({ ...entry, path: `${out}/${entry.path}` })), { path: receiptPath, content }]);
  requireSketch(plan.changes.at(-1)!.beforeHash === previousHash && candidates.changes.every((item, index) => item.beforeHash === plan.changes[index]!.beforeHash), 'MAKER_STALE', 'Package changed while planning.');
  return prepared(plan, { ...data, output: out, retiredFiles: [...previous.keys()].filter(path => !entries.some(entry => entry.path === path)), installed: false, built: false });
}
