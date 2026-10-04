import { prototypePlan } from '../../adapters/prototype.ts';
import { prototypeContext } from '../../adapters/prototype-context.ts';
import { loadSettings } from '../../adapters/user-settings.ts';
import { readSnapshot } from '../../adapters/storage.ts';
import { outline } from '../../application/summary.ts';
import { Workspace } from '../../application/workspace.ts';
import type { Guide } from '../../domain/guide.ts';
import type { FormValues } from '../../domain/form-model.ts';
import { review } from '../review.ts';
import { offerDesignFolder } from '../design-folder.ts';
import type { WizardModule } from './module.ts';
type Selection = Awaited<ReturnType<typeof prototypeContext>>['selection'];
/** Actions behind configs/wizards/prototype.json. A saved or open workspace seeds the brief and becomes the baseline. */
export const prototypeModule: WizardModule = {
  actions: {
    'prototype.context': async ({ state, options }) => {
      const { guide, selection } = await prototypeContext(options.root, options.guide as string | undefined);
      const configured = await loadSettings(options.root);
      let workspace = options.workspace as Workspace | undefined;
      if (!workspace) {
        const snapshot = await readSnapshot(options.root, String(options.project));
        workspace = snapshot.document ? new Workspace(snapshot.document, snapshot.beforeHash) : undefined;
      }
      Object.assign(state, { guide, selection, workspace,
        initialAnswers: workspace ? { title: workspace.document.project.name, pages: outline(workspace.document).pages.map(item => item.title) } : {},
        out: (options.out as string | undefined) ?? (configured.content ? configured.settings.paths.prototypes : 'prototypes/prepared-prototype') });
    },
    'prototype.review': async ({ ui, state, options }) => {
      const guide = state.guide as Guide, workspace = state.workspace as Workspace | undefined;
      ui.rich?.busy('Preparing prototype documents and source. No files written yet.');
      const plan = await prototypePlan({ ...options, out: String(state.out), guide, selection: state.selection as Selection, baseline: workspace?.document ?? null,
        input: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers } });
      if (!await review(ui, plan, options.signal)) return { end: true };
    },
    'prototype.complete': async ({ ui, state, options }) => {
      const out = String(state.out), answers = state.answers as FormValues;
      const completion = `Start with ${out}/execution-prompt.md. The complete source scaffold is under ${out}/source/.\n`;
      ui.write(completion);
      // The prepared package holds the exact prototype model and brief; the design folder follows them on sync.
      const design = await offerDesignFolder(ui, { root: options.root, frameworkRoot: options.frameworkRoot, title: String(answers.title),
        project: `${out}/companion.project.json`, package: out, signal: options.signal });
      return { end: true, completion: completion + (design ?? '') };
    },
  },
};
