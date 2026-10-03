import type TS from 'typescript';

/** Recipes inspect explicit static source only; they never execute or type-check developer code while planning. */
export type Typescript = typeof TS;
// Loaded on first use: the dependency-free release CLI must start without TypeScript installed.
export const loadTypescript = async (): Promise<Typescript> => (await import('typescript')).default;
export const parseTypescript = (ts: Typescript, path: string, text: string): TS.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
/** The parser's own syntax diagnostics (no program); missing diagnostics fail closed instead of passing. */
export function hasSyntaxErrors(ast: TS.SourceFile): boolean {
  if (!('parseDiagnostics' in ast) || !Array.isArray(ast.parseDiagnostics)) throw new Error('TYPESCRIPT_PARSER_UNSUPPORTED');
  return ast.parseDiagnostics.length > 0;
}
export const variableDeclarations = (ts: Typescript, ast: TS.SourceFile): TS.VariableDeclaration[] =>
  ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
export const variableNamed = (ts: Typescript, ast: TS.SourceFile, name: string): TS.VariableDeclaration | undefined =>
  variableDeclarations(ts, ast).find(item => ts.isIdentifier(item.name) && item.name.text === name);
export interface NamedImport { readonly local: string; readonly imported: string; readonly from: string }
/** Named (`{ a as b }`) bindings of every string-specifier import declaration, in source order. */
export function namedImports(ts: Typescript, ast: TS.SourceFile): NamedImport[] {
  return ast.statements.filter(ts.isImportDeclaration).flatMap(statement => {
    const bindings = statement.importClause?.namedBindings;
    if (!ts.isStringLiteral(statement.moduleSpecifier) || !bindings || !ts.isNamedImports(bindings)) return [];
    const from = statement.moduleSpecifier.text;
    return bindings.elements.map(entry => ({ local: entry.name.text, imported: entry.propertyName?.text ?? entry.name.text, from }));
  });
}
