import { loadTemplateSnapshot } from '../../bin/compiler/adapters/template-snapshot.ts';
import { renderProjectFiles } from '../../scripts/compiler/adapters/plugin-emitter.ts';

/** Test convenience: snapshot a template root once, then render the plugin project from the immutable snapshot. */
export async function projectFiles(templateRoot, model) {
  return renderProjectFiles(await loadTemplateSnapshot(templateRoot), model);
}
