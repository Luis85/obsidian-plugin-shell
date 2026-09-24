import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { slug, title, recipeOptions } from './arguments.mjs';
import { createMakerContext } from './engine.mjs';
import { dispatchMaker } from './dispatch.mjs';

export async function planMaker(root, { maker, name, options }, { beforeFinalize } = {}) {
  slug(maker, 'recipe name');
  slug(name, 'maker name');
  if (maker === 'feature' && options['--feature'] !== undefined)
    throw new Error('--feature belongs to child recipes; feature uses its positional group name');
  if (maker === 'entity' && options['--entity'] !== undefined)
    throw new Error('--entity belongs to the feature recipe; entity uses its positional entity name');
  const allowed = new Set(recipeOptions(maker));
  for (const option of Object.keys(options))
    if (!allowed.has(option)) throw new Error(`${option} is not supported by the ${maker} recipe`);
  const owner = ['maker', 'locale'].includes(maker)
    ? undefined
    : slug(maker === 'feature' ? name : options['--feature'], 'feature name (--feature is required)');
  const entity = ['entity', 'feature'].includes(maker)
    ? slug(maker === 'entity' ? name : (options['--entity'] ?? name), 'entity name')
    : undefined;
  if (owner && `${owner}-${maker === 'feature' ? 'about-command' : `${name}-${maker}`}`.length > 64)
    throw new Error('Composed command identifier exceeds 64 characters; shorten the feature or component name');
  if (
    ['feature', 'view', 'store', 'component'].includes(maker) &&
    `${owner}-${maker === 'feature' ? 'workspace' : name}`.length > 54
  )
    throw new Error('Composed native view identifier exceeds 54 characters');
  if (maker === 'setting' && `${owner}-${name}-setting`.length > 50)
    throw new Error('Composed setting entity identifier exceeds 50 characters');
  const backend = options['--backend'] ?? (maker === 'entity' && !options['--document'] ? 'domain' : 'markdown');
  if (!['domain', 'markdown', 'plugin-data'].includes(backend))
    throw new Error('Unknown backend; select domain, markdown or plugin-data');
  if (options['--document'] && backend !== 'markdown') throw new Error('--document requires the markdown backend');
  const preset = options['--preset'] ?? 'title';
  const folder = options['--folder'] ?? title(owner ?? name);
  if (!['title', 'task', 'project'].includes(preset)) throw new Error('Unknown preset; select title, task or project');
  if (
    typeof folder !== 'string' ||
    folder.length > 160 ||
    folder !== folder.trim() ||
    folder
      .split('/')
      .some(
        (part) =>
          !part ||
          part.startsWith('.') ||
          /[<>:"|?*\\\u0000-\u001f]/.test(part) ||
          /[ .]$/.test(part) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
      )
  )
    throw new Error('Unsafe document folder');
  let ownerExists = false;
  if (owner) {
    try {
      const entry = await lstat(resolve(root, 'src/features', owner));
      if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Feature owner must be a real directory');
      ownerExists = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (maker !== 'feature' && !ownerExists)
      throw new Error(`Feature ${owner} does not exist. Create it first with make feature ${owner}.`);
  }
  const context = createMakerContext(root);
  await dispatchMaker(context, { maker, name, options, owner, entity, folder, preset, backend });
  const plan = await context.finish(beforeFinalize);
  if (maker === 'feature' && ownerExists && plan.changes.some((change) => change.status === 'create'))
    throw new Error(`Feature ${owner} already exists. Use a child recipe to extend it.`);
  const runtimeTests = [...context.tests].filter((path) => path.endsWith('.test.ts'));
  const toolingTests = [...context.tests].filter((path) => path.endsWith('.checks.mjs'));
  const metadata = ['feature', 'entity'].includes(maker)
    ? { entity, preset, backend, ...(backend === 'markdown' ? { folder } : {}) }
    : maker === 'setting'
      ? {
          backend: 'plugin-data',
          ...(options['--preference']
            ? { preference: options['--preference'] }
            : { entity: `${owner}-${name}-setting` }),
        }
      : {};
  return {
    maker,
    templateVersion: 2,
    owner,
    ...metadata,
    plan,
    checks: [
      {
        command: 'node',
        args: ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'],
      },
      ...(runtimeTests.length
        ? [
            {
              command: 'node',
              args: ['node_modules/vitest/vitest.mjs', 'run', ...runtimeTests],
            },
          ]
        : []),
      ...(toolingTests.length ? [{ command: 'node', args: ['--test', ...toolingTests] }] : []),
      { command: 'node', args: ['scripts/events/catalog.mjs', '--check'] },
      { command: 'node', args: ['scripts/makers/entities.mjs', '--check'] },
      { command: 'npm', args: ['run', 'verify'] },
    ],
  };
}
