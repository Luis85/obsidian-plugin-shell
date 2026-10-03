import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.ts';
import { formatGenerated } from '../quality/format-generated.mjs';

const hash = source => createHash('sha256').update(source).digest('hex');
const keywordKinds = ts => [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword];
const unwrap = (ts, node) => ts.isParenthesizedExpression(node) ? unwrap(ts, node.expression) : node;
function parseRegistry(ts, path, source) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (ast.parseDiagnostics.length) throw new Error(`REGISTRY_PARSE_ERROR: ${path}`);
  return ast;
}
function registryArray(ts, ast, path, name) {
  const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations);
  const matches = declarations.filter(item => ts.isIdentifier(item.name) && item.name.text === name);
  const array = matches[0]?.initializer;
  if (matches.length !== 1 || !array || !ts.isArrayLiteralExpression(array)) throw new Error(`REGISTRY_UNSUPPORTED_SHAPE: ${path}:${name}`);
  return array;
}
function parseCandidate(ts, expression) {
  const candidate = ts.createSourceFile('candidate.ts', `const value = (${expression});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return candidate.statements[0]?.declarationList?.declarations[0]?.initializer;
}
function identity(ts, input, where) {
  const node = unwrap(ts, input);
  if (ts.isIdentifier(node)) return `symbol:${node.text}`;
  if (ts.isArrowFunction(node) && ts.isCallExpression(node.body) && ts.isIdentifier(node.body.expression)) return `symbol:${node.body.expression.text}`;
  const id = ts.isObjectLiteralExpression(node) ? node.properties.find(property => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'id') : undefined;
  if (id && ts.isStringLiteral(id.initializer)) return `id:${id.initializer.text}`;
  throw new Error(`REGISTRY_UNSUPPORTED_ENTRY: ${where}`);
}
function leafStructure(ts, node) {
  if (ts.isIdentifier(node)) return ['identifier', node.text];
  if (ts.isStringLiteral(node)) return ['string', node.text];
  if (ts.isNumericLiteral(node)) return ['number', node.text];
  if (keywordKinds(ts).includes(node.kind)) return ['keyword', node.kind];
  if (ts.isShorthandPropertyAssignment(node)) return ['shorthand', node.name.text];
  return undefined;
}
function containerStructure(ts, node, recurse) {
  if (ts.isObjectLiteralExpression(node)) return ['object', node.properties.map(recurse)];
  if (ts.isArrayLiteralExpression(node)) return ['array', node.elements.map(recurse)];
  if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) return ['property', node.name.text, recurse(node.initializer)];
  return undefined;
}
const plainParameter = (ts, parameter) => ts.isIdentifier(parameter.name) && !parameter.modifiers?.length && !parameter.questionToken && !parameter.type && !parameter.initializer && !parameter.dotDotDotToken;
const plainArrow = (ts, node) => ts.isArrowFunction(node) && !node.typeParameters && !node.type && node.parameters.every(parameter => plainParameter(ts, parameter));
function expressionStructure(ts, node, recurse) {
  if (ts.isPropertyAccessExpression(node)) return ['access', recurse(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node)) return ['element', recurse(node.expression), recurse(node.argumentExpression)];
  if (ts.isCallExpression(node) && !node.typeArguments) return ['call', recurse(node.expression), node.arguments.map(recurse)];
  if (plainArrow(ts, node)) return ['arrow', node.parameters.map(parameter => parameter.name.text), recurse(node.body)];
  return undefined;
}
function structure(ts, input, where) {
  const node = unwrap(ts, input);
  const recurse = child => structure(ts, child, where);
  const shape = node.modifiers?.length || node.questionDotToken ? undefined : leafStructure(ts, node) ?? containerStructure(ts, node, recurse) ?? expressionStructure(ts, node, recurse);
  if (!shape) throw new Error(`REGISTRY_UNSUPPORTED_EXPRESSION: ${where}`);
  return shape;
}
/** One identity per entry; an existing identity must keep the exact canonical expression. */
function registrationPresent(ts, array, expected, path, where) {
  const canonical = node => JSON.stringify(structure(ts, node, where));
  const wanted = canonical(expected); const key = identity(ts, expected, where);
  const seen = new Set(); let present = false;
  for (const item of array.elements) {
    const current = identity(ts, item, where);
    if (seen.has(current)) throw new Error(`REGISTRY_DUPLICATE_KEY: ${path}:${current}`);
    seen.add(current);
    if (current === key && canonical(item) !== wanted) throw new Error(`REGISTRY_CONFLICT: edited registration ${path}:${key}`);
    present ||= current === key;
  }
  return present;
}
function appendEntry(source, array, expression) {
  const last = array.elements.at(-1);
  const comma = last && !array.elements.hasTrailingComma ? ',' : '';
  const prefix = last ? source.slice(0, last.end) + comma + source.slice(last.end, array.end - 1) : source.slice(0, array.end - 1);
  return prefix + `  ${expression},\n` + source.slice(array.end - 1);
}
function importedLocals(ts, statement) {
  const clause = statement.importClause;
  const locals = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements.map(entry => entry.name.text) : [];
  return [...locals, ...(clause?.name ? [clause.name.text] : [])].map(name => ({ name, from: statement.moduleSpecifier.text }));
}
function addImport(ts, path, source, { local, from, defaultImport = false }) {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const existing = ast.statements.filter(ts.isImportDeclaration).flatMap(statement => importedLocals(ts, statement)).filter(item => item.name === local);
  if (!existing.length) return `import ${defaultImport ? local : `{ ${local} }`} from '${from}';\n` + source;
  if (existing.length !== 1 || existing[0].from !== from) throw new Error(`REGISTRY_CONFLICT: ${local}`);
  return source;
}
/** Recipes describe bytes. Only the shared file planner writes them. */
export function createMakerContext(root) {
  const entries = new Map(); const originals = new Map(); const reads = new Map(); const tests = new Set();
  async function read(path) {
    if (entries.has(path)) return entries.get(path);
    if (reads.has(path)) return reads.get(path);
    await createFilePlan(root, [{ path, content: null }]);
    const source = await readFile(resolve(root, path), 'utf8');
    originals.set(path, hash(source)); reads.set(path, source); return source;
  }
  async function add(path, content) {
    [{ content }] = await formatGenerated([{ path, content }]);
    if (entries.has(path) && entries.get(path) !== content) throw new Error(`MAKER_DUPLICATE_OUTPUT: ${path}`);
    const plan = await createFilePlan(root, [{ path, content }]);
    const change = plan.changes[0];
    if (change.status === 'update') throw new Error(`MAKER_CONFLICT: edited or unrelated file ${path}`);
    originals.set(path, change.beforeHash); entries.set(path, content);
  }
  async function editArray(path, name, expression, imports = []) {
    const ts = await import('typescript');
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
