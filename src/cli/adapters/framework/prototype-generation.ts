import { join, relative } from 'node:path';
import { activeVariant } from '#shared/companion/prototypes/commands.ts';
import { snapshotPath } from '#shared/companion/prototypes/model.ts';
import { validateSelection } from '#shared/companion/prototypes/validate.ts';
import { workspaceKey, prototypeObject, revision } from '#shared/companion/prototypes/safety.ts';
import { prototypeJsonText } from '#shared/companion/prototypes/files.ts';
import { parseAuthoringDocument } from '#shared/companion/authoring-contract.ts';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { designFile } from './configuration.ts';
import { hash, readBounded, exists } from './files.ts';
import { stringOption, requireThat, type Request, type Context } from './contracts.ts';
import { loadPrototypeWorkspace, bindPrototypePlan } from './prototype-workspace.ts';
import type { generateSourcePlan } from './generation.ts';
/** In-place generation requires the canonical design to be the adopted active variant. */
async function checkAdopted(context: Context, variantDocument: Parameters<typeof workspaceKey>[0]): Promise<void> {
  requireThat(await exists(join(context.root, designFile)), 'PROTOTYPE_IMPORT_REQUIRED', 'Review prototypes adopt before in-place generation; no canonical design is imported.');
  const imported = parseAuthoringDocument((await readBounded(join(context.root, designFile), 4_000_000)).toString('utf8'));
  requireThat(workspaceKey(imported) === workspaceKey(variantDocument), 'PROTOTYPE_IMPORT_REQUIRED',
    'The canonical design does not match the active variant. Review prototypes adopt before in-place generation.');
}
/** A pre-existing receipt may only be replaced when it belongs to this managed project and is unchanged. */
async function checkPriorReceipt(context: Context, receipt: string, beforeHash: string, projectId: string): Promise<void> {
  const raw = await readBounded(join(context.root, receipt));
  const old: unknown = JSON.parse(raw.toString('utf8'));
  prototypeObject(old, ['schemaVersion', 'projectId', 'prototypeId', 'versionId', 'variantId', 'variantRevision', 'workspaceRevision', 'snapshotPath', 'snapshotHash']);
  const selection = { prototypeId: old.prototypeId, versionId: old.versionId, variantId: old.variantId };
  validateSelection(selection); revision(old.variantRevision); revision(old.workspaceRevision);
  requireThat(old.schemaVersion === 1 && old.projectId === projectId && hash(raw) === beforeHash &&
    old.snapshotPath === snapshotPath(selection) && typeof old.snapshotHash === 'string' && /^[a-f0-9]{64}$/.test(old.snapshotHash),
    'PROTOTYPE_RECEIPT_CONFLICT', 'Existing prototype receipt is incompatible with this project or changed during planning.');
}
/** Explicit --input retains standalone compatibility. Default generation honors the project registry. */
export async function managedGenerationPlan(request: Request, context: Context, compile: typeof generateSourcePlan) {
  if (stringOption(request.options, 'input') !== undefined) return compile(request, context);
  const current = await loadPrototypeWorkspace(context);
  if (!current.workspace) return compile(request, context);
  const selected = activeVariant(current.workspace), path = snapshotPath(selected.selection);
  const provenance = { ...selected.selection, variantRevision: selected.variant.revision,
    workspaceRevision: current.workspace.revision, snapshotPath: path, snapshotHash: hash(current.files.get(path)!) };
  // In-place generation compiles the adopted design; the active variant must be the adopted one.
  await checkAdopted(context, selected.variant.document);
  const planned = await compile(request, context);
  // Separate provenance receipt: the compiler continues to own its unchanged receipt contract.
  const receipt = relative(context.root, join(planned.summary.target, '.companion/prototype-selection.json')).replaceAll('\\', '/');
  const entries = planned.plan.changes.map(({ path, content, encoding }) => ({ path, content, ...(encoding ? { encoding } : {}) }));
  const priorReceipt = entries.find(e => e.path === receipt);
  requireThat(!priorReceipt, 'PROTOTYPE_OUTPUT_COLLISION', 'Compiler output collides with prototype provenance.');
  entries.push({ path: receipt, content: prototypeJsonText({ schemaVersion: 1, projectId: current.workspace.projectId, ...provenance }) });
  const plan = await createFilePlan(context.root, entries);
  for (const before of planned.plan.changes) requireThat(plan.changes.find(c => c.path === before.path)?.beforeHash === before.beforeHash,
    'PLAN_STALE', 'Generation output changed while binding prototype provenance.');
  // A pre-existing receipt may only be replaced when it belongs to this managed project.
  const change = plan.changes.find(c => c.path === receipt)!;
  if (change.beforeHash !== null) await checkPriorReceipt(context, receipt, change.beforeHash, current.workspace.projectId);
  return bindPrototypePlan(context, { ...planned, plan, summary: { ...planned.summary, prototypeSelection: provenance } }, current);
}
