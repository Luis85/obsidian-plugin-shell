import { applyOperation, planOperation } from '../../scripts/framework/planning.ts';
import type { Request } from '../../scripts/framework/contracts.ts';
import { brainstormContext, brainstormFeaturePlan, brainstormVerifyPlan, executeBrainstormVerification,
  type BrainstormOptions, type BrainstormVerificationPlan } from '../adapters/brainstorm.ts';
import { slug } from '../domain/errors.ts';
import type { FeatureBrainstorm, BrainstormPage } from '../domain/brainstorm.ts';
import { review } from './review.ts';
import { Back, choose, confirm, input, reportError, titleInput, type Prompts } from './prompts.ts';

interface BrainstormWizardOptions extends BrainstormOptions { offerImport?: boolean }
interface Draft {
  name: string; purpose: string; actors: string[]; entities: string[];
  pages: BrainstormPage[]; acceptance: string[];
  output: FeatureBrainstorm['output']; verification: FeatureBrainstorm['verification'];
}

async function longText(ui: Prompts, label: string, initial = ''): Promise<string> {
  if (!ui.rich) return input(ui, label, initial);
  return ui.rich.text({ title: label, initial, multiline: true,
    help: 'Describe the intent in plain language. Ctrl+J adds a line; Enter continues.',
    validate(value) { return value.trim() ? undefined : 'Enter a description.'; } });
}
async function lines(ui: Prompts, label: string, initial: string[] = []): Promise<string[]> {
  if (!ui.rich) {
    const value = await input(ui, label + ' (semicolon separated; empty is allowed)', initial.join('; '));
    return value.split(';').map(item => item.trim()).filter(Boolean);
  }
  const value = await ui.rich.text({ title: label, initial: initial.join('\n'), multiline: true,
    help: 'One item per line. Leave empty when this is not known yet. Ctrl+J adds a line; Enter continues.' });
  return value.split('\n').map(item => item.trim()).filter(Boolean);
}
async function page(ui: Prompts, kind: BrainstormPage['kind'], initial?: BrainstormPage): Promise<BrainstormPage> {
  const label = kind === 'view' ? 'Main feature view' : kind === 'modal' ? 'Dialog' : 'Page';
  const title = await titleInput(ui, label + ' title', initial?.title ?? '', 80);
  const purpose = await longText(ui, 'What does the user accomplish on ' + title + '?', initial?.purpose ?? '');
  return { title, purpose, kind, interactions: initial?.interactions ?? [] };
}
async function pages(ui: Prompts, initial: BrainstormPage[]): Promise<BrainstormPage[]> {
  const result = initial.length ? structuredClone(initial) : [await page(ui, 'view')];
  if (!result.length) result.push(await page(ui, 'view'));
  while (true) {
    const action = await choose(ui, 'Feature screens', [
      { id: 'done', label: 'Done — define navigation next' },
      { id: 'page', label: 'Add an internal page' },
      { id: 'modal', label: 'Add a dialog / modal' },
      ...result.map((item, index) => ({ id: 'edit-' + index, label: 'Edit: ' + item.title })),
      ...(result.length > 1 ? result.slice(1).map((item, index) => ({ id: 'remove-' + (index + 1), label: 'Remove: ' + item.title })) : []),
    ], 'done');
    if (action === 'done') return result;
    if (action === 'page' || action === 'modal') result.push(await page(ui, action));
    else if (action.startsWith('edit-')) {
      const index = Number(action.slice(5)); result[index] = await page(ui, result[index]!.kind, result[index]);
    } else if (action.startsWith('remove-')) result.splice(Number(action.slice(7)), 1);
  }
}
async function navigation(ui: Prompts, pages: BrainstormPage[]): Promise<BrainstormPage[]> {
  const result = structuredClone(pages);
  for (const current of result) {
    current.interactions = [];
    if (result.length < 2) continue;
    while (true) {
      const choice = await choose(ui, 'Navigation from ' + current.title, [
        { id: 'done', label: current.interactions.length ? 'Done with this screen' : 'No navigation from this screen' },
        { id: 'add', label: 'Add navigation / open-dialog interaction' },
      ], 'done');
      if (choice === 'done') break;
      const targets = result.filter(item => item.title !== current.title);
      const target = await choose(ui, 'Where does the user go?', targets.map(item => ({ id: item.title, label: item.title + ' — ' + item.purpose })));
      const label = await titleInput(ui, 'Interaction label', 'Open ' + target, 120);
      current.interactions.push({ label, target });
    }
  }
  return result;
}
function request(draft: Draft, projectId: string, baseSha256: string): FeatureBrainstorm {
  return { schemaVersion: 1, name: draft.name, purpose: draft.purpose, actors: draft.actors,
    entities: draft.entities, pages: draft.pages, acceptance: draft.acceptance,
    output: draft.output, verification: draft.verification, projectId, baseSha256 };
}
function setContext(ui: Prompts, title: string, step: string, details: string[]): void {
  ui.rich?.context({ title, location: 'Brainstorm / ' + step, details: [...details, '', 'Escape: previous section', 'F1: keyboard help'] });
}
async function capture(ui: Prompts, options: BrainstormWizardOptions): Promise<FeatureBrainstorm> {
  const context = await brainstormContext(options);
  const draft: Draft = { name: '', purpose: '', actors: [], entities: [], pages: [], acceptance: [],
    output: 'definition', verification: 'none' };
  let stage = 0;
  while (stage < 8) {
    try {
      if (stage === 0) {
        setContext(ui, draft.name || 'New feature', 'Feature', ['1 / 8', context.project.name]);
        draft.name = await titleInput(ui, 'What is the name of the new feature?', draft.name, 80);
      } else if (stage === 1) {
        setContext(ui, draft.name, 'Purpose', ['2 / 8', 'Problem and desired outcome']);
        draft.purpose = await longText(ui, 'What problem does this feature solve, and what is its purpose?', draft.purpose);
      } else if (stage === 2) {
        setContext(ui, draft.name, 'Actors and entities', ['3 / 8', 'Planning context only']);
        draft.actors = await lines(ui, 'Who will use or interact with it?', draft.actors);
        draft.entities = await lines(ui, 'Which actors/entities or business objects are involved?', draft.entities);
      } else if (stage === 3) {
        setContext(ui, draft.name, 'Screens', ['4 / 8', 'Main view → pages/dialogs']);
        draft.pages = await pages(ui, draft.pages);
      } else if (stage === 4) {
        setContext(ui, draft.name, 'Interactions', ['5 / 8', 'Navigation between the sketched screens']);
        draft.pages = await navigation(ui, draft.pages);
      } else if (stage === 5) {
        setContext(ui, draft.name, 'Acceptance', ['6 / 8', 'Useful/correct outcomes']);
        draft.acceptance = await lines(ui, 'How will you recognize the feature as useful and correct?', draft.acceptance);
      } else if (stage === 6) {
        setContext(ui, draft.name, 'Output', ['7 / 8', 'Generation is reviewed separately']);
        draft.output = await choose(ui, 'What should be prepared?', [
          { id: 'definition', label: 'Feature definition + canonical concept only' },
          { id: 'prototype', label: 'Definition + offline prototype source' },
          { id: 'boilerplate', label: 'Definition + project/plugin boilerplate source' },
        ], draft.output) as Draft['output'];
      } else {
        setContext(ui, draft.name, 'Build and test', ['8 / 8', 'Processes require another approval']);
        draft.verification = draft.output === 'definition' ? 'none' : await choose(ui, 'After generation, what should be available as a separately approved run?', [
          { id: 'none', label: 'Do not run anything' },
          { id: 'test', label: 'Install dependencies and run tests' },
          { id: 'test-build', label: 'Install dependencies, run tests and build' },
        ], draft.verification) as Draft['verification'];
      }
      stage++;
    } catch (error) {
      if (!(error instanceof Back) || stage === 0) throw error;
      stage--;
    }
  }
  const value = request(draft, context.project.id, context.baseSha256);
  if (ui.rich) await ui.rich.review('Review feature brainstorm', [
    { title: 'Definition request', body: JSON.stringify(value, null, 2) },
    { title: 'Boundaries', body: [
      'The first screen becomes the feature view; pages live under it and dialogs remain top-level overlays.',
      'Navigation becomes canonical sitemap transitions. Actors, entities and acceptance remain planning information until refined in their canonical editors.',
      'Prototype/boilerplate generation is a file plan. Tests/builds are an independent process plan with a different approval hash.',
      'Nothing here authorizes publication or native Companion acceptance.',
    ].join('\n') },
  ]);
  else ui.write('\nFeature brainstorm\n' + JSON.stringify(value, null, 2) + '\n');
  if (!await confirm(ui, 'Continue to the reviewed file plan?')) throw new Back();
  return value;
}
async function reviewFrameworkPlan(ui: Prompts, planned: Awaited<ReturnType<typeof planOperation>>,
  options: BrainstormWizardOptions): Promise<boolean> {
  const changed = planned.plan.changes.filter(change => change.status !== 'unchanged');
  const manifest = changed.map(change => change.status.padEnd(10) + ' ' + change.path).join('\n');
  if (ui.rich) await ui.rich.review('Review feature import', [
    { title: 'Canonical project changes', body: 'Plan hash: ' + planned.planHash + '\n\n' + manifest },
    { title: 'Import summary', body: JSON.stringify(planned.summary, null, 2) },
  ]);
  else ui.write('\nFeature import plan\nPlan hash: ' + planned.planHash + '\n' + manifest + '\n');
  if (!await confirm(ui, 'Apply this independently reviewed feature import?')) return false;
  ui.rich?.busy('Importing the reviewed additive feature concept.');
  const applied = await applyOperation(planned, options, planned.planHash);
  ui.write(applied.written.length ? 'Feature imported into the canonical project.\n' : 'Project already matches this import.\n');
  return true;
}
async function optionalImport(ui: Prompts, options: BrainstormWizardOptions, conceptPath: string): Promise<boolean> {
  if (!options.offerImport || !await confirm(ui, 'Review importing this feature into the current project now?')) return false;
  const request: Request = { command: 'concept import', args: [], options: { input: conceptPath } };
  const planned = await planOperation(request, options);
  return reviewFrameworkPlan(ui, planned, options);
}
async function optionalVerification(ui: Prompts, options: BrainstormWizardOptions, out: string,
  requested: FeatureBrainstorm['verification']): Promise<void> {
  if (requested === 'none') return;
  const plan = await brainstormVerifyPlan(options, out);
  const commands = plan.steps.map(step => 'npm ' + step.args.join(' ')).join('\n');
  const blockers = plan.blockers.length ? '\n\nBLOCKED:\n' + plan.blockers.join('\n') : '';
  if (ui.rich) await ui.rich.review('Review generated-source execution', [
    { title: 'Commands', body: commands + '\n\nExecution plan hash: ' + plan.planHash + blockers },
    { title: 'Effects and limits', body: plan.effects.join('\n') },
    { title: 'Toolchain', body: JSON.stringify({ expected: plan.expected, actual: { node: plan.tool.node, npm: plan.tool.version } }, null, 2) },
  ]);
  else ui.write('\nGenerated-source execution plan\n' + commands + '\nPlan hash: ' + plan.planHash + blockers + '\n');
  if (plan.blockers.length) {
    ui.write('No process started. Switch to the generated project toolchain and run brainstorm verify again.\n'); return;
  }
  if (!await confirm(ui, 'Run the reviewed install/test' + (requested === 'test-build' ? '/build' : '') + ' plan?')) return;
  ui.rich?.busy('Running the separately approved generated-source checks. Ctrl+C cancels safely.');
  const result = await executeBrainstormVerification(plan, plan.planHash, options);
  ui.write('Generated-source verification completed: ' + result.outcomes.map(item => item.label).join(', ') +
    '. Native acceptance and publication were not inferred.\n');
}
/**
 * Feature-first brainstorming flow. Project brainstorming is intentionally left as
 * a separate future use-case rather than hiding the existing preset wizard behind
 * the same label.
 */
export async function brainstormWizard(ui: Prompts, options: BrainstormWizardOptions): Promise<string | undefined> {
  const mode = await choose(ui, 'Brainstorm', [
    { id: 'feature', label: 'Brainstorm a new feature' },
    { id: 'project', label: 'Brainstorm a new project — planned next' },
  ], 'feature');
  if (mode === 'project') {
    ui.write('Project brainstorming is not implemented by this increment. Use New project for the current preset/prototype flow.\n');
    return;
  }
  try {
    const definition = await capture(ui, options);
    const out = options.out ?? 'brainstorms/' + slug(definition.name, 'feature');
    ui.rich?.busy('Validating the feature against the saved project and preparing files. No writes or processes yet.');
    const plan = await brainstormFeaturePlan(definition, { ...options, out });
    if (!await review(ui, plan, options.signal)) return;
    const conceptPath = String(plan.data.conceptPath);
    const imported = await optionalImport(ui, options, conceptPath);
    await optionalVerification(ui, options, out, definition.verification);
    const completion = 'Brainstorm saved to ' + out + '. Concept: ' + conceptPath + '. ' +
      (imported ? 'The feature is imported in the canonical project. ' :
        'The canonical project was not changed; import remains a separate reviewed action. ') +
      (definition.output === 'definition' ? 'No source was generated.' : 'Generated source is under ' + out + '/source/.');
    ui.write(completion + '\n'); return completion + '\n';
  } catch (error) {
    if (error instanceof Back) { ui.write('Brainstorm cancelled. No additional files were written.\n'); return; }
    reportError(ui, error); return;
  }
}
