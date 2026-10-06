/** Resolved compiler import policy, additional to the repository's Fallow gate. */
import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pureEntrypoints = [
  'src/cli/compiler/adapters/plugin-emitter.ts', 'src/cli/compiler/adapters/clickdummy-emitter.ts',
  'src/cli/compiler/adapters/target-lowering.ts', 'src/cli/compiler/adapters/project/emitter.ts',
  'src/cli/compiler/adapters/frontend.ts', 'src/cli/compiler/adapters/dependencies.ts', 'src/cli/compiler/adapters/origins.ts',
];
// Existing runtime modules expose pure validators alongside deferred runtime operations.
// Only function-local timers in these two legacy modules are permitted; module-level effects stay forbidden.
const deferredRuntimeTimers = new Set(['templates/companion/runtime/json-http.ts', 'docs/concepts/companion/test-kit/adapters.mjs']);
function deferredTimer(path, node) {
  if (!deferredRuntimeTimers.has(path)) return false;
  for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent)) return true;
  return false;
}
// The inward-only compiler core lives in src/cli/compiler/{domain,application}; host adapters live beside it in src/cli/compiler/adapters.
const compilerDomain = 'src/cli/compiler/domain/', compilerApplication = 'src/cli/compiler/application/';
const safePureImports = new Set(['node:crypto', 'node:path']);
/** Uses a syntax tree: imports inside generated source string literals are not compiler dependencies. */
export function inspectModule(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const dependencies = [], globals = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly = ts.isImportDeclaration(node) ? Boolean(node.importClause?.isTypeOnly) : Boolean(node.isTypeOnly);
      dependencies.push({ specifier: node.moduleSpecifier.text, typeOnly });
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      dependencies.push({ specifier: node.arguments[0] && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : '<dynamic>', typeOnly: false });
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['fetch', 'eval', 'setTimeout', 'setInterval'].includes(node.expression.text)) {
      if (!(['setTimeout', 'setInterval'].includes(node.expression.text) && deferredTimer(path,node))) globals.push(node.expression.text);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.getText(source);
      if (/^(?:process\.|Date\.now$|Math\.random$|globalThis\.(?:process|fetch|eval)|Deno\.|Bun\.)/.test(name)) globals.push(name);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && (['Function','WebSocket','Worker'].includes(node.expression.text) || (node.expression.text === 'Date' && !node.arguments?.length))) globals.push('new '+node.expression.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { dependencies, globals: [...new Set(globals)] };
}
/** Input map allows negative tests without creating invalid production modules. */
export function checkCompilerBoundaries(sources) {
  const failures = [], modules = new Map([...sources].map(([path, text]) => [path, inspectModule(path, text)]));
  function resolveImport(from, specifier) {
    if (!specifier.startsWith('.')) return null;
    const path = posix.normalize(posix.join(posix.dirname(from), specifier));
    return modules.has(path) ? path : null;
  }
  for (const [path, module] of modules) {
    const domain = path.startsWith(compilerDomain), application = path.startsWith(compilerApplication);
    if (!domain && !application) continue;
    for (const dependency of module.dependencies) {
      const target = resolveImport(path, dependency.specifier);
      const allowed = target && (target.startsWith(compilerDomain) || (application && target.startsWith(compilerApplication)));
      if (!allowed) failures.push(`${path}: inward-only compiler layer cannot import ${dependency.specifier}`);
    }
    for (const name of module.globals) failures.push(`${path}: compiler core cannot use ${name}`);
  }
  const visited = new Set();
  function pure(path, chain) {
    if (visited.has(path)) return;
    visited.add(path);
    const module = modules.get(path);
    if (!module) { failures.push(`${chain.join(' -> ')}: missing pure dependency ${path}`); return; }
    for (const name of module.globals) failures.push(`${[...chain,path].join(' -> ')}: pure compilation cannot use ${name}`);
    for (const dependency of module.dependencies) {
      if (dependency.typeOnly) continue;
      const target = resolveImport(path, dependency.specifier);
      if (target) pure(target, [...chain,path]);
      else if (!safePureImports.has(dependency.specifier)) failures.push(`${[...chain,path].join(' -> ')}: pure compilation cannot import ${dependency.specifier}`);
    }
  }
  for (const entry of pureEntrypoints) if (sources.has(entry)) pure(entry, []);
  return [...new Set(failures)].sort();
}
export async function compilerSourceInventory(root) {
  const sources = new Map();
  async function walk(folder) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes:true })) {
      const path = folder + '/' + entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(?:ts|mjs)$/.test(path)) sources.set(path, await readFile(resolve(root,path),'utf8'));
    }
  }
  for (const folder of ['src/cli/compiler','tooling/compiler','src/shared/companion','tooling/companion-tools','templates/companion','src/shared/contracts','docs/concepts/companion/test-kit']) await walk(folder);
  return sources;
}
/** A listed pure entrypoint outside the inventory would otherwise be skipped silently. */
export function missingPureEntrypoints(sources) {
  return pureEntrypoints.filter(entry => !sources.has(entry)).map(entry => `${entry}: pure entrypoint is missing from the compiler source inventory`);
}
export async function checkCompilerArchitecture(root) {
  const sources = await compilerSourceInventory(root), failures = [...missingPureEntrypoints(sources), ...checkCompilerBoundaries(sources)];
  if (failures.length) throw new Error('COMPILER_ARCHITECTURE_FAILED\n' + failures.join('\n'));
  return { files: sources.size, pureEntrypoints: pureEntrypoints.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await checkCompilerArchitecture(process.cwd())));
}
