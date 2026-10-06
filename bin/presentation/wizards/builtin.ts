import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { prepared } from '../../adapters/storage.ts';
import { requireSketch } from '../../domain/errors.ts';
import { getPath, renderText, type FormValues } from '../../domain/form-model.ts';
import { review } from '../review.ts';
import { confirm } from '../prompts.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
/** `with` parameters are inert templates rendered against the wizard state and options. */
function parameter(context: ActionContext, key: string, fallback?: string): string {
  const raw = context.step.with?.[key] ?? fallback;
  requireSketch(raw !== undefined, 'WIZARD_ACTION', `${context.step.id} needs with.${key} for ${context.step.action}.`);
  return renderText(raw, { ...context.state, options: context.options });
}
const jsonOf = (context: ActionContext) => {
  const path = parameter(context, 'value', '');
  return JSON.stringify(path ? getPath(context.state, path) ?? null : context.state, null, 2);
};
/**
 * Generic actions any data-only wizard may use, so a new guided process needs no code:
 * review collected answers, ask for an explicit decision, and save JSON through a reviewed, default-No file plan.
 */
export const builtinModule: WizardModule = {
  actions: {
    'wizard.review': async context => {
      const title = parameter(context, 'title', 'Review your answers'), body = jsonOf(context);
      if (context.ui.rich) await context.ui.rich.review(title, [{ title: 'Answers', body }]);
      else context.ui.write(`\n${title}\n${body}\n`);
    },
    /** Ends the wizard unless the person explicitly agrees; the answer is never assumed. */
    'wizard.agree': async context => {
      if (!await confirm(context.ui, parameter(context, 'label', 'Continue?'))) return { end: true };
    },
    'wizard.save-json': async context => {
      const file = parameter(context, 'file');
      requireSketch(file.endsWith('.json'), 'WIZARD_SAVE', 'wizard.save-json writes a project-relative .json file.');
      const plan = prepared(await createFilePlan(context.options.root, [{ path: file, content: jsonOf(context) + '\n' }]), { file } as FormValues);
      if (!await review(context.ui, plan, context.options.signal)) return { end: true };
    },
  },
};
