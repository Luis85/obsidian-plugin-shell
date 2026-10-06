import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import { readFakeEntity, type FakeEntity } from '../domain/fake-data-entity.ts';
import { defaultReferenceDate, fakeCount, fakeSeed, readEntityRef, readFakeGeneration, type FakeGeneration } from '../domain/fake-data-config.ts';
import { fakeEntityList, loadFakeCatalog, resolveFakeEntity, type FakeCatalog } from './fake-data-catalog.ts';
import { fakeDataPlan, saveEntityPlan, saveGenerationPlan, type FakeRun } from './fake-data-plan.ts';
import { applyPrepared } from './storage.ts';
import type { CommandContext } from './commands.ts';
/** Defaults shared by the command and the wizard: ten notes, seed 1, under "Fake Data/<entity folder>". */
export const fakeDefaults = Object.freeze({ count: 10, seed: 1 });
export const defaultOut = (entity: FakeEntity) => `Fake Data/${entity.folder}`;
function wholeNumber(args: Arguments, name: string): number | undefined {
  const raw = option(args, name);
  if (!raw) return undefined;
  requireSketch(/^\d{1,10}$/.test(raw), 'FAKE_DATA_OPTION', `--${name} needs a whole number.`);
  return Number(raw);
}
/** Exactly one of --entity and --generation; a named generation config must exist. */
function savedGeneration(args: Arguments, catalog: FakeCatalog): FakeGeneration | undefined {
  const configId = option(args, 'generation'), entityOption = option(args, 'entity');
  requireSketch(Boolean(configId) !== Boolean(entityOption), 'FAKE_DATA_COMMAND', 'Use --entity <id> or --generation <saved-config-id> (exactly one).');
  const saved = configId ? catalog.generations.get(configId)?.definition : undefined;
  requireSketch(!configId || saved, 'FAKE_DATA_CONFIG_UNKNOWN', `Unknown generation config ${configId}; list them with fake-data configs --json.`);
  return saved;
}
function runSize(args: Arguments, saved: FakeGeneration | undefined): Pick<FakeRun, 'count' | 'seed'> {
  const count = wholeNumber(args, 'count'), seed = wholeNumber(args, 'seed');
  return { count: fakeCount(count ?? saved?.count ?? fakeDefaults.count, '--count'), seed: fakeSeed(seed ?? saved?.seed ?? fakeDefaults.seed, '--seed') };
}
function runTarget(args: Arguments, saved: FakeGeneration | undefined, entity: FakeEntity): Pick<FakeRun, 'out' | 'base' | 'referenceDate'> {
  return { out: option(args, 'out') || saved?.out || defaultOut(entity), base: args.flags.base === true || saved?.base === true, referenceDate: saved?.referenceDate ?? defaultReferenceDate };
}
/** A saved config supplies every parameter; explicit --count, --out, --seed and --base override it for this run only. */
async function runOf(args: Arguments, context: CommandContext, catalog: FakeCatalog): Promise<FakeRun> {
  const saved = savedGeneration(args, catalog);
  const ref = saved?.entity ?? readEntityRef(option(args, 'entity'), '--entity');
  const entity = await resolveFakeEntity(context.root, ref, catalog, option(args, 'project') || undefined);
  return { ref, entity, ...runSize(args, saved), ...runTarget(args, saved, entity) };
}
function named<T>(table: ReadonlyMap<string, { definition: T; source: string }>, args: Arguments, kind: string): { definition: T; source: string } {
  const name = option(args, 'name'), entry = table.get(name);
  requireSketch(entry, 'FAKE_DATA_UNKNOWN', `Unknown ${kind} ${name || '(missing --name)'}.`);
  return entry;
}
function validation(read: () => unknown): Record<string, unknown> {
  try { return { valid: true, definition: read(), issues: [], status: 'ok' }; }
  catch (error) {
    if (!(error instanceof SketchError)) throw error;
    return { valid: false, issues: [{ code: error.code, message: error.message }], status: 'failed' };
  }
}
interface FakeDataRequest {
  args: Arguments; context: CommandContext; catalog: FakeCatalog; apply: string | undefined; project: string | undefined; input: () => Promise<unknown>;
}
type FakeDataAction = (request: FakeDataRequest) => Promise<Record<string, unknown>> | Record<string, unknown>;
const fakeDataActions: Readonly<Record<string, FakeDataAction>> = {
  entities: async ({ context, catalog, project }) => ({ entities: await fakeEntityList(context.root, catalog, project) }),
  show: async ({ args, context, catalog, project }) => {
    const ref = readEntityRef(option(args, 'name'), '--name'), entity = await resolveFakeEntity(context.root, ref, catalog, project);
    return { ref, source: catalog.entities.get(ref)?.source ?? ref.split(':')[0], entity };
  },
  validate: async ({ input }) => { const value = await input(); return validation(() => readFakeEntity(value)); },
  'save-entity': async ({ context, catalog, apply, input }) => applyPrepared(await saveEntityPlan(context.root, readFakeEntity(await input()), catalog), apply, context.signal),
  configs: ({ catalog }) => ({ configs: [...catalog.generations.values()].map(({ definition, source }) => ({ ...definition, source })) }),
  'show-config': ({ args, catalog }) => { const entry = named(catalog.generations, args, 'generation config'); return { config: entry.definition, source: entry.source }; },
  'save-config': async ({ context, catalog, apply, project, input }) => {
    const generation = readFakeGeneration(await input());
    await resolveFakeEntity(context.root, generation.entity, catalog, project);
    return applyPrepared(await saveGenerationPlan(context.root, generation, catalog), apply, context.signal);
  },
  '': async ({ args, context, catalog, apply }) => applyPrepared(await fakeDataPlan(context.root, context.frameworkRoot, await runOf(args, context, catalog)), apply, context.signal),
};
/**
 * `fake-data`: list and show entity presets and saved generation configs, validate or save definitions, and plan or
 * apply one seeded generation. Every write is one reviewed file plan applied only with its exact --apply <planHash>.
 */
export async function fakeDataCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  const catalog = await loadFakeCatalog(context.root), apply = option(args, 'apply') || undefined, project = option(args, 'project') || undefined;
  requireSketch(Object.hasOwn(fakeDataActions, args.action), 'FAKE_DATA_COMMAND', 'Use fake-data entities|show|validate|save-entity|configs|show-config|save-config, or fake-data --entity <id>|--generation <id> --json.');
  return fakeDataActions[args.action]!({ args, context, catalog, apply, project, input });
}
