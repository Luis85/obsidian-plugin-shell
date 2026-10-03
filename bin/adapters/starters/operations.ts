import { defaultVaultConfigDirectory } from '../../domain/host-paths.ts';
import { starterCoverage } from './coverage.ts';
import { basename, dirname, join, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { createFilePlan, applyFilePlan } from '../../../scripts/shared/file-plan.ts';
import { hash, readBounded, exists } from '../framework/files.ts';
import { zip } from '../framework/zip.ts';
import { result, requireThat, stringOption, type Context, type Request } from '../framework/contracts.ts';
import { STARTER_MAX_BYTES } from './browser.ts';
import { loadDefinitions, parseDefinition, starterFolder } from './repository.ts';
import { pluginStarterDefinitions } from '../../../plugins/runtime.ts';
export async function listStarters(context: Context, command = 'starters list') {
  const definitions = await loadDefinitions(context.root), folder = await starterFolder(context.root);
  return result(command, { folder, integrity: 'local-content-sha256; not a signature', starters: definitions.map(({ definition: d, sha256, file }) => ({
    id: d.id, title: d.name, category: d.category, difficulty: d.level, description: d.summary, version: d.version, generator: d.generator.kind, ...(d.generator.kind === 'project' ? { project: { projectType: d.generator.projectType, framework: d.generator.framework, targets: d.generator.targets } } : {}), file, sha256,
    inputs: d.inputs, processes: d.processes.map(process => ({ id: process.id, label: process.label, description: process.description, dependsOn: process.dependsOn })) })),
    ...(definitions.length ? {} : { next: `No starters installed. Extract the separate Workbench starters ZIP into this project (${folder}/), or use starters add --input <definition.json>. The shell contains no fallback definitions.` }) });
}
export async function readStarterOperation(request: Request, context: Context) {
  if (request.command === 'starters list') return listStarters(context);
  if (request.command === 'starters schema') {
    // A release kit keeps the schema as template data beside its bundled CLI; a checkout reads its own source.
    const schema = 'scripts/starters/starter.schema.json';
    let root = context.frameworkRoot;
    if (await exists(join(context.frameworkRoot, 'bin/template', schema))) root = join(context.frameworkRoot, 'bin/template');
    return result(request.command, JSON.parse((await readBounded(join(root, schema))).toString('utf8')));
  }
  const definitions = await loadDefinitions(context.root);
  const id = request.args[0], selected = definitions.filter(entry => !id || entry.definition.id === id);
  requireThat(!id || selected.length === 1, 'STARTER_UNKNOWN', 'Starter not installed; use starters list.');
  requireThat(!['starters show', 'starters coverage'].includes(request.command) || id, 'STARTER_REQUIRED', 'Supply the starter ID.');
  if (request.command === 'starters coverage') {
    const report = starterCoverage(selected[0]!.definition);
    requireThat(!request.options['require-model-coverage'] || report.modeled?.complete, 'STARTER_COVERAGE', 'The definition does not cover the complete visual model catalog. Inspect coverage without --require-model-coverage.');
    return result(request.command, { ...report, sha256: selected[0]!.sha256 });
  }
  return result(request.command, { valid: true, starters: selected.map(({ definition, sha256, file }) => ({ definition, sha256, file })) });
}
/**
 * Validates every installed definition except the target file, so edit can repair a broken target.
 * The target stays bound by the file plan's before-hash; it must still be a regular file.
 */
async function otherDefinitionIds(root: string, folder: string, target: string): Promise<string[]> {
  const path = resolve(root, folder), ids: string[] = [];
  if (!await exists(path)) return ids;
  const entries = await readdir(path, { withFileTypes: true });
  requireThat(entries.length <= 256, 'STARTER_LIMIT', 'A starter folder supports at most 256 entries.');
  let size = 0;
  for (const entry of entries) {
    if (!entry.name.toLowerCase().endsWith('.json')) continue;
    requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json$/.test(entry.name) && entry.isFile() && !entry.isSymbolicLink(), 'STARTER_SOURCE', 'Definitions must be regular lower-case $starterName.json files.');
    if (entry.name === target + '.json') continue;
    const bytes = await readBounded(join(path, entry.name), STARTER_MAX_BYTES); size += bytes.length;
    requireThat(size <= 16_000_000, 'STARTER_LIMIT', 'Starter folder exceeds 16 MB.');
    const definition = parseDefinition(bytes);
    requireThat(definition.id + '.json' === entry.name, 'STARTER_ID', 'Starter ID must match its filename and be unique.');
    ids.push(definition.id);
  }
  return ids;
}
export async function editStarterPlan(request: Request, context: Context) {
  const input = stringOption(request.options, 'input'); requireThat(input, 'INPUT_REQUIRED', 'Supply --input <definition.json>.');
  const bytes = await readBounded(resolve(context.root, input), STARTER_MAX_BYTES), definition = parseDefinition(bytes);
  const folder = await starterFolder(context.root), path = folder + '/' + definition.id + '.json';
  if (request.command === 'starters edit') {
    requireThat(request.args[0] === definition.id, 'STARTER_ID', 'Editing cannot change the ID; add a separate definition instead.');
    requireThat(await exists(join(context.root, path)), 'STARTER_UNKNOWN', 'Starter not installed; use starters add.');
  } else requireThat(!await exists(join(context.root, path)), 'STARTER_EXISTS', 'Starter already exists; use starters edit with a reviewed plan.');
  // Validate every other installed definition as well; no registry or cached index needs updating.
  requireThat(!(await otherDefinitionIds(context.root, folder, definition.id)).includes(definition.id), 'STARTER_ID', 'Starter IDs must be unique.');
  requireThat(!pluginStarterDefinitions().some(starter => starter.id === definition.id), 'STARTER_ID',
    'Starter ID is already contributed by an enabled Workbench plugin: ' + definition.id);
  const plan = await createFilePlan(context.root, [{ path, content: bytes.toString('utf8') }]);
  return { plan, hash: hash(bytes), conflicts: [] as string[], summary: { id: definition.id, file: path, sha256: hash(bytes), processes: 'not-run' } };
}
export async function assembleStarterPack(context: Context) {
  // The standalone starter pack contains data-only file definitions only.
  // Plugin-contributed starters travel with their registered plugin because their
  // framework adapter or other trusted code may be required to use them.
  const entries = await loadDefinitions(context.root, []);
  requireThat(entries.length > 0, 'STARTER_EMPTY', 'No installed starter definitions to package.');
  return entries.map(entry => ({ path: 'configs/starters/' + entry.definition.id + '.json', bytes: entry.bytes }));
}
export async function packStarterOperation(request: Request, context: Context) {
  const output = stringOption(request.options, 'out'); requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <starters.zip>.');
  const target = resolve(context.root, output);
  requireThat(target.endsWith('.zip') && !target.split(/[\\/]/).some(part => ['.git', defaultVaultConfigDirectory, '.framework', 'node_modules'].includes(part.toLowerCase())), 'STARTER_PATH', 'Choose a ZIP outside protected directories.');
  const files = await assembleStarterPack(context), bytes = zip(files);
  const report = { archive: target, sha256: hash(bytes), bytes: bytes.length, starters: files.length, publication: 'not-authorized', definitionFormat: 'configs/starters/$starterName.json' };
  if (!request.options.yes || request.options['dry-run']) return result(request.command, { ...report, requires: '--yes' }, 'planned');
  const plan = await createFilePlan(dirname(target), [{ path: basename(target), content: bytes.toString('base64'), encoding: 'base64' }]);
  requireThat(!plan.changes.some(change => change.status === 'update'), 'STARTER_ARCHIVE_EXISTS', 'Refusing to overwrite a different archive.');
  await applyFilePlan(plan); return result(request.command, report, 'applied');
}
