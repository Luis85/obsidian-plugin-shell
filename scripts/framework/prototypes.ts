import { validateWorkspaceReplacement } from '../companion/prototypes/replacement.ts';
import { validateAuthoringDocument } from '../companion/authoring-contract.ts';
import { activeVariant, emptyWorkspace, changeWorkspace, workspaceSummary, selectedVariant } from '../companion/prototypes/commands.ts';
import { snapshotPath, variantStatuses, type PrototypeAction, type PrototypeSelection } from '../companion/prototypes/model.ts';
import { prototypeJsonText } from '../companion/prototypes/files.ts';
import { validateSelection } from '../companion/prototypes/validate.ts';
import { comparePrototypeDocuments } from '../companion/prototypes/compare.ts';
import { createFilePlan } from '../shared/file-plan.ts';
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
export async function prototypesPlan(request: Request, context: Context) {
  const current = await loadPrototypeWorkspace(context), command = request.command.slice('prototypes '.length);
  if (command === 'generate') {
    requireThat(current.workspace, 'PROTOTYPE_REQUIRED', 'Create or import a prototype workspace first.');
    return generationPlan({ ...request, command: 'generate' }, context);
  }
  if (command === 'adopt') {
    requireThat(current.workspace, 'PROTOTYPE_REQUIRED', 'Create or import a prototype workspace first.');
    const selected = activeVariant(current.workspace);
    const planned = await configurationPlan({ command: 'project import', args: [], options: { input: snapshotPath(selected.selection), ...(request.options.resolve ? { resolve: request.options.resolve } : {}) } }, context);
    return bindPrototypePlan(context, planned, current);
  }
  if (command === 'export') {
    requireThat(current.workspace, 'PROTOTYPE_REQUIRED', 'No prototype workspace exists.');
    const out = required(request, 'out');
    requireThat(!current.files.has(out) && !out.replaceAll('\\', '/').startsWith('docs/concepts/'), 'PROTOTYPE_OUTPUT_COLLISION', 'Export outside the managed prototype directory.');
    const plan = await createFilePlan(context.root, [{ path: out, content: prototypeJsonText(current.workspace) }]);
    requireThat(plan.changes.every(c => c.status !== 'update'), 'PROTOTYPE_EXPORT_EXISTS', 'Export refuses to overwrite a different existing file.');
    return bindPrototypePlan(context, { plan, conflicts: [], summary: { output: out, active: current.workspace.active } }, current);
  }
  if (command === 'import') {
    const next = await readPrototypeBundle(context, required(request, 'input'));
    requireThat(!current.workspace || next.projectId === current.workspace.projectId, 'PROTOTYPE_PROJECT', 'Imported workspace belongs to another project.');
    validateWorkspaceReplacement(current.workspace, next);
    return prototypeWritePlan(context, current, next);
  }
  const document = command === 'create' || command === 'save' ? await readPrototypeDocument(context, stringOption(request.options, 'input') ?? designFile) : null;
  const workspace = current.workspace ?? (document ? emptyWorkspace(document.project.id) : null);
  requireThat(workspace, 'PROTOTYPE_REQUIRED', 'Create a prototype or import a workspace first.');
  let action: PrototypeAction;
  if (command === 'create') {
    const id = request.args[0]; requireThat(id && document, 'PROTOTYPE_REQUIRED', 'Supply a prototype slug and project JSON.');
    action = { type: 'create', id, name: stringOption(request.options, 'name') ?? id, description: stringOption(request.options, 'description') ?? '', document };
  } else if (command === 'prototype-details') action = { type:'prototype-details', prototypeId:request.args[0] ?? '', name:required(request,'name'), description:stringOption(request.options,'description') ?? '' };
  else if (command === 'version-details') action = { type:'version-details', prototypeId:request.args[0] ?? '', versionId:required(request,'version'), label:required(request,'label') };
  else if (command === 'restore-snapshot') {
    const target = selection(request);
    action = { type:'restore-snapshot', selection:target, source:{prototypeId:stringOption(request.options,'from-prototype') ?? target.prototypeId,
      versionId:required(request,'from-version'),variantId:required(request,'from-variant')}, recoveryId:required(request,'recovery-version') };
  } else if (command === 'deactivate') action = { type: 'deactivate' };
  else if (command === 'version') action = { type: 'version', prototypeId: request.args[0] ?? '', id: required(request, 'version'), from: required(request, 'from') };
  else if (command === 'seal') action = { type: 'seal', prototypeId: request.args[0] ?? '', versionId: required(request, 'version') };
  else if (command === 'archive' || command === 'restore') action = { type: 'archive', prototypeId: request.args[0] ?? '', archived: command === 'archive' };
  else if (command === 'fork') action = { type: 'fork', selection: selection(request), id: required(request, 'as'), name: stringOption(request.options, 'name') ?? required(request, 'as'), hypothesis: stringOption(request.options, 'hypothesis') ?? '' };
  else if (command === 'save') { requireThat(document, 'PROTOTYPE_REQUIRED', 'Supply project JSON.'); action = { type: 'save', selection: selection(request), document }; }
  else if (command === 'status') {
    const status = required(request, 'status');
    requireThat(variantStatuses.some(s => s === status) && status !== 'active', 'PROTOTYPE_STATUS', 'Use draft, review, approved or archived. Use activate for the generation variant.');
    action = { type: 'status', selection: selection(request), status: status as 'draft' | 'review' | 'approved' | 'archived' };
  } else if (command === 'activate') action = { type: 'activate', selection: selection(request) };
  else if (command === 'details') action = { type: 'details', selection: selection(request), name: required(request, 'name'), hypothesis: stringOption(request.options, 'hypothesis') ?? '' };
  else throw Error('PROTOTYPE_COMMAND: Unknown operation.');
  return prototypeWritePlan(context, current, changeWorkspace(workspace, action, validateAuthoringDocument));
}
