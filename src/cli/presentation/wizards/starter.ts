import { resolve } from 'node:path';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import { validateNativeIntegrations } from '#shared/companion/native-contract.mjs';
import { readJson } from '../../adapters/framework/files.ts';
import { requireThat, type Request } from '../../adapters/framework/contracts.ts';
import { companionStarterSet, derivedName, invocationDirectory } from '../../adapters/framework/starter-project.ts';
import { loadDefinitions } from '../../adapters/starters/repository.ts';
import { record } from '../../adapters/starters/validation.ts';
import type { LoadedStarter, StarterDefinition } from '../../adapters/starters/types.ts';
import type { FormChoice } from '../../domain/form.ts';
import { getPath, type FormValues } from '../../domain/form-model.ts';
import { runForm } from '../form-runner.ts';
import type { WizardModule } from './module.ts';
import { starterInputForm } from './starter-inputs.ts';
import { prepareHosting } from './hosting.ts';
type Options = Request['options'];
/** The `new` request the interview starts from (`state.request`, never edited) and the one it returns (`state.result`). */
export interface StarterRequest { args: string[]; options: Options }
const isOptions = (value: unknown): value is Options => typeof value === 'object' && value !== null && !Array.isArray(value) &&
  Object.values(value).every(item => typeof item === 'string' || typeof item === 'boolean');
const isRequest = (value: unknown): value is StarterRequest => typeof value === 'object' && value !== null && 'args' in value && 'options' in value &&
  Array.isArray(value.args) && value.args.every(item => typeof item === 'string') && isOptions(value.options);
export function starterRequest(state: FormValues, key: 'request' | 'result' = 'request'): StarterRequest {
  const request = state[key];
  requireThat(isRequest(request), 'WIZARD_OPTIONS', 'The starter interview runs through node bin/app new <directory>.');
  return request;
}
const isChoice = (item: unknown): item is FormChoice => typeof item === 'object' && item !== null && 'id' in item && 'label' in item &&
  typeof item.id === 'string' && typeof item.label === 'string';
/** Loaded definitions stay out of the wizard state, so they are neither template data nor cloned by form steps. */
const loaded = new WeakMap<FormValues, LoadedStarter[]>();
function selected(state: FormValues): StarterDefinition {
  const entry = loaded.get(state)?.find(item => item.definition.id === state.starterId);
  requireThat(entry, 'STARTER_UNKNOWN', 'Starter is not installed.');
  return entry.definition;
}
async function suppliedValues(options: Options, root: string): Promise<FormValues> {
  requireThat(!(options.values && options.answers), 'STARTER_INPUT', 'Use either --values or --answers, not both.');
  if (options.values) return record(await readJson(resolve(root, String(options.values))));
  return options.answers ? record(parseJsonData(String(options.answers))) : {};
}
/** Supplied values first, then each input in definition order: an identity flag, else a new answer. */
function merged(definition: StarterDefinition, state: FormValues, answers: FormValues = {}): FormValues {
  const { options } = starterRequest(state), values = { ...record(state.supplied) };
  for (const { id } of definition.inputs) {
    if (options[id] !== undefined && ['id', 'name', 'author'].includes(id)) values[id] = options[id];
    else if (values[id] === undefined && Object.hasOwn(answers, id)) values[id] = answers[id];
  }
  return values;
}
const inputForm = (state: FormValues) => starterInputForm(selected(state), String(state.directory), merged(selected(state), state));
/** Template data whose suggestedName follows the live id answer, as the former interview did. */
const suggestion = (value: FormValues): FormValues => ({ get suggestedName() { return derivedName(String(value.id ?? 'my-project')); } });
const companionQuestions = { askAirship: false, askExtension: false, askExtensions: false };
type NativeIntegrations = ReturnType<typeof validateNativeIntegrations>;
interface NativeTargets { fileType?: NativeIntegrations['fileTypes'][number]; menu?: NativeIntegrations['contextMenus'][number] }
/** A companion's single file type and single context menu are the only native targets the interview offers. */
function nativeTargets(integrations: unknown): NativeTargets {
  if (integrations === undefined) return {};
  const native = validateNativeIntegrations(integrations);
  return { ...(native.fileTypes.length === 1 ? { fileType: native.fileTypes[0] } : {}), ...(native.contextMenus.length === 1 ? { menu: native.contextMenus[0] } : {}) };
}
function companionQuestionsFor(request: Options, { fileType, menu }: NativeTargets): FormValues {
  return { askAirship: request.airship === undefined && request['no-airship'] === undefined,
    askExtension: Boolean(fileType) && request.extension === undefined, askExtensions: Boolean(menu) && request.extensions === undefined,
    native: { extension: fileType?.extension ?? '', extensions: menu?.extensions.join(',') ?? '' } };
}
/** Actions behind configs/wizards/new-starter.json. Only missing answers are asked; the operation still validates everything. */
export const starterModule: WizardModule = {
  hooks: {
    choices: { 'starter.installed': data => { const starters = getPath(data, 'starters'); return Array.isArray(starters) ? starters.filter(isChoice) : []; } },
  },
  actions: {
    'starter.prepare': ({ state }) => {
      const { args, options } = starterRequest(state);
      Object.assign(state, { askTarget: !args[0], askStarter: typeof options.starter !== 'string' });
    },
    'starter.target': ({ state }) => {
      const { args, options } = starterRequest(state);
      if (state.askTarget === true) {
        const answer = typeof state.target === 'string' ? state.target.trim() : '';
        requireThat(answer, 'TARGET_REQUIRED', 'Supply the new project directory.');
      }
      state.directory = state.askTarget === true ? invocationDirectory(String(state.target).trim()) : args[0];
      if (typeof options.from !== 'string') return;
      state.result = { args: [String(state.directory), ...args.slice(1)], options: { ...options } };
      return { end: true };
    },
    'starter.load': async ({ state, options }) => {
      const definitions = await loadDefinitions(options.root);
      requireThat(definitions.length, 'STARTER_EMPTY', 'No starters installed. Extract the separate starters ZIP into configs/starters first.');
      loaded.set(state, definitions);
      Object.assign(state, { firstStarter: definitions[0]!.definition.id,
        starters: definitions.map(({ definition: d }) => ({ id: d.id, label: `${d.id} — ${d.summary}` })) });
    },
    /** A different starter forgets the previous starter's answers; --values/--answers are read after the choice. */
    'starter.select': async ({ state, options }) => {
      const request = starterRequest(state), id = state.askStarter === true ? state.starter : request.options.starter;
      if (state.starterId !== id) for (const key of ['inputs', 'airship', 'extension', 'extensions', 'hosting']) delete state[key];
      state.starterId = id;
      const definition = selected(state);
      Object.assign(state, { supplied: await suppliedValues(request.options, options.root), companion: definition.generator.kind === 'companion', ...companionQuestions });
      state.askInputs = inputForm(state).form !== undefined;
    },
    /** Revisiting keeps the previous answers as defaults; every answer still passes the starter's inputValue. */
    'starter.inputs': async ({ ui, state, env }) => {
      const plan = inputForm(state), value = state.inputs === undefined ? plan.value : record(state.inputs);
      requireThat(plan.form, 'STARTER_INPUT', 'Every starter input is already supplied.');
      state.inputs = value;
      await runForm(ui, plan.form, value, { ...env, data: suggestion(value) });
      state.answers = plan.decode(value);
    },
    'starter.companion': async ({ state, options }) => {
      const request = starterRequest(state).options, { starters } = await companionStarterSet(options);
      const document = starters.find(entry => entry.definition.id === state.starterId)?.document;
      Object.assign(state, companionQuestionsFor(request, nativeTargets(document?.design.nativeIntegrations)));
    },
    /** A new folder has no remote, so the hosting default is GitHub; an explicit --hosting is never asked again. */
    'starter.hosting': ({ state }) => { prepareHosting(state, starterRequest(state).options, null, true); },
    /** Answers stay data (`--answers` JSON); no editor or third-party process is launched by the interview. */
    'starter.finish': ({ state }) => {
      const { args, options } = starterRequest(state), result: Options = { ...options };
      if (state.askStarter === true) result.starter = String(state.starterId);
      delete result.values; result.answers = JSON.stringify(merged(selected(state), state, state.askInputs === true ? record(state.answers) : {}));
      if (state.askAirship === true && state.airship === true) result.airship = true;
      if (state.askExtension === true) result.extension = String(state.extension);
      if (state.askExtensions === true) result.extensions = String(state.extensions);
      state.result = { args: [String(state.directory), ...args.slice(1)], options: result };
    },
  },
};
