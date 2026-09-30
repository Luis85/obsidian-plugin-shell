import { firstRunWizard } from './first-run.ts';
import { editBricks } from './brick-editor.ts';
import { savedProjectSelection } from '../adapters/project-selection.ts';
import { projectWizard } from './project-wizard.ts';
import { brainstormWizard } from './brainstorm.ts';
import { newDocument } from '../domain/document.ts';
import { Workspace } from '../application/workspace.ts';
import { outline } from '../application/summary.ts';
import { readSnapshot, savePlan } from '../adapters/storage.ts';
import { boilerplatePlan } from '../adapters/compiler.ts';
import { prototypePlan } from '../adapters/prototype.ts';
import { prototypeContext } from '../adapters/prototype-context.ts';
import { loadSettings } from '../adapters/user-settings.ts';
import { interview } from './guide.ts';
import { editPage } from './page-editor.ts';
import { review } from './review.ts';
import { workspaceContext } from './context.ts';
import { choose, input, titleInput, confirm, reportError, type Prompts } from './prompts.ts';
export interface StudioOptions { root: string; frameworkRoot: string; project: string; guide?: string; out?: string; kind?: string; signal?: AbortSignal }
async function savedWorkspace(options: StudioOptions): Promise<Workspace | undefined> {
  const snapshot = await readSnapshot(options.root, options.project);
  return snapshot.document ? new Workspace(snapshot.document, snapshot.beforeHash) : undefined;
}
export async function prototypeWizard(ui: Prompts, options: StudioOptions, workspace?: Workspace): Promise<string | undefined> {
  const { guide, selection } = await prototypeContext(options.root, options.guide);
  const configured = await loadSettings(options.root);
  workspace ??= await savedWorkspace(options);
  const answers = await interview(ui, guide, workspace ? { title: workspace.document.project.name, pages: outline(workspace.document).pages.map(item => item.title) } : {});
  const out = await input(ui, 'Package output folder', options.out ?? (configured.content ? configured.settings.paths.prototypes : 'prototypes/prepared-prototype'));
  ui.rich?.busy('Preparing prototype documents and source. No files written yet.');
  const plan = await prototypePlan({ ...options, out, guide, selection, baseline: workspace?.document ?? null,
    input: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers } });
  if (!await review(ui, plan, options.signal)) return;
  const completion = `Start with ${out}/execution-prompt.md. The complete source scaffold is under ${out}/source/.\n`;
  ui.write(completion); return completion;
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
  const title = await titleInput(ui, 'Component title');
  workspace.edit([id === 'new' ? { op: 'component.add', title } : { op: 'component.rename', id, title }]);
}
async function generate(ui: Prompts, options: StudioOptions, workspace: Workspace): Promise<void> {
  const out = await input(ui, 'Boilerplate output folder', options.out ?? `generated/${workspace.document.project.id}`);
  const selection = await savedProjectSelection(options.root);
  const kind = await choose(ui, 'Output kind', selection ? [{ id: 'project', label: selection.targets.join(' + ') + ' / ' + selection.framework }] : [
    { id: 'obsidian-plugin', label: 'Obsidian plugin' }, { id: 'clickdummy', label: 'Offline clickdummy source' },
  ], selection ? 'project' : options.kind ?? 'obsidian-plugin');
  ui.rich?.busy('Compiling boilerplate and inspecting conflicts. No files written yet.');
  const plan = await boilerplatePlan(options.root, options.frameworkRoot, out, workspace.document,
    kind === 'project' || kind === 'clickdummy' ? kind : 'obsidian-plugin', options.signal, selection);
  await review(ui, plan, options.signal);
}
interface StudioAction { label: string; run: () => unknown }
function studioActions(ui: Prompts, options: StudioOptions, workspace: Workspace): Record<string, StudioAction> {
  return {
    new: { label: 'Sketch a new page', run: async () => {
      const result = workspace.edit([{ op: 'page.add', title: await titleInput(ui, 'Page title') }]);
      await editPage(ui, workspace, result.created[0]!);
    } },
    page: { label: 'Continue an existing page', run: () => selectPage(ui, workspace) },
    bricks: { label: 'Edit sitemap, layout, entities, data sources and journeys', run: () => editBricks(ui, workspace) },
    library: { label: 'Create or rename components', run: () => library(ui, workspace) },
    brainstorm: { label: 'Brainstorm a new project or feature', run: async () => {
      if (workspace.dirty) {
        if (!await confirm(ui, 'Save current project before starting a feature brainstorm?')) return;
        await save(ui, options, workspace);
        if (workspace.dirty) { ui.write('Brainstorm requires the current project to be saved.\n'); return; }
      }
      await brainstormWizard(ui, { ...options, offerImport: true, out: undefined });
    } },
    prototype: { label: 'Prepare a prototype with the guided maker', run: () => prototypeWizard(ui, { ...options, out: undefined }, workspace) },
    save: { label: 'Save Companion project JSON', run: () => save(ui, options, workspace) },
    'first-run': { label: 'Install, build and showcase the generated application', run: () => firstRunWizard(ui, options) },
    generate: { label: 'Generate boilerplate from this sketch', run: () => generate(ui, options, workspace) },
    undo: { label: 'Undo last edit', run: () => workspace.undo() },
    redo: { label: 'Redo last edit', run: () => workspace.redo() },
    'new-project': { label: 'Create another project from a project starter', run: () => projectWizard(ui, options) },
  };
}
export async function studio(ui: Prompts, options: StudioOptions): Promise<Workspace> {
  const snapshot = await readSnapshot(options.root, options.project);
  const workspace = new Workspace(snapshot.document ?? newDocument(await titleInput(ui, 'Project title', '', 80)), snapshot.beforeHash);
  const actions = studioActions(ui, options, workspace);
  const choices = [...Object.entries(actions).map(([id, action]) => ({ id, label: action.label })), { id: 'exit', label: 'Exit' }];
  while (true) {
    showWorkspace(ui, workspace);
    try {
      const action = await choose(ui, 'What would you like to make?', choices);
      if (action === 'exit') {
        if (!workspace.dirty || await confirm(ui, 'Discard unsaved edits?')) return workspace;
      } else await actions[action]!.run();
    } catch (error) { reportError(ui, error); }
  }
}

function showWorkspace(ui: Prompts, workspace: Workspace): void {
  workspaceContext(ui, workspace);
  if (ui.rich) return;
  const summary = outline(workspace.document);
  ui.write(`\n${summary.project.name} · ${summary.pages.length} pages · ${summary.components.length} components${workspace.dirty ? ' · unsaved' : ''}\n`);
}
