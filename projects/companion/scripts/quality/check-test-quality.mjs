import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** AST-only policy for imported Vitest/Playwright test declarations, including aliases.
 * Promise handling belongs to the separately configured type-aware ESLint rule. */
export function inspectTestQuality(text, name = 'example.test.ts') {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) return ['TEST_PARSE_ERROR'];
  const bindings = new Set(); const namespaces = new Set(); const failures = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || !['vitest', '@playwright/test'].includes(statement.moduleSpecifier.text)) continue;
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamespaceImport(named)) namespaces.add(named.name.text);
    if (named && ts.isNamedImports(named)) for (const item of named.elements) {
      if (['test', 'it', 'describe', 'suite'].includes((item.propertyName ?? item.name).text)) bindings.add(item.name.text);
    }
  }
  function chain(node) {
    if (ts.isIdentifier(node)) return [node.text];
    if (ts.isPropertyAccessExpression(node)) return [...chain(node.expression), node.name.text];
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) return [...chain(node.expression), node.argumentExpression.text];
    if (ts.isCallExpression(node)) return chain(node.expression);
    return [];
  }
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const parts = chain(node.expression);
      const imported = bindings.has(parts[0]) || (namespaces.has(parts[0]) && ['test', 'it', 'describe', 'suite'].includes(parts[1]));
      if (imported && parts.some(part => ['only', 'skip', 'todo', 'fixme', 'skipIf', 'runIf'].includes(part))) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        failures.push(`FOCUSED_OR_SKIPPED_TEST: ${name}:${line}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return [...new Set(failures)];
}
export async function checkTestQuality(root = process.cwd()) {
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('TEST_SOURCE_SYMLINK');
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.ts')) files.push(path);
    }
  }
  for (const path of ['tests/runtime', 'tests/e2e', 'tests/obsidian']) await walk(resolve(root, path));
  if (!files.length) throw new Error('NO_TEST_INPUTS');
  const failures = [];
  for (const file of files) failures.push(...inspectTestQuality(await readFile(file, 'utf8'), relative(root, file)));
  if (failures.length) throw new Error(failures.join('\n'));
  return { status: 'passed', files: files.length, scope: 'imported Vitest/Playwright declarations; typed promises use ESLint' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED'); console.log(JSON.stringify(await checkTestQuality())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
