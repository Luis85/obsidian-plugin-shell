/** Native-file adapter for the shared, inert prototype workspace. Uses the existing guarded writer. */
import { resolve, join } from 'node:path';
import { createFilePlan } from '../shared/file-plan.mjs';
import { validateAuthoringDocument, parseAuthoringDocument } from '../companion/authoring-contract.ts';
import { PROTOTYPE_REGISTRY, PROTOTYPE_MAX_BYTES, type PrototypeWorkspace } from '../companion/prototypes/model.ts';
import { validateWorkspace } from '../companion/prototypes/validate.ts';
import { workspaceFiles, readWorkspaceFiles, prototypeJsonText } from '../companion/prototypes/files.ts';
import { workspaceKey } from '../companion/prototypes/safety.ts';
import { exists, readBounded, hash, readConfiguration } from './files.ts';
import { requireThat, type Context } from './contracts.ts';
export interface WorkspaceRead { workspace: PrototypeWorkspace | null; files: Map<string, string> }
export async function loadPrototypeWorkspace(context: Context): Promise<WorkspaceRead> {
  const files = new Map<string, string>();
  if (!await exists(join(context.root, PROTOTYPE_REGISTRY))) return { workspace: null, files };
  let bytes = 0;
  const read = async (path: string) => {
    requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
    const raw = await readBounded(resolve(context.root, path), 4_000_000); bytes += raw.length;
    requireThat(bytes <= PROTOTYPE_MAX_BYTES, 'PROTOTYPE_LIMIT', 'Prototype directory exceeds 32 MB.');
    const content = new TextDecoder('utf-8', { fatal: true }).decode(raw); files.set(path, content); return content;
  };
  const workspace = await readWorkspaceFiles(read, validateAuthoringDocument, hash);
  const config = await readConfiguration(context.root);
  requireThat(!config || config.project.id === workspace.projectId, 'PROTOTYPE_PROJECT', 'The workspace does not belong to this configured project.');
  return { workspace, files };
}
export async function readPrototypeDocument(context: Context, input: string) {
  return parseAuthoringDocument(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(resolve(context.root, input), 4_000_000)));
}
export async function readPrototypeBundle(context: Context, input: string) {
  const bytes = await readBounded(resolve(context.root, input), PROTOTYPE_MAX_BYTES);
  return validateWorkspace(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), validateAuthoringDocument);
}
export async function prototypeWritePlan(context: Context, current: WorkspaceRead, next: PrototypeWorkspace) {
  const config = await readConfiguration(context.root);
  requireThat(!config || config.project.id === next.projectId, 'PROTOTYPE_PROJECT', 'The prototype source belongs to another configured project.');
  const entries = await workspaceFiles(next, validateAuthoringDocument, hash);
  const plan = await createFilePlan(context.root, entries), conflicts: string[] = [];
  for (const change of plan.changes) {
    const before = current.files.get(change.path);
    requireThat(change.beforeHash === (before === undefined ? null : hash(before)), 'PROTOTYPE_CONFLICT',
      'A prototype file changed during planning, or an unowned file occupies its path. Nothing was overwritten.');
  }
  requireThat([...current.files.keys()].every(path => entries.some(entry => entry.path === path)), 'PROTOTYPE_REMOVAL',
    'Import cannot remove saved prototypes, versions or variants. Archive them instead.');
  return { plan, conflicts, summary: { projectId: next.projectId, revision: next.revision, active: next.active, prototypes: next.prototypes.length,
    directory: 'docs/concepts/<prototype-name>/', execution: 'not-run' } };
}
/** Read-only input guards bind activation and all source bytes to the same plan/apply transaction. */
export async function bindPrototypePlan<T extends { plan: Awaited<ReturnType<typeof createFilePlan>>; summary: unknown; hash?: string }>(
  context: Context, planned: T, current: WorkspaceRead) {
  requireThat(resolve(planned.plan.root) === resolve(context.root), 'PROTOTYPE_VAULT', 'Managed prototype generation must use the current project root as its vault.');
  const entries = planned.plan.changes.map(({ path, content, encoding }) => ({ path, content, ...(encoding ? { encoding } : {}) }));
  for (const [path, content] of current.files) {
    requireThat(!entries.some(e => e.path === path), 'PROTOTYPE_OUTPUT_COLLISION', 'Generation must not overwrite prototype source files.'); entries.push({ path, content });
  }
  const plan = await createFilePlan(context.root, entries);
  for (const change of plan.changes) {
    const before = current.files.get(change.path);
    const prior = planned.plan.changes.find(c => c.path === change.path);
    requireThat(before !== undefined ? change.beforeHash === hash(before) : prior?.beforeHash === change.beforeHash, 'PLAN_STALE', 'Prototype source or target changed during planning.');
  }
  return { ...planned, plan, hash: hash(prototypeJsonText({ prior: planned.hash ?? null,
    workspace: current.workspace ? workspaceKey(current.workspace) : null, guards: [...current.files].map(([path, bytes]) => ({ path, hash: hash(bytes) })) })) };
}
