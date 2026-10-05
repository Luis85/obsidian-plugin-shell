import { resolve } from 'node:path';
import { loadTemplateSnapshot } from '../../bin/compiler/adapters/template-snapshot.ts';
import { renderProjectFiles } from '../../bin/compiler/adapters/plugin-emitter.ts';

const repositoryRoot = resolve(import.meta.dirname, '../..');
let repositorySnapshot;
/**
 * Test convenience: snapshot a template root once, then render the plugin project from the immutable (frozen)
 * snapshot. The repository checkout is read-only to tests, so its snapshot is loaded once per test process; any
 * other root (a scratch template a test may edit between renders) is read again on every call.
 */
export async function projectFiles(templateRoot, model) {
  const snapshot = resolve(templateRoot) === repositoryRoot
    ? await (repositorySnapshot ??= loadTemplateSnapshot(repositoryRoot).catch(error => { repositorySnapshot = undefined; throw error; }))
    : await loadTemplateSnapshot(templateRoot);
  return renderProjectFiles(snapshot, model);
}
