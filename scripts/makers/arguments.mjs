import recipes from './recipes.json' with { type: 'json' };
const flags = new Set(['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--document']);
const values = new Set(['--feature', '--entity', '--folder', '--preset', '--backend', '--event', '--view', '--preference']);
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
export const symbol = value => value.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
export const title = value => value.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
export const help = `Template maker v2 — explicit, local authoring recipes

npm run make -- --list
npm run make -- feature bookmarks [--entity bookmark] [--preset title|task|project]
npm run make -- entity meeting --feature bookmarks [--document | --backend plugin-data]
npm run make -- view|component|store|usecase|command|modal|event <name> --feature bookmarks
npm run make -- setting <name> --feature bookmarks [--preference notifySuccess|hideObsidianViewHeader]
npm run make -- listener <name> --feature bookmarks --event <existing-event-name>
npm run make -- style <name> --feature bookmarks --view <existing-view-name>
npm run make -- locale <language>                 (complete pending translation skeleton)
npm run make -- maker <recipe-name>               (trusted explicit local custom recipe)
npm run make -- <custom-recipe> <name> --feature bookmarks

Options: --folder <vault-relative-folder>, --dry-run, --yes, --no-interaction, --json.
Use npm run --silent make -- ... --json for clean machine output.
Feature composes entity, per-view store, component, styles, locales and real actions.
Entity defaults to a domain-only registered schema; --document adds Markdown CRUD.
--backend plugin-data explicitly selects canonical plugin data; never duplicate storage.
A setting creates a disabled-by-default boolean plugin-data preference; --preference
instead binds an existing shared preference. Views/stores contain editable drafts;
usecase previews normalized input. Extend business rules deliberately. Pending locales
are not selectable. No notes, installs, remote templates or network actions occur.
Help needs no installed dependencies; planning requires the qualified installed tools.
After generation run the printed targeted checks and npm run verify.`;
