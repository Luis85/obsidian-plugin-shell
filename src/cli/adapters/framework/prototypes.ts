import { validateWorkspaceReplacement } from '../../../../scripts/companion/prototypes/replacement.ts';
import { validateAuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { activeVariant, emptyWorkspace, changeWorkspace, workspaceSummary, selectedVariant } from '../../../../scripts/companion/prototypes/commands.ts';
import { snapshotPath, variantStatuses, type PrototypeAction, type PrototypeSelection } from '../../../../scripts/companion/prototypes/model.ts';
import { prototypeJsonText } from '../../../../scripts/companion/prototypes/files.ts';
import { validateSelection } from '../../../../scripts/companion/prototypes/validate.ts';
import { comparePrototypeDocuments } from '../../../../scripts/companion/prototypes/compare.ts';
import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { configurationPlan } from './changes.ts';
import { generationPlan } from './generation.ts';
import { designFile } from './configuration.ts';
import { stringOption, requireThat, type Request, type Context } from './contracts.ts';
import { loadPrototypeWorkspace, readPrototypeDocument, readPrototypeBundle, prototypeWritePlan, bindPrototypePlan } from './prototype-workspace.ts';
function selection(request: Request): PrototypeSelection {
  const value = { prototypeId: request.args[0], versionId: stringOption(request.options, 'version'), variantId: stringOption(request.options, 'variant') };
  validateSelection(value); return value;
}
function required(request: Request, key: string): string {
  const value = stringOption(request.options, key); requireThat(value, 'PROTOTYPE_OPTION', `Supply --${key}.`); return value;
}
export async function prototypesRead(context: Context) {
  const { workspace } = await loadPrototypeWorkspace(context);
  return workspace ? workspaceSummary(workspace) : { active: null, prototypes: [], directory: 'docs/concepts/<prototype-name>/' };
}
export async function prototypesCompare(request: Request, context: Context) {
  const { workspace } = await loadPrototypeWorkspace(context);
  requireThat(workspace, 'PROTOTYPE_REQUIRED', 'Create or import a prototype workspace first.');
  const before = selection(request), after = {
    prototypeId: stringOption(request.options,'with-prototype') ?? before.prototypeId,
    versionId: stringOption(request.options,'with-version') ?? before.versionId,
    variantId: required(request,'with-variant'),
  };
  validateSelection(after);
  return { before, after, comparison: comparePrototypeDocuments(selectedVariant(workspace,before).variant.document,selectedVariant(workspace,after).variant.document) };
}
type Workspace = Awaited<ReturnType<typeof loadPrototypeWorkspace>>;
type PrototypeDocument = Awaited<ReturnType<typeof readPrototypeDocument>>;
function requireWorkspace(current: Workspace, message = 'Create or import a prototype workspace first.'): NonNullable<Workspace['workspace']> {
  requireThat(current.workspace, 'PROTOTYPE_REQUIRED', message);
  return current.workspace;
}
async function adoptPlan(request: Request, context: Context, current: Workspace) {
  const selected = activeVariant(requireWorkspace(current));
  const planned = await configurationPlan({ command: 'project import', args: [], options: { input: snapshotPath(selected.selection), ...(request.options.resolve ? { resolve: request.options.resolve } : {}) } }, context);
  return bindPrototypePlan(context, planned, current);
}
async function exportPlan(request: Request, context: Context, current: Workspace) {
  const workspace = requireWorkspace(current, 'No prototype workspace exists.');
  const out = required(request, 'out');
  requireThat(!current.files.has(out) && !out.replaceAll('\\', '/').startsWith('docs/concepts/'), 'PROTOTYPE_OUTPUT_COLLISION', 'Export outside the managed prototype directory.');
  const plan = await createFilePlan(context.root, [{ path: out, content: prototypeJsonText(workspace) }]);
  requireThat(plan.changes.every(c => c.status !== 'update'), 'PROTOTYPE_EXPORT_EXISTS', 'Export refuses to overwrite a different existing file.');
  return bindPrototypePlan(context, { plan, conflicts: [], summary: { output: out, active: workspace.active } }, current);
}
async function importPlan(request: Request, context: Context, current: Workspace) {
  const next = await readPrototypeBundle(context, required(request, 'input'));
  requireThat(!current.workspace || next.projectId === current.workspace.projectId, 'PROTOTYPE_PROJECT', 'Imported workspace belongs to another project.');
  validateWorkspaceReplacement(current.workspace, next);
  return prototypeWritePlan(context, current, next);
}
const prototypeId = (request: Request) => request.args[0] ?? '';
function statusAction(request: Request): PrototypeAction {
  const status = required(request, 'status');
  requireThat(variantStatuses.some(s => s === status) && status !== 'active', 'PROTOTYPE_STATUS', 'Use draft, review, approved or archived. Use activate for the generation variant.');
  return { type: 'status', selection: selection(request), status: status as 'draft' | 'review' | 'approved' | 'archived' };
}
function restoreAction(request: Request): PrototypeAction {
  const target = selection(request);
  return { type:'restore-snapshot', selection:target, source:{prototypeId:stringOption(request.options,'from-prototype') ?? target.prototypeId,
    versionId:required(request,'from-version'),variantId:required(request,'from-variant')}, recoveryId:required(request,'recovery-version') };
}
/** Workspace edits; each builder reads only its own options so validation order stays per command. */
const actions: Record<string, (request: Request, document: PrototypeDocument | null) => PrototypeAction> = {
  create: (request, document) => {
    const id = request.args[0]; requireThat(id && document, 'PROTOTYPE_REQUIRED', 'Supply a prototype slug and project JSON.');
    return { type: 'create', id, name: stringOption(request.options, 'name') ?? id, description: stringOption(request.options, 'description') ?? '', document };
  },
  'prototype-details': request => ({ type:'prototype-details', prototypeId:prototypeId(request), name:required(request,'name'), description:stringOption(request.options,'description') ?? '' }),
  'version-details': request => ({ type:'version-details', prototypeId:prototypeId(request), versionId:required(request,'version'), label:required(request,'label') }),
  'restore-snapshot': restoreAction,
  deactivate: () => ({ type: 'deactivate' }),
  version: request => ({ type: 'version', prototypeId: prototypeId(request), id: required(request, 'version'), from: required(request, 'from') }),
  seal: request => ({ type: 'seal', prototypeId: prototypeId(request), versionId: required(request, 'version') }),
  archive: request => ({ type: 'archive', prototypeId: prototypeId(request), archived: true }),
  restore: request => ({ type: 'archive', prototypeId: prototypeId(request), archived: false }),
  fork: request => ({ type: 'fork', selection: selection(request), id: required(request, 'as'), name: stringOption(request.options, 'name') ?? required(request, 'as'), hypothesis: stringOption(request.options, 'hypothesis') ?? '' }),
  save: (request, document) => { requireThat(document, 'PROTOTYPE_REQUIRED', 'Supply project JSON.'); return { type: 'save', selection: selection(request), document }; },
  status: statusAction,
  activate: request => ({ type: 'activate', selection: selection(request) }),
  details: request => ({ type: 'details', selection: selection(request), name: required(request, 'name'), hypothesis: stringOption(request.options, 'hypothesis') ?? '' }),
};
export async function prototypesPlan(request: Request, context: Context) {
  const current = await loadPrototypeWorkspace(context), command = request.command.slice('prototypes '.length);
  switch (command) {
    case 'generate': requireWorkspace(current); return generationPlan({ ...request, command: 'generate' }, context);
    case 'adopt': return adoptPlan(request, context, current);
    case 'export': return exportPlan(request, context, current);
    case 'import': return importPlan(request, context, current);
  }
  return editPlan(request, context, current, command);
}
/** create and save read project JSON; a create may start the first workspace. */
async function editPlan(request: Request, context: Context, current: Workspace, command: string) {
  const document = command === 'create' || command === 'save' ? await readPrototypeDocument(context, stringOption(request.options, 'input') ?? designFile) : null;
  const workspace = current.workspace ?? (document ? emptyWorkspace(document.project.id) : null);
  requireThat(workspace, 'PROTOTYPE_REQUIRED', 'Create a prototype or import a workspace first.');
  if (!Object.hasOwn(actions, command)) throw Error('PROTOTYPE_COMMAND: Unknown operation.');
  return prototypeWritePlan(context, current, changeWorkspace(workspace, actions[command]!(request, document), validateAuthoringDocument));
}
