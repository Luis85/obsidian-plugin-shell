/** Legacy API. Loading templates is separate from the pure renderer used by the compiler. */
import { loadTemplateSnapshot } from '../../../bin/compiler/adapters/template-snapshot.ts';
import { renderProjectFiles } from './plugin-emitter.ts';
import type { Model } from '../../companion/compiler/model.ts';
import type { Entry } from '../../companion/compiler/file-code.ts';
export async function projectFiles(templateRoot: string, model: Model): Promise<Entry[]> {
  return renderProjectFiles(await loadTemplateSnapshot(templateRoot), model);
}
