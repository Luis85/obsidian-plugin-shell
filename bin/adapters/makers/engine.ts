import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type TS from 'typescript';
import { hasSyntaxErrors, loadTypescript, parseTypescript as parseSource, variableDeclarations, type Typescript } from './syntax.ts';
import { sha256 as hash } from '../../../scripts/shared/hash.ts';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { formatGenerated } from './format-generated.ts';
import type { MakerContext, RegistryImport } from './contracts.ts';

type Structure = readonly unknown[];
const keywordKinds = (ts: Typescript): readonly TS.SyntaxKind[] => [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword];
const unwrap = (ts: Typescript, node: TS.Node): TS.Node => ts.isParenthesizedExpression(node) ? unwrap(ts, node.expression) : node;
function parseRegistry(ts: Typescript, path: string, source: string): TS.SourceFile {
  const ast = parseSource(ts, path, source);
  if (hasSyntaxErrors(ast)) throw new Error(`REGISTRY_PARSE_ERROR: ${path}`);
  return ast;
}
function registryArray(ts: Typescript, ast: TS.SourceFile, path: string, name: string): TS.ArrayLiteralExpression {
  const matches = variableDeclarations(ts, ast).filter(item => ts.isIdentifier(item.name) && item.name.text === name);
  const array = matches[0]?.initializer;
  if (matches.length !== 1 || !array || !ts.isArrayLiteralExpression(array)) throw new Error(`REGISTRY_UNSUPPORTED_SHAPE: ${path}:${name}`);
  return array;
}
function parseCandidate(ts: Typescript, expression: string): TS.Node {
  const candidate = parseSource(ts, 'candidate.ts', `const value = (${expression});`);
  const initializer = variableDeclarations(ts, candidate)[0]?.initializer;
  if (hasSyntaxErrors(candidate) || !initializer) throw new Error('REGISTRY_UNSUPPORTED_EXPRESSION: candidate');
  return initializer;
}
function identity(ts: Typescript, input: TS.Node, where: string): string {
  const node = unwrap(ts, input);
  if (ts.isIdentifier(node)) return `symbol:${node.text}`;
  if (ts.isArrowFunction(node) && ts.isCallExpression(node.body) && ts.isIdentifier(node.body.expression)) return `symbol:${node.body.expression.text}`;
  const id = ts.isObjectLiteralExpression(node) ? node.properties.find(property => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'id') : undefined;
  if (id && ts.isPropertyAssignment(id) && ts.isStringLiteral(id.initializer)) return `id:${id.initializer.text}`;
  throw new Error(`REGISTRY_UNSUPPORTED_ENTRY: ${where}`);
}
function leafStructure(ts: Typescript, node: TS.Node): Structure | undefined {
  if (ts.isIdentifier(node)) return ['identifier', node.text];
  if (ts.isStringLiteral(node)) return ['string', node.text];
  if (ts.isNumericLiteral(node)) return ['number', node.text];
  if (keywordKinds(ts).includes(node.kind)) return ['keyword', node.kind];
  if (ts.isShorthandPropertyAssignment(node)) return ['shorthand', node.name.text];
  return undefined;
}
type Recurse = (node: TS.Node) => Structure;
function containerStructure(ts: Typescript, node: TS.Node, recurse: Recurse): Structure | undefined {
  if (ts.isObjectLiteralExpression(node)) return ['object', node.properties.map(recurse)];
  if (ts.isArrayLiteralExpression(node)) return ['array', node.elements.map(recurse)];
  if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) return ['property', node.name.text, recurse(node.initializer)];
  return undefined;
}
const plainParameter = (ts: Typescript, parameter: TS.ParameterDeclaration): boolean => ts.isIdentifier(parameter.name) && !parameter.modifiers?.length && !parameter.questionToken && !parameter.type && !parameter.initializer && !parameter.dotDotDotToken;
const parameterName = (ts: Typescript, parameter: TS.ParameterDeclaration): string => ts.isIdentifier(parameter.name) ? parameter.name.text : '';
function expressionStructure(ts: Typescript, node: TS.Node, recurse: Recurse): Structure | undefined {
  if (ts.isPropertyAccessExpression(node)) return ['access', recurse(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node)) return ['element', recurse(node.expression), recurse(node.argumentExpression)];
  if (ts.isCallExpression(node) && !node.typeArguments) return ['call', recurse(node.expression), node.arguments.map(recurse)];
  if (ts.isArrowFunction(node) && !node.typeParameters && !node.type && node.parameters.every(parameter => plainParameter(ts, parameter)))
    return ['arrow', node.parameters.map(parameter => parameterName(ts, parameter)), recurse(node.body)];
  return undefined;
}
const modified = (ts: Typescript, node: TS.Node): boolean => Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.length) || ts.isOptionalChain(node);
function structure(ts: Typescript, input: TS.Node, where: string): Structure {
  const node = unwrap(ts, input);
  const recurse = (child: TS.Node) => structure(ts, child, where);
  const shape = modified(ts, node) ? undefined : leafStructure(ts, node) ?? containerStructure(ts, node, recurse) ?? expressionStructure(ts, node, recurse);
  if (!shape) throw new Error(`REGISTRY_UNSUPPORTED_EXPRESSION: ${where}`);
  return shape;
}
/** One identity per entry; an existing identity must keep the exact canonical expression. */
function registrationPresent(ts: Typescript, array: TS.ArrayLiteralExpression, expected: TS.Node, path: string, where: string): boolean {
  const canonical = (node: TS.Node) => JSON.stringify(structure(ts, node, where));
  const wanted = canonical(expected); const key = identity(ts, expected, where);
  const seen = new Set<string>(); let present = false;
  for (const item of array.elements) {
    const current = identity(ts, item, where);
    if (seen.has(current)) throw new Error(`REGISTRY_DUPLICATE_KEY: ${path}:${current}`);
    seen.add(current);
    if (current === key && canonical(item) !== wanted) throw new Error(`REGISTRY_CONFLICT: edited registration ${path}:${key}`);
    present ||= current === key;
  }
  return present;
}
function appendEntry(source: string, array: TS.ArrayLiteralExpression, expression: string): string {
  const last = array.elements.at(-1);
  const comma = last && !array.elements.hasTrailingComma ? ',' : '';
  const prefix = last ? source.slice(0, last.end) + comma + source.slice(last.end, array.end - 1) : source.slice(0, array.end - 1);
  return prefix + `  ${expression},\n` + source.slice(array.end - 1);
}
function importedLocals(ts: Typescript, statement: TS.ImportDeclaration): { name: string; from: string }[] {
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  const locals = bindings && ts.isNamedImports(bindings) ? bindings.elements.map(entry => entry.name.text) : [];
  const from = ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : '';
  return [...locals, ...(clause?.name ? [clause.name.text] : [])].map(name => ({ name, from }));
}
function addImport(ts: Typescript, path: string, source: string, { local, from, defaultImport = false }: RegistryImport): string {
  const ast = parseSource(ts, path, source);
  const existing = ast.statements.filter(ts.isImportDeclaration).flatMap(statement => importedLocals(ts, statement)).filter(item => item.name === local);
  if (!existing.length) return `import ${defaultImport ? local : `{ ${local} }`} from '${from}';\n` + source;
  if (existing.length !== 1 || existing[0]?.from !== from) throw new Error(`REGISTRY_CONFLICT: ${local}`);
  return source;
}
/** Recipes describe bytes. Only the shared file planner writes them. */
export function createMakerContext(root: string): MakerContext {
  const entries = new Map<string, string>(); const originals = new Map<string, string | null>(); const reads = new Map<string, string>(); const tests = new Set<string>();
  async function read(path: string): Promise<string> {
    const known = entries.get(path) ?? reads.get(path);
    if (known !== undefined) return known;
    await createFilePlan(root, [{ path, content: null }]);
    const source = await readFile(resolve(root, path), 'utf8');
    originals.set(path, hash(source)); reads.set(path, source); return source;
  }
  async function add(path: string, input: string): Promise<void> {
    const [formatted] = await formatGenerated([{ path, content: input }]);
    const content = formatted?.content ?? input;
    if (entries.has(path) && entries.get(path) !== content) throw new Error(`MAKER_DUPLICATE_OUTPUT: ${path}`);
    const plan = await createFilePlan(root, [{ path, content }]);
    const change = plan.changes[0];
    if (change?.status === 'update') throw new Error(`MAKER_CONFLICT: edited or unrelated file ${path}`);
    originals.set(path, change?.beforeHash ?? null); entries.set(path, content);
  }
  async function editArray(path: string, name: string, expression: string, imports: readonly RegistryImport[] = []): Promise<void> {
    const ts = await loadTypescript();
    const where = `${path}:${name}`;
    let source = await read(path);
    const array = registryArray(ts, parseRegistry(ts, path, source), path, name);
    if (!registrationPresent(ts, array, parseCandidate(ts, expression), path, where)) source = appendEntry(source, array, expression);
    for (const entry of imports) source = addImport(ts, path, source, entry);
    entries.set(path, source);
  }
  return { root, read, add, editArray, tests,
    async edit(path, transform) { entries.set(path, await transform(await read(path))); },
    async finish(beforeFinalize) {
      await beforeFinalize?.();
      const formatted = await formatGenerated([...entries].map(([path, content]) => ({ path, content })));
      const guards = [...reads].filter(([path]) => !entries.has(path)).map(([path, content]) => ({ path, content }));
      const plan = await createFilePlan(root, [...formatted, ...guards]);
      for (const change of plan.changes) if (originals.get(change.path) !== change.beforeHash) throw new Error(`MAKER_STALE_INPUT: ${change.path}`);
      return plan;
    },
  };
}
