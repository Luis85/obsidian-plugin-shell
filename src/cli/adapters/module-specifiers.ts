/**
 * Module specifiers of a source file, read from its syntax tree: static and dynamic imports, re-exports, import types,
 * require() and `new URL('<relative>', import.meta.url)`. Strings inside other strings or comments never count. Shared
 * by `source check`/`source rename` and the repository's project boundary gate (tooling/quality/check-project-boundaries.mjs),
 * which passes its own statically imported parsers (including Vue's SFC parser).
 */
import type TS from 'typescript';
type Typescript = typeof TS;
interface SfcBlock { content: string; loc: { start: { offset: number; line: number } } }
type ParseSfc = (source: string, options: { filename: string }) => { descriptor: { script: SfcBlock | null; scriptSetup: SfcBlock | null } };
export interface SpecifierParsers { ts: Typescript; parseSfc: ParseSfc }
/** `start`/`end` delimit the specifier text (inside its quotes) in the complete file text; `line` is 1-based. */
export interface ModuleSpecifier { specifier: string; line: number; start: number; end: number }

/**
 * The `<script>` and `<script setup>` blocks of a single-file component with their offsets. The built CLI bundles no
 * Vue compiler (its optional template engines cannot be bundled), and module specifiers live only in these blocks.
 */
const scriptBlocks: ParseSfc = source => {
  const blocks = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(match => {
    const offset = match.index + match[0].indexOf('>') + 1;
    return { setup: /\bsetup\b/.test(match[1]!), block: { content: match[2]!, loc: { start: { offset, line: source.slice(0, offset).split('\n').length } } } };
  });
  return { descriptor: { script: blocks.find(item => !item.setup)?.block ?? null, scriptSetup: blocks.find(item => item.setup)?.block ?? null } };
};
export async function loadSpecifierParsers(): Promise<SpecifierParsers> {
  return { ts: (await import('typescript')).default, parseSfc: scriptBlocks };
}
function scriptKind(ts: Typescript, path: string): TS.ScriptKind {
  return /\.[cm]?jsx?$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}
function loaderCall(ts: Typescript, node: TS.CallExpression): TS.StringLiteralLike | null {
  const callee = node.expression, first = node.arguments[0];
  const loader = callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require');
  return loader && first && ts.isStringLiteralLike(first) ? first : null;
}
const relativeLiteral = (ts: Typescript, node: TS.Node | undefined): TS.StringLiteralLike | null =>
  node && ts.isStringLiteralLike(node) && /^\.\.?\//.test(node.text) ? node : null;
const isImportMetaUrl = (ts: Typescript, node: TS.Node | undefined, ast: TS.SourceFile): boolean =>
  Boolean(node && ts.isPropertyAccessExpression(node) && node.getText(ast) === 'import.meta.url');
function urlTarget(ts: Typescript, node: TS.NewExpression, ast: TS.SourceFile): TS.StringLiteralLike | null {
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'URL' || node.arguments?.length !== 2) return null;
  const target = relativeLiteral(ts, node.arguments[0]);
  return target && isImportMetaUrl(ts, node.arguments[1], ast) ? target : null;
}
function literalOf(ts: Typescript, node: TS.Node, ast: TS.SourceFile): TS.StringLiteralLike | null {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier;
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) return node.argument.literal;
  if (ts.isCallExpression(node)) return loaderCall(ts, node);
  if (ts.isNewExpression(node)) return urlTarget(ts, node, ast);
  return null;
}
function scriptSpecifiers(ts: Typescript, path: string, source: string, offset: number, firstLine: number): ModuleSpecifier[] {
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind(ts, path));
  const found: ModuleSpecifier[] = [];
  const visit = (node: TS.Node): void => {
    const literal = literalOf(ts, node, ast);
    if (literal) {
      const start = literal.getStart(ast) + 1;
      found.push({ specifier: literal.text, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + firstLine, start: start + offset, end: start + offset + literal.text.length });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}
export function moduleSpecifiers(path: string, text: string, { ts, parseSfc }: SpecifierParsers): ModuleSpecifier[] {
  if (!path.endsWith('.vue')) return scriptSpecifiers(ts, path, text, 0, 1);
  const { descriptor } = parseSfc(text, { filename: path });
  return [descriptor.script, descriptor.scriptSetup].filter((block): block is SfcBlock => Boolean(block))
    .flatMap(block => scriptSpecifiers(ts, `${path}.ts`, block.content, block.loc.start.offset, block.loc.start.line));
}
