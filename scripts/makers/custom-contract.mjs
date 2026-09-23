import { slug, builtinRecipes } from './arguments.mjs';

/** @typedef {{ readonly name: string, readonly owner: string }} MakerRequest */
/**
 * @typedef {object} MakerContext
 * @property {(path: string) => Promise<string>} read Read-only, hash-bound source input.
 * @property {(path: string, content: string) => Promise<void>} add Declare a file; never write directly.
 * @property {(path: string, name: string, expression: string, imports?: {local: string, from: string, defaultImport?: boolean}[]) => Promise<void>} editArray
 * @property {Set<string>} tests Generated test paths for the runner's targeted checks.
 */
/**
 * @param {{ readonly name: string, readonly version: number, readonly description: string,
 * readonly plan: (context: MakerContext, request: MakerRequest) => Promise<void> }} recipe
 */
export function defineLocalMaker(recipe) {
  slug(recipe?.name, 'custom recipe name');
  if (builtinRecipes.includes(recipe.name)) throw new Error('CUSTOM_RECIPE_BUILTIN_CONFLICT');
  if (recipe.version !== 1 || typeof recipe.description !== 'string' || !recipe.description.trim() || recipe.description.length > 200 || typeof recipe.plan !== 'function') throw new Error('CUSTOM_RECIPE_INVALID');
  return Object.freeze({ name: recipe.name, version: recipe.version, description: recipe.description, plan: recipe.plan });
}
