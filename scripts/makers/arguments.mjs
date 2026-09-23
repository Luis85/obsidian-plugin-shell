const flags = new Set(['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list', '--document']);
const values = new Set(['--feature', '--entity', '--folder', '--preset']);
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
export const help = `Template maker v1 — implemented note-backed recipes

npm run make -- --list
npm run make -- feature bookmarks --entity bookmark [--preset title|task|project]
npm run make -- entity meeting --feature bookmarks --document

Options: --folder <vault-relative-folder>, --dry-run, --yes, --no-interaction, --json.
Use npm run --silent make -- ... --json for clean machine output.
Feature creates a group and registered note entity. Entity requires an existing group
and --document. Domain-only entities use the manual defineEntity API for now.
Default preset title creates a required title and Notes body; customize business rules
in the generated ordinary source. Full UI, command, style and custom-maker recipes
are not supplied by this bounded catalog. No notes, installs, or network actions occur.
Actual execution requires the installed qualified TypeScript tooling; help needs none.
After generation run the printed targeted test, entities:check and npm run verify.`;
