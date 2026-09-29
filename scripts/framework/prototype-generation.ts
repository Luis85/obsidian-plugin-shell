import { join, relative } from 'node:path';
import { activeVariant } from '../companion/prototypes/commands.ts';
import { snapshotPath } from '../companion/prototypes/model.ts';
import { validateSelection } from '../companion/prototypes/validate.ts';
import { workspaceKey, prototypeObject as object, revision } from '../companion/prototypes/safety.ts';
import { prototypeJsonText } from '../companion/prototypes/files.ts';
import { parseAuthoringDocument } from '../companion/authoring-contract.ts';
import { createFilePlan } from '../shared/file-plan.mjs';
import { designFile } from './configuration.ts';
import { hash, readBounded, exists } from './files.ts';
import { stringOption, requireThat, type Request, type Context } from './contracts.ts';
import { loadPrototypeWorkspace, bindPrototypePlan } from './prototype-workspace.ts';
import type { generateSourcePlan } from './generation.ts';
/** Explicit --input retains standalone compatibility. Default generation honors the project registry. */
export async function managedGenerationPlan(request: Request, context: Context, compile: typeof generateSourcePlan) {
  if (stringOption(request.options, 'input') !== undefined) return compile(request, context);
  const current = await loadPrototypeWorkspace(context);
  if (!current.workspace) return compile(request, context);
  const selected = activeVariant(current.workspace), path = snapshotPath(selected.selection);
  const provenance = { ...selected.selection, variantRevision: selected.variant.revision,
    workspaceRevision: current.workspace.revision, snapshotPath: path, snapshotHash: hash(current.files.get(path)!) };
  const target = stringOption(request.options, 'target');
  if (target === undefined) {
    requireThat(await exists(join(context.root, designFile)), 'PROTOTYPE_IMPORT_REQUIRED', 'Review prototypes adopt before in-place generation; no canonical design is imported.');
    const imported = parseAuthoringDocument((await readBounded(join(context.root, designFile), 4_000_000)).toString('utf8'));
    requireThat(workspaceKey(imported) === workspaceKey(selected.variant.document), 'PROTOTYPE_IMPORT_REQUIRED',
      'The canonical design does not match the active variant. Review prototypes adopt before in-place generation.');
  }
  const planned = await compile({ ...request, options: { ...request.options, ...(target === undefined ? {} : { input: path }) } }, context);
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
  if (change.beforeHash !== null) {
    const raw = await readBounded(join(context.root, receipt));
    const old: unknown = JSON.parse(raw.toString('utf8'));
    object(old, ['schemaVersion', 'projectId', 'prototypeId', 'versionId', 'variantId', 'variantRevision', 'workspaceRevision', 'snapshotPath', 'snapshotHash']);
    const selection = { prototypeId: old.prototypeId, versionId: old.versionId, variantId: old.variantId };
    validateSelection(selection); revision(old.variantRevision); revision(old.workspaceRevision);
    requireThat(old.schemaVersion === 1 && old.projectId === current.workspace.projectId && hash(raw) === change.beforeHash &&
      old.snapshotPath === snapshotPath(selection) && typeof old.snapshotHash === 'string' && /^[a-f0-9]{64}$/.test(old.snapshotHash),
      'PROTOTYPE_RECEIPT_CONFLICT', 'Existing prototype receipt is incompatible with this project or changed during planning.');
  }
  return bindPrototypePlan(context, { ...planned, plan, summary: { ...planned.summary, prototypeSelection: provenance } }, current);
}
