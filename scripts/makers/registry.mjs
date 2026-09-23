import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readRegistry(root, providedSource) {
  const ts = await import('typescript');
  const path = 'src/bootstrap/features.ts'; const source = providedSource ?? await readFile(resolve(root, path), 'utf8');
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) throw new Error('REGISTRY_PARSE_ERROR: repair src/bootstrap/features.ts first');
  const imports = [];
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) imports.push({ local: entry.name.text, exported: entry.propertyName?.text ?? entry.name.text, from: statement.moduleSpecifier.text });
  }
  const registrations = []; let object; let registerName; let parameterInsertion;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createNoteFeatures') {
      const callback = node.arguments[1];
      const body = callback && ts.isArrowFunction(callback) ? callback.body : undefined;
      const literal = body && ts.isParenthesizedExpression(body) ? body.expression : body;
      if (object || !literal || !ts.isObjectLiteralExpression(literal) || callback.parameters.length > 1 || (callback.parameters.length === 1 && !ts.isIdentifier(callback.parameters[0].name)) || (callback.parameters.length === 0 && literal.properties.length !== 0)) throw new Error('REGISTRY_UNSUPPORTED_SHAPE: use one explicit register callback object');
      object = literal; registerName = callback.parameters[0]?.name.text ?? 'register';
      if (!callback.parameters.length) parameterInsertion = callback.parameters.pos;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (!object) throw new Error('REGISTRY_MISSING: expected the explicit feature registration callback');
  const keys = new Set();
  for (const entry of object.properties) {
    if (!ts.isPropertyAssignment(entry) || !ts.isIdentifier(entry.name) || !ts.isCallExpression(entry.initializer) || !ts.isIdentifier(entry.initializer.expression) || entry.initializer.expression.text !== registerName || !entry.initializer.arguments[0] || !ts.isIdentifier(entry.initializer.arguments[0])) throw new Error('REGISTRY_UNSUPPORTED_ENTRY: preserve explicit key: register(feature) entries');
    if (keys.has(entry.name.text.toLowerCase())) throw new Error(`REGISTRY_DUPLICATE_KEY: ${entry.name.text}`);
    keys.add(entry.name.text.toLowerCase());
    const local = entry.initializer.arguments[0].text; const imported = imports.find(item => item.local === local);
    if (!imported || !/^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/.test(imported.from)) throw new Error(`REGISTRY_UNKNOWN_IMPORT: ${local}`);
    registrations.push({ key: entry.name.text, ...imported, override: entry.initializer.arguments.length > 1 });
  }
  const importNodes = parsed.statements.filter(ts.isImportDeclaration);
  const lastImport = importNodes.at(-1);
  if (!lastImport) throw new Error('REGISTRY_MISSING_IMPORTS');
  return { path, source, imports, registrations, importEnd: lastImport.end, close: object.end - 1, lastPropertyEnd: object.properties.at(-1)?.end, trailingComma: object.properties.hasTrailingComma, parameterInsertion, registerName };
}
export function extendRegistry(registry, { key, local, from }) {
  const existing = registry.registrations.find(entry => entry.key.toLowerCase() === key.toLowerCase());
  const imported = registry.imports.find(entry => entry.local.toLowerCase() === local.toLowerCase());
  if (existing || imported) {
    if (existing?.key === key && existing.local === local && existing.from === from && imported?.local === local && imported.from === from && !existing.override) return registry.source;
    throw new Error(`REGISTRY_CONFLICT: ${key} or ${local} is already owned`);
  }
  const newline = registry.source.includes('\r\n') ? '\r\n' : '\n';
  const lineStart = registry.source.lastIndexOf('\n', registry.close) + 1;
  const ownLine = /^\s*$/.test(registry.source.slice(lineStart, registry.close));
  if (!ownLine && registry.registrations.length) throw new Error('REGISTRY_UNSUPPORTED_LAYOUT: closing callback brace needs its own line');
  let source = ownLine ? registry.source.slice(0, lineStart) + `    ${key}: ${registry.registerName}(${local}),${newline}` + registry.source.slice(lineStart)
    : registry.source.slice(0, registry.close) + `${newline}    ${key}: ${registry.registerName}(${local}),${newline}  ` + registry.source.slice(registry.close);
  if (registry.lastPropertyEnd !== undefined && !registry.trailingComma) source = source.slice(0, registry.lastPropertyEnd) + ',' + source.slice(registry.lastPropertyEnd);
  if (registry.parameterInsertion !== undefined) source = source.slice(0, registry.parameterInsertion) + 'register' + source.slice(registry.parameterInsertion);
  source = source.slice(0, registry.importEnd) + `${newline}import { ${local} } from '${from}';` + source.slice(registry.importEnd);
  return source;
}
export async function validateRegistrySource(source) {
  const ts = await import('typescript');
  const parsed = ts.createSourceFile('features.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) throw new Error('REGISTRY_GENERATED_SYNTAX_ERROR: no files were changed');
}
