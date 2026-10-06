import { join } from 'node:path';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { exists } from './files.ts';
import { inspectDesign } from './changes.ts';
import { runNode } from './process.ts';

interface ClickdummyDependencies {
  exists: typeof exists;
  inspectDesign: typeof inspectDesign;
  runNode: typeof runNode;
}

const defaults: ClickdummyDependencies = { exists, inspectDesign, runNode };
/** The shipped worker: a framework checkout keeps it inside the prototype skill; a generated project carries only the worker under scripts/clickdummy/. */
const skillWorker = '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs';
const projectWorker = 'scripts/clickdummy/lib/build-worker.mjs';

/** Fixed generated entry, shipped prototype worker and one local artifact; no alternate compiler or shell parsing. */
export async function buildClickdummy(
  request: Request,
  context: Context,
  dependencies: ClickdummyDependencies = defaults,
): Promise<Result> {
  if (request.options['dry-run']) return result(request.command, {
    entry: 'harness/prototype/clickdummy.ts',
    output: 'clickdummy.html',
    execution: 'not-run',
    requires: 'A reviewed generated project and its installed lockfile. This executes trusted project build code.',
  }, 'planned');

  requireThat(
    await dependencies.exists(join(context.root, '.companion/generation.json'))
      && await dependencies.exists(join(context.root, 'harness/prototype/clickdummy.ts')),
    'CLICKDUMMY_PROJECT_REQUIRED',
    'Generate or regenerate the project with this framework before building its clickdummy.',
  );

  const input = 'design/project.json';
  const { model } = await dependencies.inspectDesign(context, input);
  const worker = await dependencies.exists(join(context.root, skillWorker)) ? skillWorker : projectWorker;
  const execution = await dependencies.runNode(context, worker, [
    '--entry', join(context.root, 'harness/prototype/clickdummy.ts'),
    '--project', join(context.root, input),
    '--out', join(context.root, 'clickdummy.html'),
    '--title', String(model.project.name),
    ...(request.options.replace ? ['--replace'] : []),
  ], Number(stringOption(request.options, 'timeout') ?? '600000'));

  requireThat(!execution.truncated, 'CLICKDUMMY_OUTPUT_LIMIT', 'Build output was truncated; do not infer success.');
  const receipt: unknown = JSON.parse(execution.stdout);
  requireThat(
    receipt && typeof receipt === 'object' && 'status' in receipt && receipt.status === 'built-not-browser-verified',
    'CLICKDUMMY_RECEIPT',
    'The worker did not return a completed build receipt.',
  );
  return result(request.command, { receipt, acceptance: 'not-inferred', execution });
}
