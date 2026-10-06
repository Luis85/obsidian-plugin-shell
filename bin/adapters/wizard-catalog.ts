import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readForm, type FormDefinition, type FormField } from '../domain/form.ts';
import { readWizard, stepReferences, type WizardDefinition } from '../domain/wizard.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { readData } from './storage.ts';
/** Data-driven definitions live beside the other shipped configuration; the compiled kit rebases this URL. */
export const definitionsRoot = fileURLToPath(new URL('../../configs/', import.meta.url));
export interface DefinitionCatalog { root: string; forms: Map<string, FormDefinition>; wizards: Map<string, WizardDefinition> }
/** Names of the code hooks a registry provides; definitions may reference nothing else. */
export interface HookNames { actions: ReadonlySet<string>; choices: ReadonlySet<string>; effects: ReadonlySet<string>; prepare: ReadonlySet<string>; commit: ReadonlySet<string> }
async function definitionFiles(folder: string): Promise<string[]> {
  try { return (await readdir(folder)).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if ((error as { code?: string }).code === 'ENOENT') return []; throw error; }
}
/** Every `<id>.json` in one folder, validated by `read`; an invalid or misnamed file fails the whole folder. */
export async function readFolder<T extends { id: string }>(folder: string, read: (value: unknown) => T): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  for (const name of await definitionFiles(folder)) {
    let definition: T;
    try { definition = read(await readData(join(folder, name))); }
    catch (error) { throw new SketchError(error instanceof SketchError ? error.code : 'DEFINITION_INVALID', `${name}: ${error instanceof Error ? error.message : 'invalid definition'}`); }
    requireSketch(name === definition.id + '.json', 'DEFINITION_FILE', `${name} must be named ${definition.id}.json.`);
    result.set(definition.id, definition);
  }
  return result;
}
/** Read and structurally validate every form and wizard; a single invalid file fails the whole catalog. */
export async function loadCatalog(root = definitionsRoot): Promise<DefinitionCatalog> {
  return { root, forms: await readFolder(join(root, 'forms'), readForm), wizards: await readFolder(join(root, 'wizards'), readWizard) };
}
function fieldIssues(fields: readonly FormField[], catalog: DefinitionCatalog, hooks: HookNames, where: string, trail: string[]): string[] {
  return fields.flatMap(field => {
    const name = `${where}.${field.id}`, issues: string[] = [];
    const missing = (set: ReadonlySet<string>, value: string | undefined, label: string) => { if (value && !set.has(value)) issues.push(`${name}: unknown ${label} ${value}.`); };
    missing(hooks.choices, field.choicesFrom, 'choice provider'); missing(hooks.effects, field.effect, 'effect');
    missing(hooks.prepare, field.prepare, 'prepare hook'); missing(hooks.commit, field.commit, 'commit hook');
    if (field.fields) issues.push(...fieldIssues(field.fields, catalog, hooks, name, trail));
    if (field.form) issues.push(...formIssues(field.form, catalog, hooks, trail, name));
    return issues;
  });
}
function formIssues(id: string, catalog: DefinitionCatalog, hooks: HookNames, trail: string[], from: string): string[] {
  const form = catalog.forms.get(id);
  if (!form) return [`${from}: unknown form ${id}.`];
  if (trail.includes(id)) return [`${from}: form ${id} includes itself through ${[...trail, id].join(' → ')}.`];
  const commit = form.commit && !hooks.commit.has(form.commit) ? [`form ${id}: unknown commit hook ${form.commit}.`] : [];
  return [...commit, ...fieldIssues(form.fields, catalog, hooks, 'form ' + id, [...trail, id])];
}
/** Cross-reference check: every form, action and hook named by data exists, and section includes are acyclic. */
export function catalogIssues(catalog: DefinitionCatalog, hooks: HookNames): string[] {
  const issues = [...catalog.forms.keys()].flatMap(id => formIssues(id, catalog, hooks, [], 'form ' + id));
  for (const wizard of catalog.wizards.values()) for (const step of wizard.steps) {
    const where = `wizard ${wizard.id}.${step.id}`, references = stepReferences(step);
    issues.push(...references.forms.flatMap(id => catalog.forms.has(id) ? [] : [`${where}: unknown form ${id}.`]));
    issues.push(...references.actions.flatMap(id => hooks.actions.has(id) ? [] : [`${where}: unknown action ${id}.`]));
    issues.push(...fieldIssues(references.fields, catalog, hooks, where, []));
  }
  return [...new Set(issues)];
}
export async function checkedCatalog(hooks: HookNames, root = definitionsRoot): Promise<DefinitionCatalog> {
  const catalog = await loadCatalog(root), issues = catalogIssues(catalog, hooks);
  requireSketch(!issues.length, 'DEFINITION_REFERENCE', issues.join('\n'));
  return catalog;
}
export function catalogSummary(catalog: DefinitionCatalog) {
  return {
    root: catalog.root,
    wizards: [...catalog.wizards.values()].map(item => ({ id: item.id, version: item.version, title: item.title, description: item.description ?? '',
      steps: item.steps.map(step => ({ id: step.id, kind: step.kind, ...(step.form ? { form: step.form } : {}), ...(step.action ? { action: step.action } : {}) })) })),
    forms: [...catalog.forms.values()].map(item => ({ id: item.id, version: item.version, title: item.title, description: item.description ?? '', fields: item.fields.map(field => field.id) })),
  };
}
