/** Compatibility API for existing fixture tooling. Rendering itself only consumes an immutable snapshot. */
import type { Model } from './model.ts';
import type { Add } from './file-code.ts';
import { renderFixtureCode } from '../../compiler/adapters/fixture-emitter.ts';
import { loadTemplateSnapshot } from '../../compiler/adapters/template-snapshot.ts';
export { fixtureManifest } from '../../compiler/adapters/fixture-emitter.ts';
export async function fixtureCode(root: string, model: Model, add: Add): Promise<boolean> {
  return renderFixtureCode(await loadTemplateSnapshot(root), model, add);
}
