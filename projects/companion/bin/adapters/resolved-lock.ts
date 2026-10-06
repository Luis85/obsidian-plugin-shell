import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hash, readBounded } from './framework/files.ts';
import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { object, list } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import type { Entry } from './storage.ts';
function same(value: unknown, expected: unknown): boolean {
  const a = object(value ?? {}), b = object(expected ?? {});
  const keys = Object.keys(a).sort();
  return JSON.stringify(keys) === JSON.stringify(Object.keys(b).sort()) && keys.every(key => a[key] === b[key]);
}
function matchesManifest(lock: Record<string, unknown>, pkg: Record<string, unknown>): boolean {
  if (![2, 3].includes(Number(lock.lockfileVersion))) return false;
  const root = object(object(lock.packages)['']);
  if (root.name !== pkg.name || root.version !== pkg.version) return false;
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].every(key => same(root[key], pkg[key]));
}
function withResolvedReceipt(entries: Entry[], content: string): Entry[] {
  const digest = hash(content);
  return entries.map(entry => {
    if (entry.path === 'package-lock.json') return { path: entry.path, content };
    if (entry.path !== '.companion/generation.json') return entry;
    const receipt = object(parseJsonData(entry.content));
    for (const raw of list(receipt.files, 'generation.files', 5000)) {
      const file = object(raw); if (file.path === 'package-lock.json') file.hash = digest;
    }
    return { ...entry, content: JSON.stringify(receipt, null, 2) + '\n' };
  });
}
/** Preserve a resolved lock only for an unchanged, owned manifest. Changes to dependency declarations still conflict. */
export async function preserveResolvedLock(root: string, out: string, entries: Entry[], previous: Map<string, string>): Promise<Entry[]> {
  const manifest = entries.find(entry => entry.path === 'package.json');
  const lock = entries.find(entry => entry.path === 'package-lock.json');
  if (!manifest || !lock || !previous.has('package-lock.json')) return entries;
  if (previous.get('package.json') !== hash(manifest.content)) return entries;
  const plan = await createFilePlan(root, [manifest, lock].map(entry => ({ ...entry, path: out + '/' + entry.path })));
  const [packageChange, lockChange] = plan.changes;
  if (packageChange!.status !== 'unchanged' || lockChange!.status !== 'update') return entries;
  const bytes = await readBounded(join(root, out, 'package-lock.json'), 4_000_000);
  requireSketch(hash(bytes) === lockChange!.beforeHash, 'MAKER_STALE', 'Lock changed while planning regeneration.');
  const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const parsed = object(parseJsonData(content));
  requireSketch(matchesManifest(parsed, object(parseJsonData(manifest.content))), 'MAKER_LOCK_CONFLICT', 'Resolved lock does not match the unchanged generated manifest. Reconcile dependencies explicitly.');
  return withResolvedReceipt(entries, content);
}
