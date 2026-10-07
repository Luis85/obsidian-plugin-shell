/**
 * Source project dependency gate. Every directory under src/ is a self-contained project; a project imports itself and
 * the projects it depends on, nothing else. Source projects never import tooling/ or the root tests/ folder (those may
 * import the projects, never the other way). The companion concept is outside the Fallow analysis, so this gate is what
 * keeps it, and every other project, inside the graph. Resolved by specifier text: relative paths, `#shared/*` and
 * `#tui/*` (package.json "imports"), dynamic import(), require() and `new URL('<relative>', import.meta.url)`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { posix, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

/** shared -> none; tui -> shared; cli -> shared, tui; companion -> shared; plugin -> shared. */
export const projectDependencies = Object.freeze({
  shared: [], tui: ['shared'], cli: ['shared', 'tui'], companion: ['shared'], plugin: ['shared'],
});
/** Top-level folders whose files may import the projects but must never be imported by them. */
const forbiddenRoots = Object.freeze(['tooling', 'tests']);
const aliases = Object.freeze({ '#shared/': 'src/shared/', '#tui/': 'src/tui/' });
const codeFile = /\.(?:[cm]?[jt]sx?|vue)$/;
const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', '.vite']);

/** Module specifiers a file refers to, from its syntax tree: strings inside other strings or comments never count. */
export function moduleSpecifiers(path, text) {
  let source = text;
  if (path.endsWith('.vue')) {
    const { descriptor } = parse(text, { filename: path });
    source = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n');
  }
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, /\.[cm]?jsx?$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const found = [];
  const add = (node, specifier) => found.push({ specifier, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 });
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node, node.moduleSpecifier.text);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node, node.argument.literal.text);
    else if (ts.isCallExpression(node)) {
      const callee = node.expression, first = node.arguments[0];
      const loader = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
      if (loader && first && ts.isStringLiteralLike(first)) add(node, first.text);
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.length === 2) {
      const [target, base] = node.arguments;
      if (ts.isStringLiteralLike(target) && /^\.\.?\//.test(target.text) && ts.isPropertyAccessExpression(base) && base.getText(ast) === 'import.meta.url') add(node, target.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

/** The repository-relative target of a specifier, or null for packages, node: builtins and anything outside the repository. */
export function resolveSpecifier(from, specifier) {
  for (const [alias, target] of Object.entries(aliases)) if (specifier.startsWith(alias)) return target + specifier.slice(alias.length);
  if (!/^\.\.?(?:\/|$)/.test(specifier)) return null;
  const target = posix.normalize(posix.join(posix.dirname(from), specifier));
  return target.startsWith('..') ? null : target;
}

const projectOf = path => /^src\/([^/]+)\//.exec(path)?.[1] ?? null;

/** Violations for a map of repository-relative path -> source text. Pure: the negative fixtures feed it directly. */
export function checkProjectBoundaries(files, dependencies = projectDependencies) {
  const violations = [];
  for (const [path, text] of files) {
    if (!path.startsWith('src/') || !codeFile.test(path)) continue;
    const project = projectOf(path);
    // A code file directly under src/ belongs to no project, which is as undeclared as an unknown folder.
    if (!project) { violations.push({ path, line: 1, code: 'UNDECLARED_PROJECT', detail: 'code directly under src/ belongs to no source project' }); continue; }
    if (!Object.hasOwn(dependencies, project)) { violations.push({ path, line: 1, code: 'UNDECLARED_PROJECT', detail: `src/${project} is not a declared source project` }); continue; }
    for (const { specifier, line } of moduleSpecifiers(path, text)) {
      const target = resolveSpecifier(path, specifier);
      if (!target) continue;
      const root = target.split('/')[0];
      if (forbiddenRoots.includes(root)) { violations.push({ path, line, code: 'SOURCE_IMPORTS_' + root.toUpperCase(), detail: `${specifier} -> ${target}` }); continue; }
      const imported = projectOf(target + '/');
      if (!imported || imported === project) continue;
      if (!dependencies[project].includes(imported)) violations.push({ path, line, code: 'PROJECT_DEPENDENCY', detail: `${project} must not import ${imported}: ${specifier} -> ${target}` });
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
/** Reads every code file under src/ of a repository root and checks it. */
export async function scanProjectBoundaries(root = process.cwd()) {
  const files = new Map();
  await collect(resolve(root), 'src', files);
  if (!files.size) throw new Error('PROJECT_BOUNDARY_EMPTY_SCOPE');
  const violations = checkProjectBoundaries(files);
  return { files: files.size, projects: [...new Set([...files.keys()].map(projectOf))].sort(), violations };
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
