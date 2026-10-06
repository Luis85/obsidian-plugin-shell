import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { requireSketch, SketchError } from '../domain/errors.ts';
import type { FormField } from '../domain/form.ts';
import { learningPrerequisiteIssues, readLearningPath, type LearningPath, type LearningStep } from '../domain/learning-path.ts';
import { learningDocLink, learningDocTargets, learningHeadings, readLearningMarkdown } from '../domain/learning-markdown.ts';
import { readBounded } from './framework/files.ts';
import { guardedText } from './user-settings.ts';
import { definitionsRoot, type DefinitionCatalog } from './wizard-catalog.ts';
import { readData } from './storage.ts';
/**
 * configs/learning/paths/<id>.json are the learning paths; configs/learning/content/ holds Markdown they reference.
 * Documentation links resolve against the repository that ships the definitions (the parent of configs/).
 */
export interface LearningCatalog { root: string; repository: string; paths: Map<string, LearningPath>; content: Map<string, string>; contentIssues: string[] }
const contentLimit = 64 * 1024;
async function pathFiles(folder: string): Promise<string[]> {
  try { return (await readdir(folder)).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if ((error as { code?: string }).code === 'ENOENT') return []; throw error; }
}
async function readPathFile(folder: string, name: string): Promise<LearningPath> {
  let path: LearningPath;
  try { path = readLearningPath(await readData(join(folder, name))); }
  catch (error) { throw new SketchError(error instanceof SketchError ? error.code : 'LEARNING_INVALID', `${name}: ${error instanceof Error ? error.message : 'invalid learning path'}`); }
  requireSketch(name === path.id + '.json', 'LEARNING_FILE', `${name} must be named ${path.id}.json.`);
  return path;
}
const contentFile = (step: LearningStep) => typeof step.markdown === 'object' ? step.markdown.file : undefined;
async function readContent(root: string, file: string): Promise<string> {
  const bytes = await readBounded(join(root, 'learning', 'content', file), contentLimit);
  return readLearningMarkdown(new TextDecoder('utf-8', { fatal: true }).decode(bytes), file, contentLimit);
}
/** Structural load; one structurally invalid path fails the catalog. Missing or unsafe content is a reference issue. */
export async function loadLearningCatalog(root = definitionsRoot): Promise<LearningCatalog> {
  const folder = join(root, 'learning', 'paths'), paths = new Map<string, LearningPath>();
  for (const name of await pathFiles(folder)) { const path = await readPathFile(folder, name); paths.set(path.id, path); }
  const content = new Map<string, string>(), contentIssues: string[] = [];
  const files = new Set([...paths.values()].flatMap(path => path.steps.flatMap(step => contentFile(step) ?? [])));
  for (const file of files) {
    try { content.set(file, await readContent(root, file)); }
    catch (error) { contentIssues.push(`content ${file}: ${error instanceof Error ? error.message : 'unreadable'}`); }
  }
  return { root, repository: resolve(root, '..'), paths, content, contentIssues };
}
/** The step's Markdown text, inline or from its content file. */
export function learningStepMarkdown(catalog: LearningCatalog, step: LearningStep): string | undefined {
  if (typeof step.markdown === 'string') return step.markdown;
  return step.markdown ? catalog.content.get(step.markdown.file) : undefined;
}
async function linkIssue(repository: string, target: string, pages: Map<string, string | null>): Promise<string | undefined> {
  const link = learningDocLink(target);
  if (!pages.has(link.file)) {
    try { pages.set(link.file, (await guardedText(repository, link.file)).content); }
    catch { pages.set(link.file, null); }
  }
  const page = pages.get(link.file);
  if (page === null || page === undefined) return `broken documentation link [[${target}]]: ${link.file} does not exist.`;
  if (link.heading && !learningHeadings(page).has(link.heading.trim().toLowerCase())) return `broken documentation link [[${target}]]: no heading "${link.heading}" in ${link.file}.`;
  return undefined;
}
function referenceIssues(path: LearningPath, step: LearningStep, definitions: DefinitionCatalog): string[] {
  const where = `path ${path.id}.${step.id}`, issues: string[] = [];
  const forms = [step.form, ...(step.actions ?? []).map(action => action.form)].filter((id): id is string => Boolean(id));
  issues.push(...forms.filter(id => !definitions.forms.has(id)).map(id => `${where}: unknown form ${id}.`));
  const wizards = (step.actions ?? []).flatMap(action => action.wizard && !action.wizard.startsWith('{{') ? [action.wizard] : []);
  issues.push(...wizards.filter(id => !definitions.wizards.has(id)).map(id => `${where}: unknown wizard ${id}.`));
  return [...issues, ...inlineFieldIssues(step.fields ?? [], where, definitions)];
}
/** Inline fields stay pure data: code hooks belong to registered forms, whose hooks the wizard catalog checks. */
function inlineFieldIssues(fields: readonly FormField[], where: string, definitions: DefinitionCatalog): string[] {
  return fields.flatMap(field => [
    ...(field.choicesFrom || field.effect || field.prepare || field.commit ? [`${where}.${field.id}: inline fields cannot name code hooks; use a registered form.`] : []),
    ...(field.form && !definitions.forms.has(field.form) ? [`${where}.${field.id}: unknown form ${field.form}.`] : []),
    ...inlineFieldIssues(field.fields ?? [], `${where}.${field.id}`, definitions),
  ]);
}
/** Cross-reference check: forms and wizards exist, prerequisites exist and are acyclic, content and documentation links resolve. */
export async function learningIssues(catalog: LearningCatalog, definitions: DefinitionCatalog): Promise<string[]> {
  const issues = [...catalog.contentIssues, ...learningPrerequisiteIssues(catalog.paths)], pages = new Map<string, string | null>();
  for (const path of catalog.paths.values()) for (const step of path.steps) {
    issues.push(...referenceIssues(path, step, definitions));
    for (const target of learningDocTargets(learningStepMarkdown(catalog, step), step.docs)) {
      const issue = await linkIssue(catalog.repository, target, pages);
      if (issue) issues.push(`path ${path.id}.${step.id}: ${issue}`);
    }
  }
  return [...new Set(issues)];
}
/** Learning paths are read on each start, so an edited file applies to the next run; any broken reference fails closed. */
export async function checkedLearningCatalog(definitions: DefinitionCatalog, root = definitionsRoot): Promise<LearningCatalog> {
  const catalog = await loadLearningCatalog(root), issues = await learningIssues(catalog, definitions);
  requireSketch(!issues.length, 'LEARNING_REFERENCE', issues.join('\n'));
  return catalog;
}
