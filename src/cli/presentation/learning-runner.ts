import { evaluateLearningStep } from '../adapters/learning-checks.ts';
import { checkedLearningCatalog, type LearningCatalog } from '../adapters/learning-catalog.ts';
import { learningProgressPlan, learningProgressSummary, loadLearningProgress } from '../adapters/learning-progress-store.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import type { LearningCheck } from '../domain/learning-conditions.ts';
import type { LearningPath, LearningStep } from '../domain/learning-path.ts';
import { completeLearningStep, learningProgressPath, newLearningProgress, type LearningProgress } from '../domain/learning-progress.ts';
import { askStepForm, runLearningAction, tickChecklist, type LearningSession } from './learning-actions.ts';
import { overviewSections, showSections, stepSections } from './learning-view.ts';
import { Back, choose, confirm, reportError, type Choice, type Prompts } from './prompts.ts';
import { review } from './review.ts';
import type { WizardOptions } from './wizard-runner.ts';
import { wizardCatalog } from './wizards/registry.ts';
const now = () => new Date().toISOString();
async function courseChoices(catalog: LearningCatalog, root: string): Promise<Choice[]> {
  const choices: Choice[] = [];
  for (const path of catalog.paths.values()) {
    const summary = await learningProgressSummary(root, path);
    const state = 'error' in summary ? 'progress unreadable' : summary.finished ? 'completed' : `${summary.completedSteps}/${summary.totalSteps} steps`;
    choices.push({ id: path.id, label: `${path.title} — ${path.skill} (${path.estimatedMinutes} min, ${state})` });
  }
  requireSketch(choices.length, 'LEARNING_EMPTY', 'No learning paths in configs/learning/paths.');
  return choices;
}
function menu(session: LearningSession, step: LearningStep, checks: readonly LearningCheck[]): Choice[] {
  const done = Object.hasOwn(session.progress.completed, step.id), last = session.index === session.path.steps.length - 1;
  const ticked = (session.progress.checklists[step.id] ?? []).length;
  const verbs = { wizard: 'Run wizard', form: 'Open form', command: 'Show command' };
  return [
    ...(step.bind ? [{ id: 'form', label: 'Fill in the step form' }] : []),
    ...(step.checklist ? [{ id: 'checklist', label: `Tick the checklist (${ticked}/${step.checklist.length})` }] : []),
    ...(step.actions ?? []).map(action => ({ id: 'action:' + action.id, label: `${verbs[action.kind]}: ${action.label}` })),
    { id: 'check', label: done ? 'Check the win conditions again' : checks.length ? 'Check the win conditions and complete this step' : 'Complete this step' },
    ...(done && !last ? [{ id: 'next', label: 'Next step' }] : []),
    ...(session.index > 0 ? [{ id: 'previous', label: 'Previous step' }] : []),
    { id: 'exit', label: 'Exit (offers to save your progress)' },
  ];
}
/** Completion needs every win condition; unmet ones are listed with their reason. Returns true when the path is finished. */
async function check(session: LearningSession, step: LearningStep): Promise<boolean> {
  const checks = await evaluateLearningStep({ root: session.options.root, definitions: session.definitions }, step, session.progress);
  const unmet = checks.filter(item => !item.met);
  if (unmet.length) { session.ui.write(`\nNot yet complete:\n${unmet.map(item => `  - ${item.label}${item.detail ? ': ' + item.detail : ''}`).join('\n')}\n`); return false; }
  const before = session.progress.completed[step.id];
  session.progress = completeLearningStep(session.path, session.progress, step.id, now());
  session.dirty ||= before === undefined;
  const finished = session.path.steps.every(item => Object.hasOwn(session.progress.completed, item.id));
  session.ui.write(finished ? `\nStep completed. You finished ${session.path.title}.\n` : '\nStep completed.\n');
  if (!finished && session.index < session.path.steps.length - 1) session.index++;
  return finished;
}
async function handle(session: LearningSession, step: LearningStep, choice: string): Promise<boolean> {
  if (choice === 'form') await askStepForm(session, step);
  else if (choice === 'checklist') await tickChecklist(session, step);
  else if (choice === 'check') return check(session, step);
  else if (choice === 'next') session.index++;
  else if (choice === 'previous') session.index--;
  else await runLearningAction(session, step.actions!.find(action => 'action:' + action.id === choice)!);
  return false;
}
async function saved(session: LearningSession): Promise<boolean> {
  if (!session.dirty || !await confirm(session.ui, 'Save your learning progress?')) return false;
  return review(session.ui, await learningProgressPlan(session.options.root, session.progress, session.beforeHash), session.options.signal);
}
/** Leaving offers one reviewed, default-No save; declining keeps the saved file exactly as it was. Like a wizard end, the message is written and returned. */
async function leave(session: LearningSession): Promise<string> {
  const where = learningProgressPath(session.path.id), resume = `Run node bin/app learn --name ${session.path.id} to continue.`;
  const message = !session.dirty ? `Nothing new to save for ${session.path.title}. ${resume}\n`
    : await saved(session) ? `Progress saved to ${where}. ${resume}\n` : `Progress was not saved; ${where} is unchanged.\n`;
  session.ui.write(message);
  return message;
}
async function choice(session: LearningSession, step: LearningStep, checks: readonly LearningCheck[]): Promise<string> {
  const items = menu(session, step, checks), fallback = items.some(item => item.id === 'next') ? 'next' : 'check';
  try { return await choose(session.ui, 'What would you like to do?', items, fallback); }
  catch (error) { if (error instanceof Back) return session.index > 0 ? 'previous' : 'exit'; throw error; }
}
/** One step at a time: show it, act on one menu choice, and re-evaluate. Failures are reported and the step stays open. */
async function walk(session: LearningSession): Promise<string> {
  while (true) {
    const step = session.path.steps[session.index]!;
    const checks = await evaluateLearningStep({ root: session.options.root, definitions: session.definitions }, step, session.progress);
    await showSections(session.ui, session.path, stepSections(session, step, checks), session.index);
    const selected = await choice(session, step, checks);
    if (selected === 'exit') return leave(session);
    try { if (await handle(session, step, selected)) return leave(session); }
    catch (error) { reportError(session.ui, error); }
  }
}
async function startingProgress(ui: Prompts, path: LearningPath, saved: LearningProgress | null): Promise<LearningProgress | undefined> {
  if (!saved) return await confirm(ui, `Start ${path.title}?`) ? newLearningProgress(path, now()) : undefined;
  const action = await choose(ui, 'Saved progress found', [
    { id: 'resume', label: 'Resume where you stopped' },
    { id: 'restart', label: 'Restart from the first step (the saved file changes only after a reviewed save)' },
    { id: 'exit', label: 'Exit without changes' },
  ], 'resume');
  return action === 'exit' ? undefined : action === 'resume' ? saved : newLearningProgress(path, now());
}
/** `node bin/app learn [--name <id>]` in a terminal: choose a path, resume or restart it, and work through its steps. */
export async function launchLearning(ui: Prompts, args: Arguments, options: WizardOptions): Promise<string | undefined> {
  const configsRoot = typeof options.configsRoot === 'string' ? options.configsRoot : undefined;
  const definitions = await wizardCatalog(configsRoot), catalog = await checkedLearningCatalog(definitions, configsRoot);
  const id = option(args, 'name') || await choose(ui, 'Which learning path do you want to follow?', await courseChoices(catalog, options.root));
  const path = catalog.paths.get(id);
  requireSketch(path, 'LEARNING_UNKNOWN', `Unknown learning path ${id}; use learn list.`);
  const snapshot = await loadLearningProgress(options.root, path);
  await showSections(ui, path, await overviewSections(catalog, path, snapshot.progress, options.root));
  const progress = await startingProgress(ui, path, snapshot.progress);
  if (!progress) return undefined;
  const index = path.steps.findIndex(step => step.id === progress.currentStep);
  return walk({ ui, options, path, catalog, definitions, progress, beforeHash: snapshot.beforeHash, dirty: progress !== snapshot.progress, index, now, configsRoot });
}
