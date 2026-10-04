/** The framework checkout inputs a template snapshot and a distribution kit copy. One list, shared by the
 * snapshot loader, the kit assembler and the maker output boundary, so a new input cannot be missed by one. */
export const templateRoots: readonly string[] = Object.freeze(['src', 'scripts', 'templates', 'tests', 'harness', 'docs', '.github', 'bin', 'plugins', 'configs']);
export const templateRootFiles: readonly string[] = Object.freeze(['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc',
  'AGENTS.md', 'LICENSE', 'README.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md']);
/** The framework repository's own delivery pipeline (Dev and Release tiers, release cut, publish and the release
 * pull-request template) is maintainer process: neither the kit nor a generated project receives it. */
export const deliveryPipelineFiles: readonly string[] = Object.freeze(['.github/workflows/dev.yml', '.github/workflows/release.yml', '.github/workflows/release-cut.yml', '.github/workflows/publish.yml']);
export const deliveryPipelineFolder = '.github/PULL_REQUEST_TEMPLATE/';
/** Top-level folders that generated output must never occupy inside a framework checkout (case-insensitive). */
const reservedOutputFolders: readonly string[] = Object.freeze([...templateRoots, '.framework']);
export function reservedOutputFolder(name: string): boolean {
  const folded = name.toLowerCase();
  return reservedOutputFolders.some(folder => folder.toLowerCase() === folded);
}
