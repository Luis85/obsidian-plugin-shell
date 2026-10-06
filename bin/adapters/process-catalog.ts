import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { hasPortableProjectSegments } from '../../scripts/shared/project-path.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import type { FormDefinition, FormField } from '../domain/form.ts';
import { getPath } from '../domain/form-model.ts';
import { readProcess, type ProcessDefinition, type ProcessDoc, type ProcessReferences } from '../domain/process.ts';
import { processDataIssues, processGraphIssues, type ProcessIssue } from '../domain/process-graph.ts';
import { processWikilinks } from '../domain/process-docs.ts';
import { guardedText } from './user-settings.ts';
import { loadCatalog } from './wizard-catalog.ts';
/** Business processes are project data under configs/processes; their notes live under configs/processes/docs. */
export const processFolder = 'configs/processes';
const processDocsFolder = processFolder + '/docs';
export interface ProcessEntry { id: string; file: string; definition?: ProcessDefinition; docs: Map<string, string>; issues: ProcessIssue[]; warnings: string[] }
export interface ProcessCatalogContext { root: string; forms: ReadonlyMap<string, FormDefinition>; project: Map<keyof ProcessReferences, Set<string>> | null }
const failure = (error: unknown): ProcessIssue => ({ code: error instanceof SketchError ? error.code : 'PROCESS_INVALID', message: error instanceof Error ? error.message : 'Invalid process.' });
async function processFiles(root: string): Promise<string[]> {
  try { return (await readdir(join(root, processFolder))).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
}
function idsAt(raw: unknown, path: string, keys: readonly string[]): string[] {
  const items = getPath(raw, path);
  return Array.isArray(items) ? items.flatMap(item => keys.map(key => getPath(item, key)).filter((value): value is string => typeof value === 'string')) : [];
}
/** Ids a process may reference in the saved companion project, or null when the project has none. */
async function projectIds(root: string): Promise<ProcessCatalogContext['project']> {
  const read = await guardedText(root, 'design/project.json');
  if (read.content === null) return null;
  const raw = parseJsonData(read.content);
  return new Map([['entities', new Set(idsAt(raw, 'design.semantic.entities', ['id', 'slug']))],
    ['journeys', new Set(idsAt(raw, 'design.sitemap.journeys', ['id']))], ['pages', new Set(idsAt(raw, 'design.nodes', ['id']))]]);
}
export async function processCatalogContext(root: string): Promise<ProcessCatalogContext> {
  return { root, forms: (await loadCatalog()).forms, project: await projectIds(root) };
}
export function stepFields(context: Pick<ProcessCatalogContext, 'forms'>): (id: string) => readonly FormField[] | undefined {
  return id => context.forms.get(id)?.fields;
}
function linkIssues(text: string, where: string, found: Set<string>): ProcessIssue[] {
  return processWikilinks(text).flatMap(target => {
    if (!hasPortableProjectSegments(target)) return [{ code: 'PROCESS_DOC_LINK', message: `${where}: wikilink ${target} is not a safe repository path.` }];
    found.add(target);
    return [];
  });
}
async function existingLinks(root: string, targets: Set<string>): Promise<ProcessIssue[]> {
  const issues: ProcessIssue[] = [];
  for (const target of targets) if ((await guardedText(root, target)).content === null) issues.push({ code: 'PROCESS_DOC_LINK', message: `Wikilink [[${target}]] does not resolve to a repository file.` });
  return issues;
}
async function docFile(root: string, file: string, docs: Map<string, string>): Promise<ProcessIssue[]> {
  if (docs.has(file)) return [];
  const read = await guardedText(root, `${processDocsFolder}/${file}`);
  if (read.content === null) return [{ code: 'PROCESS_DOC_MISSING', message: `Doc file ${processDocsFolder}/${file} does not exist.` }];
  docs.set(file, read.content);
  return [];
}
/** Reads every doc file and validates every wikilink in inline text and files against the repository. */
async function docIssues(root: string, definition: ProcessDefinition, docs: Map<string, string>): Promise<ProcessIssue[]> {
  const entries: Array<[string, ProcessDoc | undefined]> = [['process', definition.doc], ...definition.steps.map((step): [string, ProcessDoc | undefined] => [`step ${step.id}`, step.doc]),
    ...definition.rules.map((rule): [string, ProcessDoc | undefined] => [`rule ${rule.id}`, rule.doc])];
  const issues: ProcessIssue[] = [], targets = new Set<string>();
  for (const [where, doc] of entries) {
    if (doc?.file) issues.push(...await docFile(root, doc.file, docs));
    issues.push(...linkIssues(doc?.text ?? '', where, targets), ...linkIssues(doc?.file ? docs.get(doc.file) ?? '' : '', where, targets));
  }
  return [...issues, ...await existingLinks(root, targets)];
}
const referenceKinds = ['entities', 'journeys', 'pages'] as const;
function referenceIssues(definition: ProcessDefinition, context: ProcessCatalogContext): { issues: ProcessIssue[]; warnings: string[] } {
  const references = referenceKinds.flatMap(kind => (definition.references?.[kind] ?? []).map(id => ({ kind, id })));
  const project = context.project;
  if (!references.length) return { issues: [], warnings: [] };
  if (!project) return { issues: [], warnings: [`${references.length} project reference(s) not verified: no design/project.json in this project.`] };
  return { warnings: [], issues: references.filter(item => !project.get(item.kind)?.has(item.id))
    .map(item => ({ code: 'PROCESS_REFERENCE', message: `references.${item.kind} names ${item.id}, which design/project.json does not define.` })) };
}
function formIssues(definition: ProcessDefinition, context: ProcessCatalogContext): ProcessIssue[] {
  return definition.steps.filter(step => step.form && !context.forms.has(step.form))
    .map(step => ({ code: 'PROCESS_FORM', step: step.id, message: `Step ${step.id} uses unknown form ${step.form}; add it to configs/forms.` }));
}
/** Every check of `process check` for one valid definition: graph health, data coverage, forms, references and docs. */
export async function definitionIssues(definition: ProcessDefinition, context: ProcessCatalogContext, docs = new Map<string, string>()): Promise<{ issues: ProcessIssue[]; warnings: string[] }> {
  const references = referenceIssues(definition, context);
  return { warnings: references.warnings, issues: [...processGraphIssues(definition), ...processDataIssues(definition, stepFields(context)),
    ...formIssues(definition, context), ...references.issues, ...await docIssues(context.root, definition, docs)] };
}
async function loadEntry(file: string, context: ProcessCatalogContext): Promise<ProcessEntry> {
  const id = file.replace(/\.json$/, ''), docs = new Map<string, string>();
  let definition: ProcessDefinition;
  try { definition = readProcess(parseJsonData((await guardedText(context.root, `${processFolder}/${file}`)).content ?? 'null')); }
  catch (error) { return { id, file, docs, issues: [failure(error)], warnings: [] }; }
  const found = await definitionIssues(definition, context, docs);
  const named = definition.id === id ? [] : [{ code: 'PROCESS_FILE', message: `${file} must be named ${definition.id}.json.` }];
  return { id, file, definition, docs, issues: [...named, ...found.issues], warnings: found.warnings };
}
/** Each file is read and checked on its own, so one broken process never hides the findings of another. */
export async function loadProcesses(root: string, context?: ProcessCatalogContext): Promise<ProcessEntry[]> {
  const resolved = context ?? await processCatalogContext(root), entries: ProcessEntry[] = [];
  for (const file of await processFiles(root)) entries.push(await loadEntry(file, resolved));
  return entries;
}
export async function processEntry(root: string, id: string, context?: ProcessCatalogContext): Promise<ProcessEntry> {
  const entry = (await loadProcesses(root, context)).find(item => item.id === id);
  requireSketch(entry, 'PROCESS_UNKNOWN', `Unknown process ${id || '(missing --name)'}; use process list.`);
  return entry;
}
/** A process that can be run or documented: valid structure and no findings. */
export function healthyDefinition(entry: ProcessEntry): ProcessDefinition {
  requireSketch(entry.definition && !entry.issues.length, 'PROCESS_INVALID', `Process ${entry.id} has findings; run process check --json.\n${entry.issues.map(item => item.message).join('\n')}`);
  return entry.definition;
}
