import { posix } from 'node:path';

const registryPath = 'src/bootstrap/authoring-locales.ts';
const featureImport = /^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/;
const parse = (ts, path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const variable = (ts, ast, name) => ast.statements.filter(ts.isVariableStatement)
  .flatMap(statement => statement.declarationList.declarations)
  .find(node => ts.isIdentifier(node.name) && node.name.text === name);
function namedImports(ts, source) {
  const imports = new Map();
  for (const node of source.statements.filter(ts.isImportDeclaration)) {
    const names = node.importClause?.namedBindings;
    if (!names || !ts.isNamedImports(names)) continue;
    for (const item of names.elements) imports.set(item.name.text, { from: node.moduleSpecifier.text, exported: item.propertyName?.text ?? item.name.text });
  }
  return imports;
}
function literalProperty(ts, property) {
  const named = ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name));
  if (!named || ['__proto__', 'constructor', 'prototype'].includes(property.name.text)) throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
  return [property.name.text, literal(ts, property.initializer)];
}
function literal(ts, node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => literalProperty(ts, property)));
  throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
}
async function englishModule(ts, read, imports, entry) {
  if (!ts.isIdentifier(entry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
  const imported = imports.get(entry.text);
  if (!imported || !featureImport.test(imported.from)) throw new Error('LOCALE_REGISTRY_IMPORT');
  const modulePath = posix.normalize(posix.join('src/bootstrap', imported.from + '.ts'));
  const declaration = variable(ts, parse(ts, modulePath, await read(modulePath)), imported.exported);
  if (!declaration?.initializer) throw new Error('LOCALE_DECLARATION_MISSING');
  const module = literal(ts, declaration.initializer);
  if (!module.en || typeof module.en !== 'object') throw new Error('LOCALE_ENGLISH_DICTIONARY_MISSING');
  return module.en;
}
/** Read literal registered dictionaries without executing developer source or writing a bundle. */
export async function localeSkeleton(read) {
  const ts = await import('typescript');
  const base = JSON.parse(await read('src/locales/en.json'));
  const source = parse(ts, registryPath, await read(registryPath));
  const registry = variable(ts, source, 'authoringLocaleModules')?.initializer;
  if (!registry || !ts.isArrayLiteralExpression(registry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
  const imports = namedImports(ts, source);
  const authoring = {};
  for (const entry of registry.elements) {
    for (const [namespace, values] of Object.entries(await englishModule(ts, read, imports, entry))) {
      if (Object.hasOwn(authoring, namespace)) throw new Error('LOCALE_NAMESPACE_COLLISION');
      authoring[namespace] = values;
    }
  }
  return Object.keys(authoring).length ? { ...base, authoring } : base;
}
