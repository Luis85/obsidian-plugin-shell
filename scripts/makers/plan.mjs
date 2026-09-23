import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { slug, title, symbol } from './arguments.mjs';
import { createMakerContext } from './engine.mjs';
import { entityRecipe } from './entities-recipe.mjs';
import { action } from './primitives.mjs';
import { component } from './ui.mjs';
import { customMaker, runCustom, styleRecipe, localeRecipe } from './extra-recipes.mjs';
import { settingRecipe } from './setting.mjs';

export async function planMaker(root, { maker, name, options }, { beforeFinalize } = {}) {
  slug(maker, 'recipe name');
  slug(name, 'maker name');
  if (maker === 'feature' && options['--feature'] !== undefined) throw new Error('--feature belongs to child recipes; feature uses its positional group name');
  if (maker === 'entity' && options['--entity'] !== undefined) throw new Error('--entity belongs to the feature recipe; entity uses its positional entity name');
  const allowed = new Set(['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list',
    ...(maker === 'feature' ? ['--entity'] : ['maker', 'locale'].includes(maker) ? [] : ['--feature']),
    ...(['feature', 'entity'].includes(maker) ? ['--backend', '--document', '--folder', '--preset'] : []),
    ...(maker === 'setting' ? ['--preference'] : []), ...(maker === 'listener' ? ['--event'] : []), ...(maker === 'style' ? ['--view'] : []),
  ]);
  for (const option of Object.keys(options)) if (!allowed.has(option)) throw new Error(`${option} is not supported by the ${maker} recipe`);
  const owner = ['maker', 'locale'].includes(maker) ? undefined : slug(maker === 'feature' ? name : options['--feature'], 'feature name (--feature is required)');
  const entity = ['entity', 'feature'].includes(maker) ? slug(maker === 'entity' ? name : options['--entity'] ?? name, 'entity name') : undefined;
  if (owner && `${owner}-${maker === 'feature' ? 'about-command' : `${name}-${maker}`}`.length > 64) throw new Error('Composed command identifier exceeds 64 characters; shorten the feature or component name');
  if (['feature', 'view', 'store', 'component'].includes(maker) && `${owner}-${maker === 'feature' ? 'workspace' : name}`.length > 54) throw new Error('Composed native view identifier exceeds 54 characters');
  if (maker === 'setting' && `${owner}-${name}-setting`.length > 50) throw new Error('Composed setting entity identifier exceeds 50 characters');
  const backend = options['--backend'] ?? (maker === 'entity' && !options['--document'] ? 'domain' : 'markdown');
  if (!['domain', 'markdown', 'plugin-data'].includes(backend)) throw new Error('Unknown backend; select domain, markdown or plugin-data');
  if (options['--document'] && backend !== 'markdown') throw new Error('--document requires the markdown backend');
  const preset = options['--preset'] ?? 'title'; const folder = options['--folder'] ?? title(owner ?? name);
  if (!['title', 'task', 'project'].includes(preset)) throw new Error('Unknown preset; select title, task or project');
  if (typeof folder !== 'string' || folder.length > 160 || folder !== folder.trim() || folder.split('/').some(part => !part || part.startsWith('.') || /[<>:"|?*\\\u0000-\u001f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Unsafe document folder');
  let ownerExists = false;
  if (owner) {
    try { const entry = await lstat(resolve(root, 'src/features', owner)); if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Feature owner must be a real directory'); ownerExists = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (maker !== 'feature' && !ownerExists) throw new Error(`Feature ${owner} does not exist. Create it first with make feature ${owner}.`);
  }
  const context = createMakerContext(root);
  if (maker === 'feature' || maker === 'entity') {
    await entityRecipe(context, { owner, entity, folder, preset, backend });
    if (maker === 'feature') {
      if (backend === 'markdown') await component(context, { owner, name: 'workspace', editable: true, repository: { key: symbol(entity), entity, label: preset === 'project' ? 'name' : 'title' } });
      else await component(context, { owner, name: 'workspace', editable: true });
      await action(context, { owner, name: 'about', kind: 'command' });
    }
  } else if (['view', 'component', 'store'].includes(maker)) {
    await component(context, { owner, name, editable: maker !== 'component' });
  } else if (['usecase', 'command', 'modal', 'setting', 'event', 'listener'].includes(maker)) {
    const preference = options['--preference'];
    if (maker === 'setting' && preference === undefined) await settingRecipe(context, owner, name);
    else {
    if (maker === 'setting' && !['notifySuccess', 'hideObsidianViewHeader'].includes(preference)) throw new Error('Unknown --preference; select notifySuccess|hideObsidianViewHeader');
    const event = maker === 'listener' ? slug(options['--event'], 'existing event name (--event)') : undefined;
    await action(context, { owner, name, kind: maker, preference, event });
    }
  } else if (maker === 'style') await styleRecipe(context, owner, name, slug(options['--view'], 'existing view name (--view)'));
  else if (maker === 'locale') await localeRecipe(context, name);
  else if (maker === 'maker') await customMaker(context, name);
  else await runCustom(context, { maker, name, owner });
  const plan = await context.finish(beforeFinalize);
  if (maker === 'feature' && ownerExists && plan.changes.some(change => change.status === 'create')) throw new Error(`Feature ${owner} already exists. Use a child recipe to extend it.`);
  const runtimeTests = [...context.tests].filter(path => path.endsWith('.test.ts'));
  const toolingTests = [...context.tests].filter(path => path.endsWith('.checks.mjs'));
  const metadata = ['feature', 'entity'].includes(maker) ? { entity, preset, backend, ...(backend === 'markdown' ? { folder } : {}) }
    : maker === 'setting' ? { backend: 'plugin-data', ...(options['--preference'] ? { preference: options['--preference'] } : { entity: `${owner}-${name}-setting` }) } : {};
  return { maker, templateVersion: 2, owner, ...metadata, plan, checks: [
    { command: 'node', args: ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'] },
    ...(runtimeTests.length ? [{ command: 'node', args: ['node_modules/vitest/vitest.mjs', 'run', ...runtimeTests] }] : []),
    ...(toolingTests.length ? [{ command: 'node', args: ['--test', ...toolingTests] }] : []),
    { command: 'node', args: ['scripts/makers/entities.mjs', '--check'] }, { command: 'npm', args: ['run', 'verify'] },
  ] };
}
