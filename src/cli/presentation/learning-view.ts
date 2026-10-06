import { learningProgressSummary } from '../adapters/learning-progress-store.ts';
import { learningStepMarkdown, type LearningCatalog } from '../adapters/learning-catalog.ts';
import type { LearningCheck } from '../domain/learning-conditions.ts';
import { learningDocLink, learningDocTargets, renderLearningMarkdown } from '../domain/learning-markdown.ts';
import type { LearningPath, LearningStep } from '../domain/learning-path.ts';
import type { LearningProgress } from '../domain/learning-progress.ts';
import type { LearningSession } from './learning-actions.ts';
import type { Prompts } from './prompts.ts';
import type { Section } from './tui/contracts.ts';
const box = (done: boolean) => done ? '[x]' : '[ ]';
/** The terminal UI pages through sections; plain prompts print the same text once. */
export async function showSections(ui: Prompts, path: LearningPath, sections: Section[], index?: number): Promise<void> {
  const where = index === undefined ? 'Overview' : `Step ${index + 1}/${path.steps.length}: ${path.steps[index]!.title}`;
  if (ui.rich) {
    ui.rich.context({ title: path.title, location: where, details: [path.skill] });
    await ui.rich.review(`${path.title} — ${where}`, sections);
    return;
  }
  ui.write(`\n${path.title} — ${where}\n\n${sections.map(section => `${section.title}\n${section.body}`).join('\n\n')}\n`);
}
function documentation(markdown: string | undefined, step: LearningStep): string {
  return learningDocTargets(markdown, step.docs).map(target => {
    const link = learningDocLink(target);
    return `- ${link.file}${link.heading ? ' → ' + link.heading : ''}`;
  }).join('\n');
}
function checklist(step: LearningStep, progress: LearningProgress): string {
  const ticked = progress.checklists[step.id] ?? [];
  return step.checklist!.map(item => `${box(ticked.includes(item.id))} ${item.label}${item.required ? '' : ' (optional)'}`).join('\n');
}
function actions(step: LearningStep): string {
  return step.actions!.map(action => `- ${action.label}${action.command ? `\n    ${action.command}` : ''}`).join('\n');
}
function conditions(checks: readonly LearningCheck[]): string {
  if (!checks.length) return 'No win conditions: complete this step when you are ready.';
  return checks.map(check => `${box(check.met)} ${check.label}${check.met || !check.detail ? '' : `\n    ${check.detail}`}`).join('\n');
}
/** Goal, lesson, documentation links, checklist, actions and win conditions of one step, in that order. */
export function stepSections(session: LearningSession, step: LearningStep, checks: readonly LearningCheck[]): Section[] {
  const markdown = learningStepMarkdown(session.catalog, step), completedAt = session.progress.completed[step.id];
  const links = documentation(markdown, step);
  return [
    { title: 'Goal', body: step.goal + (completedAt ? `\nCompleted ${completedAt}.` : '') },
    ...(markdown ? [{ title: 'Lesson', body: renderLearningMarkdown(markdown) }] : []),
    ...(links ? [{ title: 'Documentation', body: links }] : []),
    ...(step.checklist ? [{ title: 'Checklist', body: checklist(step, session.progress) }] : []),
    ...(step.actions ? [{ title: 'Actions', body: actions(step) }] : []),
    { title: 'Win conditions', body: conditions(checks) },
  ];
}
/** What the path teaches, for whom, how long it takes, which paths come first and where the learner stands. */
export async function overviewSections(catalog: LearningCatalog, path: LearningPath, progress: LearningProgress | null, root: string): Promise<Section[]> {
  const prerequisites: string[] = [];
  for (const id of path.prerequisites) {
    const summary = await learningProgressSummary(root, catalog.paths.get(id)!);
    prerequisites.push(`${box(!('error' in summary) && summary.finished)} ${catalog.paths.get(id)!.title} (${id})`);
  }
  const steps = path.steps.map((step, index) => `${box(Boolean(progress && Object.hasOwn(progress.completed, step.id)))} ${index + 1}. ${step.title}`);
  return [
    { title: 'Summary', body: path.summary },
    { title: 'Skill', body: `${path.skill}\nFor: ${path.audience}\nEstimated time: ${path.estimatedMinutes} minutes` },
    ...(prerequisites.length ? [{ title: 'Recommended first', body: prerequisites.join('\n') }] : []),
    { title: 'Steps', body: steps.join('\n') },
  ];
}
