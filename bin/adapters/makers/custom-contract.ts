import { slug, builtinRecipes } from './arguments.ts';
import type { RecipeContext } from './contracts.ts';

interface MakerRequest { readonly name: string; readonly owner: string | undefined }
/** A local recipe receives read-only, hash-bound source input plus declared outputs; it never writes directly. */
interface LocalMaker {
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly plan: (context: RecipeContext, request: MakerRequest) => Promise<void>;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
function validDescription(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= 200;
}
/** Validates trusted local recipe metadata; the runner owns review, formatting, writes and checks. */
export function defineLocalMaker(recipe: unknown): LocalMaker {
  const candidate = isRecord(recipe) ? recipe : {};
  const name = slug(candidate.name, 'custom recipe name');
  if (builtinRecipes.includes(name)) throw new Error('CUSTOM_RECIPE_BUILTIN_CONFLICT');
  const { version, description, plan } = candidate;
  if (version !== 1 || !validDescription(description) || typeof plan !== 'function') throw new Error('CUSTOM_RECIPE_INVALID');
  return Object.freeze({ name, version, description, plan: (context: RecipeContext, request: MakerRequest) => Promise.resolve(plan.call(recipe, context, request)).then(() => undefined) });
}
