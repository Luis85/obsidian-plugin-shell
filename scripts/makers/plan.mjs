import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { slug, title, recipeOptions } from './arguments.mjs';
import { createMakerContext } from './engine.mjs';
import { dispatchMaker } from './dispatch.mjs';

const ownerless = ['maker', 'locale', 'plugin'];
const surfaces = ['feature', 'view', 'store', 'component'];
const reservedSegment = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function checkRecipeOptions(maker, options) {
  if (maker === 'feature' && options['--feature'] !== undefined)
    throw new Error('--feature belongs to child recipes; feature uses its positional group name');
  if (maker === 'entity' && options['--entity'] !== undefined)
    throw new Error('--entity belongs to the feature recipe; entity uses its positional entity name');
  const allowed = new Set(recipeOptions(maker));
  for (const option of Object.keys(options))
    if (!allowed.has(option)) throw new Error(`${option} is not supported by the ${maker} recipe`);
}
function resolveOwner(maker, name, options) {
  if (ownerless.includes(maker)) return undefined;
  return slug(maker === 'feature' ? name : options['--feature'], 'feature name (--feature is required)');
}
function resolveEntity(maker, name, options) {
  if (!['entity', 'feature'].includes(maker)) return undefined;
  return slug(maker === 'entity' ? name : (options['--entity'] ?? name), 'entity name');
}
function checkIdentifierLengths(maker, owner, name) {
  if (owner && `${owner}-${maker === 'feature' ? 'about-command' : `${name}-${maker}`}`.length > 64)
    throw new Error('Composed command identifier exceeds 64 characters; shorten the feature or component name');
  if (surfaces.includes(maker) && `${owner}-${maker === 'feature' ? 'workspace' : name}`.length > 54)
    throw new Error('Composed native view identifier exceeds 54 characters');
  if (maker === 'setting' && `${owner}-${name}-setting`.length > 50)
    throw new Error('Composed setting entity identifier exceeds 50 characters');
}
function resolveBackend(maker, options) {
  const backend = options['--backend'] ?? (maker === 'entity' && !options['--document'] ? 'domain' : 'markdown');
  if (!['domain', 'markdown', 'plugin-data'].includes(backend))
    throw new Error('Unknown backend; select domain, markdown or plugin-data');
  if (options['--document'] && backend !== 'markdown') throw new Error('--document requires the markdown backend');
  return backend;
}
const unsafeSegment = (part) =>
  !part || part.startsWith('.') || /[<>:"|?*\\\u0000-\u001f]/.test(part) || /[ .]$/.test(part) || reservedSegment.test(part);
function unsafeFolder(folder) {
  return typeof folder !== 'string' || folder.length > 160 || folder !== folder.trim() || folder.split('/').some(unsafeSegment);
}
function resolveDocument(options, owner, name) {
  const preset = options['--preset'] ?? 'title';
  const folder = options['--folder'] ?? title(owner ?? name);
  if (!['title', 'task', 'project'].includes(preset)) throw new Error('Unknown preset; select title, task or project');
  if (unsafeFolder(folder)) throw new Error('Unsafe document folder');
  return { preset, folder };
}
async function ownerDirectoryExists(root, owner) {
  try {
    const entry = await lstat(resolve(root, 'src/features', owner));
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Feature owner must be a real directory');
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}
async function checkOwner(root, maker, owner) {
  if (!owner) return false;
  const exists = await ownerDirectoryExists(root, owner);
  if (maker !== 'feature' && !exists)
    throw new Error(`Feature ${owner} does not exist. Create it first with make feature ${owner}.`);
  return exists;
}
function planMetadata({ maker, name, options, owner, entity, preset, backend, folder }) {
  if (['feature', 'entity'].includes(maker)) return { entity, preset, backend, ...(backend === 'markdown' ? { folder } : {}) };
  if (maker !== 'setting') return {};
  const preference = options['--preference'];
  return { backend: 'plugin-data', ...(preference ? { preference } : { entity: `${owner}-${name}-setting` }) };
}
const pluginChecks = [
  { command: 'node', args: ['scripts/quality/check-workbench-plugins.mjs'] },
  { command: 'node', args: ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'tsconfig.maker.json'] },
  { command: 'node', args: ['scripts/testing/suites.mjs', 'workbench-plugins'] },
];
function planChecks(maker, tests) {
  const runtimeTests = [...tests].filter((path) => path.endsWith('.test.ts'));
  const toolingTests = [...tests].filter((path) => path.endsWith('.checks.mjs'));
  return [
    ...(maker === 'plugin' ? pluginChecks : []),
    { command: 'node', args: ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'] },
    ...(runtimeTests.length
      ? [{ command: 'node', args: ['node_modules/vitest/vitest.mjs', 'run', '--config', 'configs/testing/vitest.config.mjs', ...runtimeTests] }]
      : []),
    ...(toolingTests.length ? [{ command: 'node', args: ['--test', ...toolingTests] }] : []),
    { command: 'node', args: ['scripts/events/catalog.mjs', '--check'] },
    { command: 'node', args: ['scripts/makers/entities.mjs', '--check'] },
    { command: 'npm', args: ['run', 'verify'] },
  ];
}
/** Validation order is part of the contract: earlier problems are reported first. */
function resolveRequest({ maker, name, options }) {
  slug(maker, 'recipe name');
  slug(name, 'maker name');
  checkRecipeOptions(maker, options);
  const owner = resolveOwner(maker, name, options);
  const entity = resolveEntity(maker, name, options);
  checkIdentifierLengths(maker, owner, name);
  const backend = resolveBackend(maker, options);
  return { maker, name, options, owner, entity, backend, ...resolveDocument(options, owner, name) };
}
export async function planMaker(root, request, { beforeFinalize } = {}) {
  const input = resolveRequest(request);
  const { maker, owner } = input;
  const ownerExists = await checkOwner(root, maker, owner);
  const context = createMakerContext(root);
  await dispatchMaker(context, input);
  const plan = await context.finish(beforeFinalize);
  if (maker === 'feature' && ownerExists && plan.changes.some((change) => change.status === 'create'))
    throw new Error(`Feature ${owner} already exists. Use a child recipe to extend it.`);
  return {
    maker,
    templateVersion: 2,
    owner,
    ...planMetadata(input),
    plan,
    checks: planChecks(maker, context.tests),
  };
}
