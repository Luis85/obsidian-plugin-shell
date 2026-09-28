import { join } from 'node:path';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { configurationPlan } from '../../scripts/framework/changes.ts';
import { hash, readBounded, exists } from '../../scripts/framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { openDocument, documentText, type SketchDocument } from '../domain/document.ts';
import { requireSketch } from '../domain/errors.ts';
export interface Snapshot { document: SketchDocument | null; beforeHash: string | null }
export interface Entry { path: string; content: string; encoding?: 'base64' }
export type FilePlan = Awaited<ReturnType<typeof createFilePlan>>;
export interface Prepared { plan: FilePlan; planHash: string; data: Record<string, unknown> }
export async function readData(path: string): Promise<unknown> {
  return parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path, 4_000_000)));
}
export async function readSnapshot(root: string, path: string): Promise<Snapshot> {
  const inspection = await createFilePlan(root, [{ path, content: null }]);
  const beforeHash = inspection.changes[0]!.beforeHash;
  if (beforeHash === null) return { document: null, beforeHash };
  const bytes = await readBounded(join(root, path), 4_000_000);
  requireSketch(hash(bytes) === beforeHash, 'MAKER_STALE', 'The project changed while reading. Reload before editing.');
  return { document: openDocument(parseJsonData(bytes.toString('utf8'))), beforeHash };
}
export function prepared(plan: FilePlan, data: Record<string, unknown>, identity: unknown = null): Prepared {
  const planHash = hash(JSON.stringify({ root: plan.root, identity, changes: plan.changes.map(({ path, beforeHash, afterHash }) => ({ path, beforeHash, afterHash })) }));
  return { plan, planHash, data };
}
export async function savePlan(root: string, path: string, document: SketchDocument, beforeHash: string | null): Promise<Prepared> {
  const content = documentText(document);
  const configured = path === 'design/project.json' && await exists(join(root, 'shell.config.json'));
  const { plan } = configured
    ? await configurationPlan({ command: 'project import', args: [], options: { input: '-' } }, { root, frameworkRoot: root, inputText: content })
    : { plan: await createFilePlan(root, [{ path, content }]) };
  requireSketch(plan.changes.find(change => change.path === path)?.beforeHash === beforeHash, 'MAKER_STALE', 'Project changed since it was opened. Nothing was overwritten; reload and reconcile.');
  return prepared(plan, { projectPath: path, project: document.project, document });
}
export async function applyPrepared(value: Prepared, approval?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
  requireSketch(!signal?.aborted, 'CANCELLED', 'Cancelled before applying the plan.');
  const base = { ...value.data, planHash: value.planHash, changes: value.plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash })) };
  if (approval === undefined) return { ...base, status: 'planned' };
  requireSketch(approval === value.planHash, 'MAKER_APPROVAL', 'The plan changed. Review the current planHash before applying.');
  const report = await applyFilePlan(value.plan, { beforeWrite() { requireSketch(!signal?.aborted, 'CANCELLED', 'CANCELLED: Cancelled during apply; completed writes are rolled back by the shared writer.'); } });
  return { ...base, status: report.written.length ? 'applied' : 'unchanged', report };
}
