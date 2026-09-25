import { slug, symbol } from './arguments.mjs';
import { entityRecipe } from './entities-recipe.mjs';
import { action } from './primitives.mjs';
import { component } from './ui.mjs';
import { customMaker, runCustom, styleRecipe, localeRecipe } from './extra-recipes.mjs';
import { settingRecipe } from './setting.mjs';

async function feature(context, input) {
  const { owner, entity, preset, backend } = input;
  await entityRecipe(context, input);
  const repository = backend === 'markdown' ? { key: symbol(entity), entity, label: preset === 'project' ? 'name' : 'title' } : undefined;
  await component(context, { owner, name: 'workspace', editable: true, ...(repository ? { repository } : {}) });
  await action(context, { owner, name: 'about', kind: 'command' });
}
function surface(context, { owner, name, maker }) {
  return component(context, { owner, name, editable: maker !== 'component' });
}
function primitive(context, { owner, name, maker, options }) {
  const preference = options['--preference'];
  const event = maker === 'listener' ? slug(options['--event'], 'existing event name (--event)') : undefined;
  return action(context, { owner, name, kind: maker, preference, event });
}
function setting(context, input) {
  const preference = input.options['--preference'];
  if (preference === undefined) return settingRecipe(context, input.owner, input.name);
  if (!['notifySuccess', 'hideObsidianViewHeader'].includes(preference)) throw new Error('Unknown --preference; select notifySuccess|hideObsidianViewHeader');
  return primitive(context, input);
}
/** Actual dispatch table: catalog parity tests inspect these registrations, not a second label list. */
export const builtinHandlers = Object.freeze({
  feature, entity: entityRecipe, view: surface, component: surface, store: surface,
  usecase: primitive, command: primitive, modal: primitive, setting, event: primitive, listener: primitive,
  style: (context, { owner, name, options }) => styleRecipe(context, owner, name, slug(options['--view'], 'existing view name (--view)')),
  locale: (context, { name }) => localeRecipe(context, name),
  maker: (context, { name }) => customMaker(context, name),
});
export async function dispatchMaker(context, input) {
  if (Object.hasOwn(builtinHandlers, input.maker)) await builtinHandlers[input.maker](context, input);
  else await runCustom(context, input);
}
