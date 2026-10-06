import { resolve } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import { keys, list, object, text } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { readForm } from '../domain/form.ts';
import { getPath } from '../domain/form-model.ts';
import { formValueIssues } from '../domain/form-values.ts';
import { processText, readProcess, type ProcessDefinition, type ProcessStep } from '../domain/process.ts';
import { simulateProcess } from '../domain/process-engine.ts';
import { definitionIssues, healthyDefinition, loadProcesses, processCatalogContext, processEntry, processFolder, type ProcessCatalogContext, type ProcessEntry } from './process-catalog.ts';
import { processDocsPlan } from './process-docs-plan.ts';
import { applyPrepared, prepared, readData, type Prepared } from './storage.ts';
/** Actions of `node bin/app process` that ask questions and therefore run only in a terminal. */
const interactiveActions = new Set(['', 'new', 'edit', 'run']);
export function interactiveProcess(args: Arguments): boolean {
  return args.command === 'process' && interactiveActions.has(args.action);
}
function summary(entry: ProcessEntry): Record<string, unknown> {
  const definition = entry.definition, base = { id: entry.id, file: `${processFolder}/${entry.file}` };
  const details = definition ? { title: definition.title, version: definition.version, status: definition.status, owner: definition.owner,
    steps: definition.steps.length, rules: definition.rules.length } : { status: 'invalid' };
  return { ...base, ...details, issues: entry.issues, warnings: entry.warnings };
}
const healthy = (entries: ProcessEntry[]) => entries.every(entry => !entry.issues.length) ? 'ok' : 'failed';
/** Validation of one step's collected input, the same form rules a terminal run enforces while asking. */
function stepInputIssues(context: Pick<ProcessCatalogContext, 'forms'>): (step: ProcessStep, data: unknown) => string[] {
  return (step, data) => {
    const form = step.form ? context.forms.get(step.form) : step.fields ? readForm({ schemaVersion: 1, id: 'inline', version: 1, title: step.title, fields: step.fields }) : undefined;
    if (!form) return [];
    const value = step.bind ? getPath(data, step.bind) ?? {} : data;
    return formValueIssues(form, value, id => context.forms.get(id)).map(issue => `${step.bind ? step.bind + '.' : ''}${issue.field}: ${issue.message}`);
  };
}
/** The one save path for agents and the authoring wizard: full validation, then a reviewed plan for configs/processes/<id>.json. */
export async function processSavePlan(input: unknown, context: ProcessCatalogContext): Promise<Prepared> {
  const definition = readProcess(input), found = await definitionIssues(definition, context);
  requireSketch(!found.issues.length, 'PROCESS_INVALID', `Process ${definition.id} has findings; nothing was planned.\n${found.issues.map(item => item.message).join('\n')}`);
  const path = `${processFolder}/${definition.id}.json`, plan = await createFilePlan(context.root, [{ path, content: processText(definition) }]);
  return prepared(plan, { process: definition.id, path, warnings: found.warnings });
}
function simulationInput(value: unknown): { data: unknown; acknowledge: Set<string> } {
  const item = object(value); keys(item, ['schemaVersion', 'data', 'acknowledge']);
  requireSketch(item.schemaVersion === 1, 'PROCESS_SIMULATION', 'Simulation input needs schemaVersion 1, data and optional acknowledge (warn rule ids).');
  return { data: object(item.data), acknowledge: new Set(list(item.acknowledge ?? [], 'acknowledge', 80).map((rule, index) => text(rule, `acknowledge[${index}]`, 80))) };
}
async function simulate(args: Arguments, context: ProcessCatalogContext, definition: ProcessDefinition, input: unknown): Promise<Record<string, unknown>> {
  const run = simulateProcess(definition, { ...simulationInput(input), inputIssues: stepInputIssues(context) }), out = option(args, 'out');
  if (!out) return { run, status: 'ok' };
  requireSketch(out.endsWith('.json'), 'PROCESS_SIMULATION', 'Use --out <file.json> to save the audit trail.');
  const plan = await createFilePlan(context.root, [{ path: out, content: JSON.stringify(run, null, 2) + '\n' }]);
  return { run, ...await applyPrepared(prepared(plan, { process: definition.id, path: out }), option(args, 'apply') || undefined) };
}
async function named(args: Arguments, context: ProcessCatalogContext): Promise<ProcessEntry> {
  return processEntry(context.root, option(args, 'name'), context);
}
async function inputValue(args: Arguments, root: string, usage: string): Promise<unknown> {
  const input = option(args, 'input');
  requireSketch(input, 'MAKER_INPUT_REQUIRED', usage);
  return readData(resolve(root, input));
}
const usage = 'Use process list, show --name <id>, check, save --input <process.json>, docs --name <id> [--out docs/processes], simulate --name <id> --input <data.json>; process, process new, process edit --name <id> and process run --name <id> run in a terminal.';
type Handler = (args: Arguments, context: ProcessCatalogContext) => Promise<Record<string, unknown>>;
const handlers: Record<string, Handler> = {
  list: async (_args, context) => { const entries = await loadProcesses(context.root, context); return { root: context.root, processes: entries.map(summary), status: healthy(entries) }; },
  check: async (_args, context) => {
    const entries = await loadProcesses(context.root, context);
    return { processes: entries.map(entry => ({ id: entry.id, issues: entry.issues, warnings: entry.warnings })), issues: entries.reduce((total, entry) => total + entry.issues.length, 0), status: healthy(entries) };
  },
  show: async (args, context) => { const entry = await named(args, context); return { process: entry.definition ?? null, summary: summary(entry), docs: [...entry.docs.keys()], status: healthy([entry]) }; },
  save: async (args, context) => applyPrepared(await processSavePlan(await inputValue(args, context.root, 'Use process save --input <process.json>; discover the format in docs/development/BUSINESS-PROCESSES.md.'), context), option(args, 'apply') || undefined),
  docs: async (args, context) => {
    const entry = await named(args, context);
    return applyPrepared(await processDocsPlan(healthyDefinition(entry), context, entry.docs, option(args, 'out') || undefined), option(args, 'apply') || undefined);
  },
  simulate: async (args, context) => {
    const definition = healthyDefinition(await named(args, context));
    return simulate(args, context, definition, await inputValue(args, context.root, 'Use process simulate --name <id> --input <data.json> with {"schemaVersion":1,"data":{},"acknowledge":[]}.'));
  },
};
/** `node bin/app process …` for agents and scripts: discover, check, save, document and simulate data-driven business processes. */
export async function processCommand(args: Arguments, context: { root: string }): Promise<Record<string, unknown>> {
  requireSketch(Object.hasOwn(handlers, args.action), 'PROCESS_COMMAND', interactiveActions.has(args.action) ? `process ${args.action} is interactive. ${usage}` : usage);
  return handlers[args.action]!(args, await processCatalogContext(context.root));
}
