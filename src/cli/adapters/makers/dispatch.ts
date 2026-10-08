import { nativeRecipe } from './native.ts';
import { slug, makerSymbol as symbol, title } from './arguments.ts';
import { entityRecipe } from './entities-recipe.ts';
import { action } from './primitives.ts';
import { component } from './ui.ts';
import { customMaker, runCustom, styleRecipe, localeRecipe } from './extra-recipes.ts';
import { settingRecipe } from './setting.ts';
import { pluginRecipe } from './plugin-recipe.ts';
import { fileEditorRecipe } from './file-editor.ts';
import type { EntityInput, MakerContext, MakerInput, OwnedInput } from './contracts.ts';

type Handler = (context: MakerContext, input: MakerInput) => Promise<void>;
function owned(input: MakerInput): OwnedInput {
  if (input.owner === undefined) throw new Error(`MAKER_OWNER_REQUIRED: ${input.maker}`);
  return { ...input, owner: input.owner };
}
function withEntity(input: MakerInput): EntityInput {
  const request = owned(input);
  if (request.entity === undefined) throw new Error(`MAKER_ENTITY_REQUIRED: ${input.maker}`);
  return { ...request, entity: request.entity };
}
/** A bare feature is only an owner folder with a README; child recipes add every capability. */
async function bareFeature(context: MakerContext, owner: string): Promise<void> {
  await context.add(`src/features/${owner}/README.md`, `# ${title(owner)}

Feature folder. Add capabilities with child recipes, for example:

\`\`\`bash
node bin/app make file-extension <name> --feature ${owner} --extension <ext> --editor vue
node bin/app make context-menu <name> --feature ${owner} --extensions <ext>
node bin/app make command <name> --feature ${owner}
\`\`\`

Feature code depends only on \`src/features/api.ts\`.
`);
}
async function feature(context: MakerContext, input: MakerInput): Promise<void> {
  if (input.options['--bare']) return bareFeature(context, owned(input).owner);
  const request = withEntity(input);
  const { owner, entity, preset, backend } = request;
  await entityRecipe(context, request);
  const repository = backend === 'markdown' ? { key: symbol(entity), entity, label: preset === 'project' ? 'name' : 'title' } : undefined;
  await component(context, { owner, name: 'workspace', editable: true, repository });
  await action(context, { owner, name: 'about', kind: 'command' });
}
async function surface(context: MakerContext, input: MakerInput): Promise<void> {
  const { owner, name, maker } = owned(input);
  await component(context, { owner, name, editable: maker !== 'component', repository: undefined });
}
async function primitive(context: MakerContext, input: MakerInput): Promise<void> {
  const { owner, name, maker, options } = owned(input);
  await action(context, { owner, name, kind: maker, preference: options['--preference'], event: options['--event'] });
}
async function setting(context: MakerContext, input: MakerInput): Promise<void> {
  const preference = input.options['--preference'];
  // A bound shared preference is validated by the action primitive against the one allowlist.
  if (preference === undefined) return settingRecipe(context, owned(input).owner, input.name);
  return primitive(context, input);
}
async function style(context: MakerContext, input: MakerInput): Promise<void> {
  const { owner, name, options } = owned(input);
  await styleRecipe(context, owner, name, slug(options['--view'], 'existing view name (--view)'));
}
/** Actual dispatch table: catalog parity tests inspect these registrations, not a second label list. */
export const builtinHandlers: Readonly<Record<string, Handler>> = Object.freeze({
  'file-extension': (context, input) => nativeRecipe(context, owned(input)), 'context-menu': (context, input) => nativeRecipe(context, owned(input)),
  'file-editor': (context, input) => fileEditorRecipe(context, { ...owned(input), fileType: slug(input.options['--file-type'], 'file type id (--file-type is required)') }),
  feature, entity: async (context, input) => { await entityRecipe(context, withEntity(input)); }, view: surface, component: surface, store: surface,
  usecase: primitive, command: primitive, modal: primitive, setting, event: primitive, listener: primitive, style,
  locale: (context, { name, options }) => localeRecipe(context, name, options['--refresh'] === true),
  maker: (context, { name }) => customMaker(context, name),
  plugin: (context, { name }) => pluginRecipe(context, name),
} satisfies Record<string, Handler>);
export async function dispatchMaker(context: MakerContext, input: MakerInput): Promise<void> {
  const handler = Object.hasOwn(builtinHandlers, input.maker) ? builtinHandlers[input.maker] : undefined;
  if (handler) await handler(context, input);
  else await runCustom(context, input);
}
