/** Compatibility API for existing fixture tooling. Rendering itself only consumes an immutable snapshot. */
import type { Model } from '../../companion/compiler/model.ts';
import type { Add } from '../../companion/compiler/file-code.ts';
import { renderFixtureCode } from './fixture-emitter.ts';
import { loadTemplateSnapshot } from './template-snapshot.ts';
export { fixtureManifest } from './fixture-emitter.ts';
export async function fixtureCode(root: string, model: Model, add: Add): Promise<boolean> {
  return renderFixtureCode(await loadTemplateSnapshot(root), model, add);
}
