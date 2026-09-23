import { posix } from 'node:path';

/** Read literal registered dictionaries without executing developer source or writing a bundle. */
export async function localeSkeleton(read) {
  const ts = await import('typescript');
  const base = JSON.parse(await read('src/locales/en.json'));
  const path = 'src/bootstrap/authoring-locales.ts';
  const source = ts.createSourceFile(path, await read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const variables = ast => ast.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations);
  const registry = variables(source).find(node => ts.isIdentifier(node.name) && node.name.text === 'authoringLocaleModules')?.initializer;
  if (!registry || !ts.isArrayLiteralExpression(registry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
  const imports = new Map();
  for (const node of source.statements.filter(ts.isImportDeclaration)) {
    const names = node.importClause?.namedBindings;
    if (names && ts.isNamedImports(names)) for (const item of names.elements) imports.set(item.name.text, { from: node.moduleSpecifier.text, exported: item.propertyName?.text ?? item.name.text });
  }
  function literal(node) {
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) || ['__proto__', 'constructor', 'prototype'].includes(property.name.text)) throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
      return [property.name.text, literal(property.initializer)];
    }));
    throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
  }
  const authoring = {};
  for (const entry of registry.elements) {
    if (!ts.isIdentifier(entry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
    const imported = imports.get(entry.text);
    if (!imported || !/^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/.test(imported.from)) throw new Error('LOCALE_REGISTRY_IMPORT');
    const modulePath = posix.normalize(posix.join('src/bootstrap', imported.from + '.ts'));
    const ast = ts.createSourceFile(modulePath, await read(modulePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declaration = variables(ast).find(node => ts.isIdentifier(node.name) && node.name.text === imported.exported);
    if (!declaration?.initializer) throw new Error('LOCALE_DECLARATION_MISSING');
    const module = literal(declaration.initializer);
    if (!module.en || typeof module.en !== 'object') throw new Error('LOCALE_ENGLISH_DICTIONARY_MISSING');
    for (const [namespace, values] of Object.entries(module.en)) {
      if (Object.hasOwn(authoring, namespace)) throw new Error('LOCALE_NAMESPACE_COLLISION');
      authoring[namespace] = values;
    }
  }
  return Object.keys(authoring).length ? { ...base, authoring } : base;
}
