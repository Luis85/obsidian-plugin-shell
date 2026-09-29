import { loadSettings } from '../adapters/user-settings.ts';
import { intakePrds } from '../adapters/prd-intake.ts';
import { angularSetupGuide, projectSetupPlan, setupPrerequisites } from '../adapters/project-setup.ts';
import { openDocument } from '../domain/document.ts';
import { Workspace } from '../application/workspace.ts';
import { settingsForm } from './settings.ts';
import { editBricks } from './brick-editor.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { input, titleInput, choose, confirm, type Prompts } from './prompts.ts';
export async function projectSetupWizard(ui: Prompts, context: { root: string; frameworkRoot: string; signal?: AbortSignal }): Promise<string | undefined> {
  await setupPrerequisites(context.root);
  ui.write('Angular project setup. Git and the Obsidian vault are preserved. No files are written before the final review.\n');
  const loaded = await loadSettings(context.root);
  const settings = await settingsForm(ui, loaded.settings);
  const project = { name: await titleInput(ui, 'Project name', '', 80), description: await input(ui, 'Describe your project'), product: await input(ui, 'Describe the product and desired outcome') };
  const mode = await choose(ui, 'PRD intake', [{ id: 'scan', label: 'Scan ' + settings.paths.prds }, { id: 'add', label: 'Add existing typed Markdown files from this vault' }], 'scan');
  const prds = mode === 'scan' ? { mode } : { mode, files: (await input(ui, 'Vault-relative Markdown paths, separated by semicolons')).split(';').map(value => value.trim()).filter(Boolean) };
  const intake = await intakePrds(context.root, settings, prds);
  ui.write(`Found ${intake.prds.length} PRDs; ignored ${intake.ignored.length} non-PRD Markdown files. Requirements remain unmapped.\n`);
  const { guide } = await angularSetupGuide();
  const prototypeInterview = await confirm(ui, 'Prepare a prototype?') ? {
    schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
    answers: await interview(ui, guide, { title: project.name, problem: project.product, pages: ['Hello world'] }),
  } : null;
  const request = { schemaVersion: 1, settings, project, prds, prototypeInterview, operations: [] as Record<string, unknown>[], boilerplate: false };
  if (await confirm(ui, 'Add application bricks?')) {
    const preview = await projectSetupPlan(context, request);
    const workspace = new Workspace(openDocument(preview.data.document), null);
    request.operations = await editBricks(ui, workspace);
  }
  request.boilerplate = await confirm(ui, 'Create the Angular application boilerplate?');
  ui.rich?.busy('Preparing the complete setup plan. No files written yet.');
  const plan = await projectSetupPlan(context, request);
  if (!await review(ui, plan, context.signal)) return;
  const completion = request.boilerplate
    ? `Project prepared. In ${settings.paths.app}, run npm install, npm run typecheck, npm test, then npm start. Continue editing with shell.mjs sketch.\n`
    : 'Project specifications saved. Continue with shell.mjs sketch; generate the application with shell.mjs sketch generate.\n';
  ui.write(completion); return completion;
}
