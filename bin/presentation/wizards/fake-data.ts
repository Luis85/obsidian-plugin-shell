import { requireSketch } from '../../domain/errors.ts';
import type { FormChoice } from '../../domain/form.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { fakeId, readFakeEntity, readFakeProperty, type FakeEntity, type FakeProperty } from '../../domain/fake-data-entity.ts';
import { generatorsFor, type FakePropertyType } from '../../domain/fake-data-generators.ts';
import { defaultReferenceDate, readFakeGeneration } from '../../domain/fake-data-config.ts';
import { fakeEntityList, loadFakeCatalog, resolveFakeEntity, type FakeEntitySummary } from '../../adapters/fake-data-catalog.ts';
import { fakeDataPlan, saveEntityPlan, saveGenerationPlan } from '../../adapters/fake-data-plan.ts';
import { defaultOut, fakeDefaults } from '../../adapters/fake-data-command.ts';
import { formDefinition, runForm } from '../form-runner.ts';
import { Back, confirm, reportError } from '../prompts.ts';
import { review } from '../review.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
type Config = ReturnType<typeof readFakeGeneration>;
const run = (state: FormValues) => state.run as FormValues;
const whole = (value: unknown, fallback: number) => typeof value === 'string' && /^\d{1,10}$/.test(value) ? Number(value) : fallback;
/** The entity of this run: an unsaved definition from this session, or a catalog/semantic/file reference. */
async function entityOf({ state, options }: ActionContext): Promise<FakeEntity> {
  if (state.start === 'define' && state.entitySaved === false) return state.custom as FakeEntity;
  return resolveFakeEntity(options.root, String(run(state).entity), await loadFakeCatalog(options.root), options.project as string | undefined);
}
function choicesFor(type: FakePropertyType): FormChoice[] {
  const fixed = type === 'checkbox' ? [] : [{ id: 'choices', label: 'Pick from values I list' }];
  const sequence = type === 'text' || type === 'link' ? [{ id: 'sequence', label: 'Numbered sequence (KEY-0001, KEY-0002, …)' }] : [];
  return [...fixed, ...sequence, ...generatorsFor(type)];
}
/** Answers of the fake-data-property form, normalized and validated as one property definition. */
function propertyOf(value: FormValues): FakeProperty {
  const type = String(value.type), generator = String(value.generator), key = String(value.key);
  const items = Array.isArray(value.choices) ? value.choices.map(String) : [];
  const choices = items.map(item => type === 'number' ? Number(item) : type === 'checkbox' ? item === 'true' : item);
  return readFakeProperty({ key, type, required: value.required !== false, unique: value.unique === true && !['checkbox', 'list', 'tags'].includes(type),
    generator: generator === 'choices' ? { choices } : generator === 'sequence' ? { sequence: key.slice(0, 20).toUpperCase() + '-' } : { faker: generator } }, key);
}
/** A required text property names each note, so the list is only complete once it has one. */
const names = (property: FakeProperty) => property.type === 'text' && property.required;
/** Ask the property form until the author stops; Back finishes the list, or returns to the entity form while it is empty. */
async function askProperties(context: ActionContext): Promise<void> {
  const properties: FakeProperty[] = [], ui = context.ui;
  context.state.properties = properties;
  while (properties.length < 40) {
    const value: FormValues = {}, env = { ...context.env, data: { ...context.state, property: value } };
    let back = false;
    try {
      const property = await runForm(ui, formDefinition(env, 'fake-data-property'), value, env) as FakeProperty;
      requireSketch(properties.every(item => item.key.toLowerCase() !== property.key.toLowerCase()), 'FAKE_DATA_KEY', `${property.key} is already a property of this entity.`);
      properties.push(property);
    } catch (error) {
      if (!(error instanceof Back)) { reportError(ui, error); continue; }
      if (!properties.length) throw error;
      back = true;
    }
    if (!properties.some(names)) { ui.write('Add a required text property; its value names each note.\n'); continue; }
    if (back || !await confirm(ui, `Add another property? (${properties.length} so far)`)) return;
  }
}
async function saveEntity(context: ActionContext): Promise<void> {
  const { state, ui, options } = context, draft = state.draft as FormValues, catalog = await loadFakeCatalog(options.root);
  const title = String(draft.title), properties = state.properties as FakeProperty[];
  const entity = readFakeEntity({ schemaVersion: 1, id: fakeId(title, [...catalog.entities.keys()]), title, folder: title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Fake Data',
    titleProperty: draft.titleProperty, properties, ...(draft.description ? { description: draft.description } : {}) });
  state.custom = entity;
  state.entitySaved = await review(ui, await saveEntityPlan(options.root, entity, catalog), options.signal);
  if (!state.entitySaved) ui.write('Entity not saved; it is used for this run only and cannot back a saved generation config.\n');
  run(state).entity = entity.id;
}
/** Actions and hooks behind configs/wizards/fake-data.json. Every write is a reviewed, default-No file plan. */
export const fakeDataModule: WizardModule = {
  hooks: {
    choices: {
      'fake-data.starts': data => [{ id: 'entity', label: 'Generate notes from an existing entity' }, { id: 'define', label: 'Define a new entity, save it, then generate' },
        ...(((data as FormValues).configs as Config[]).length ? [{ id: 'config', label: 'Run a saved generation config' }] : [])],
      'fake-data.entities': data => ((data as FormValues).entities as FakeEntitySummary[]).map(item => ({ id: item.ref, label: `${item.title} (${item.source}) — ${item.ref}` })),
      'fake-data.configs': data => ((data as FormValues).configs as Config[]).map(item => ({ id: item.id, label: `${item.title} — ${item.count} × ${item.entity} → ${item.out}` })),
      'fake-data.generators': data => choicesFor(String(((data as FormValues).property as FormValues).type) as FakePropertyType),
      'fake-data.title-properties': data => ((data as FormValues).properties as FakeProperty[]).filter(names).map(item => ({ id: item.key, label: item.key })),
    },
    commit: { 'fake-data.property': value => propertyOf(value) },
  },
  actions: {
    'fake-data.load': async ({ state, options }) => {
      const catalog = await loadFakeCatalog(options.root), flags = (options.flags ?? {}) as FormValues;
      const entities = await fakeEntityList(options.root, catalog, options.project as string | undefined);
      Object.assign(state, { entities, configs: [...catalog.generations.values()].map(item => item.definition), referenceDate: defaultReferenceDate,
        start: flags.config ? 'config' : 'entity', configId: typeof flags.config === 'string' ? flags.config : undefined,
        run: { entity: typeof flags.entity === 'string' ? flags.entity : entities[0]?.ref, count: whole(flags.count, fakeDefaults.count),
          seed: whole(flags.seed, fakeDefaults.seed), base: flags.base === true, out: options.out ?? '' } });
    },
    'fake-data.use-config': ({ state }) => {
      const config = (state.configs as Config[]).find(item => item.id === state.configId);
      requireSketch(config, 'FAKE_DATA_CONFIG_UNKNOWN', `Unknown generation config ${String(state.configId)}.`);
      Object.assign(state, { run: { entity: config.entity, count: config.count, seed: config.seed, base: config.base, out: config.out },
        referenceDate: config.referenceDate, saveDefaults: { id: config.id, title: config.title } });
    },
    'fake-data.properties': askProperties,
    'fake-data.save-entity': saveEntity,
    /** Revisiting the start may change the entity: refresh defaults the person has not changed. */
    'fake-data.prepare': async context => {
      const { state } = context;
      if (state.start !== 'define') delete state.entitySaved;
      const entity = await entityOf(context), current = run(state), out = defaultOut(entity);
      if (!current.out || current.out === state.defaultOut) current.out = out;
      state.defaultOut = out;
      if (state.start !== 'config') state.saveDefaults = { id: `${entity.id}-demo`, title: `${entity.title} demo` };
    },
    'fake-data.review': async context => {
      const { ui, state, options } = context, entity = await entityOf(context), current = run(state);
      ui.rich?.busy('Generating notes. No files written yet.');
      const plan = await fakeDataPlan(options.root, options.frameworkRoot, { ref: String(current.entity), entity, count: Number(current.count), seed: Number(current.seed),
        out: String(current.out), base: current.base === true, referenceDate: String(state.referenceDate) });
      const sample = plan.data.sample as { path: string; content: string };
      if (ui.rich) await ui.rich.review('Sample note', [{ title: sample.path, body: sample.content }]);
      else ui.write(`\nSample note ${sample.path}:\n${sample.content}\n`);
      if (!await review(ui, plan, options.signal)) return { end: true, completion: 'No notes written.\n' };
    },
    'fake-data.save-config': async ({ ui, state, options }) => {
      const save = state.save as FormValues, current = run(state), catalog = await loadFakeCatalog(options.root);
      const generation = readFakeGeneration({ schemaVersion: 1, id: save.id, title: save.title, entity: current.entity, count: current.count, out: current.out,
        seed: current.seed, base: current.base === true, referenceDate: state.referenceDate });
      if (!await review(ui, await saveGenerationPlan(options.root, generation, catalog), options.signal)) ui.write('Generation config not saved.\n');
    },
  },
};
