import { brainstormContext, brainstormFeaturePlan } from '../../adapters/brainstorm.ts';
import { slug } from '../../domain/errors.ts';
import type { BrainstormPage, FeatureBrainstorm } from '../../domain/brainstorm.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { approveCapturedRequest, navigation, optionalImport, optionalVerification, pages, type BrainstormWizardOptions } from '../brainstorm-steps.ts';
import { review } from '../review.ts';
import type { WizardOptions } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
type Context = Awaited<ReturnType<typeof brainstormContext>>;
const draftOf = (state: FormValues) => state.draft as Omit<FeatureBrainstorm, 'schemaVersion' | 'projectId' | 'baseSha256'>;
const requestOf = (state: FormValues) => state.request as FeatureBrainstorm;
/** The command context passes through unchanged (plugins, input and progress included). */
function brainstormOptions(options: WizardOptions): BrainstormWizardOptions {
  return { ...options, project: String(options.project ?? 'design/project.json'), offerImport: options.offerImport === true };
}
/** Actions behind configs/wizards/brainstorm.json: screen/interaction editors and the separately reviewed follow-ups. */
export const brainstormModule: WizardModule = {
  actions: {
    'brainstorm.context': async ({ state, options }) => {
      state.context = await brainstormContext(brainstormOptions(options));
      state.draft = { name: '', purpose: '', actors: [], entities: [], pages: [], acceptance: [], output: 'definition', verification: 'none' };
    },
    'brainstorm.screens': async ({ ui, state }) => { draftOf(state).pages = await pages(ui, draftOf(state).pages as BrainstormPage[]); },
    'brainstorm.interactions': async ({ ui, state }) => { draftOf(state).pages = await navigation(ui, draftOf(state).pages as BrainstormPage[]); },
    /** Declining the reviewed request cancels the brainstorm; nothing has been written yet. */
    'brainstorm.approve': async ({ ui, state }) => {
      const draft = draftOf(state), context = state.context as Context;
      const value: FeatureBrainstorm = { schemaVersion: 1, name: draft.name, purpose: draft.purpose, actors: draft.actors,
        entities: draft.entities, pages: draft.pages, acceptance: draft.acceptance, output: draft.output,
        verification: draft.output === 'definition' ? 'none' : draft.verification, projectId: context.project.id, baseSha256: context.baseSha256 };
      state.request = value;
      await approveCapturedRequest(ui, value);
    },
    'brainstorm.plan': async ({ ui, state, options }) => {
      const definition = requestOf(state), out = (options.out as string | undefined) ?? 'brainstorms/' + slug(definition.name, 'feature');
      ui.rich?.busy('Validating the feature against the saved project and preparing files. No writes or processes yet.');
      const plan = await brainstormFeaturePlan(definition, { ...brainstormOptions(options), out });
      if (!await review(ui, plan, options.signal)) return { end: true };
      Object.assign(state, { out, conceptPath: String(plan.data.conceptPath) });
    },
    'brainstorm.import': async ({ ui, state, options }) => { state.imported = await optionalImport(ui, brainstormOptions(options), String(state.conceptPath)); },
    'brainstorm.verify': ({ ui, state, options }) => optionalVerification(ui, brainstormOptions(options), String(state.out), requestOf(state).verification),
    'brainstorm.complete': ({ ui, state }) => {
      const completion = 'Brainstorm saved to ' + String(state.out) + '. Concept: ' + String(state.conceptPath) + '. ' +
        (state.imported ? 'The feature is imported in the canonical project. ' :
          'The canonical project was not changed; import remains a separate reviewed action. ') +
        (requestOf(state).output === 'definition' ? 'No source was generated.' : 'Generated source is under ' + String(state.out) + '/source/.');
      ui.write(completion + '\n');
      return { end: true, completion: completion + '\n' };
    },
  },
};
