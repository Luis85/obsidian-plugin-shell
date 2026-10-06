/** Brainstorm editors and reviewed follow-ups used by the actions behind configs/wizards/brainstorm.json. */
import { applyOperation, planOperation } from '../adapters/framework/planning.ts';
import type { Request } from '../adapters/framework/contracts.ts';
import { brainstormVerifyPlan, executeBrainstormVerification, type BrainstormOptions } from '../adapters/brainstorm.ts';
import type { FeatureBrainstorm, BrainstormPage } from '../domain/brainstorm.ts';
import { Back, choose, confirm, input, titleInput, type Prompts } from '#tui/prompts.ts';

export interface BrainstormWizardOptions extends BrainstormOptions { offerImport?: boolean }

async function longText(ui: Prompts, label: string, initial = ''): Promise<string> {
  if (!ui.rich) return input(ui, label, initial);
  return ui.rich.text({ title: label, initial, multiline: true,
    help: 'Describe the intent in plain language. Ctrl+J adds a line; Enter continues.',
    validate(value) { return value.trim() ? undefined : 'Enter a description.'; } });
}
async function page(ui: Prompts, kind: BrainstormPage['kind'], initial?: BrainstormPage): Promise<BrainstormPage> {
  const label = kind === 'view' ? 'Main feature view' : kind === 'modal' ? 'Dialog' : 'Page';
  const title = await titleInput(ui, label + ' title', initial?.title ?? '', 80);
  const purpose = await longText(ui, 'What does the user accomplish on ' + title + '?', initial?.purpose ?? '');
  return { title, purpose, kind, interactions: initial?.interactions ?? [] };
}
export async function pages(ui: Prompts, initial: BrainstormPage[]): Promise<BrainstormPage[]> {
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
async function plannedAction(ui: Prompts, current: BrainstormPage): Promise<void> {
  const label = await titleInput(ui, 'Action label', '', 120);
  const outcome = await longText(ui, 'What should happen when users choose "' + label + '"?');
  current.interactions.push({ kind: 'action', label, outcome });
}
async function navigationAction(ui: Prompts, current: BrainstormPage, featurePages: BrainstormPage[]): Promise<void> {
  const targets = featurePages.filter(item => item.title !== current.title);
  const target = await choose(ui, 'Where does the user go?',
    targets.map(item => ({ id: item.title, label: item.title + ' — ' + item.purpose })));
  const label = await titleInput(ui, 'Interaction label', 'Open ' + target, 120);
  current.interactions.push({ kind: 'navigate', label, target });
}
async function screenInteractions(ui: Prompts, current: BrainstormPage, featurePages: BrainstormPage[]): Promise<void> {
  current.interactions = [];
  while (true) {
    const choice = await choose(ui, 'Interactions on ' + current.title, [
      { id: 'done', label: current.interactions.length ? 'Done with this screen' : 'No interactions on this screen' },
      ...(featurePages.length > 1 ? [{ id: 'navigate', label: 'Add navigation / open-dialog interaction' }] : []),
      { id: 'action', label: 'Describe a planned action and its expected outcome' },
    ], 'done');
    if (choice === 'done') return;
    if (choice === 'action') await plannedAction(ui, current);
    else await navigationAction(ui, current, featurePages);
  }
}
export async function navigation(ui: Prompts, featurePages: BrainstormPage[]): Promise<BrainstormPage[]> {
  const result = structuredClone(featurePages);
  for (const current of result) await screenInteractions(ui, current, result);
  return result;
}
export async function approveCapturedRequest(ui: Prompts, value: FeatureBrainstorm): Promise<void> {
  if (ui.rich) await ui.rich.review('Review feature brainstorm', [
    { title: 'Definition request', body: JSON.stringify(value, null, 2) },
    { title: 'Boundaries', body: [
      'The first screen becomes the feature view; pages live under it and dialogs remain top-level overlays.',
      'Navigation becomes canonical sitemap transitions. Planned actions, actors, entities and acceptance remain design information until explicitly implemented.',
      'Prototype/boilerplate generation is a file plan. Tests/builds are an independent process plan with a different approval hash.',
      'Nothing here authorizes publication or native Companion acceptance.',
    ].join('\n') },
  ]);
  else ui.write('\nFeature brainstorm\n' + JSON.stringify(value, null, 2) + '\n');
  if (!await confirm(ui, 'Continue to the reviewed file plan?')) throw new Back();
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
export async function optionalImport(ui: Prompts, options: BrainstormWizardOptions, conceptPath: string): Promise<boolean> {
  if (!options.offerImport || !await confirm(ui, 'Review importing this feature into the current project now?')) return false;
  const request: Request = { command: 'concept import', args: [], options: { input: conceptPath } };
  const planned = await planOperation(request, options);
  return reviewFrameworkPlan(ui, planned, options);
}
export async function optionalVerification(ui: Prompts, options: BrainstormWizardOptions, out: string,
  requested: FeatureBrainstorm['verification']): Promise<void> {
  if (requested === 'none') return;
  const plan = await brainstormVerifyPlan(options, out);
  const commands = plan.steps.map(step => 'npm ' + step.args.join(' ')).join('\n');
  const blockers = plan.blockers.length ? '\n\nBLOCKED:\n' + plan.blockers.join('\n') : '';
  if (ui.rich) await ui.rich.review('Review generated-source execution', [
    { title: 'Commands', body: commands + '\n\nExecution plan hash: ' + plan.planHash + blockers },
    { title: 'Effects and limits', body: plan.effects.join('\n') },
    { title: 'Toolchain', body: JSON.stringify({ expected: plan.expected,
      actual: { node: plan.tool.node, npm: plan.tool.version } }, null, 2) },
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
