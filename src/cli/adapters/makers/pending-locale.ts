import { posix } from 'node:path';
import type TS from 'typescript';
import { loadTypescript, namedImports, parseTypescript, variableNamed, type NamedImport, type Typescript } from './syntax.ts';

type Dictionary = { readonly [key: string]: string | Dictionary };
type Read = (path: string) => Promise<string>;
const registryPath = 'src/bootstrap/authoring-locales.ts';
const featureImport = /^\.\.\/features\/[a-z0-9-]+\/[a-zA-Z0-9.-]+$/;
const isDictionary = (value: string | Dictionary | undefined): value is Dictionary => typeof value === 'object';
function literalProperty(ts: Typescript, property: TS.ObjectLiteralElementLike): [string, string | Dictionary] {
  const named = ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name));
  if (!named || ['__proto__', 'constructor', 'prototype'].includes(property.name.text)) throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
  return [property.name.text, literal(ts, property.initializer)];
}
function literal(ts: Typescript, node: TS.Expression): string | Dictionary {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => literalProperty(ts, property)));
  throw new Error('LOCALE_LITERAL_DICTIONARY_REQUIRED');
}
async function englishModule(ts: Typescript, read: Read, imports: ReadonlyMap<string, NamedImport>, entry: TS.Expression): Promise<Dictionary> {
  if (!ts.isIdentifier(entry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
  const imported = imports.get(entry.text);
  if (!imported || !featureImport.test(imported.from)) throw new Error('LOCALE_REGISTRY_IMPORT');
  const modulePath = posix.normalize(posix.join('src/bootstrap', imported.from + '.ts'));
  const declaration = variableNamed(ts, parseTypescript(ts, modulePath, await read(modulePath)), imported.imported);
  if (!declaration?.initializer) throw new Error('LOCALE_DECLARATION_MISSING');
  const module = literal(ts, declaration.initializer);
  const english = isDictionary(module) ? module.en : undefined;
  if (!isDictionary(english)) throw new Error('LOCALE_ENGLISH_DICTIONARY_MISSING');
  return english;
}
/** Read literal registered dictionaries without executing developer source or writing a bundle. */
export async function localeSkeleton(read: Read): Promise<Record<string, unknown>> {
  const ts = await loadTypescript();
  const base: unknown = JSON.parse(await read('src/locales/en.json'));
  const source = parseTypescript(ts, registryPath, await read(registryPath));
  const registry = variableNamed(ts, source, 'authoringLocaleModules')?.initializer;
  if (!registry || !ts.isArrayLiteralExpression(registry)) throw new Error('LOCALE_REGISTRY_UNSUPPORTED');
  const imports = new Map(namedImports(ts, source).map(item => [item.local, item]));
  const authoring: Record<string, string | Dictionary> = {};
  for (const entry of registry.elements) {
    for (const [namespace, values] of Object.entries(await englishModule(ts, read, imports, entry))) {
      if (Object.hasOwn(authoring, namespace)) throw new Error('LOCALE_NAMESPACE_COLLISION');
      authoring[namespace] = values;
    }
  }
  const dictionary = typeof base === 'object' && base !== null ? base : {};
  return Object.keys(authoring).length ? { ...dictionary, authoring } : { ...dictionary };
}
export interface PendingLocaleCheck { readonly locale: string; readonly missing: readonly string[]; readonly extra: readonly string[]; readonly selectable: unknown }
const keyPaths = (value: unknown): string[] => typeof value === 'object' && value !== null
  ? Object.entries(value).flatMap(([key, child]: [string, unknown]) => typeof child === 'object' && child !== null ? keyPaths(child).map(nested => `${key}.${nested}`) : [key])
  : [];
/** Read-only comparison of a pending draft with the current base keys; translated values stay free to change. */
export async function checkPendingLocale(read: Read, locale: string): Promise<PendingLocaleCheck> {
  const base = new Set(keyPaths(await localeSkeleton(read)));
  const draft = new Set(keyPaths(JSON.parse(await read(`src/locales/pending/${locale}.json`))));
  const status: unknown = JSON.parse(await read(`src/locales/pending/${locale}.status.json`));
  const selectable = typeof status === 'object' && status !== null && 'selectable' in status ? status.selectable : null;
  return { locale, missing: [...base].filter(key => !draft.has(key)).sort(), extra: [...draft].filter(key => !base.has(key)).sort(), selectable };
}
