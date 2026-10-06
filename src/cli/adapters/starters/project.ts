import { parseJsonData } from '../../../../scripts/contracts/json-data.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { planProject } from '../../compiler/adapters/project-plan.ts';
import { customizeStarter } from './customize.ts';
import { withAirshipOption } from '../../../../scripts/companion/tooling-options.ts';
import { hostingFlags, hostingSummary, withHostingFlags } from '../framework/hosting-options.ts';
import { hash, readJson } from '../framework/files.ts';
import { derivedPluginId, pluginIdProblem } from '../framework/plugin-id.ts';
import { storybookFlags } from '../framework/storybook-options.ts';
import { requireThat, stringOption, type Context, type Request } from '../framework/contracts.ts';
import { loadDefinitions } from './repository.ts';
import { renderFiles, renderProcesses, resolveValues, interpolate } from './render.ts';
import { record, readProcesses } from './validation.ts';
import type { InputValue, StarterReceipt, LoadedStarter, StarterDefinition, StarterProcess } from './types.ts';
import type { FilePlan } from '../../../../scripts/shared/file-plan.ts';
export const receiptFile = '.workbench/starter.json';
export interface Placement { directory: string; vault: string; target: string }
async function selectedStarter(request: Request, context: Context): Promise<LoadedStarter> {
  const id = stringOption(request.options, 'starter');
  requireThat(id, 'STARTER_REQUIRED', 'Supply --starter <id>; use starters list to discover local definitions.');
  const definitions = await loadDefinitions(context.root), selected = definitions.find(entry => entry.definition.id === id);
  requireThat(selected, 'STARTER_UNKNOWN', `Starter ${id} is not installed. Extract the separate starters ZIP into this project, or add configs/starters/${id}.json.`);
  return selected;
}
/** --values file or --answers JSON (not both), then the explicit identity options. */
async function suppliedValues(request: Request, context: Context): Promise<Record<string, unknown>> {
  const input = stringOption(request.options, 'values');
  const source = input ? record(await readJson(resolve(context.root, input))) : {};
  const inline = stringOption(request.options, 'answers');
  requireThat(!inline || !input, 'STARTER_INPUT', 'Use --values or --answers, not both.');
  if (inline) Object.assign(source, record(parseJsonData(inline)));
  for (const key of ['id', 'name', 'author']) if (request.options[key] !== undefined) source[key] = stringOption(request.options, key);
  return source;
}
async function starterValues(request: Request, context: Context, selected: LoadedStarter, directory: string): Promise<Record<string, InputValue>> {
  const source = await suppliedValues(request, context);
  const fallback = selected.definition.generator.kind === 'companion' ? String(record(selected.definition.generator.document.project).id) : selected.definition.id;
  const id = source.id ?? derivedPluginId(basename(directory), fallback);
  source.id = id; source.name ??= String(id).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const values = resolveValues(selected.definition, source);
  if (selected.definition.generator.kind === 'companion') {
    const problem = pluginIdProblem(String(values.id)); requireThat(!problem, 'INVALID_PLUGIN_ID', problem ?? 'Invalid plugin ID.');
  }
  return values;
}
/** The processes to run after creation: --run <ids>, --install (the definition's firstRun) or none; running needs explicit trust. */
function selectedRun(request: Request, d: StarterDefinition, processes: StarterProcess[]): string[] {
  const requested = stringOption(request.options, 'run');
  requireThat(!(requested && request.options.install), 'STARTER_PROCESS', 'Use --run or --install, not both.');
  const run = requested ? requested.split(',') : request.options.install ? [...d.firstRun] : [];
  requireThat(run.every(id => processes.some(item => item.id === id)) && new Set(run).size === run.length, 'STARTER_PROCESS', 'Unknown or duplicate process selection.');
  requireThat(!request.options.install || run.length > 0, 'STARTER_PROCESS', 'This definition has no firstRun; choose --run <process>.');
  requireThat(!run.length || request.options['dry-run'] || !(request.options.yes || request.options.apply) || request.options['trust-processes'] === true, 'STARTER_TRUST', 'Review the declared processes and explicitly pass --trust-processes before creating and running them.');
  return run;
}
type Change = FilePlan['changes'][number];
const planned = (change: Change) => ({ path: change.path, content: change.content, ...(change.encoding ? { encoding: change.encoding } : {}) });
interface GeneratedPlan { plan: FilePlan; conflicts: string[]; acceptanceTodos: number; warnings: string[]; compilerHash: string; hosting?: ReturnType<typeof hostingSummary> }
/** Compiles the identity-customized Companion document through the project compiler, then adds the starter's extra files. */
async function companionPlan(request: Request, context: Context, place: Placement, template: string, selected: LoadedStarter, values: Record<string, InputValue>, extra: { path: string; content: string }[]): Promise<GeneratedPlan> {
  const customization: Record<string, string> = {};
  for (const key of ['id', 'name', 'author', 'version', 'description', 'codebaseFolder', 'testsFolder', 'extension', 'extensions']) if (values[key] !== undefined) customization[key] = String(values[key]);
  for (const key of ['extension', 'extensions']) if (request.options[key] !== undefined) customization[key] = stringOption(request.options, key)!;
  const document = withHostingFlags(withAirshipOption(customizeStarter(selected, customization), request.options), request.options);
  const scratch = await mkdtemp(join(tmpdir(), 'workbench-starter-'));
  try {
    const input = join(scratch, 'project.json'); await writeFile(input, JSON.stringify(document) + '\n', { flag: 'wx' });
    const generated = await planProject({ input, vault: place.vault, target: place.target, templateRoot: template, storybook: storybookFlags(request.options), signal: context.signal });
    const plan = await createFilePlan(place.vault, [...generated.plan.changes.map(planned), ...extra]);
    return { plan, conflicts: generated.conflicts, acceptanceTodos: generated.summary.acceptanceTodos, warnings: generated.summary.warnings, compilerHash: generated.hash, hosting: hostingSummary(document) };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
/** A file starter plans only its rendered files; Companion-only options are refused. */
function filesPlan(request: Request, plan: FilePlan): GeneratedPlan {
  requireThat(['extension', 'extensions', 'airship', 'no-airship', 'storybook', 'storybook-stories', ...hostingFlags].every(key => request.options[key] === undefined), 'STARTER_OPTION', 'Companion-only options do not apply to this file starter.');
  return { plan, conflicts: [], acceptanceTodos: 0, warnings: [], compilerHash: '' };
}
export async function definitionProjectPlan(request: Request, context: Context, place: Placement, template: string) {
  const selected = await selectedStarter(request, context), d = selected.definition;
  requireThat(d.generator.kind !== 'project', 'STARTER_KIND', `${d.id} is a project starter; it is prepared with a prototype interview, not a target directory. Run node bin/app new --starter ${d.id}, or new guide --starter ${d.id} --json for agents.`);
  const values = await starterValues(request, context, selected, place.directory);
  const processes = readProcesses(renderProcesses(d, values));
  const run = selectedRun(request, d, processes);
  const starter = { id: d.id, name: d.name, version: d.version, sha256: selected.sha256 };
  const extra = renderFiles(d, values).map(file => ({ ...file, path: place.target + '/' + file.path }));
  // The rendered files are planned (and so validated) before any compilation, for both generators.
  const rendered = await createFilePlan(place.vault, extra);
  const { plan: files, conflicts, acceptanceTodos, warnings, compilerHash, hosting } = d.generator.kind === 'companion'
    ? await companionPlan(request, context, place, template, selected, values, extra) : filesPlan(request, rendered);
  const receipt: StarterReceipt = { schemaVersion: 1, starter, values, processes, firstRun: d.firstRun,
    nextSteps: d.nextSteps.map(step => interpolate(step, values)),
    files: files.changes.map(change => ({ path: change.path.slice(place.target.length + 1), sha256: change.afterHash! })) };
  const content = JSON.stringify(receipt, null, 2) + '\n';
  const plan = await createFilePlan(place.vault, [...files.changes.map(planned), { path: place.target + '/' + receiptFile, content }]);
  return { plan, conflicts, hash: hash(JSON.stringify({ source: selected.sha256, values, compilerHash })),
    summary: { starter: { ...starter, title: d.name }, identity: { id: String(values.id), name: String(values.name), author: String(values.author ?? '') },
      directory: place.directory, vault: place.vault, target: place.target, files: plan.changes.length, acceptanceTodos, warnings, ...(hosting ? { hosting } : {}),
      recipe: { source: selected.file, sha256: selected.sha256, receiptSha256: hash(content), generator: d.generator.kind, processes, run, nextSteps: receipt.nextSteps } } };
}
