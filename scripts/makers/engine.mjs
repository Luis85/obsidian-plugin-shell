import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.mjs';
import { formatGenerated } from '../quality/format-generated.mjs';

const hash = source => createHash('sha256').update(source).digest('hex');
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
    let source = await read(path);
    let ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (ast.parseDiagnostics.length) throw new Error(`REGISTRY_PARSE_ERROR: ${path}`);
    const declarations = ast.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations);
    const matches = declarations.filter(item => ts.isIdentifier(item.name) && item.name.text === name);
    const array = matches[0]?.initializer;
    if (matches.length !== 1 || !array || !ts.isArrayLiteralExpression(array)) throw new Error(`REGISTRY_UNSUPPORTED_SHAPE: ${path}:${name}`);
    const candidate = ts.createSourceFile('candidate.ts', `const value = (${expression});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const expected = candidate.statements[0]?.declarationList?.declarations[0]?.initializer;
    const unwrap = node => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
    const identity = node => {
      node = unwrap(node);
      if (ts.isIdentifier(node)) return `symbol:${node.text}`;
      if (ts.isArrowFunction(node) && ts.isCallExpression(node.body) && ts.isIdentifier(node.body.expression)) return `symbol:${node.body.expression.text}`;
      if (ts.isObjectLiteralExpression(node)) {
        const id = node.properties.find(property => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'id');
        if (id && ts.isStringLiteral(id.initializer)) return `id:${id.initializer.text}`;
      }
      throw new Error(`REGISTRY_UNSUPPORTED_ENTRY: ${path}:${name}`);
    };
    function structure(input) {
      const node = unwrap(input);
      if (node.modifiers?.length || node.questionDotToken) throw new Error(`REGISTRY_UNSUPPORTED_EXPRESSION: ${path}:${name}`);
      if (ts.isIdentifier(node)) return ['identifier', node.text];
      if (ts.isStringLiteral(node)) return ['string', node.text];
      if (ts.isNumericLiteral(node)) return ['number', node.text];
      if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return ['keyword', node.kind];
      if (ts.isObjectLiteralExpression(node)) return ['object', node.properties.map(structure)];
      if (ts.isArrayLiteralExpression(node)) return ['array', node.elements.map(structure)];
      if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) return ['property', node.name.text, structure(node.initializer)];
      if (ts.isShorthandPropertyAssignment(node)) return ['shorthand', node.name.text];
      if (ts.isPropertyAccessExpression(node)) return ['access', structure(node.expression), node.name.text];
      if (ts.isElementAccessExpression(node)) return ['element', structure(node.expression), structure(node.argumentExpression)];
      if (ts.isCallExpression(node) && !node.typeArguments) return ['call', structure(node.expression), node.arguments.map(structure)];
      if (ts.isArrowFunction(node) && !node.typeParameters && !node.type && node.parameters.every(parameter => ts.isIdentifier(parameter.name) && !parameter.modifiers?.length && !parameter.questionToken && !parameter.type && !parameter.initializer && !parameter.dotDotDotToken)) return ['arrow', node.parameters.map(parameter => parameter.name.text), structure(node.body)];
      throw new Error(`REGISTRY_UNSUPPORTED_EXPRESSION: ${path}:${name}`);
    }
    const canonical = node => JSON.stringify(structure(node));
    const wanted = canonical(expected); const key = identity(expected);
    const seen = new Set(); let present = false;
    for (const item of array.elements) {
      const current = identity(item);
      if (seen.has(current)) throw new Error(`REGISTRY_DUPLICATE_KEY: ${path}:${current}`);
      seen.add(current);
      if (current === key) {
        if (canonical(item) !== wanted) throw new Error(`REGISTRY_CONFLICT: edited registration ${path}:${key}`);
        present = true;
      }
    }
    if (!present) {
      const last = array.elements.at(-1);
      const comma = last && !array.elements.hasTrailingComma ? ',' : '';
      const prefix = last ? source.slice(0, last.end) + comma + source.slice(last.end, array.end - 1) : source.slice(0, array.end - 1);
      source = prefix + `  ${expression},\n` + source.slice(array.end - 1);
    }
    for (const { local, from, defaultImport = false } of imports) {
      ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const existing = ast.statements.filter(ts.isImportDeclaration).flatMap(node => {
        const clause = node.importClause;
        const locals = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements.map(entry => entry.name.text) : [];
        return [...locals, ...(clause?.name ? [clause.name.text] : [])].map(name => ({ name, from: node.moduleSpecifier.text }));
      }).filter(item => item.name === local);
      if (existing.length) {
        if (existing.length !== 1 || existing[0].from !== from) throw new Error(`REGISTRY_CONFLICT: ${local}`);
      } else source = `import ${defaultImport ? local : `{ ${local} }`} from '${from}';\n` + source;
    }
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
