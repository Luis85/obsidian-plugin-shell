import { makerTarget } from './target.ts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type TS from 'typescript';
import { hasSyntaxErrors, loadTypescript, namedImports, parseTypescript, type NamedImport, type Typescript } from './syntax.ts';

// Hand-written features live under ../features/<owner>/; the project compiler registers its documents from ../generated/.
const featureImport = /^\.\.\/(?:features\/[a-z0-9-]+|generated(?:\/[a-z0-9-]+)+)\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
interface FeatureImport { readonly local: string; readonly exported: string; readonly from: string }
interface Registration extends FeatureImport { readonly key: string; readonly override: boolean }
export interface FeatureRegistry {
  readonly path: string; readonly source: string; readonly imports: readonly FeatureImport[]; readonly registrations: readonly Registration[];
  readonly importEnd: number; readonly close: number; readonly lastPropertyEnd: number | undefined; readonly trailingComma: boolean;
  readonly parameterInsertion: number | undefined; readonly registerName: string;
}
interface Callback { readonly object: TS.ObjectLiteralExpression; readonly registerName: string; readonly parameterInsertion: number | undefined }
const featureImports = (imports: readonly NamedImport[]): FeatureImport[] => imports.map(({ local, imported, from }) => ({ local, exported: imported, from }));
function callbackLiteral(ts: Typescript, body: TS.ConciseBody): TS.Expression | undefined {
  if (ts.isBlock(body)) return undefined;
  return ts.isParenthesizedExpression(body) ? body.expression : body;
}
function registerParameter(ts: Typescript, callback: TS.ArrowFunction, literal: TS.ObjectLiteralExpression): string | null | undefined {
  const [parameter, ...rest] = callback.parameters;
  if (rest.length) return undefined;
  if (!parameter) return literal.properties.length === 0 ? null : undefined;
  return ts.isIdentifier(parameter.name) ? parameter.name.text : undefined;
}
function registerCallback(ts: Typescript, callback: TS.Expression | undefined): Callback | undefined {
  if (!callback || !ts.isArrowFunction(callback)) return undefined;
  const literal = callbackLiteral(ts, callback.body);
  if (!literal || !ts.isObjectLiteralExpression(literal)) return undefined;
  const name = registerParameter(ts, callback, literal);
  if (name === undefined) return undefined;
  return { object: literal, registerName: name ?? 'register', parameterInsertion: name === null ? callback.parameters.pos : undefined };
}
/** Exactly one `createNoteFeatures(services, register => ({ ... }))` callback owns the registrations. */
function registrationCallback(ts: Typescript, parsed: TS.SourceFile): Callback {
  let found: Callback | undefined;
  function visit(node: TS.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createNoteFeatures') {
      const callback = registerCallback(ts, node.arguments[1]);
      if (found || !callback) throw new Error('REGISTRY_UNSUPPORTED_SHAPE: use one explicit register callback object');
      found = callback;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (!found) throw new Error('REGISTRY_MISSING: expected the explicit feature registration callback');
  return found;
}
interface Entry { readonly key: string; readonly local: string; readonly override: boolean }
function registerEntry(ts: Typescript, entry: TS.ObjectLiteralElementLike, registerName: string): Entry | undefined {
  if (!ts.isPropertyAssignment(entry) || !ts.isIdentifier(entry.name) || !ts.isCallExpression(entry.initializer)) return undefined;
  const call = entry.initializer; const argument = call.arguments[0];
  const registers = ts.isIdentifier(call.expression) && call.expression.text === registerName;
  return registers && argument && ts.isIdentifier(argument) ? { key: entry.name.text, local: argument.text, override: call.arguments.length > 1 } : undefined;
}
function readRegistrations(ts: Typescript, { object, registerName }: Callback, imports: readonly FeatureImport[]): Registration[] {
  const registrations: Registration[] = []; const keys = new Set<string>();
  for (const property of object.properties) {
    const entry = registerEntry(ts, property, registerName);
    if (!entry) throw new Error('REGISTRY_UNSUPPORTED_ENTRY: preserve explicit key: register(feature) entries');
    if (keys.has(entry.key.toLowerCase())) throw new Error(`REGISTRY_DUPLICATE_KEY: ${entry.key}`);
    keys.add(entry.key.toLowerCase());
    const imported = imports.find(item => item.local === entry.local);
    if (!imported || !featureImport.test(imported.from)) throw new Error(`REGISTRY_UNKNOWN_IMPORT: ${entry.local}`);
    registrations.push({ key: entry.key, ...imported, override: entry.override });
  }
  return registrations;
}
export async function readRegistry(root: string, providedSource?: string, sourcePath?: string): Promise<FeatureRegistry> {
  const ts = await loadTypescript();
  const base = sourcePath ?? (providedSource === undefined ? (await makerTarget(root)).path : 'src');
  const path = `${base}/bootstrap/features.ts`; const source = providedSource ?? await readFile(resolve(root, path), 'utf8');
  const parsed = parseTypescript(ts, path, source);
  if (hasSyntaxErrors(parsed)) throw new Error('REGISTRY_PARSE_ERROR: repair src/bootstrap/features.ts first');
  const imports = featureImports(namedImports(ts, parsed));
  const callback = registrationCallback(ts, parsed);
  const registrations = readRegistrations(ts, callback, imports);
  const lastImport = parsed.statements.filter(ts.isImportDeclaration).at(-1);
  if (!lastImport) throw new Error('REGISTRY_MISSING_IMPORTS');
  const { object, registerName, parameterInsertion } = callback;
  return { path, source, imports, registrations, importEnd: lastImport.end, close: object.end - 1, lastPropertyEnd: object.properties.at(-1)?.end, trailingComma: object.properties.hasTrailingComma, parameterInsertion, registerName };
}
interface Binding { readonly key: string; readonly local: string; readonly from: string }
const sameImport = (entry: FeatureImport | undefined, local: string, from: string) => entry?.local === local && entry.from === from;
const sameRegistration = (entry: Registration | undefined, { key, local, from }: Binding) => entry?.key === key && sameImport(entry, local, from) && !entry.override;
/** Returns the unchanged source for the exact existing registration; any other overlap conflicts. */
function existingRegistration(registry: FeatureRegistry, binding: Binding): string | undefined {
  const existing = registry.registrations.find(entry => entry.key.toLowerCase() === binding.key.toLowerCase());
  const imported = registry.imports.find(entry => entry.local.toLowerCase() === binding.local.toLowerCase());
  if (!existing && !imported) return undefined;
  if (sameRegistration(existing, binding) && sameImport(imported, binding.local, binding.from)) return registry.source;
  throw new Error(`REGISTRY_CONFLICT: ${binding.key} or ${binding.local} is already owned`);
}
function insertRegistration(registry: FeatureRegistry, key: string, local: string, newline: string): string {
  const lineStart = registry.source.lastIndexOf('\n', registry.close) + 1;
  const ownLine = /^\s*$/.test(registry.source.slice(lineStart, registry.close));
  if (!ownLine && registry.registrations.length) throw new Error('REGISTRY_UNSUPPORTED_LAYOUT: closing callback brace needs its own line');
  if (ownLine) return registry.source.slice(0, lineStart) + `    ${key}: ${registry.registerName}(${local}),${newline}` + registry.source.slice(lineStart);
  return registry.source.slice(0, registry.close) + `${newline}    ${key}: ${registry.registerName}(${local}),${newline}  ` + registry.source.slice(registry.close);
}
export function extendRegistry(registry: FeatureRegistry, binding: Binding): string {
  const unchanged = existingRegistration(registry, binding);
  if (unchanged !== undefined) return unchanged;
  const { key, local, from } = binding;
  const newline = registry.source.includes('\r\n') ? '\r\n' : '\n';
  let source = insertRegistration(registry, key, local, newline);
  if (registry.lastPropertyEnd !== undefined && !registry.trailingComma) source = source.slice(0, registry.lastPropertyEnd) + ',' + source.slice(registry.lastPropertyEnd);
  if (registry.parameterInsertion !== undefined) source = source.slice(0, registry.parameterInsertion) + 'register' + source.slice(registry.parameterInsertion);
  return source.slice(0, registry.importEnd) + `${newline}import { ${local} } from '${from}';` + source.slice(registry.importEnd);
}
export async function validateRegistrySource(source: string): Promise<void> {
  const ts = await loadTypescript();
  if (hasSyntaxErrors(parseTypescript(ts, 'features.ts', source))) throw new Error('REGISTRY_GENERATED_SYNTAX_ERROR: no files were changed');
}
