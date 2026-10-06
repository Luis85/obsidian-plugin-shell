import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { defaultReferenceDate } from '../domain/fake-data-config.ts';
import { generateCollection } from '../domain/fake-data.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { readTestWorkflow, type TestWorkflowDefinition } from '../domain/test-workflow.ts';
import { resolveTestWorkflowText, testWorkflowDataContext, type TestWorkflowFakeSource, type TestWorkflowRecord } from '../domain/test-workflow-data.ts';
import type { TestWorkflowDataRow } from '../domain/test-workflow-docs.ts';
import { testWorkflowLocatorTexts, testWorkflowTemplatePaths } from '../domain/test-workflow-locator.ts';
import { loadFakeCatalog, resolveFakeEntity, type FakeCatalog } from './fake-data-catalog.ts';
import { fakeDefaults } from './fake-data-command.ts';
import { testWorkflowTargetState } from './test-workflow-serve.ts';
import { guardedText } from './user-settings.ts';
/** Test workflows are project data under configs/tests/workflows; their documentation notes live in docs/tests/workflows. */
export const testWorkflowFolder = 'configs/tests/workflows';
export const testWorkflowDocsFolder = 'docs/tests/workflows';
export interface TestWorkflowIssue { code: string; message: string }
/** One file: its validated definition, resolved test data (template context and documented rows) and findings. */
export interface TestWorkflowEntry {
  id: string; file: string; definition?: TestWorkflowDefinition; context: Record<string, unknown>; rows: TestWorkflowDataRow[];
  issues: TestWorkflowIssue[]; warnings: string[];
}
const failure = (error: unknown): TestWorkflowIssue => ({ code: error instanceof SketchError ? error.code : 'WORKFLOW_INVALID', message: error instanceof Error ? error.message : 'Invalid workflow.' });
async function workflowFiles(root: string): Promise<string[]> {
  try { return (await readdir(join(root, testWorkflowFolder))).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
}
interface FakeRun { entity: string; count: number; seed: number; referenceDate: string }
/** A config supplies its entity, seed, count and reference date; an entity source generates just enough records. */
function fakeRun(catalog: FakeCatalog, source: TestWorkflowFakeSource): FakeRun {
  if (!source.config) return { entity: source.entity!, count: source.index + 1, seed: source.seed ?? fakeDefaults.seed, referenceDate: defaultReferenceDate };
  const config = catalog.generations.get(source.config)?.definition;
  requireSketch(config, 'WORKFLOW_FAKE_DATA', `Unknown fake-data generation config ${source.config}; list them with node bin/app fake-data configs --json.`);
  requireSketch(source.index < config.count, 'WORKFLOW_FAKE_DATA', `Record index ${source.index} is outside config ${source.config}, which generates ${config.count} records.`);
  return { entity: config.entity, count: config.count, seed: config.seed, referenceDate: config.referenceDate };
}
/** The fake-data generator's own seeded output, offline: the same record on every run and export. */
async function fakeRecord(root: string, catalog: FakeCatalog, source: TestWorkflowFakeSource): Promise<TestWorkflowRecord> {
  const run = fakeRun(catalog, source), entity = await resolveFakeEntity(root, run.entity, catalog);
  const { fakerSource } = await import('./fake-data-faker.ts');
  return generateCollection(entity, { count: run.count, out: 'workflow-data', base: false }, fakerSource(run.seed, run.referenceDate)).notes[source.index]!.frontmatter;
}
function sourceText(definition: TestWorkflowDefinition, alias: string): string {
  const source = definition.data?.fakeData?.[alias];
  if (!source) return 'inline value';
  return source.config ? `fake-data config ${source.config}, record ${source.index + 1}` : `fake-data entity ${source.entity!} (seed ${source.seed ?? fakeDefaults.seed}), record ${source.index + 1}`;
}
/** Every text a run resolves: step values and texts, and the texts of target and mask locators. */
function testWorkflowTexts(definition: TestWorkflowDefinition): string[] {
  return definition.steps.flatMap(step => [step.value, step.text, ...[step.target, ...step.mask ?? []].flatMap(locator => locator ? testWorkflowLocatorTexts(locator) : [])]
    .filter((item): item is string => item !== undefined));
}
/** Resolves every template once; a missing record value is a finding, not an empty string typed into the app. */
function templateRows(definition: TestWorkflowDefinition, context: Record<string, unknown>): { rows: TestWorkflowDataRow[]; issues: TestWorkflowIssue[] } {
  const paths = [...new Set(testWorkflowTexts(definition).flatMap(testWorkflowTemplatePaths))], rows: TestWorkflowDataRow[] = [], issues: TestWorkflowIssue[] = [];
  for (const path of paths) {
    try { rows.push({ reference: `{{data.${path}}}`, source: sourceText(definition, path.split('.')[0]!), value: resolveTestWorkflowText(`{{data.${path}}}`, context) }); }
    catch (error) { issues.push(failure(error)); }
  }
  return { rows, issues };
}
async function dataOf(root: string, definition: TestWorkflowDefinition, catalog: () => Promise<FakeCatalog>): Promise<Pick<TestWorkflowEntry, 'context' | 'rows' | 'issues'>> {
  const records = new Map<string, TestWorkflowRecord>(), issues: TestWorkflowIssue[] = [];
  for (const [alias, source] of Object.entries(definition.data?.fakeData ?? {})) {
    try { records.set(alias, await fakeRecord(root, await catalog(), source)); }
    catch (error) { issues.push(failure(error)); }
  }
  const context = testWorkflowDataContext(definition.data, records), templates = templateRows(definition, context);
  return { context, rows: templates.rows, issues: [...issues, ...templates.issues] };
}
async function loadEntry(root: string, file: string, catalog: () => Promise<FakeCatalog>): Promise<TestWorkflowEntry> {
  const id = file.replace(/\.json$/, '');
  let definition: TestWorkflowDefinition;
  try { definition = readTestWorkflow(parseJsonData((await guardedText(root, `${testWorkflowFolder}/${file}`)).content ?? 'null')); }
  catch (error) { return { id, file, context: {}, rows: [], issues: [failure(error)], warnings: [] }; }
  const named = definition.id === id ? [] : [{ code: 'WORKFLOW_FILE', message: `${file} must be named ${definition.id}.json.` }];
  const data = await dataOf(root, definition, catalog), target = await testWorkflowTargetState(root, definition.target);
  return { id, file, definition, context: data.context, rows: data.rows, issues: [...named, ...data.issues, ...target.issues], warnings: target.warnings };
}
/** One fake-data catalog per load, read only when a workflow references fake data. */
function lazyCatalog(root: string): () => Promise<FakeCatalog> {
  let catalog: Promise<FakeCatalog> | undefined;
  return () => (catalog ??= loadFakeCatalog(root));
}
/** Each file is read and checked on its own, so one broken workflow never hides the findings of another. */
export async function loadTestWorkflows(root: string): Promise<TestWorkflowEntry[]> {
  const catalog = lazyCatalog(root), entries: TestWorkflowEntry[] = [];
  for (const file of await workflowFiles(root)) entries.push(await loadEntry(root, file, catalog));
  return entries;
}
/** A definition supplied for saving goes through exactly the same data and target checks as a stored one. */
export async function checkedTestWorkflow(root: string, input: unknown): Promise<TestWorkflowEntry> {
  const definition = readTestWorkflow(input), data = await dataOf(root, definition, lazyCatalog(root)), target = await testWorkflowTargetState(root, definition.target);
  return { id: definition.id, file: definition.id + '.json', definition, context: data.context, rows: data.rows, issues: [...data.issues, ...target.issues], warnings: target.warnings };
}
export async function testWorkflowEntry(root: string, id: string): Promise<TestWorkflowEntry> {
  const entry = (await loadTestWorkflows(root)).find(item => item.id === id);
  requireSketch(entry, 'WORKFLOW_UNKNOWN', `Unknown workflow ${id || '(missing --name)'}; use workflow list.`);
  return entry;
}
/** A workflow that can be run, documented or exported: valid structure and no findings. */
export function healthyTestWorkflow(entry: TestWorkflowEntry): TestWorkflowDefinition {
  requireSketch(entry.definition && !entry.issues.length, 'WORKFLOW_INVALID', `Workflow ${entry.id} has findings; run workflow check --json.\n${entry.issues.map(item => item.message).join('\n')}`);
  return entry.definition;
}
