/** Compile in a worker: the shell's Vite pipeline intentionally resolves against cwd. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { framework } from './lib/framework.mjs';
import { noLinks, readBytes } from './lib/io.mjs';
export async function buildPrototype({ repo, entry, project, out, title, replace = false, signal }) {
  const api = await framework(repo);
  const context = { ...api.context, signal };
  const input = noLinks(path.resolve(api.root, project));
  readBytes(input, 4_000_000);
  const checked = await api.executeOperation({ command: 'project inspect', args: [], options: { input } }, context);
  if (checked.status !== 'ok') return checked;
  const worker = fileURLToPath(new URL('lib/build-worker.mjs', import.meta.url));
  const argv = ['--entry', path.resolve(api.root, entry), '--project', input,
    '--out', path.resolve(out), '--title', title, ...(replace ? ['--replace'] : [])];
  try {
    const execution = await api.runNode(context, worker, argv, 600000);
    if (execution.truncated) throw new Error('PROTOTYPE_OUTPUT_LIMIT: build receipt was truncated');
    const result = JSON.parse(execution.stdout);
    if (result.status !== 'built-not-browser-verified') throw new Error('PROTOTYPE_BUILD_RECEIPT');
    return api.result('prototype build', { ...result, execution });
  } catch (error) { return api.failure('prototype build', error); }
}
