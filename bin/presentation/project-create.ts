import { projectTargets, compatibleFrontends, type PresetCatalog } from '../domain/project-presets.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { loadProjectCatalog, loadProjectGuide, projectCreatePlan } from '../adapters/project-create.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { Back, choose, input, selectMany, reportError, type Prompts } from './prompts.ts';
interface Options { root: string; frameworkRoot: string; out?: string; signal?: AbortSignal }
async function selection(ui: Prompts, catalog: PresetCatalog) {
  while (true) {
    const preset = await choose(ui, '1. Choose a project preset', catalog.presets.map(item => ({ id: item.id, label: item.label })));
    try {
      const chosen = preset === 'hybrid' ? await selectMany(ui, 'Select at least two runtimes', catalog.runtimes) : undefined;
      const targets = projectTargets(catalog, preset, chosen), choices = compatibleFrontends(catalog, preset, targets);
      requireSketch(choices.length > 0, 'PRESET_INCOMPATIBLE', 'No frontend supports this combination.');
      const frontend = choices.length === 1 ? choices[0]!.id : await choose(ui, '2. Choose the frontend', choices);
      return { preset, frontend, ...(chosen ? { targets } : {}) };
    } catch (error) {
      if (error instanceof Back) continue;
      if (!(error instanceof SketchError)) throw error;
      reportError(ui, error);
    }
  }
}
/** TUI and plain adapters create the exact same request the agent protocol accepts. */
export async function projectWizard(ui: Prompts, options: Options): Promise<string | undefined> {
  const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
  while (true) {
    const selected = await selection(ui, catalog);
    try {
      ui.write(`\nSelected preset: ${selected.preset}; frontend: ${selected.frontend}.\n3. Design the prototype.\n`);
      const answers = await interview(ui, guide);
      const out = await input(ui, 'Project package output folder', options.out ?? 'projects/prepared-project');
      ui.rich?.busy('Preparing the selected runtime sources and prototype handoff. No files written yet.');
      const plan = await projectCreatePlan({ ...options, catalog, guide, out,
        input: { schemaVersion: 1, catalogVersion: catalog.version, ...selected,
          prototypeRequest: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers } } });
      if (!ui.rich) ui.write(String(plan.data.prompt) + '\n');
      if (!await review(ui, plan, options.signal)) return;
      const completion = `Start with ${out}/execution-prompt.md. Sources: ${out}/source/. No installation or build was performed.\n`;
      ui.write(completion); return completion;
    } catch (error) {
      if (error instanceof Back) continue;
      if (!(error instanceof SketchError)) throw error;
      reportError(ui, error);
    }
  }
}
