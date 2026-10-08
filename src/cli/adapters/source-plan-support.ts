/** Shared pieces of the writing `source` commands: the manifest entry, the derived files a command touches, the declared manifest. */
import type { FilePlan, FilePlanEntry } from '#shared/platform/file-plan.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import type { SourceManifest } from '../domain/source-projects.ts';
import { manifestDocument } from '../domain/source-projects-edit.ts';
import { requireThat, type Context } from './framework/contracts.ts';
import { derivedEntries, type DerivedChange } from './source-derived.ts';
import { readSourceState, sourceManifestFile } from './source-workspace.ts';

export interface SourcePlanned { plan: FilePlan; summary: unknown; conflicts: string[] }
export const manifestEntry = (manifest: SourceManifest): FilePlanEntry => ({ path: sourceManifestFile, content: json(manifestDocument(manifest)) });
/** Changes the command itself causes, and how many other drifted files it leaves for `source check --fix`. */
export function selected(changes: readonly DerivedChange[], paths: (path: string) => boolean) {
  const chosen = changes.filter(change => paths(change.path));
  return { entries: derivedEntries(chosen), manual: chosen.filter(change => change.content === null).map(change => change.message),
    otherDrift: changes.filter(change => !paths(change.path)).length };
}
export async function declaredManifest(context: Context): Promise<SourceManifest> {
  const state = await readSourceState(context.root);
  requireThat(state.declared, 'SOURCE_MANIFEST_MISSING', `${sourceManifestFile} is missing; run source check --fix first.`);
  return state.manifest;
}
