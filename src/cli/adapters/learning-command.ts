import { join, resolve } from 'node:path';
import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { setPath } from '../domain/form-model.ts';
import { formValueIssues } from '../domain/form-values.ts';
import { learningStepForm } from '../domain/learning-conditions.ts';
import { learningDocLink, learningDocTargets } from '../domain/learning-markdown.ts';
import type { LearningPath, LearningStep } from '../domain/learning-path.ts';
import { completeLearningStep, learningStep, learningStepOpen, newLearningProgress, readLearningStepInput, type LearningProgress } from '../domain/learning-progress.ts';
import { evaluateLearningStep, type LearningCheckContext } from './learning-checks.ts';
import { learningIssues, learningStepMarkdown, loadLearningCatalog, type LearningCatalog } from './learning-catalog.ts';
import { learningProgressPlan, learningProgressSummary, loadLearningProgress, restartLearningPlan } from './learning-progress-store.ts';
import { applyPrepared, readData } from './storage.ts';
import { definitionsRoot, loadCatalog, type DefinitionCatalog } from './wizard-catalog.ts';
import type { CommandContext } from './commands.ts';
interface Loaded { catalog: LearningCatalog; definitions: DefinitionCatalog; issues: string[] }
const usage = 'Use learn list, learn show --name <id>, learn check, learn status --name <id>, learn complete-step --name <id> --step <step> [--input <answers.json>] [--apply <planHash>], learn restart --name <id> [--apply <planHash>], or run node bin/app learn [--name <id>] in a terminal.';
function overview(path: LearningPath) {
  return { id: path.id, version: path.version, title: path.title, summary: path.summary, skill: path.skill, audience: path.audience,
    prerequisites: path.prerequisites, estimatedMinutes: path.estimatedMinutes, steps: path.steps.length };
}
async function list(loaded: Loaded, root: string) {
  const paths = [];
  for (const path of loaded.catalog.paths.values()) paths.push({ ...overview(path), progress: await learningProgressSummary(root, path) });
  return { root: join(loaded.catalog.root, 'learning'), paths, issues: loaded.issues, status: loaded.issues.length ? 'failed' : 'ok' };
}
function show(loaded: Loaded, path: LearningPath) {
  const steps = path.steps.map(step => {
    const markdown = learningStepMarkdown(loaded.catalog, step);
    return { id: step.id, markdown: markdown ?? null, docs: learningDocTargets(markdown, step.docs).map(learningDocLink) };
  });
  return { definition: path, steps, issues: loaded.issues };
}
async function status(context: LearningCheckContext, path: LearningPath, root: string) {
  const { progress } = await loadLearningProgress(root, path), current = progress ?? newLearningProgress(path, new Date().toISOString());
  const steps = [];
  for (const step of path.steps) steps.push({ id: step.id, title: step.title, goal: step.goal, current: current.currentStep === step.id,
    completedAt: current.completed[step.id] ?? null, open: learningStepOpen(path, current, step.id), checks: await evaluateLearningStep(context, step, current) });
  return { path: overview(path), progress: progress ?? null, steps };
}
/** Answers are validated like `form validate`; invalid answers are refused before anything is planned. */
function applyInput(step: LearningStep, progress: LearningProgress, value: unknown, definitions: DefinitionCatalog): string | undefined {
  const input = readLearningStepInput(value, step);
  if (input.answers) {
    const lookup = (id: string) => definitions.forms.get(id), issues = formValueIssues(learningStepForm(step, lookup)!, input.answers, lookup);
    requireSketch(!issues.length, 'LEARNING_ANSWERS', issues.map(issue => `${issue.field}: ${issue.message}`).join(' '));
    setPath(progress.answers, step.bind!, input.answers);
  }
  if (input.checklist) progress.checklists[step.id] = input.checklist;
  return input.completedAt;
}
/**
 * Agents complete a step without prompts: the input supplies answers and ticked items, every win condition is
 * evaluated, and only a fully met step yields a reviewed progress plan. Wizard runs cannot be claimed this way.
 * Without completedAt the completion is recorded at day precision so the reviewed planHash stays reproducible.
 */
async function completeStep(args: Arguments, context: CommandContext, loaded: Loaded, path: LearningPath) {
  requireSketch(!loaded.issues.length, 'LEARNING_REFERENCE', loaded.issues.join('\n'));
  const step = learningStep(path, option(args, 'step')), snapshot = await loadLearningProgress(context.root, path);
  const day = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const progress = structuredClone(snapshot.progress ?? newLearningProgress(path, day)), input = option(args, 'input');
  const completedAt = input ? applyInput(step, progress, await readData(resolve(context.root, input)), loaded.definitions) : undefined;
  requireSketch(learningStepOpen(path, progress, step.id), 'LEARNING_ORDER', `Complete the steps before ${step.id} first.`);
  const checks = await evaluateLearningStep({ root: context.root, definitions: loaded.definitions }, step, progress);
  const unmet = checks.filter(check => !check.met);
  if (unmet.length) return { path: path.id, step: step.id, checks, unmet, status: 'blocked' };
  const next = completeLearningStep(path, progress, step.id, completedAt ?? day);
  const result = await applyPrepared(await learningProgressPlan(context.root, next, snapshot.beforeHash), option(args, 'apply') || undefined, context.signal);
  return { ...result, step: step.id, checks };
}
/** `learn`: discover, inspect, check and advance learning paths in configs/learning. Running a path is interactive. */
export async function learningCommand(args: Arguments, context: CommandContext, configsRoot = definitionsRoot): Promise<Record<string, unknown>> {
  const definitions = await loadCatalog(configsRoot), catalog = await loadLearningCatalog(configsRoot);
  const loaded: Loaded = { catalog, definitions, issues: await learningIssues(catalog, definitions) };
  if (args.action === 'list') return list(loaded, context.root);
  if (args.action === 'check') return { root: join(catalog.root, 'learning'), paths: catalog.paths.size, issues: loaded.issues, status: loaded.issues.length ? 'failed' : 'ok' };
  requireSketch(['show', 'status', 'complete-step', 'restart'].includes(args.action), 'LEARNING_COMMAND', usage);
  const name = option(args, 'name'), path = catalog.paths.get(name);
  requireSketch(path, 'LEARNING_UNKNOWN', `Unknown learning path ${name || '(missing --name)'}; use learn list.`);
  if (args.action === 'show') return show(loaded, path);
  if (args.action === 'status') return status({ root: context.root, definitions }, path, context.root);
  if (args.action === 'complete-step') return completeStep(args, context, loaded, path);
  return applyPrepared(await restartLearningPlan(context.root, path), option(args, 'apply') || undefined, context.signal);
}
