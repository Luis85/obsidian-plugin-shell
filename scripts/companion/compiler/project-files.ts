/** Legacy API. Loading templates is separate from the pure renderer used by the compiler. */
import { loadTemplateSnapshot } from '../../compiler/adapters/template-snapshot.ts';
import { renderProjectFiles } from '../../compiler/adapters/plugin-emitter.ts';
import type { Model } from './model.ts';
import type { Entry } from './file-code.ts';
export async function projectFiles(templateRoot: string, model: Model): Promise<Entry[]> {
  return renderProjectFiles(await loadTemplateSnapshot(templateRoot), model);
}
