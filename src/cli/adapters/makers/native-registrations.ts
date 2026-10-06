import { posix } from 'node:path';
import type TS from 'typescript';
import { hasSyntaxErrors, loadTypescript, namedImports, parseTypescript, variableNamed, type NamedImport, type Typescript } from './syntax.ts';
import type { RecipeContext } from './contracts.ts';

interface Registered { readonly source: string; readonly id: string | undefined; readonly extension: string | undefined }
interface Candidate { readonly id: string; readonly extension?: string | undefined }
/** Static native-registry inspection: explicit imports and literal declarations only, never executed while planning. */
interface Scan { readonly ts: Typescript; readonly context: RecipeContext }
function literal(ts: Typescript, input: TS.Node | undefined): TS.Node | undefined {
  let node = input;
  while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression;
  return node;
}
async function parsed({ ts, context }: Scan, path: string): Promise<TS.SourceFile> {
  const ast = parseTypescript(ts, path, await context.read(path));
  if (hasSyntaxErrors(ast)) throw new Error('NATIVE_REGISTRY_PARSE_ERROR: ' + path);
  return ast;
}
const review = (detail: string) => new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: ' + detail);
const declaration = (ts: Typescript, ast: TS.SourceFile, name: string) => literal(ts, variableNamed(ts, ast, name)?.initializer);
type Imports = ReadonlyMap<string, NamedImport>;
function entrySource(ts: Typescript, registry: string, imports: Imports, entry: TS.Expression): { source: string; imported: string } {
  const binding = ts.isIdentifier(entry) ? imports.get(entry.text) : undefined;
  if (!binding || !binding.from.startsWith('.'))
    throw review('expected an explicit imported declaration in ' + registry);
  const source = posix.normalize(posix.join(posix.dirname(registry), binding.from.replace(/\.ts$/, '') + '.ts'));
  return { source, imported: binding.imported };
}
function localExportName(ts: Typescript, sourceAst: TS.SourceFile, imported: string): string {
  let exported = imported;
  for (const statement of sourceAst.statements.filter(ts.isExportDeclaration)) {
    if (statement.moduleSpecifier || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    const alias = statement.exportClause.elements.find(item => item.name.text === exported);
    if (alias) exported = alias.propertyName?.text ?? alias.name.text;
  }
  return exported;
}
function readField(ts: Typescript, property: TS.ObjectLiteralElementLike, source: string, fields: Map<string, string>): void {
  if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return;
  if (!['id', 'extension'].includes(property.name.text)) return;
  const field = literal(ts, property.initializer);
  if (!field || !ts.isStringLiteral(field)) throw review('nonliteral ' + property.name.text + ' in ' + source);
  fields.set(property.name.text, field.text);
}
function readFields(ts: Typescript, object: TS.ObjectLiteralExpression, source: string, fields: Map<string, string>): Map<string, string> {
  for (const property of object.properties) {
    if (!ts.isSpreadAssignment(property)) {
      readField(ts, property, source, fields);
      continue;
    }
    const spread = literal(ts, property.expression);
    if (!spread || !ts.isObjectLiteralExpression(spread)) throw review('dynamic declaration spread in ' + source);
    readFields(ts, spread, source, fields);
  }
  return fields;
}
async function registeredEntry(scan: Scan, registry: string, imports: Imports, name: string, entry: TS.Expression): Promise<Registered> {
  const { ts } = scan;
  const { source, imported } = entrySource(ts, registry, imports, entry);
  const sourceAst = await parsed(scan, source);
  const value = declaration(ts, sourceAst, localExportName(ts, sourceAst, imported));
  if (!value || !ts.isObjectLiteralExpression(value)) throw review('expected a static definition in ' + source);
  const fields = readFields(ts, value, source, new Map());
  if (!fields.has('id') || (name.endsWith('FileTypes') && !fields.has('extension')))
    throw review('missing static identity in ' + source);
  return { source, id: fields.get('id'), extension: fields.get('extension') };
}
async function registrations(scan: Scan, registry: string, names: readonly string[]): Promise<Registered[]> {
  const { ts } = scan;
  const ast = await parsed(scan, registry);
  const imports = new Map(namedImports(ts, ast).map(item => [item.local, item]));
  const found: Registered[] = [];
  for (const name of names) {
    const array = declaration(ts, ast, name);
    if (!array || !ts.isArrayLiteralExpression(array)) throw review(registry + ':' + name);
    for (const entry of array.elements) found.push(await registeredEntry(scan, registry, imports, name, entry));
  }
  return found;
}
const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
function codebaseFolder(project: unknown): string {
  const settings = typeof project === 'object' && project !== null && 'settings' in project ? project.settings : undefined;
  const folder = typeof settings === 'object' && settings !== null && 'codebaseFolder' in settings ? settings.codebaseFolder : undefined;
  if (typeof folder !== 'string') throw new Error('NATIVE_REGISTRY_REQUIRES_REVIEW: design/project.json settings.codebaseFolder');
  return folder;
}
async function projectRegistrations(scan: Scan): Promise<Registered[]> {
  let project: unknown;
  try {
    project = JSON.parse(await scan.context.read('design/project.json'));
  } catch (error) {
    if (!isMissing(error)) throw error;
    return [];
  }
  return registrations(scan, codebaseFolder(project) + '/generated/bootstrap/native-integrations.ts', ['projectFileTypes', 'projectContextMenus']);
}
function checkConflict(candidate: Candidate, source: string, entry: Registered): void {
  if (entry.source === source) return;
  if (entry.id === candidate.id)
    throw new Error('NATIVE_ID_CONFLICT: ' + candidate.id + ' is already registered by ' + entry.source);
  if (candidate.extension && entry.extension === candidate.extension)
    throw new Error('NATIVE_EXTENSION_CONFLICT: .' + candidate.extension + ' is already registered by ' + String(entry.id));
}
export async function checkNativeRegistration(context: RecipeContext, candidate: Candidate, source: string): Promise<void> {
  const scan = { ts: await loadTypescript(), context };
  const existing = await registrations(scan, 'src/bootstrap/native-integrations.ts', ['nativeFileTypes', 'nativeContextMenus']);
  existing.push(...(await projectRegistrations(scan)));
  for (const entry of existing) checkConflict(candidate, source, entry);
}
