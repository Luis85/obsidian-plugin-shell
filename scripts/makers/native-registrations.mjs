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
/** Inspect only explicit static imports/declarations; never execute source code while planning. */
async function registrations(context, registry, names) {
  const ast = parsed(registry, await context.read(registry));
  const imports = new Map();
  for (const statement of ast.statements.filter(ts.isImportDeclaration)) {
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const entry of bindings.elements) {
        imports.set(entry.name.text, {
          imported: entry.propertyName?.text ?? entry.name.text,
          from: statement.moduleSpecifier.text,
        });
      }
  }
  const found = [];
  for (const name of names) {
    const array = literal(
      declarations(ast).find((item) => ts.isIdentifier(item.name) && item.name.text === name)?.initializer,
    );
    if (!array || !ts.isArrayLiteralExpression(array))
      throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: ' + registry + ':' + name);
    for (const entry of array.elements) {
      const binding = ts.isIdentifier(entry) ? imports.get(entry.text) : null;
      if (!binding || !binding.from.startsWith('.'))
        throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: expected an explicit imported declaration in ' + registry);
      const source = posix.normalize(posix.join(posix.dirname(registry), binding.from.replace(/\.ts$/, '') + '.ts'));
      const sourceAst = parsed(source, await context.read(source));
      let exported = binding.imported;
      for (const statement of sourceAst.statements.filter(ts.isExportDeclaration)) {
        if (!statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          const alias = statement.exportClause.elements.find((item) => item.name.text === exported);
          if (alias) exported = alias.propertyName?.text ?? alias.name.text;
        }
      }
      const value = literal(
        declarations(sourceAst).find((item) => ts.isIdentifier(item.name) && item.name.text === exported)?.initializer,
      );
      if (!value || !ts.isObjectLiteralExpression(value))
        throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: expected a static definition in ' + source);
      const fields = new Map();
      const readFields = (object) => {
        for (const property of object.properties) {
          if (ts.isSpreadAssignment(property)) {
            const spread = literal(property.expression);
            if (!ts.isObjectLiteralExpression(spread))
              throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: dynamic declaration spread in ' + source);
            readFields(spread);
          } else if (
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          ) {
            if (['id', 'extension'].includes(property.name.text)) {
              const field = literal(property.initializer);
              if (!field || !ts.isStringLiteral(field))
                throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: nonliteral ' + property.name.text + ' in ' + source);
              fields.set(property.name.text, field.text);
            }
          }
        }
      };
      readFields(value);
      if (!fields.has('id') || (name.endsWith('FileTypes') && !fields.has('extension')))
        throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: missing static identity in ' + source);
      found.push({ source, id: fields.get('id'), extension: fields.get('extension') });
    }
  }
  return found;
}
export async function checkNativeRegistration(context, candidate, source) {
  ts ??= (await import('typescript')).default;
  const existing = await registrations(context, 'src/bootstrap/native-integrations.ts', [
    'nativeFileTypes',
    'nativeContextMenus',
  ]);
  let project;
  try {
    project = JSON.parse(await context.read('design/project.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (project)
    existing.push(
      ...(await registrations(
        context,
        project.settings.codebaseFolder + '/generated/bootstrap/native-integrations.ts',
        ['projectFileTypes', 'projectContextMenus'],
      )),
    );
  for (const entry of existing) {
    if (entry.source === source) continue;
    if (entry.id === candidate.id)
      throw new Error('NATIVE_ID_CONFLICT: ' + candidate.id + ' is already registered by ' + entry.source);
    if (candidate.extension && entry.extension === candidate.extension)
      throw new Error('NATIVE_EXTENSION_CONFLICT: .' + candidate.extension + ' is already registered by ' + entry.id);
  }
}
