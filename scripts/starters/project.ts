import { parseJsonData } from '../contracts/json-data.ts';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createFilePlan } from '../shared/file-plan.ts';
import { planProject } from '../companion/compiler/plan.ts';
import { customizeStarter } from '../companion/starter-contract.mjs';
import { withAirshipOption } from '../companion/tooling-options.ts';
import { hash, readJson } from '../framework/files.ts';
import { derivedPluginId, pluginIdProblem } from '../framework/plugin-id.ts';
import { storybookFlags } from '../framework/storybook-options.ts';
import { requireThat, stringOption, type Context, type Request } from '../framework/contracts.ts';
import { loadDefinitions, companionCatalog } from './repository.ts';
import { renderFiles, renderProcesses, resolveValues, interpolate } from './render.ts';
import { record, readProcesses } from './validation.ts';
import type { InputValue, StarterReceipt, LoadedStarter } from './types.ts';
export const receiptFile = '.workbench/starter.json';
export interface Placement { directory: string; vault: string; target: string }
async function selectedStarter(request: Request, context: Context): Promise<LoadedStarter> {
  const id = stringOption(request.options, 'starter');
  requireThat(id, 'STARTER_REQUIRED', 'Supply --starter <id>; use starters list to discover local definitions.');
  const definitions = await loadDefinitions(context.root), selected = definitions.find(entry => entry.definition.id === id);
  requireThat(selected, 'STARTER_UNKNOWN', `Starter ${id} is not installed. Extract the separate starters ZIP into this project, or add configs/starters/${id}.json.`);
  return selected;
}
async function starterValues(request: Request, context: Context, selected: LoadedStarter, directory: string): Promise<Record<string, InputValue>> {
  const input = stringOption(request.options, 'values');
  const source = input ? record(await readJson(resolve(context.root, input))) : {};
  const inline = stringOption(request.options, 'answers');
  requireThat(!inline || !input, 'STARTER_INPUT', 'Use --values or --answers, not both.');
  if (inline) Object.assign(source, record(parseJsonData(inline)));
  for (const key of ['id', 'name', 'author']) if (request.options[key] !== undefined) source[key] = stringOption(request.options, key);
  const fallback = selected.definition.generator.kind === 'companion' ? String(record(selected.definition.generator.document.project).id) : selected.definition.id;
  const id = source.id ?? derivedPluginId(basename(directory), fallback);
  source.id = id; source.name ??= String(id).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const values = resolveValues(selected.definition, source);
  if (selected.definition.generator.kind === 'companion') {
    const problem = pluginIdProblem(String(values.id)); requireThat(!problem, 'INVALID_PLUGIN_ID', problem ?? 'Invalid plugin ID.');
  }
  return values;
}
export async function definitionProjectPlan(request: Request, context: Context, place: Placement, template: string) {
  const selected = await selectedStarter(request, context), d = selected.definition;
  requireThat(d.generator.kind !== 'project', 'STARTER_KIND', `${d.id} is a project starter; it is prepared with a prototype interview, not a target directory. Run node bin/app new --starter ${d.id}, or new guide --starter ${d.id} --json for agents.`);
  const values = await starterValues(request, context, selected, place.directory);
  const processes = readProcesses(renderProcesses(d, values));
  const requested = stringOption(request.options, 'run');
  requireThat(!(requested && request.options.install), 'STARTER_PROCESS', 'Use --run or --install, not both.');
  const run = requested ? requested.split(',') : request.options.install ? [...d.firstRun] : [];
  requireThat(run.every(id => processes.some(item => item.id === id)) && new Set(run).size === run.length, 'STARTER_PROCESS', 'Unknown or duplicate process selection.');
  requireThat(!request.options.install || run.length > 0, 'STARTER_PROCESS', 'This definition has no firstRun; choose --run <process>.');
  requireThat(!run.length || request.options['dry-run'] || !(request.options.yes || request.options.apply) || request.options['trust-processes'] === true, 'STARTER_TRUST', 'Review the declared processes and explicitly pass --trust-processes before creating and running them.');
  const starter = { id: d.id, name: d.name, version: d.version, sha256: selected.sha256 };
  const extra = renderFiles(d, values).map(file => ({ ...file, path: place.target + '/' + file.path }));
  let plan = await createFilePlan(place.vault, extra), conflicts: string[] = [], acceptanceTodos = 0, warnings: string[] = [];
  let compilerHash = '';
  if (d.generator.kind === 'companion') {
    const customization: Record<string, string> = {};
    for (const key of ['id', 'name', 'author', 'version', 'description', 'codebaseFolder', 'testsFolder', 'extension', 'extensions']) if (values[key] !== undefined) customization[key] = String(values[key]);
    for (const key of ['extension', 'extensions']) if (request.options[key] !== undefined) customization[key] = stringOption(request.options, key)!;
    const document = withAirshipOption(customizeStarter(companionCatalog([selected]), d.id, customization), request.options);
    const scratch = await mkdtemp(join(tmpdir(), 'workbench-starter-'));
    try {
      const input = join(scratch, 'project.json'); await writeFile(input, JSON.stringify(document) + '\n', { flag: 'wx' });
      const generated = await planProject({ input, vault: place.vault, target: place.target, templateRoot: template, storybook: storybookFlags(request.options), signal: context.signal });
      plan = await createFilePlan(place.vault, [...generated.plan.changes.map(change => ({ path: change.path, content: change.content, ...(change.encoding ? { encoding: change.encoding } : {}) })), ...extra]);
      conflicts = generated.conflicts; acceptanceTodos = generated.summary.acceptanceTodos; warnings = generated.summary.warnings; compilerHash = generated.hash;
    } finally { await rm(scratch, { recursive: true, force: true }); }
  } else {
    requireThat(['extension', 'extensions', 'airship', 'no-airship', 'storybook', 'storybook-stories'].every(key => request.options[key] === undefined), 'STARTER_OPTION', 'Companion-only options do not apply to this file starter.');
  }
  const receipt: StarterReceipt = { schemaVersion: 1, starter, values, processes, firstRun: d.firstRun,
    nextSteps: d.nextSteps.map(step => interpolate(step, values)),
    files: plan.changes.map(change => ({ path: change.path.slice(place.target.length + 1), sha256: change.afterHash! })) };
  const content = JSON.stringify(receipt, null, 2) + '\n';
  plan = await createFilePlan(place.vault, [...plan.changes.map(change => ({ path: change.path, content: change.content, ...(change.encoding ? { encoding: change.encoding } : {}) })), { path: place.target + '/' + receiptFile, content }]);
  return { plan, conflicts, hash: hash(JSON.stringify({ source: selected.sha256, values, compilerHash })),
    summary: { starter: { ...starter, title: d.name }, identity: { id: String(values.id), name: String(values.name), author: String(values.author ?? '') },
      directory: place.directory, vault: place.vault, target: place.target, files: plan.changes.length, acceptanceTodos, warnings,
      recipe: { source: selected.file, sha256: selected.sha256, receiptSha256: hash(content), generator: d.generator.kind, processes, run, nextSteps: receipt.nextSteps } } };
}
