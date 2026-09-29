import { variantStatuses, selectionKey, type PrototypeWorkspace, type PrototypeSelection, type ValidateDocument } from './model.ts';
import { prototypeJson, prototypeObject, text, slug, revision, collection, unique, ensure } from './safety.ts';
export function validateSelection(value: unknown): asserts value is PrototypeSelection {
  prototypeJson(value);
  prototypeObject(value, ['prototypeId', 'versionId', 'variantId']); slug(value.prototypeId); slug(value.versionId); slug(value.variantId);
}
function assertWorkspace(input: unknown, validateDocument: ValidateDocument): asserts input is PrototypeWorkspace {
  prototypeJson(input);
  prototypeObject(input, ['kind', 'schemaVersion', 'projectId', 'revision', 'active', 'prototypes']);
  ensure(input.kind === 'workbench-prototype-workspace' && input.schemaVersion === 1, 'PROTOTYPE_VERSION', 'Unsupported prototype workspace format.');
  text(input.projectId); revision(input.revision); collection(input.prototypes, 40);
  if (input.active !== null) validateSelection(input.active);
  const activeSelection = input.active;
  const active: string[] = [], ids: string[] = []; let snapshots = 0;
  for (const p of input.prototypes) {
    prototypeObject(p, ['id', 'name', 'description', 'archived', 'versions']); slug(p.id); text(p.name); text(p.description, 2000, true);
    ensure(typeof p.archived === 'boolean', 'PROTOTYPE_SHAPE', 'Invalid archive state.'); ids.push(p.id);
    collection(p.versions, 40); ensure(p.versions.length > 0, 'PROTOTYPE_SHAPE', 'A prototype needs a version.');
    const versions: string[] = [];
    for (const v of p.versions) {
      prototypeObject(v, ['id', 'label', 'sealed', 'variants']); slug(v.id); text(v.label); versions.push(v.id);
      ensure(typeof v.sealed === 'boolean', 'PROTOTYPE_SHAPE', 'Invalid version seal.'); collection(v.variants, 40);
      ensure(v.variants.length > 0, 'PROTOTYPE_SHAPE', 'A version needs a variant.'); const variants: string[] = [];
      for (const item of v.variants) {
        ensure(++snapshots <= 200, 'PROTOTYPE_LIMIT', 'Workspace supports at most 200 saved variants.');
        prototypeObject(item, ['id', 'name', 'hypothesis', 'status', 'revision', 'document']); slug(item.id); text(item.name); text(item.hypothesis, 2000, true); revision(item.revision);
        ensure(variantStatuses.some(s => s === item.status), 'PROTOTYPE_STATUS', 'Unknown variant status.'); variants.push(item.id);
        const document = validateDocument(item.document);
        ensure(document.project.id === input.projectId, 'PROTOTYPE_PROJECT', 'Every snapshot must belong to this project.');
        if (item.status === 'active') {
          ensure(!p.archived, 'PROTOTYPE_ACTIVE_ARCHIVED', 'An archived prototype cannot be active.');
          active.push(selectionKey({ prototypeId: p.id, versionId: v.id, variantId: item.id }));
        }
      }
      unique(variants);
    }
    unique(versions);
  }
  unique(ids);
  ensure(activeSelection === null ? active.length === 0 : active.length === 1 && active[0] === selectionKey(activeSelection),
    'PROTOTYPE_ACTIVE_INVALID', 'The active selection and the single active variant must agree.');

}

export function validateWorkspace(input: unknown, validateDocument: ValidateDocument): PrototypeWorkspace {
  assertWorkspace(input, validateDocument); return input;
}
