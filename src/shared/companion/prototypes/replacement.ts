import type { PrototypeWorkspace } from './model.ts';
import { ensure, workspaceKey } from './safety.ts';
/** Imported bundles are reviewed data, not permission to erase history or thaw sealed versions. */
export function validateWorkspaceReplacement(before: PrototypeWorkspace | null, after: PrototypeWorkspace): void {
  if (!before) return;
  ensure(before.projectId === after.projectId, 'PROTOTYPE_PROJECT', 'Workspace belongs to another project.');
  if (workspaceKey(before) === workspaceKey(after)) return;
  ensure(after.revision > before.revision, 'PROTOTYPE_STALE', 'Imported workspace is older or diverged. Export both copies before reconciling.');
  for (const p of before.prototypes) {
    const replacement = after.prototypes.find(item => item.id === p.id);
    ensure(replacement, 'PROTOTYPE_REMOVAL', 'Import cannot remove a prototype. Archive it instead.');
    for (const v of p.versions) {
      const version = replacement.versions.find(item => item.id === v.id);
      ensure(version && (!v.sealed || version.sealed), 'PROTOTYPE_SEALED', 'Import cannot remove or unseal a saved version.');
      ensure(!v.sealed || version.label === v.label, 'PROTOTYPE_SEALED', 'Import cannot rename a sealed version.');
      for (const x of v.variants) {
        const variant = version.variants.find(item => item.id === x.id);
        ensure(variant, 'PROTOTYPE_REMOVAL', 'Import cannot remove a variant. Archive it instead.');
        const changed = workspaceKey(x.document) !== workspaceKey(variant.document) || x.name !== variant.name || x.hypothesis !== variant.hypothesis;
        ensure(!changed || (!v.sealed && x.status === 'draft' && !p.archived && variant.revision > x.revision),
          'PROTOTYPE_SNAPSHOT_PROTECTED', 'Imported edits must advance an editable draft. Fork protected snapshots instead.');
        ensure(variant.revision >= x.revision, 'PROTOTYPE_STALE', 'Import cannot roll back a variant revision.');
      }
      ensure(!v.sealed || version.variants.length === v.variants.length, 'PROTOTYPE_SEALED', 'Create a new version to add variants to a sealed checkpoint.');
    }
  }
}
