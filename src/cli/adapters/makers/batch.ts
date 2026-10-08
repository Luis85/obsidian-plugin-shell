import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { makerTarget, targetedMakerContext } from './target.ts';
import { builtinRecipes, parseArguments } from './arguments.ts';
import { createMakerContext } from './engine.ts';
import { dispatchMaker } from './dispatch.ts';
import { fullGate, ownerDirectoryExists, planChecks, resolveRequest, type MakerCheck } from './plan.ts';
import type { MakerArguments } from './contracts.ts';
import type { FilePlan } from '#shared/platform/file-plan.ts';

/** Step fields map one-to-one onto maker options; arrays join with commas. */
const valueFields: Readonly<Record<string, string>> = {
  source: '--source', feature: '--feature', entity: '--entity', folder: '--folder', preset: '--preset', backend: '--backend', event: '--event',
  view: '--view', preference: '--preference', extension: '--extension', format: '--format', extensions: '--extensions',
  editor: '--editor', fileType: '--file-type',
};
const flagFields: Readonly<Record<string, string>> = { document: '--document', bare: '--bare' };
/** Recipes that execute project code or replace whole projects are never batched. */
const excluded = new Set(['maker', 'plugin', 'locale']);
const maxSteps = 40;
interface BatchStep { readonly recipe: string; readonly name: string; readonly arguments: MakerArguments }
export interface PlannedBatch {
  readonly maker: 'batch'; readonly steps: readonly { readonly recipe: string; readonly name: string }[];
  readonly plan: FilePlan; readonly checks: readonly MakerCheck[]; readonly next: string;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function stepOption(where: string, key: string, value: unknown, args: string[]): void {
  if (Object.hasOwn(flagFields, key)) {
    if (typeof value !== 'boolean') throw new Error(`${where}.${key} must be true or false`);
    if (value) args.push(flagFields[key]!);
    return;
  }
  if (!Object.hasOwn(valueFields, key)) throw new Error(`${where}: unknown field ${key}; use ${['recipe', 'name', ...Object.keys(valueFields), ...Object.keys(flagFields)].join(', ')}`);
  const text = Array.isArray(value) && value.every(item => typeof item === 'string') ? value.join(',') : value;
  if (typeof text !== 'string' || !text) throw new Error(`${where}.${key} must be non-empty text`);
  args.push(valueFields[key]!, text);
}
function parseStep(value: unknown, index: number): BatchStep {
  const where = `steps[${index}]`;
  if (!record(value)) throw new Error(`${where} must be an object`);
  const { recipe, name, ...fields } = value;
  if (typeof recipe !== 'string' || !builtinRecipes.includes(recipe) || excluded.has(recipe))
    throw new Error(`${where}.recipe must be a built-in recipe other than ${[...excluded].join(', ')} (see make list)`);
  if (typeof name !== 'string') throw new Error(`${where}.name is required`);
  const args = [recipe, name];
  for (const [key, field] of Object.entries(fields)) stepOption(where, key, field, args);
  // The same parser as the command line; the recipe catalog then rejects options a recipe does not take.
  return { recipe, name, arguments: parseArguments(args) };
}
/** `{ "schemaVersion": 1, "steps": [{ "recipe": "feature", "name": "boards", "bare": true }, ...] }` */
function parseBatch(input: unknown): BatchStep[] {
  if (!record(input) || input.schemaVersion !== 1 || !Array.isArray(input.steps))
    throw new Error('Batch input must be { "schemaVersion": 1, "steps": [...] }');
  const keys = Object.keys(input).filter(key => !['schemaVersion', 'steps', 'description'].includes(key));
  if (keys.length) throw new Error(`Unknown batch field: ${keys.join(', ')}`);
  if (!input.steps.length || input.steps.length > maxSteps) throw new Error(`A batch has 1 to ${maxSteps} steps`);
  return input.steps.map(parseStep);
}
/** A feature step must create a new feature; a child step needs one from an earlier step or on disk. */
async function claimOwner(root: string, owners: Set<string>, maker: string, owner: string | undefined, source: string): Promise<void> {
  if (!owner) return;
  const key = `${source}/${owner}`;
  const exists = owners.has(key) || await ownerDirectoryExists(root, owner, source);
  if (maker !== 'feature') {
    if (!exists) throw new Error(`Feature ${owner} does not exist. Add a { "recipe": "feature", "name": "${owner}", "bare": true } step before it.`);
    return;
  }
  if (exists) throw new Error(`Feature ${owner} already exists. Use a child recipe to extend it.`);
  owners.add(key);
}
/**
 * Plan every step in one shared maker context: later steps see earlier outputs (a feature
 * created in step 1 owns the file extension of step 2), and the result is one reviewed file
 * plan with one targeted check run.
 */
export async function planMakerBatch(root: string, input: unknown, sourceName?: string): Promise<PlannedBatch> {
  const steps = parseBatch(input);
  const context = createMakerContext(root);
  const owners = new Set<string>();
  const checks = new Map<string, MakerCheck>();
  if (existsSync(resolve(root, 'workbench.sources.json'))) await context.read('workbench.sources.json');
  for (const [index, step] of steps.entries()) {
    try {
      const request = resolveRequest(step.arguments);
      const target = await makerTarget(root, 'plugin', request.options['--source'] ?? sourceName);
      await claimOwner(root, owners, request.maker, request.owner, target.path);
      const local = { ...targetedMakerContext(root, target, context), tests: new Set<string>() };
      await dispatchMaker(local, request);
      for (const check of await planChecks(root, 'batch', local.tests, target)) checks.set(JSON.stringify(check.args), check);
    } catch (error) {
      throw new Error(`steps[${index}] (${step.recipe} ${step.name}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const plan = await context.finish();
  return {
    maker: 'batch',
    steps: steps.map(({ recipe, name }) => ({ recipe, name })),
    plan,
    checks: [...checks.values()],
    next: await fullGate(root),
  };
}
