import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasSyntaxErrors, loadTypescript, namedImports, parseTypescript, variableNamed } from './syntax.ts';

const customRegistryPath = 'scripts/makers/custom/registry.mjs';
const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const localModule = /^\.\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.mjs$/;

/**
 * Names of the explicitly registered local recipes, read statically from the registry without executing it.
 * A registered recipe lives in `./<name>.mjs`; resolving a name never imports trusted code.
 */
export async function customRecipeNames(root: string): Promise<string[]> {
  let source: string;
  try { source = await readFile(resolve(root, customRegistryPath), 'utf8'); }
  catch (error) { if (isMissing(error)) return []; throw error; }
  const ts = await loadTypescript();
  const ast = parseTypescript(ts, customRegistryPath, source);
  if (hasSyntaxErrors(ast)) throw new Error(`REGISTRY_PARSE_ERROR: ${customRegistryPath}`);
  const array = variableNamed(ts, ast, 'customMakers')?.initializer;
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error(`REGISTRY_UNSUPPORTED_SHAPE: ${customRegistryPath}:customMakers`);
  const registered = new Set(array.elements.filter(ts.isIdentifier).map(element => element.text));
  return namedImports(ts, ast)
    .filter(item => registered.has(item.local))
    .map(item => localModule.exec(item.from)?.[1] ?? '')
    .filter(Boolean)
    .sort();
}
