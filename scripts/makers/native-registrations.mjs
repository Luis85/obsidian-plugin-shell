import { posix } from 'node:path';
// Loaded on first use: the dependency-free release CLI must start without TypeScript installed.
let ts;

function literal(node) {
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)))
    node = node.expression;
  return node;
}
function parsed(path, text) {
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error('NATIVE_REGISTRY_PARSE_ERROR: ' + path);
  return ast;
}
const declarations = (ast) =>
  ast.statements.filter(ts.isVariableStatement).flatMap((statement) => statement.declarationList.declarations);
const review = (detail) => new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: ' + detail);
const declaration = (ast, name) =>
  literal(declarations(ast).find((item) => ts.isIdentifier(item.name) && item.name.text === name)?.initializer);
function namedImports(ast) {
  const imports = new Map();
  for (const statement of ast.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const entry of bindings.elements)
      imports.set(entry.name.text, { imported: entry.propertyName?.text ?? entry.name.text, from: statement.moduleSpecifier.text });
  }
  return imports;
}
function entrySource(registry, imports, entry) {
  const binding = ts.isIdentifier(entry) ? imports.get(entry.text) : null;
  if (!binding || !binding.from.startsWith('.'))
    throw review('expected an explicit imported declaration in ' + registry);
  const source = posix.normalize(posix.join(posix.dirname(registry), binding.from.replace(/\.ts$/, '') + '.ts'));
  return { source, imported: binding.imported };
}
function localExportName(sourceAst, imported) {
  let exported = imported;
  for (const statement of sourceAst.statements.filter(ts.isExportDeclaration)) {
    if (statement.moduleSpecifier || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    const alias = statement.exportClause.elements.find((item) => item.name.text === exported);
    if (alias) exported = alias.propertyName?.text ?? alias.name.text;
  }
  return exported;
}
function readField(property, source, fields) {
  if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return;
  if (!['id', 'extension'].includes(property.name.text)) return;
  const field = literal(property.initializer);
  if (!field || !ts.isStringLiteral(field)) throw review('nonliteral ' + property.name.text + ' in ' + source);
  fields.set(property.name.text, field.text);
}
function readFields(object, source, fields) {
  for (const property of object.properties) {
    if (!ts.isSpreadAssignment(property)) {
      readField(property, source, fields);
      continue;
    }
    const spread = literal(property.expression);
    if (!ts.isObjectLiteralExpression(spread)) throw review('dynamic declaration spread in ' + source);
    readFields(spread, source, fields);
  }
  return fields;
}
async function registeredEntry(context, registry, imports, name, entry) {
  const { source, imported } = entrySource(registry, imports, entry);
  const sourceAst = parsed(source, await context.read(source));
  const value = declaration(sourceAst, localExportName(sourceAst, imported));
  if (!value || !ts.isObjectLiteralExpression(value)) throw review('expected a static definition in ' + source);
  const fields = readFields(value, source, new Map());
  if (!fields.has('id') || (name.endsWith('FileTypes') && !fields.has('extension')))
    throw review('missing static identity in ' + source);
  return { source, id: fields.get('id'), extension: fields.get('extension') };
}
/** Inspect only explicit static imports/declarations; never execute source code while planning. */
async function registrations(context, registry, names) {
  const ast = parsed(registry, await context.read(registry));
  const imports = namedImports(ast);
  const found = [];
  for (const name of names) {
    const array = declaration(ast, name);
    if (!array || !ts.isArrayLiteralExpression(array)) throw review(registry + ':' + name);
    for (const entry of array.elements) found.push(await registeredEntry(context, registry, imports, name, entry));
  }
  return found;
}
async function projectRegistrations(context) {
  let project;
  try {
    project = JSON.parse(await context.read('design/project.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!project) return [];
  return registrations(context, project.settings.codebaseFolder + '/generated/bootstrap/native-integrations.ts', [
    'projectFileTypes',
    'projectContextMenus',
  ]);
}
function checkConflict(candidate, source, entry) {
  if (entry.source === source) return;
  if (entry.id === candidate.id)
    throw new Error('NATIVE_ID_CONFLICT: ' + candidate.id + ' is already registered by ' + entry.source);
  if (candidate.extension && entry.extension === candidate.extension)
    throw new Error('NATIVE_EXTENSION_CONFLICT: .' + candidate.extension + ' is already registered by ' + entry.id);
}
export async function checkNativeRegistration(context, candidate, source) {
  ts ??= (await import('typescript')).default;
  const existing = await registrations(context, 'src/bootstrap/native-integrations.ts', [
    'nativeFileTypes',
    'nativeContextMenus',
  ]);
  existing.push(...(await projectRegistrations(context)));
  for (const entry of existing) checkConflict(candidate, source, entry);
}
