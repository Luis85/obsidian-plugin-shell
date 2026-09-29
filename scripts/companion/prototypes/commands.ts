import type { AuthoringDocument } from '../authoring-contract.ts';
import { selectionKey, type PrototypeWorkspace, type PrototypeSelection, type PrototypeAction, type ValidateDocument } from './model.ts';
import { validateWorkspace, validateSelection } from './validate.ts';
import { ensure, prototypeJson, slug } from './safety.ts';
export function emptyWorkspace(projectId: string): PrototypeWorkspace {
  return { kind: 'workbench-prototype-workspace', schemaVersion: 1, projectId, revision: 1, active: null, prototypes: [] };
}
export function selectedVariant(workspace: PrototypeWorkspace, selection: PrototypeSelection) {
  validateSelection(selection);
  const prototype = workspace.prototypes.find(p => p.id === selection.prototypeId);
  const version = prototype?.versions.find(v => v.id === selection.versionId);
  const variant = version?.variants.find(v => v.id === selection.variantId);
  ensure(prototype && version && variant, 'PROTOTYPE_NOT_FOUND', 'The selected prototype, version or variant does not exist.');
  return { prototype, version, variant };
}
export function activeVariant(workspace: PrototypeWorkspace) {
  ensure(workspace.active, 'PROTOTYPE_ACTIVE_REQUIRED', 'Approve and activate a variant before generating. No variant is selected implicitly.');
  const item = selectedVariant(workspace, workspace.active);
  ensure(!item.prototype.archived && item.variant.status === 'active', 'PROTOTYPE_ACTIVE_INVALID', 'The active variant is unavailable.');
  return { ...item, selection: { ...workspace.active } };
}
function writable(item: ReturnType<typeof selectedVariant>): void {
  ensure(!item.prototype.archived && !item.version.sealed && item.variant.status === 'draft',
    'PROTOTYPE_READ_ONLY', 'Only draft variants in an unsealed, unarchived version can be changed. Fork or create a new version.');
}
function documentCopy(input: AuthoringDocument, projectId: string, validate: ValidateDocument): AuthoringDocument {
  const doc = validate(input); ensure(doc.project.id === projectId, 'PROTOTYPE_PROJECT', 'The source belongs to another project.');
  return structuredClone(doc);
}
/** Clone first, validate the full candidate last: failed mutations never alter caller-owned data. */
export function changeWorkspace(source: PrototypeWorkspace, action: PrototypeAction, validate: ValidateDocument): PrototypeWorkspace {
  validateWorkspace(source, validate); prototypeJson(action);
  const next = structuredClone(source);
  if (action.type === 'create') {
    slug(action.id); ensure(!next.prototypes.some(p => p.id === action.id), 'PROTOTYPE_DUPLICATE', 'Prototype slug already exists.');
    next.prototypes.push({ id: action.id, name: action.name, description: action.description, archived: false,
      versions: [{ id: 'v1', label: 'Version 1', sealed: false, variants: [{ id: 'main', name: 'Main', hypothesis: '', status: 'draft', revision: 1,
        document: documentCopy(action.document, next.projectId, validate) }] }] });
  } else if (action.type === 'deactivate') {
    if (next.active) selectedVariant(next, next.active).variant.status = 'approved'; next.active = null;
  } else if (action.type === 'version' || action.type === 'seal' || action.type === 'archive') {
    const p = next.prototypes.find(p => p.id === action.prototypeId); ensure(p, 'PROTOTYPE_NOT_FOUND', 'Prototype not found.');
    if (action.type === 'archive') {
      ensure(!action.archived || next.active?.prototypeId !== p.id, 'PROTOTYPE_ACTIVE_PROTECTED', 'Activate a replacement or deactivate before archiving.');
      p.archived = action.archived;
    } else {
      ensure(!p.archived, 'PROTOTYPE_READ_ONLY', 'Restore the prototype first.');
      const v = p.versions.find(v => v.id === (action.type === 'version' ? action.from : action.versionId));
      ensure(v, 'PROTOTYPE_NOT_FOUND', 'Source version not found.');
      if (action.type === 'seal') v.sealed = true;
      else {
        slug(action.id); ensure(!p.versions.some(v => v.id === action.id), 'PROTOTYPE_DUPLICATE', 'Version slug already exists.');
        p.versions.push({ ...structuredClone(v), id: action.id, label: action.id, sealed: false,
          variants: v.variants.map(x => ({ ...structuredClone(x), status: 'draft', revision: 1 })) });
      }
    }
  } else {
    const item = selectedVariant(next, action.selection);
    if (action.type === 'activate') {
      ensure(!item.prototype.archived && item.variant.status === 'approved', 'PROTOTYPE_APPROVAL_REQUIRED', 'Approve an unarchived variant before activation.');
      if (next.active) selectedVariant(next, next.active).variant.status = 'approved';
      item.variant.status = 'active'; next.active = { ...action.selection };
    } else if (action.type === 'status') {
      ensure(!item.prototype.archived && item.variant.status !== 'active', 'PROTOTYPE_ACTIVE_PROTECTED', 'Active or archived prototypes cannot change status here.');
      ensure(item.variant.status !== 'archived' || action.status === 'draft', 'PROTOTYPE_STATUS', 'Restore an archived variant to draft first.');
      item.variant.status = action.status;
    } else if (action.type === 'fork') {
      ensure(!item.prototype.archived && !item.version.sealed, 'PROTOTYPE_READ_ONLY', 'Create a new version before forking a sealed version.');
      slug(action.id); ensure(!item.version.variants.some(v => v.id === action.id), 'PROTOTYPE_DUPLICATE', 'Variant slug already exists.');
      item.version.variants.push({ ...structuredClone(item.variant), id: action.id, name: action.name, hypothesis: action.hypothesis, status: 'draft', revision: 1 });
    } else if (action.type === 'save' || action.type === 'details') {
      writable(item);
      if (action.type === 'save') item.variant.document = documentCopy(action.document, next.projectId, validate);
      else { item.variant.name = action.name; item.variant.hypothesis = action.hypothesis; }
      item.variant.revision++;
    } else ensure(false, 'PROTOTYPE_ACTION', 'Unsupported workspace action.');
  }
  next.revision++;
  return validateWorkspace(next, validate);
}
export function workspaceSummary(workspace: PrototypeWorkspace) {
  return { projectId: workspace.projectId, revision: workspace.revision, active: workspace.active,
    prototypes: workspace.prototypes.map(p => ({ id: p.id, name: p.name, archived: p.archived,
      versions: p.versions.map(v => ({ id: v.id, sealed: v.sealed, variants: v.variants.map(x => ({ id: x.id, name: x.name, status: x.status,
        revision: x.revision, active: selectionKey(workspace.active) === selectionKey({ prototypeId: p.id, versionId: v.id, variantId: x.id }),
        surfaces: x.document.design.nodes.length, routes: x.document.design.sitemap?.routes.length ?? 0 })) })) })) };
}
