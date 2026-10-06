import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { testWorkflowJson, type TestWorkflowDefinition } from '../domain/test-workflow.ts';
import type { TestWorkflowRunRecord } from '../domain/test-workflow-docs.ts';
import { describeTestWorkflowTarget, testWorkflowTargetOverride } from '../domain/test-workflow-target.ts';
import { checkedTestWorkflow, healthyTestWorkflow, loadTestWorkflows, testWorkflowDocsFolder, testWorkflowEntry, testWorkflowFolder, type TestWorkflowEntry, type TestWorkflowIssue } from './test-workflow-catalog.ts';
import { testWorkflowNote, testWorkflowOrphans } from './test-workflow-docs-plan.ts';
import { testWorkflowExportPlan } from './test-workflow-export.ts';
import { readTestWorkflowReport, testWorkflowRunRecord } from './test-workflow-record.ts';
import { runTestWorkflow, writeTestWorkflowReport } from './test-workflow-run.ts';
import { applyPrepared, prepared, readData, type Prepared } from './storage.ts';
/** Actions of `node bin/app workflow` that ask questions and therefore run only in a terminal. */
const interactiveActions = new Set(['', 'new', 'edit']);
export function interactiveTestWorkflow(args: Arguments): boolean {
  return args.command === 'workflow' && interactiveActions.has(args.action);
}
export interface TestWorkflowCommandContext { root: string; frameworkRoot: string; env?: Readonly<Record<string, string | undefined>> }
function summary(entry: TestWorkflowEntry): Record<string, unknown> {
  const definition = entry.definition, base = { id: entry.id, file: `${testWorkflowFolder}/${entry.file}`, doc: `${testWorkflowDocsFolder}/${entry.id}.md` };
  const details = definition ? { title: definition.title, status: definition.status, target: describeTestWorkflowTarget(definition.target), steps: definition.steps.length,
    assertions: definition.steps.filter(step => step.kind.startsWith('expect')).length } : { status: 'invalid' };
  return { ...base, ...details, issues: entry.issues, warnings: entry.warnings };
}
const failure = (error: unknown): TestWorkflowIssue => ({ code: error instanceof SketchError ? error.code : 'WORKFLOW_DOCS', message: error instanceof Error ? error.message : 'Unreadable note.' });
/** A missing, stale, edited or unmarked note is a finding of the workflow it documents. */
async function noteIssues(root: string, entry: TestWorkflowEntry): Promise<TestWorkflowIssue[]> {
  if (!entry.definition) return [];
  try {
    const note = await testWorkflowNote(root, entry.definition, entry.rows);
    if (note.state === 'missing') return [{ code: 'WORKFLOW_DOC_MISSING', message: `${note.path} does not exist; run workflow docs --name ${entry.id}.` }];
    return note.state === 'stale' ? [{ code: 'WORKFLOW_DOC_STALE', message: `${note.path} is out of date; run workflow docs --name ${entry.id}.` }] : [];
  } catch (error) { return [failure(error)]; }
}
async function noteFiles(root: string): Promise<string[]> {
  try { return (await readdir(join(root, testWorkflowDocsFolder))).sort(); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []; throw error; }
}
async function check(context: TestWorkflowCommandContext): Promise<Record<string, unknown>> {
  const entries = await loadTestWorkflows(context.root), workflows = [];
  for (const entry of entries) workflows.push({ id: entry.id, issues: [...entry.issues, ...await noteIssues(context.root, entry)], warnings: entry.warnings });
  const orphans = testWorkflowOrphans(await noteFiles(context.root), new Set(entries.map(entry => entry.id)));
  const issues = workflows.reduce((total, item) => total + item.issues.length, 0) + orphans.length;
  return { workflows, orphans: orphans.map(path => ({ code: 'WORKFLOW_DOC_ORPHAN', path, message: `${path} documents no workflow in ${testWorkflowFolder}; remove it or restore the definition.` })),
    issues, status: issues ? 'failed' : 'ok' };
}
/** The one save path for agents and the authoring wizard: the definition and its regenerated note in one reviewed plan. */
export async function testWorkflowSavePlan(root: string, input: unknown): Promise<Prepared> {
  const entry = await checkedTestWorkflow(root, input), definition = healthyTestWorkflow(entry);
  const note = await testWorkflowNote(root, definition, entry.rows), path = `${testWorkflowFolder}/${definition.id}.json`;
  const plan = await createFilePlan(root, [{ path, content: testWorkflowJson(definition) }, { path: note.path, content: note.content }]);
  return prepared(plan, { workflow: definition.id, path, doc: note.path, warnings: entry.warnings }, { kind: 'workflow-save', workflow: definition.id });
}
async function docsPlan(root: string, name: string): Promise<Prepared> {
  const entries = name ? [await testWorkflowEntry(root, name)] : await loadTestWorkflows(root), notes = [];
  for (const entry of entries) notes.push(await testWorkflowNote(root, healthyTestWorkflow(entry), entry.rows));
  const plan = await createFilePlan(root, notes.map(note => ({ path: note.path, content: note.content })));
  return prepared(plan, { workflows: entries.map(entry => entry.id), notes: notes.map(note => ({ path: note.path, state: note.state, generatedHash: note.generatedHash })) }, { kind: 'workflow-docs', name });
}
const runStatus = { passed: 'ok', failed: 'failed', 'not-run': 'blocked' } as const;
async function run(args: Arguments, context: TestWorkflowCommandContext): Promise<Record<string, unknown>> {
  const entry = await testWorkflowEntry(context.root, option(args, 'name')), definition = healthyTestWorkflow(entry), override = option(args, 'target');
  const outcome = await runTestWorkflow({ root: context.root, frameworkRoot: context.frameworkRoot, ...override ? { target: testWorkflowTargetOverride(override) } : {}, ...context.env ? { env: context.env } : {} }, definition, entry.context);
  const reports = await writeTestWorkflowReport(context.root, outcome), report = outcome.report;
  const next = report.status === 'not-run' ? report.reason : `Review the report, then record it in the note with node bin/app workflow record --name ${definition.id} --json.`;
  return { report, reports, screenshots: report.screenshots.map(item => item.path), next, status: runStatus[report.status] };
}
async function record(args: Arguments, context: TestWorkflowCommandContext): Promise<Prepared> {
  const entry = await testWorkflowEntry(context.root, option(args, 'name')), definition: TestWorkflowDefinition = healthyTestWorkflow(entry);
  const input = option(args, 'input') || `reports/workflows/${definition.id}/latest.json`;
  const runRecord: TestWorkflowRunRecord = testWorkflowRunRecord(readTestWorkflowReport(await readData(resolve(context.root, input))), definition);
  const note = await testWorkflowNote(context.root, definition, entry.rows, runRecord);
  return prepared(await createFilePlan(context.root, [{ path: note.path, content: note.content }]), { workflow: definition.id, path: note.path, run: runRecord }, { kind: 'workflow-record', input });
}
const usage = 'Use workflow list, show --name <id>, check, save --input <workflow.json>, docs [--name <id>], run --name <id> [--target <url|folder>], record --name <id> [--input <report.json>], export --name <id> --out <folder>; workflow new and workflow edit --name <id> run in a terminal.';
type Handler = (args: Arguments, context: TestWorkflowCommandContext) => Promise<Record<string, unknown>>;
const apply = (args: Arguments) => option(args, 'apply') || undefined;
const handlers: Record<string, Handler> = {
  list: async (_args, context) => { const entries = await loadTestWorkflows(context.root); return { workflows: entries.map(summary), status: entries.every(item => !item.issues.length) ? 'ok' : 'failed' }; },
  show: async (args, context) => {
    const entry = await testWorkflowEntry(context.root, option(args, 'name'));
    return { workflow: entry.definition ?? null, summary: summary(entry), data: entry.rows, status: entry.issues.length ? 'failed' : 'ok' };
  },
  check: (_args, context) => check(context),
  save: async (args, context) => {
    const input = option(args, 'input');
    requireSketch(input, 'MAKER_INPUT_REQUIRED', 'Use workflow save --input <workflow.json>; the format is in docs/development/TEST-WORKFLOWS.md.');
    return applyPrepared(await testWorkflowSavePlan(context.root, await readData(resolve(context.root, input))), apply(args));
  },
  docs: async (args, context) => applyPrepared(await docsPlan(context.root, option(args, 'name')), apply(args)),
  run, record: async (args, context) => applyPrepared(await record(args, context), apply(args)),
  export: async (args, context) => {
    const entry = await testWorkflowEntry(context.root, option(args, 'name')), out = option(args, 'out');
    requireSketch(out, 'WORKFLOW_EXPORT_OUT', 'Use workflow export --name <id> --out <test folder>, for example tests/e2e/workflows.');
    return applyPrepared(await testWorkflowExportPlan(context.root, healthyTestWorkflow(entry), entry.context, out), apply(args));
  },
};
/** `node bin/app workflow …` for agents and scripts: discover, check, save, document, run, record and export browser test workflows. */
export async function testWorkflowCommand(args: Arguments, context: TestWorkflowCommandContext): Promise<Record<string, unknown>> {
  requireSketch(Object.hasOwn(handlers, args.action), 'WORKFLOW_COMMAND', interactiveActions.has(args.action) ? `workflow ${args.action || ''} is interactive. ${usage}`.replace('  ', ' ') : usage);
  return handlers[args.action]!(args, context);
}
