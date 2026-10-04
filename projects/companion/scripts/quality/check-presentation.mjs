import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parse } from 'vue/compiler-sfc';

const macro = name => /^define(?:Props|Emits|Slots|Model|Options|Expose)$/.test(name) || name === 'withDefaults';
function binding(node) {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isIdentifier(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
  if (ts.isArrayLiteralExpression(node)) return node.elements.every(binding);
  if (ts.isObjectLiteralExpression(node)) return node.properties.every(property => ts.isPropertyAssignment(property) && binding(property.initializer));
  if (ts.isPropertyAccessExpression(node)) return binding(node.expression);
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return binding(node.expression);
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (/^use[A-Z]/.test(node.expression.text) || macro(node.expression.text)) && node.arguments.every(binding);
}
export function inspectPresentation(path, source) {
  const errors = [];
  const vue = path.endsWith('.vue');
  if (vue && !path.startsWith('src/presentation/components/')) errors.push('VUE_COMPONENT_LOCATION');
  if (!vue && !/^src\/presentation\/(?:composables|stores|context)\/.+\.ts$/.test(path)) errors.push('TYPESCRIPT_CONCERN_LOCATION');
  let script = source;
  if (vue) {
    const result = parse(source, { filename: path });
    if (result.errors.length) return [...errors, 'INVALID_SFC'];
    if (result.descriptor.script) errors.push('USE_SETUP_BINDINGS');
    const setup = result.descriptor.scriptSetup;
    if (setup && (setup.lang !== 'ts' || setup.src)) errors.push('LOCAL_TYPESCRIPT_SETUP_REQUIRED');
    script = setup?.content ?? '';
  }
  const ast = ts.createSourceFile(path, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) errors.push('INVALID_TYPESCRIPT');
  if (vue) for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) && statement.declarationList.declarations.every(item => item.initializer && binding(item.initializer))) continue;
    if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && ts.isIdentifier(statement.expression.expression) && macro(statement.expression.expression.text) && statement.expression.arguments.every(binding)) continue;
    errors.push('IMPERATIVE_SFC_SCRIPT');
  }
  function visit(node) {
    if (vue && (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isAwaitExpression(node) || ts.isClassDeclaration(node))) errors.push('BEHAVIOR_BELONGS_IN_TYPESCRIPT');
    if (!vue) {
      const imported = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) ? node.arguments[0] : undefined;
      if (imported && ts.isStringLiteral(imported) && /\.vue(?:[?#].*)?$/.test(imported.text)) errors.push('TYPESCRIPT_IMPORTS_COMPONENT');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(errors)];
}
async function checkPresentation(root = process.cwd()) {
  const files = []; const violations = [];
  async function walk(path) {
    for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:ts|vue)$/.test(child)) {
        files.push(child);
        for (const code of inspectPresentation(child, await readFile(join(root, child), 'utf8'))) violations.push({ path: child, code });
      }
    }
  }
  await walk('src/presentation');
  if (!files.length) throw new Error('EMPTY_PRESENTATION_SCOPE');
  if (violations.length) throw new Error(`PRESENTATION_CONCERNS: ${JSON.stringify(violations)}`);
  return { status: 'passed', inputs: files.length, vue: files.filter(path => path.endsWith('.vue')).length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkPresentation().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
