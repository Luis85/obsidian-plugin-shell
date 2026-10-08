import { SketchError } from '#shared/contracts/sketch-errors.ts';
import type { FormChoice } from '../../domain/form.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { readCandidateInput, readCandidateVersion } from '../../domain/release-candidate.ts';
import { candidateWorld, openCandidates } from '../../adapters/release-candidate-store.ts';
import { candidateCreatePlan, type CandidatePlan } from '../../adapters/release-candidate-plan.ts';
import { review } from '../review.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
const flagOf = (options: ActionContext['options'], name: string) => {
  const value = (options.flags as FormValues | undefined)?.[name];
  return typeof value === 'string' && value ? value : undefined;
};
/** Ready release items that no candidate holds, as `{ id, label }` choices stored in the wizard state. */
function readyChoices(state: FormValues): FormChoice[] {
  return Array.isArray(state.ready) ? state.ready.filter((item): item is FormChoice => typeof item === 'object' && item !== null && 'id' in item && 'label' in item) : [];
}
/** Shows the README bytes and every release item the plan moves, then the default-No review of the whole plan. */
async function reviewCandidate(context: ActionContext, plan: CandidatePlan): Promise<boolean> {
  const content = String(plan.data.content), path = String(plan.data.path);
  const moved = plan.moved.map(item => `${item.id} → ${item.status} (${item.path})`);
  const summary = moved.length ? moved.join('\n') : 'No release item notes change.';
  if (context.ui.rich) await context.ui.rich.review('Release candidate', [{ title: path, body: content }, { title: 'Release items', body: summary }]);
  else context.ui.write(`\n${path}:\n${content}\nIncrements:\n${summary}\n`);
  return review(context.ui, plan, context.options.signal);
}
/** The candidate-new wizard (configs/wizards/candidate-new.json): one reviewed plan writes the README and moves the chosen release items. */
export const candidateModule: WizardModule = {
  hooks: { choices: { 'candidate.items': data => readyChoices(data as FormValues) } },
  actions: {
    'candidate.load': async ({ state, options }) => {
      const candidates = await openCandidates(options.root, flagOf(options, 'as-of')), world = await candidateWorld(candidates);
      const ready = world.items.filter(item => item.valid && item.status === 'ready' && item.values.candidate === undefined)
        .map(item => ({ id: item.id, label: `${item.id} — ${item.title} (${String(item.values.kind ?? '')})` }));
      const flag = flagOf(options, 'version'), version = flag === undefined ? undefined : readCandidateVersion(flag);
      Object.assign(state, { folder: candidates.folder, itemsFolder: candidates.increments.folder, asOf: candidates.asOf, ready,
        draft: { ...(version ? { version, versionFlag: true } : {}), offer: ready.length > 0, items: [] } });
    },
    'candidate.plan-new': async context => {
      const { state, options } = context, candidates = await openCandidates(options.root, String(state.asOf));
      const draft = state.draft as FormValues, answers = Object.entries(draft).filter(([key, value]) => !['offer', 'versionFlag', 'pick'].includes(key) && value !== '');
      const input = readCandidateInput({ ...Object.fromEntries(answers), items: draft.pick === true ? draft.items : [] }, candidates.increments.loaded.definition.idPrefix);
      const plan = await candidateCreatePlan(candidates, { ...input, version: readCandidateVersion(input.version) }).catch((error: unknown) => {
        // A taken --version is asked again on the retry instead of being skipped.
        if (error instanceof SketchError && error.code === 'CANDIDATE_EXISTS') delete (state.draft as FormValues).versionFlag;
        throw error;
      });
      if (!await reviewCandidate(context, plan)) return { end: true, completion: 'Nothing was written.\n' };
      state.created = { version: plan.data.version, path: plan.data.path };
    },
  },
};
