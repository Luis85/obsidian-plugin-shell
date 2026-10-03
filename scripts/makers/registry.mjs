import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const featureImport = /^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/;
function namedImports(ts, parsed) {
  const imports = [];
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const entry of bindings.elements) imports.push({ local: entry.name.text, exported: entry.propertyName?.text ?? entry.name.text, from: statement.moduleSpecifier.text });
  }
  return imports;
}
function callbackLiteral(ts, callback) {
  const body = callback && ts.isArrowFunction(callback) ? callback.body : undefined;
  return body && ts.isParenthesizedExpression(body) ? body.expression : body;
}
function supportedCallback(ts, callback, literal) {
  if (!literal || !ts.isObjectLiteralExpression(literal) || callback.parameters.length > 1) return false;
  if (callback.parameters.length === 1) return ts.isIdentifier(callback.parameters[0].name);
  return literal.properties.length === 0;
}
/** Exactly one `createNoteFeatures(services, register => ({ ... }))` callback owns the registrations. */
function registrationCallback(ts, parsed) {
  let found;
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createNoteFeatures') {
      const callback = node.arguments[1]; const literal = callbackLiteral(ts, callback);
      if (found || !supportedCallback(ts, callback, literal)) throw new Error('REGISTRY_UNSUPPORTED_SHAPE: use one explicit register callback object');
      found = { object: literal, registerName: callback.parameters[0]?.name.text ?? 'register',
        parameterInsertion: callback.parameters.length ? undefined : callback.parameters.pos };
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (!found) throw new Error('REGISTRY_MISSING: expected the explicit feature registration callback');
  return found;
}
function registerArgument(ts, entry, registerName) {
  if (!ts.isPropertyAssignment(entry) || !ts.isIdentifier(entry.name) || !ts.isCallExpression(entry.initializer)) return undefined;
  const call = entry.initializer; const argument = call.arguments[0];
  const registers = ts.isIdentifier(call.expression) && call.expression.text === registerName;
  return registers && argument && ts.isIdentifier(argument) ? argument : undefined;
}
function readRegistrations(ts, object, registerName, imports) {
  const registrations = []; const keys = new Set();
  for (const entry of object.properties) {
    const argument = registerArgument(ts, entry, registerName);
    if (!argument) throw new Error('REGISTRY_UNSUPPORTED_ENTRY: preserve explicit key: register(feature) entries');
    if (keys.has(entry.name.text.toLowerCase())) throw new Error(`REGISTRY_DUPLICATE_KEY: ${entry.name.text}`);
    keys.add(entry.name.text.toLowerCase());
    const local = argument.text; const imported = imports.find(item => item.local === local);
    if (!imported || !featureImport.test(imported.from)) throw new Error(`REGISTRY_UNKNOWN_IMPORT: ${local}`);
    registrations.push({ key: entry.name.text, ...imported, override: entry.initializer.arguments.length > 1 });
  }
  return registrations;
}
export async function readRegistry(root, providedSource) {
  const ts = await import('typescript');
  const path = 'src/bootstrap/features.ts'; const source = providedSource ?? await readFile(resolve(root, path), 'utf8');
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) throw new Error('REGISTRY_PARSE_ERROR: repair src/bootstrap/features.ts first');
  const imports = namedImports(ts, parsed);
  const { object, registerName, parameterInsertion } = registrationCallback(ts, parsed);
  const registrations = readRegistrations(ts, object, registerName, imports);
  const lastImport = parsed.statements.filter(ts.isImportDeclaration).at(-1);
  if (!lastImport) throw new Error('REGISTRY_MISSING_IMPORTS');
  return { path, source, imports, registrations, importEnd: lastImport.end, close: object.end - 1, lastPropertyEnd: object.properties.at(-1)?.end, trailingComma: object.properties.hasTrailingComma, parameterInsertion, registerName };
}
const sameImport = (entry, local, from) => entry?.local === local && entry.from === from;
const sameRegistration = (entry, key, local, from) => entry?.key === key && sameImport(entry, local, from) && !entry.override;
/** Returns the unchanged source for the exact existing registration; any other overlap conflicts. */
function existingRegistration(registry, { key, local, from }) {
  const existing = registry.registrations.find(entry => entry.key.toLowerCase() === key.toLowerCase());
  const imported = registry.imports.find(entry => entry.local.toLowerCase() === local.toLowerCase());
  if (!existing && !imported) return undefined;
  if (sameRegistration(existing, key, local, from) && sameImport(imported, local, from)) return registry.source;
  throw new Error(`REGISTRY_CONFLICT: ${key} or ${local} is already owned`);
}
function insertRegistration(registry, key, local, newline) {
  const lineStart = registry.source.lastIndexOf('\n', registry.close) + 1;
  const ownLine = /^\s*$/.test(registry.source.slice(lineStart, registry.close));
  if (!ownLine && registry.registrations.length) throw new Error('REGISTRY_UNSUPPORTED_LAYOUT: closing callback brace needs its own line');
  if (ownLine) return registry.source.slice(0, lineStart) + `    ${key}: ${registry.registerName}(${local}),${newline}` + registry.source.slice(lineStart);
  return registry.source.slice(0, registry.close) + `${newline}    ${key}: ${registry.registerName}(${local}),${newline}  ` + registry.source.slice(registry.close);
}
export function extendRegistry(registry, { key, local, from }) {
  const unchanged = existingRegistration(registry, { key, local, from });
  if (unchanged !== undefined) return unchanged;
  const newline = registry.source.includes('\r\n') ? '\r\n' : '\n';
  let source = insertRegistration(registry, key, local, newline);
  if (registry.lastPropertyEnd !== undefined && !registry.trailingComma) source = source.slice(0, registry.lastPropertyEnd) + ',' + source.slice(registry.lastPropertyEnd);
  if (registry.parameterInsertion !== undefined) source = source.slice(0, registry.parameterInsertion) + 'register' + source.slice(registry.parameterInsertion);
  return source.slice(0, registry.importEnd) + `${newline}import { ${local} } from '${from}';` + source.slice(registry.importEnd);
}
export async function validateRegistrySource(source) {
  const ts = await import('typescript');
  const parsed = ts.createSourceFile('features.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) throw new Error('REGISTRY_GENERATED_SYNTAX_ERROR: no files were changed');
}
