import { join } from 'node:path';
import type { ProjectSelection } from '../../compiler/domain/project-starter.ts';
import { frameworkAdapter } from '../../compiler/adapters/project/framework-registry.ts';
import { pluginFrameworkAdapters } from '../../../../plugins/runtime.ts';
import { projectGuide, projectPlan, projectStarters } from '../../adapters/projects.ts';
import { requireSketch } from '../../domain/errors.ts';
import type { Guide } from '../../domain/guide.ts';
import type { FormChoice } from '../../domain/form.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { review } from '../review.ts';
import { offerDesignFolder } from '../design-folder.ts';
import type { WizardModule } from './module.ts';
type Starter = Awaited<ReturnType<typeof projectStarters>>[number];
function describe(selection: ProjectSelection): string {
  return `${selection.targets.join(' + ')}; ${selection.framework === 'none' ? 'no frontend framework' : (frameworkAdapter(selection.framework, pluginFrameworkAdapters())?.label ?? selection.framework).split(' — ')[0]}`;
}
const selected = (state: FormValues) => (state.starters as Starter[]).find(item => item.id === state.starterId)!.selection;
/** Actions behind configs/wizards/new-project.json. Nothing is written until the complete plan is approved. */
export const newProjectModule: WizardModule = {
  hooks: {
    choices: {
      'project.starters': data => ((data as FormValues).starters as Starter[])
        .map((item): FormChoice => ({ id: item.id, label: `${item.name} — ${item.summary} (${describe(item.selection)})` })),
    },
  },
  actions: {
    'project.starters': async ({ state, options }) => {
      const starters = await projectStarters(options.frameworkRoot), starter = options.starter as string | undefined;
      requireSketch(starters.length, 'PROJECT_STARTER_UNKNOWN', 'No project starters are installed. Extract the separate starters ZIP into the shell root (configs/starters/).');
      requireSketch(!starter || starters.some(item => item.id === starter), 'PROJECT_STARTER_UNKNOWN', `Choose an installed project starter: ${starters.map(item => item.id).join(', ')}.`);
      Object.assign(state, { starters, starterId: starter ?? starters[0]!.id, answers: {}, out: (options.out as string | undefined) ?? 'projects/prepared-project' });
    },
    /** Choosing another starter clears the brief, so agreement is always renewed for the new project. */
    'project.guide': async ({ ui, state }) => {
      if (state.guideStarter !== state.starterId) state.answers = {};
      const selection = selected(state);
      if (selection.framework === 'none') ui.write('CLI starter: no frontend framework. Describe command journeys in the prototype brief.\n');
      state.guide = await projectGuide(selection); state.guideStarter = state.starterId;
    },
    'project.review': async ({ ui, state, options }) => {
      const guide = state.guide as Guide, out = String(state.out);
      ui.rich?.busy('Preparing target-specific source and prototype handoff. No files written yet.');
      const plan = await projectPlan({ ...options, out, input: { schemaVersion: 2, starter: state.starterId,
        interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers } } });
      if (!await review(ui, plan, options.signal)) { ui.write('No project files written.\n'); return { end: true }; }
    },
    'project.complete': async ({ ui, state, options }) => {
      const selection = selected(state), out = String(state.out), answers = state.answers as FormValues;
      const completion = `Start with ${out}/execution-prompt.md. Starter: ${selection.starter.id}; targets: ${selection.targets.join(', ')}; framework: ${selection.framework}. Source: ${out}/source/.\n`;
      ui.write(completion);
      ui.write(`The design folder belongs to the new project in ${out}/source/, next to its design/project.json.\n`);
      const design = await offerDesignFolder(ui, { root: join(options.root, out, 'source'), frameworkRoot: options.frameworkRoot,
        title: String(answers.title), briefFrom: join(options.root, out, 'design-brief.md'), signal: options.signal });
      return { end: true, completion: completion + (design ?? '') };
    },
  },
};
