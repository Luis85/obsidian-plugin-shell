import { readCompanionProject } from './read-project.mjs';

const help = `Companion project handoff — v1 is READ ONLY
Usage: node scripts/companion/generate.mjs --input <project.json> --target <vault-relative-path> [--vault <vault-root>]
       npm run --silent companion:generate -- --input <project.json> --target <vault-relative-path>

--input   Full obsidian-companion-project JSON export; read locally, never executed.
--target  Future project root within the vault. Use . for the current vault root.
--vault   Existing vault directory; defaults to the current working directory.
--help    Show this help.

On success stdout contains the exact supplied JSON bytes. Diagnostics use stderr.
No directories, boilerplate, notes, dependencies or plugins are created or changed.
Codebase/tests folders are read from the export (src/tests by default), relative to target.
Full boilerplate generation is a future version and requires its own reviewed plan.
`;
function options(args) {
  if (args.length === 1 && args[0] === '--help') return null;
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].slice(2), value = args[index + 1];
    if (!['input', 'target', 'vault'].includes(key) || args[index] !== '--' + key ||
        Object.hasOwn(values, key) || !value || value.startsWith('--')) throw new Error('COMPANION_USAGE: Use --input, --target and optional --vault once each; see --help.');
    values[key] = value;
  }
  if (!values.input || !values.target) throw new Error('COMPANION_USAGE: --input and --target are required; see --help.');
  return values;
}
try {
  const value = options(process.argv.slice(2));
  if (value === null) process.stdout.write(help);
  else process.stdout.write((await readCompanionProject(value)).content);
} catch (error) {
  const message = error instanceof Error && error.message.startsWith('COMPANION_') ? error.message :
    'COMPANION_READ: Could not safely read the input or validate the vault target. No files were written.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
}
