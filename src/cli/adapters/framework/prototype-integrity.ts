import { opendir } from 'node:fs/promises';
import { join } from 'node:path';
import { PROTOTYPE_REGISTRY, PROTOTYPE_ROOT } from '../../../../scripts/companion/prototypes/model.ts';
import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { exists } from './files.ts';
import { requireThat, type Context } from './contracts.ts';

/** Missing metadata is not permission to silently switch a managed project to standalone generation. */
export async function assertNoOrphanedPrototypes(context: Context): Promise<void> {
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  // Inspect ancestor links and case collisions without creating a lock or writing a file.
  const probe = await createFilePlan(context.root, [{ path: PROTOTYPE_REGISTRY, content: null }]);
  requireThat(probe.changes[0]?.beforeHash === null, 'PLAN_STALE', 'Prototype registry appeared during inspection. Review the current workspace before generation.');
  const directory = join(context.root, PROTOTYPE_ROOT);
  if (!await exists(directory)) return;
  let entries = 0;
  for await (const entry of await opendir(directory)) {
    requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
    requireThat(++entries <= 4096, 'PROTOTYPE_LIMIT', 'Cannot establish an unmanaged workspace within the bounded concepts-directory scan. Restore or inspect the registry.');
    requireThat(!entry.isSymbolicLink(), 'PROTOTYPE_LINK', 'Resolve the symlink in docs/concepts before establishing an unmanaged workspace.');
    if (!entry.isDirectory()) continue;
    // prototype.json is the managed folder's reserved manifest. Do not parse uncertain or partial bytes.
    requireThat(!await exists(join(directory, entry.name, 'prototype.json')), 'PROTOTYPE_REGISTRY_MISSING',
      'Prototype manifests remain, but docs/concepts/prototypes.json is missing. Restore the registry from a known-good backup; saved variants have not been changed.');
  }
}
