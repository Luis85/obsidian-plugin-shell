import { starterCoverage } from './coverage.ts';
import { basename, dirname, join, resolve } from 'node:path';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
import { hash, readBounded, exists } from '../framework/files.ts';
import { zip } from '../framework/zip.ts';
import { result, requireThat, stringOption, type Context, type Request } from '../framework/contracts.ts';
import { STARTER_MAX_BYTES } from './browser.ts';
import { loadDefinitions, parseDefinition, starterFolder } from './repository.ts';
export async function listStarters(context: Context, command = 'starters list') {
  const definitions = await loadDefinitions(context.root), folder = await starterFolder(context.root);
  return result(command, { folder, integrity: 'local-content-sha256; not a signature', starters: definitions.map(({ definition: d, sha256, file }) => ({
    id: d.id, title: d.name, category: d.category, difficulty: d.level, description: d.summary, version: d.version, generator: d.generator.kind, file, sha256,
    inputs: d.inputs, processes: d.processes.map(process => ({ id: process.id, label: process.label, description: process.description, dependsOn: process.dependsOn })) })),
    ...(definitions.length ? {} : { next: `No starters installed. Extract the separate Workbench starters ZIP into this project (${folder}/), or use starters add --input <definition.json>. The shell contains no fallback definitions.` }) });
}
export async function readStarterOperation(request: Request, context: Context) {
  if (request.command === 'starters list') return listStarters(context);
  if (request.command === 'starters schema') {
    const root = await exists(join(context.frameworkRoot, '.framework/compiled/scripts/starters/starter.schema.json')) ? join(context.frameworkRoot, '.framework/compiled') : context.frameworkRoot;
    return result(request.command, JSON.parse((await readBounded(join(root, 'scripts/starters/starter.schema.json'))).toString('utf8')));
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
export async function editStarterPlan(request: Request, context: Context) {
  const input = stringOption(request.options, 'input'); requireThat(input, 'INPUT_REQUIRED', 'Supply --input <definition.json>.');
  const bytes = await readBounded(resolve(context.root, input), STARTER_MAX_BYTES), definition = parseDefinition(bytes);
  const folder = await starterFolder(context.root), path = folder + '/' + definition.id + '.json';
  if (request.command === 'starters edit') {
    requireThat(request.args[0] === definition.id, 'STARTER_ID', 'Editing cannot change the ID; add a separate definition instead.');
    requireThat(await exists(join(context.root, path)), 'STARTER_UNKNOWN', 'Starter not installed; use starters add.');
  } else requireThat(!await exists(join(context.root, path)), 'STARTER_EXISTS', 'Starter already exists; use starters edit with a reviewed plan.');
  // Validate every installed definition as well; no registry or cached index needs updating.
  await loadDefinitions(context.root);
  const plan = await createFilePlan(context.root, [{ path, content: bytes.toString('utf8') }]);
  return { plan, hash: hash(bytes), conflicts: [] as string[], summary: { id: definition.id, file: path, sha256: hash(bytes), processes: 'not-run' } };
}
export async function assembleStarterPack(context: Context) {
  const entries = await loadDefinitions(context.root);
  requireThat(entries.length > 0, 'STARTER_EMPTY', 'No installed starter definitions to package.');
  return entries.map(entry => ({ path: 'configs/starters/' + entry.definition.id + '.json', bytes: entry.bytes }));
}
export async function packStarterOperation(request: Request, context: Context) {
  const output = stringOption(request.options, 'out'); requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <starters.zip>.');
  const target = resolve(context.root, output);
  requireThat(target.endsWith('.zip') && !target.split(/[\\/]/).some(part => ['.git', '.obsidian', '.framework', 'node_modules'].includes(part.toLowerCase())), 'STARTER_PATH', 'Choose a ZIP outside protected directories.');
  const files = await assembleStarterPack(context), bytes = zip(files);
  const report = { archive: target, sha256: hash(bytes), bytes: bytes.length, starters: files.length, publication: 'not-authorized', definitionFormat: 'configs/starters/$starterName.json' };
  if (!request.options.yes || request.options['dry-run']) return result(request.command, { ...report, requires: '--yes' }, 'planned');
  const plan = await createFilePlan(dirname(target), [{ path: basename(target), content: bytes.toString('base64'), encoding: 'base64' }]);
  requireThat(!plan.changes.some(change => change.status === 'update'), 'STARTER_ARCHIVE_EXISTS', 'Refusing to overwrite a different archive.');
  await applyFilePlan(plan); return result(request.command, report, 'applied');
}
