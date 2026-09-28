import { resolve } from 'node:path';
import { newDocument } from '../domain/document.ts';
import { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import { readSnapshot, savePlan, applyPrepared, type Prepared } from '../adapters/storage.ts';
import { boilerplatePlan } from '../adapters/compiler.ts';
import { loadGuide, prototypePlan } from '../adapters/prototype.ts';
import { interview } from './guide.ts';
import { editPage } from './page-editor.ts';
import { choose, input, confirm, reportError, type Prompts } from './prompts.ts';
export interface StudioOptions { root: string; frameworkRoot: string; project: string; guide?: string; out?: string; kind?: string; signal?: AbortSignal }
async function review(ui: Prompts, value: Prepared, signal?: AbortSignal): Promise<boolean> {
  const changed = value.plan.changes.filter(item => item.status !== 'unchanged');
  ui.write(`\nReview ${changed.length} file changes\n` + changed.slice(0, 15).map(item => `  ${item.status} ${item.path}`).join('\n') + '\n');
  if (changed.length > 15) ui.write(`  … ${changed.length - 15} more files; use --json for the complete manifest.\n`);
  ui.write(`Plan hash: ${value.planHash}\n`);
  if (!await confirm(ui, 'Apply this reviewed plan?')) return false;
  await applyPrepared(value, value.planHash, signal); ui.write('Files saved. Dependencies and builds were not run.\n'); return true;
}
async function savedWorkspace(options: StudioOptions): Promise<Workspace | undefined> {
  const snapshot = await readSnapshot(options.root, options.project);
  return snapshot.document ? new Workspace(snapshot.document, snapshot.beforeHash) : undefined;
}
export async function prototypeWizard(ui: Prompts, options: StudioOptions, workspace?: Workspace): Promise<void> {
  const guide = await loadGuide(options.guide ? resolve(options.root, options.guide) : undefined);
  workspace ??= await savedWorkspace(options);
  const answers = await interview(ui, guide, workspace ? { title: workspace.document.project.name, pages: outline(workspace.document).pages.map(item => item.title) } : {});
  const out = await input(ui, 'Package output folder', options.out ?? 'prototypes/prepared-prototype');
  const plan = await prototypePlan({ ...options, out, guide, baseline: workspace?.document ?? null,
    input: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers } });
  if (await review(ui, plan, options.signal)) ui.write(`\nStart with ${out}/execution-prompt.md. The complete source scaffold is under ${out}/source/.\n`);
}
async function save(ui: Prompts, options: StudioOptions, workspace: Workspace): Promise<void> {
  const plan = await savePlan(options.root, options.project, workspace.document, workspace.beforeHash);
  if (await review(ui, plan, options.signal)) workspace.saved(plan.plan.changes.find(item => item.path === options.project)!.afterHash!);
}
async function selectPage(ui: Prompts, workspace: Workspace): Promise<void> {
  const pages = outline(workspace.document).pages;
  const id = await choose(ui, 'Select a page', [...pages.map(item => ({ id: item.id, label: item.title })), { id: 'back', label: 'Back' }]);
  if (id !== 'back') await editPage(ui, workspace, id);
}
async function library(ui: Prompts, workspace: Workspace): Promise<void> {
  const id = await choose(ui, 'Component library', [{ id: 'new', label: 'Create component' }, ...outline(workspace.document).components.map(item => ({ id: item.id, label: item.title })), { id: 'back', label: 'Back' }]);
  if (id === 'back') return;
  const title = await input(ui, 'Component title');
  workspace.edit([id === 'new' ? { op: 'component.add', title } : { op: 'component.rename', id, title }]);
}
async function generate(ui: Prompts, options: StudioOptions, workspace: Workspace): Promise<void> {
  const out = await input(ui, 'Boilerplate output folder', options.out ?? `generated/${workspace.document.project.id}`);
  const kind = await choose(ui, 'Output kind', [
    { id: 'obsidian-plugin', label: 'Obsidian plugin' }, { id: 'clickdummy', label: 'Offline clickdummy source' },
  ], options.kind ?? 'obsidian-plugin');
  const plan = await boilerplatePlan(options.root, options.frameworkRoot, out, workspace.document,
    kind === 'clickdummy' ? kind : 'obsidian-plugin', options.signal);
  await review(ui, plan, options.signal);
}
interface StudioAction { label: string; run: () => unknown }
function studioActions(ui: Prompts, options: StudioOptions, workspace: Workspace): Record<string, StudioAction> {
  return {
    new: { label: 'Sketch a new page', run: async () => {
      const result = workspace.edit([{ op: 'page.add', title: await input(ui, 'Page title') }]);
      await editPage(ui, workspace, result.created[0]!);
    } },
    page: { label: 'Continue an existing page', run: () => selectPage(ui, workspace) },
    library: { label: 'Create or rename components', run: () => library(ui, workspace) },
    prototype: { label: 'Prepare a prototype with the guided maker', run: () => prototypeWizard(ui, options, workspace) },
    save: { label: 'Save Companion project JSON', run: () => save(ui, options, workspace) },
    generate: { label: 'Generate boilerplate from this sketch', run: () => generate(ui, options, workspace) },
    undo: { label: 'Undo last edit', run: () => workspace.undo() },
    redo: { label: 'Redo last edit', run: () => workspace.redo() },
  };
}
export async function studio(ui: Prompts, options: StudioOptions): Promise<Workspace> {
  const snapshot = await readSnapshot(options.root, options.project);
  const workspace = new Workspace(snapshot.document ?? newDocument(await input(ui, 'Project title')), snapshot.beforeHash);
  const actions = studioActions(ui, options, workspace);
  const choices = [...Object.entries(actions).map(([id, action]) => ({ id, label: action.label })), { id: 'exit', label: 'Exit' }];
  while (true) {
    const summary = outline(workspace.document);
    ui.write(`\n${summary.project.name} · ${summary.pages.length} pages · ${summary.components.length} components${workspace.dirty ? ' · unsaved' : ''}\n`);
    try {
      const action = await choose(ui, 'What would you like to make?', choices);
      if (action === 'exit') {
        if (!workspace.dirty || await confirm(ui, 'Discard unsaved edits?')) return workspace;
      } else await actions[action]!.run();
    } catch (error) { reportError(ui, error); }
  }
}
