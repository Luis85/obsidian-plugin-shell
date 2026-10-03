import { slug, builtinRecipes } from './arguments.ts';
import { action, type ActionRequest } from './primitives.ts';
import type { RecipeContext } from './contracts.ts';

interface MakerRequest { readonly name: string; readonly owner: string | undefined }
/** The runner injects everything a local recipe may use: declared outputs plus the shared primitives, never direct writes or imports. */
export interface LocalRecipeContext extends RecipeContext {
  action(request: ActionRequest): Promise<void>;
}
/** A local recipe receives read-only, hash-bound source input plus declared outputs; it never writes directly. */
interface LocalMaker {
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly plan: (context: LocalRecipeContext, request: MakerRequest) => Promise<void>;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
function validDescription(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= 200;
}
function optionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
/** Recipe code is trusted but untyped: the injected primitive revalidates its request before composing anything. */
function actionRequest(request: unknown): ActionRequest {
  const candidate = isRecord(request) ? request : {};
  const { kind, preference, event } = candidate;
  if (typeof kind !== 'string' || !optionalText(preference) || !optionalText(event)) throw new Error('CUSTOM_ACTION_INVALID');
  const owner = slug(candidate.owner, 'action owner'), name = slug(candidate.name, 'action name');
  return { owner, name, kind, ...(preference === undefined ? {} : { preference }), ...(event === undefined ? {} : { event }) };
}
/** Builds the frozen context a local recipe receives: no root, edit or finish, and one bound primitive. */
export function localRecipeContext(context: RecipeContext): LocalRecipeContext {
  const outputs: RecipeContext = Object.freeze({ add: context.add, read: context.read, editArray: context.editArray, tests: context.tests });
  return Object.freeze({ ...outputs, action: async (request: ActionRequest) => { await action(outputs, actionRequest(request)); } });
}
/** Validates trusted local recipe metadata; the runner owns review, formatting, writes and checks. */
export function defineLocalMaker(recipe: unknown): LocalMaker {
  const candidate = isRecord(recipe) ? recipe : {};
  const name = slug(candidate.name, 'custom recipe name');
  if (builtinRecipes.includes(name)) throw new Error('CUSTOM_RECIPE_BUILTIN_CONFLICT');
  const { version, description, plan } = candidate;
  if (version !== 1 || !validDescription(description) || typeof plan !== 'function') throw new Error('CUSTOM_RECIPE_INVALID');
  return Object.freeze({ name, version, description, plan: (context: LocalRecipeContext, request: MakerRequest) => Promise.resolve(plan.call(recipe, context, request)).then(() => undefined) });
}
