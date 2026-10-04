import { guideInput } from '../../adapters/prototype.ts';
import { loadSettings } from '../../adapters/user-settings.ts';
import { intakePrds } from '../../adapters/prd-intake.ts';
import { angularSetupGuide, projectSetupPlan, setupPrerequisites } from '../../adapters/project-setup.ts';
import { openDocument } from '../../domain/document.ts';
import type { Guide } from '../../domain/guide.ts';
import type { Values } from '../../domain/form-model.ts';
import type { SetupDraft } from '../../domain/setup-checkpoint.ts';
import type { UserSettings } from '../../domain/user-settings.ts';
import { Workspace } from '../../application/workspace.ts';
import { beginSetupDraft, pauseSetup } from '../setup-progress.ts';
import { editBricks } from '../brick-editor.ts';
import { review } from '../review.ts';
import type { WizardModule } from './module.ts';
type Request = SetupDraft & { settings: UserSettings; project: NonNullable<SetupDraft['project']>; prds: Record<string, unknown>; prototypeInterview: Values | null; boilerplate: boolean };
const draftOf = (state: Values) => state.draft as SetupDraft;
const requestOf = (state: Values) => state.request as Request;
/** Actions behind configs/wizards/project-setup.json. Every stage may checkpoint; nothing is written before review. */
export const projectSetupModule: WizardModule = {
  hooks: { commit: { 'prd-intake.read': value => value.mode === 'add' ? { mode: 'add', files: value.files ?? [] } : { mode: value.mode } } },
  actions: {
    'setup.begin': async ({ ui, state, options }) => {
      const draft = await beginSetupDraft(ui, options.root);
      if (!draft) return { end: true };
      state.draft = draft;
    },
    'setup.load-settings': async ({ state, options }) => { if (!draftOf(state).settings) state.loadedSettings = (await loadSettings(options.root)).settings; },
    'setup.prerequisites': async ({ state, options }) => { await setupPrerequisites(options.root, draftOf(state).settings!.preferences.vaultConfigDirectory); },
    /** Before the request exists the draft is saved; afterwards the complete request (operations and prototype included). */
    'setup.pause': async ({ ui, state, options }) => {
      if (await pauseSetup(ui, options.root, (state.request ?? state.draft) as SetupDraft, options.signal)) return { end: true };
    },
    'setup.intake': async ({ ui, state, options }) => {
      const draft = draftOf(state), intake = await intakePrds(options.root, draft.settings!, draft.prds);
      ui.write(`Found ${intake.prds.length} PRDs; ignored ${intake.ignored.length} non-PRD Markdown files. Requirements remain unmapped.\n`);
    },
    'setup.prototype-context': async ({ state, options }) => {
      const draft = draftOf(state), { guide } = await angularSetupGuide(options.frameworkRoot);
      state.guide = guide;
      state.guideInitial = draft.prototypeInterview ? guideInput(guide, draft.prototypeInterview).answers
        : { title: draft.project!.name, problem: draft.project!.product, pages: ['Hello world'] };
      if (draft.prototypeInterview !== undefined) state.wantsPrototype = draft.prototypeInterview !== null;
    },
    'setup.request': ({ state }) => {
      const draft = draftOf(state), guide = state.guide as Guide;
      const prototypeInterview = state.wantsPrototype === true ? { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.prototypeAnswers } : null;
      state.request = { schemaVersion: 1, settings: draft.settings, project: draft.project, prds: draft.prds, prototypeInterview, operations: draft.operations, boilerplate: false };
    },
    'setup.bricks': async ({ ui, state, options }) => {
      const request = requestOf(state), preview = await projectSetupPlan(options, request);
      const workspace = new Workspace(openDocument(preview.data.document), null);
      request.operations = [...draftOf(state).operations, ...await editBricks(ui, workspace)];
    },
    'setup.review': async ({ ui, state, options }) => {
      ui.rich?.busy('Preparing the complete setup plan. No application files written yet.');
      const plan = await projectSetupPlan(options, requestOf(state));
      if (!await review(ui, plan, options.signal)) return { end: true };
    },
    'setup.finish': async ({ ui, state, run }) => {
      const request = requestOf(state);
      const completion = request.boilerplate
        ? `Project prepared in ${request.settings.paths.app}. Continue editing with node bin/app sketch; first run has a separate execution review.\n`
        : 'Project specifications saved. Continue with node bin/app sketch; generate the application with node bin/app sketch generate.\n';
      ui.write(completion);
      return { end: true, completion: request.boilerplate ? await run('first-run') ?? completion : completion };
    },
  },
};
