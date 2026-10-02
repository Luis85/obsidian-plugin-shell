import { beginSetupDraft, pauseSetup } from './setup-progress.ts';
import { guideInput } from '../adapters/prototype.ts';
import { firstRunWizard } from './first-run.ts';
import { loadSettings } from '../adapters/user-settings.ts';
import { intakePrds } from '../adapters/prd-intake.ts';
import { angularSetupGuide, projectSetupPlan, setupPrerequisites } from '../adapters/project-setup.ts';
import { openDocument } from '../domain/document.ts';
import type { SetupDraft } from '../domain/setup-checkpoint.ts';
import { Workspace } from '../application/workspace.ts';
import { settingsForm } from './settings.ts';
import { editBricks } from './brick-editor.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { input, titleInput, choose, confirm, type Prompts } from './prompts.ts';
interface SetupContext { root: string; frameworkRoot: string; signal?: AbortSignal }
async function projectContext(ui: Prompts, root: string, draft: SetupDraft) {
  const loaded = await loadSettings(root);
  const settings = draft.settings ?? await settingsForm(ui, loaded.settings);
  await setupPrerequisites(root, settings.preferences.vaultConfigDirectory);
  const project = draft.project ?? { name: await titleInput(ui, 'Project name', '', 80),
    description: await input(ui, 'Describe your project'), product: await input(ui, 'Describe the product and desired outcome') };
  Object.assign(draft, { settings, project });
  return { settings, project };
}
async function readPrds(ui: Prompts, root: string, draft: SetupDraft, settings: NonNullable<SetupDraft['settings']>) {
  const mode = draft.prds ? String(draft.prds.mode) : await choose(ui, 'PRD intake',
    [{ id: 'scan', label: 'Scan ' + settings.paths.prds }, { id: 'add', label: 'Add existing typed Markdown files from this vault' }], 'scan');
  const prds = draft.prds ?? (mode === 'scan' ? { mode } : { mode, files: (await input(ui,
    'Vault-relative Markdown paths, separated by semicolons')).split(';').map(value => value.trim()).filter(Boolean) });
  const intake = await intakePrds(root, settings, prds);
  ui.write(`Found ${intake.prds.length} PRDs; ignored ${intake.ignored.length} non-PRD Markdown files. Requirements remain unmapped.\n`);
  draft.prds = prds; return prds;
}
async function prototypeAnswers(ui: Prompts, frameworkRoot: string, draft: SetupDraft, project: NonNullable<SetupDraft['project']>) {
  const { guide } = await angularSetupGuide(frameworkRoot);
  const initial = draft.prototypeInterview ? guideInput(guide, draft.prototypeInterview).answers
    : { title: project.name, problem: project.product, pages: ['Hello world'] };
  const wantsPrototype = draft.prototypeInterview !== undefined ? draft.prototypeInterview !== null : await confirm(ui, 'Prepare a prototype?');
  return wantsPrototype ? { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: await interview(ui, guide, initial) } : null;
}
export async function projectSetupWizard(ui: Prompts, context: SetupContext): Promise<string | undefined> {
  const draft = await beginSetupDraft(ui, context.root);
  if (!draft) return;
  ui.write('Angular project setup. Git and the vault are preserved. Application files are written only after the final review. Checkpoint saves have a separate review.\n');
  const { settings, project } = await projectContext(ui, context.root, draft);
  if (await pauseSetup(ui, context.root, draft, context.signal)) return;
  const prds = await readPrds(ui, context.root, draft, settings);
  if (await pauseSetup(ui, context.root, draft, context.signal)) return;
  const prototypeInterview = await prototypeAnswers(ui, context.frameworkRoot, draft, project);
  const request = { schemaVersion: 1 as const, settings, project, prds, prototypeInterview, operations: draft.operations, boilerplate: false };
  if (await pauseSetup(ui, context.root, request, context.signal)) return;
  if (await confirm(ui, 'Add application bricks?')) {
    const preview = await projectSetupPlan(context, request);
    const workspace = new Workspace(openDocument(preview.data.document), null);
    request.operations = [...request.operations, ...await editBricks(ui, workspace)];
  }
  if (await pauseSetup(ui, context.root, request, context.signal)) return;
  request.boilerplate = await confirm(ui, 'Create the Angular application boilerplate?');
  ui.rich?.busy('Preparing the complete setup plan. No application files written yet.');
  const plan = await projectSetupPlan(context, request);
  if (!await review(ui, plan, context.signal)) return;
  return finish(ui, context, request.boilerplate, settings.paths.app);
}
async function finish(ui: Prompts, context: SetupContext, boilerplate: boolean, app: string): Promise<string> {
  const completion = boilerplate
    ? `Project prepared in ${app}. Continue editing with shell.mjs sketch; first run has a separate execution review.\n`
    : 'Project specifications saved. Continue with shell.mjs sketch; generate the application with shell.mjs sketch generate.\n';
  ui.write(completion);
  return boilerplate ? await firstRunWizard(ui, context) ?? completion : completion;
}
