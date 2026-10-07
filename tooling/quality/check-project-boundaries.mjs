/**
 * Source project dependency gate. The project graph is workbench.sources.json (read through
 * src/shared/platform/source-manifest.mjs, the same file `node bin/app source check` validates) and `#name/*`
 * specifiers resolve through root package.json "imports"; nothing about the graph is written down here. A project
 * imports itself and the projects it references, nothing else. On top of that graph this gate keeps the rules
 * `source check` does not cover: source projects never import tooling/ or the root tests/ folder (those may import
 * the projects, never the other way), and every code file under src/ belongs to a declared project. The companion
 * concept is outside the Fallow analysis, so this gate is what keeps it, and every other project, inside the graph.
 * Specifiers come from the syntax tree (src/cli/adapters/module-specifiers.ts): static and dynamic imports, require()
 * and `new URL('<relative>', import.meta.url)`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';
import { packageImports, readSourceManifest, sourceDependencies } from '../../src/shared/platform/source-manifest.mjs';
import { moduleSpecifiers as scan } from '../../src/cli/adapters/module-specifiers.ts';
import { aliasPrefixes, projectForPath, resolveSpecifier as resolveTarget } from '../../src/cli/domain/source-imports.ts';

/** Top-level folders whose files may import the projects but must never be imported by them. */
const forbiddenRoots = Object.freeze(['tooling', 'tests']);
const codeFile = /\.(?:[cm]?[jt]sx?|vue)$/;
const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', '.vite']);

/** Module specifiers a file refers to, from its syntax tree: strings inside other strings or comments never count. */
export function boundarySpecifiers(path, text) {
  return scan(path, text, { ts, parseSfc: parse }).map(({ specifier, line }) => ({ specifier, line }));
}

/** The repository-relative target of a specifier, or null for packages, node: builtins and anything outside the repository. */
export function boundaryTarget(from, specifier, imports) {
  return resolveTarget(from, specifier, aliasPrefixes(imports));
}

/**
 * Violations for a map of repository-relative path -> source text. Pure: the negative fixtures pass the manifest and
 * the package.json "imports" object directly.
 */
export function checkProjectBoundaries(files, { manifest, imports }) {
  const violations = [], dependencies = sourceDependencies(manifest), aliases = aliasPrefixes(imports);
  for (const [path, text] of files) {
    if (!path.startsWith('src/') || !codeFile.test(path)) continue;
    const project = projectForPath(manifest.projects, path);
    // A code file outside every declared project path (directly under src/, or in an undeclared folder) fails closed.
    if (!project) { violations.push({ path, line: 1, code: 'UNDECLARED_PROJECT', detail: `${path.split('/').length > 2 ? path.split('/').slice(0, 2).join('/') + ' is not a declared source project' : 'code directly under src/ belongs to no source project'}` }); continue; }
    for (const { specifier, line } of boundarySpecifiers(path, text)) {
      const target = resolveTarget(path, specifier, aliases);
      if (!target) continue;
      const root = target.split('/')[0];
      if (forbiddenRoots.includes(root)) { violations.push({ path, line, code: 'SOURCE_IMPORTS_' + root.toUpperCase(), detail: `${specifier} -> ${target}` }); continue; }
      const imported = projectForPath(manifest.projects, target);
      if (!imported || imported.name === project.name) continue;
      if (!dependencies[project.name].includes(imported.name)) violations.push({ path, line, code: 'PROJECT_DEPENDENCY', detail: `${project.name} must not import ${imported.name}: ${specifier} -> ${target}` });
    }
  }
  return violations;
}

async function collect(root, folder, files) {
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`PROJECT_BOUNDARY_SYMLINK: ${path}`);
    if (entry.isDirectory()) { if (!skippedDirectories.has(entry.name)) await collect(root, path, files); }
    else if (codeFile.test(entry.name)) files.set(path, await readFile(join(root, path), 'utf8'));
  }
}
/** Reads every code file under src/ of a repository root and checks it against the root's source manifest. */
export async function scanProjectBoundaries(root = process.cwd()) {
  root = resolve(root);
  const manifest = readSourceManifest(root);
  if (!manifest) throw new Error('PROJECT_BOUNDARY_MANIFEST_MISSING: workbench.sources.json declares the source projects; run node bin/app source check --fix');
  const files = new Map();
  await collect(root, 'src', files);
  if (!files.size) throw new Error('PROJECT_BOUNDARY_EMPTY_SCOPE');
  const violations = checkProjectBoundaries(files, { manifest, imports: packageImports(root) });
  const projects = [...new Set([...files.keys()].map(path => projectForPath(manifest.projects, path)?.name).filter(Boolean))].sort();
  return { files: files.size, projects, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED');
    const result = await scanProjectBoundaries();
    if (result.violations.length) {
      console.error(result.violations.map(item => `${item.path}:${item.line}: ${item.code}: ${item.detail}`).join('\n'));
      throw new Error(`PROJECT_BOUNDARIES_FAILED: ${result.violations.length}`);
    }
    console.log(JSON.stringify({ status: 'passed', files: result.files, projects: result.projects }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
