import recipes from './recipes.json' with { type: 'json' };
const flags = new Set(['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--document']);
const values = new Set(['--feature', '--entity', '--folder', '--preset', '--backend', '--event', '--view', '--preference', '--extension', '--format', '--extensions']);
export const builtinRecipes = Object.freeze(recipes.map(recipe => recipe.id));
export function recipeOptions(maker) {
  return recipes.find(recipe => recipe.id === maker)?.options ?? ['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--feature'];
}
export function parseArguments(args) {
  const options = {}; const positional = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    if (!flags.has(arg) && !values.has(arg)) throw new Error(`Unknown maker option: ${arg}`);
    if (Object.hasOwn(options, arg)) throw new Error(`Repeated maker option: ${arg}`);
    if (flags.has(arg)) options[arg] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg] = value;
    }
  }
  if (positional.length > 2) throw new Error('Expected a maker and one name');
  return { maker: positional[0], name: positional[1], options };
}
export function slug(value, label) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 48 || /^(con|prn|aux|nul|com[1-9]|lpt[1-9]|constructor|prototype|default|class|function|var|let|const|export|import)$/i.test(value)) throw new Error(`Invalid ${label}: use a lowercase non-reserved hyphenated name`);
  return value;
}
export const makerSymbol = value => value.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
export const title = value => value.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
