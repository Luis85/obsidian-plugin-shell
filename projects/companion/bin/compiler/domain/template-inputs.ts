/** The framework checkout inputs a template snapshot and a distribution kit copy. One list, shared by the
 * snapshot loader, the kit assembler and the maker output boundary, so a new input cannot be missed by one. */
export const templateRoots: readonly string[] = Object.freeze(['src', 'scripts', 'templates', 'tests', 'harness', 'docs', '.github', 'bin', 'plugins', 'configs']);
export const templateRootFiles: readonly string[] = Object.freeze(['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc',
  'AGENTS.md', 'LICENSE', 'README.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md']);
/** projects/<name> is the one folder inside a framework checkout that may hold a generated project: it is not a template
 * root, so the snapshot never reads it, and the shell's gates ignore it (projects/README.md). `within` is the target
 * relative to the checkout, with either separator. */
export function frameworkProjectFolder(within: string): boolean {
  return /^projects[\\/][a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(within);
}
/** Top-level folders that generated output must never occupy inside a framework checkout (case-insensitive). */
const reservedOutputFolders: readonly string[] = Object.freeze([...templateRoots, '.framework']);
export function reservedOutputFolder(name: string): boolean {
  const folded = name.toLowerCase();
  return reservedOutputFolders.some(folder => folder.toLowerCase() === folded);
}
