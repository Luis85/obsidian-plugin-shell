import { checkedCatalog, type DefinitionCatalog, type HookNames } from '../../adapters/wizard-catalog.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { requireSketch } from '../../domain/errors.ts';
import { formDefinition, runForm, type FormHooks } from '../form-runner.ts';
import { runWizard, type WizardOptions, type WizardRegistry } from '../wizard-runner.ts';
import type { Prompts } from '../prompts.ts';
import type { WizardModule } from './module.ts';
import { builtinModule } from './builtin.ts';
import { settingsModule } from './settings.ts';
import { firstRunModule } from './first-run.ts';
import { projectSetupModule } from './project-setup.ts';
import { newProjectModule } from './new-project.ts';
import { prototypeModule } from './prototype.ts';
import { brainstormModule } from './brainstorm.ts';
import { frameworkSetupModule } from './framework-setup.ts';
import { fakeDataModule } from './fake-data.ts';
/**
 * The explicit list of code hooks the JSON definitions in configs/forms and configs/wizards may name.
 * A new guided process adds definitions there, and only adds a module here when it needs new actions.
 */
export const wizardModules: readonly WizardModule[] = [builtinModule, settingsModule, firstRunModule, projectSetupModule, newProjectModule, prototypeModule, brainstormModule, frameworkSetupModule, fakeDataModule];
function merge<T>(target: Record<string, T>, source: Record<string, T> | undefined, kind: string): void {
  for (const [name, value] of Object.entries(source ?? {})) {
    requireSketch(!Object.hasOwn(target, name), 'WIZARD_REGISTRY', `Duplicate ${kind} ${name}.`);
    target[name] = value;
  }
}
export function composeRegistry(modules: readonly WizardModule[]): WizardRegistry {
  const hooks: FormHooks = { choices: Object.create(null), effects: Object.create(null), prepare: Object.create(null), commit: Object.create(null) };
  const actions: WizardRegistry['actions'] = Object.create(null);
  for (const module of modules) {
    merge(actions, module.actions, 'action');
    for (const kind of ['choices', 'effects', 'prepare', 'commit'] as const) merge<unknown>(hooks[kind], module.hooks?.[kind], kind + ' hook');
  }
  return { actions, hooks };
}
export const wizardRegistry = composeRegistry(wizardModules);
export function hookNames(registry: WizardRegistry = wizardRegistry): HookNames {
  const names = (table: object) => new Set(Object.keys(table));
  return { actions: names(registry.actions), choices: names(registry.hooks.choices), effects: names(registry.hooks.effects),
    prepare: names(registry.hooks.prepare), commit: names(registry.hooks.commit) };
}
/** Definitions are read on each start, so an edited JSON file applies to the next run; a broken reference fails closed. */
export function wizardCatalog(root?: string): Promise<DefinitionCatalog> {
  return checkedCatalog(hookNames(), root);
}
export async function startWizard(ui: Prompts, id: string, options: WizardOptions, state?: FormValues): Promise<string | undefined> {
  return runWizard(ui, await wizardCatalog(), wizardRegistry, id, options, state);
}
/** Run a registered form against `value` (edited in place) and return its committed result. */
export async function startForm(ui: Prompts, id: string, value: FormValues, data?: unknown): Promise<unknown> {
  const env = { catalog: await wizardCatalog(), hooks: wizardRegistry.hooks, data };
  return runForm(ui, formDefinition(env, id), value, env);
}
