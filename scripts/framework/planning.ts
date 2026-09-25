import { serializeJson as json } from '../contracts/serialization.ts';
import { join, resolve, relative, isAbsolute, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
import { parseArguments as makerArguments, builtinRecipes } from '../makers/arguments.mjs';
import { canonicalRequest, validateRequest, descriptor } from './catalog.ts';
import { configurationPlan, vaultPlan, releaseVersionPlan } from './changes.ts';
import { generationPlan } from './generation.ts';
import { styleExportPlan } from './styles.ts';
import { upgradePlan } from './kit.ts';
import { configFile, object } from './configuration.ts';
import { readConfiguration, readJson, readBounded, hash, exists } from './files.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
type FilePlan = Awaited<ReturnType<typeof createFilePlan>>;
interface Planned { plan: FilePlan; summary: unknown; conflicts: string[]; hash?: string }
async function makerPlan(request: Request, context: Context): Promise<Planned> {
  const [recipe, name] = request.args;
  requireThat(recipe && name, 'MAKER_INPUT_REQUIRED', 'Supply a recipe and name; use make list for discovery.');
  requireThat(builtinRecipes.includes(recipe) || request.options['trust-custom'] === true, 'CUSTOM_TRUST_REQUIRED', 'A custom maker executes local code; pass --trust-custom after review.');
  const args = [recipe, name];
  const fields = descriptor('make').options;
  for (const [key, value] of Object.entries(request.options)) if (Object.hasOwn(fields, key) && !['list', 'trust-custom'].includes(key)) { args.push('--' + key); if (typeof value === 'string') args.push(value); }
  const { planMaker } = await import('../makers/plan.mjs');
  const planned = await planMaker(context.root, makerArguments(args));
  return { plan: planned.plan, summary: { maker: planned.maker, checks: planned.checks.map(check => ({ ...check, status: 'not-run' })) }, conflicts: [] };
}
async function pluginPlan(context: Context): Promise<Planned> {
  const config = await readConfiguration(context.root); requireThat(config, 'CONFIG_REQUIRED', 'Run setup first.');
  requireThat(config.paths.testVaultFolder !== '.dev-vault', 'LEGACY_VAULT', 'Use the existing build:local installer for .dev-vault.');
  const manifestBytes = await readBounded(join(context.root, 'dist/manifest.json'));
  const manifest = object(JSON.parse(manifestBytes.toString('utf8')));
  requireThat(manifest.version === config.project.version, 'PLUGIN_VERSION', 'Build again after changing the configured version.');
  const vault = await readJson(join(context.root, config.paths.testVaultFolder, '.framework-vault.json'));
  requireThat(object(vault).projectId === config.project.id, 'VAULT_REQUIRED', 'Prepare this isolated test vault before installation.');
  requireThat(manifest.id === config.project.id, 'PLUGIN_IDENTITY', 'Built plugin ID differs from the configured project.');
  const prefix = `${config.paths.testVaultFolder}/${config.paths.configDirectory}/plugins/${config.project.id}/`;
  const installed = join(context.root, prefix, 'manifest.json');
  if (await exists(installed)) requireThat(object(await readJson(installed)).id === config.project.id, 'INSTALLED_IDENTITY', 'Existing installation belongs to another plugin.');
  const entries = [];
  for (const name of ['main.js', 'manifest.json', 'styles.css']) {
    if (name === 'styles.css' && !await exists(join(context.root, 'dist', name))) {
      requireThat(!await exists(join(context.root, prefix, name)), 'STALE_STYLE', 'The build no longer emits styles.css; review removal of the old installed stylesheet separately.');
      continue;
    }
    const bytes = await readBounded(join(context.root, 'dist', name), 8_000_000);
    requireThat(bytes.length > 0, 'EMPTY_ASSET', 'Refusing an empty build artifact.');
    entries.push({ path: prefix + name, content: bytes.toString('base64'), encoding: 'base64' });
  }
  return { plan: await createFilePlan(context.root, entries), conflicts: [], summary: { plugin: manifest.id, activation: 'manual', dataJson: 'preserved', target: prefix } };
}
export async function planOperation(request: Request, context: Context) {
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  let planned: Planned;
  switch (request.command) {
    case 'setup': case 'config set': case 'project import': planned = await configurationPlan(request, context); break;
    case 'generate': planned = await generationPlan(request, context); break;
    case 'styles export': planned = await styleExportPlan(request, context); break;
    case 'make': planned = await makerPlan(request, context); break;
    case 'vault prepare': planned = await vaultPlan(context); break;
    case 'plugin install': planned = await pluginPlan(context); break;
    case 'release prepare': planned = await releaseVersionPlan(request, context); break;
    case 'framework upgrade': {
      const from = stringOption(request.options, 'from'); requireThat(from, 'INPUT_REQUIRED', 'Supply --from <extracted-kit>.');
      planned = await upgradePlan(context, from); break;
    }
    default: throw new Error('Operation has no file plan.');
  }
  const requestData = canonicalRequest(request);
  const configurationHash = await exists(join(context.root, configFile)) ? hash(await readBounded(join(context.root, configFile))) : null;
  const changes = planned.plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash }));
  const binding = { protocolVersion: 1, root: context.root, request: requestData, configurationHash,
    generatorHash: planned.hash ?? null, changes, conflicts: planned.conflicts };
  return { ...planned, request: requestData, planHash: hash(json(binding)), review: { planHash: hash(json(binding)), summary: planned.summary, conflicts: planned.conflicts, changes } };
}
export async function applyOperation(planned: Awaited<ReturnType<typeof planOperation>>, context: Context, expected: string) {
  requireThat(planned.planHash === expected, 'PLAN_STALE', 'The reviewed plan is stale; inspect a new plan.');
  requireThat(planned.conflicts.length === 0, 'PLAN_CONFLICT', 'Resolve generation conflicts without overwriting edited files.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled before writing.');
  // Recompute through the same handler: config/input/kit changes invalidate API-held plans too.
  const fresh = await planOperation(planned.request, context);
  requireThat(fresh.planHash === expected && fresh.conflicts.length === 0, 'PLAN_STALE', 'Inputs changed after review; inspect a new plan.');
  return applyFilePlan(fresh.plan, { beforeWrite() { requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled; preserve the recovery outcome.'); } });
}
export async function savePlan(context: Context, planned: Awaited<ReturnType<typeof planOperation>>, output: string) {
  requireThat(planned.request.options.input !== '-', 'STDIN_PLAN_NOT_REPLAYABLE', 'Save the input to a file before exporting a replayable plan.');
  requireThat(planned.request.options['trust-custom'] !== true, 'CUSTOM_PLAN_NOT_PORTABLE', 'Custom maker trust cannot be serialized as approval.');
  const path = resolve(context.root, output);
  const local = relative(context.root, path);
  requireThat(local && !isAbsolute(local) && !local.split(sep).some(part => ['..', '.framework', '.companion', '.test-vault', '.obsidian'].includes(part.toLowerCase())), 'PLAN_OUTPUT_PROTECTED', 'Store plans inside the project, outside framework and ownership directories.');
  requireThat(!planned.plan.changes.some(change => change.path.toLowerCase() === local.split(sep).join('/').toLowerCase()), 'PLAN_OUTPUT_COLLISION', 'A saved plan cannot occupy one of its output paths.');
  const config = await readConfiguration(context.root);
  requireThat(!config || !local.split(sep).some(part => part.toLowerCase() === config.paths.testVaultFolder.toLowerCase()), 'PLAN_OUTPUT_PROTECTED', 'Saved plans must remain outside the configured test vault.');
  const content = json({ protocolVersion: 1, root: context.root, request: planned.request, planHash: planned.planHash });
  const write = await createFilePlan(context.root, [{ path: local.split(sep).join('/'), content }]);
  requireThat(!write.changes.some(change => change.status === 'update'), 'PLAN_FILE_EXISTS', 'Refusing to replace an existing plan file.');
  await applyFilePlan(write); return path;
}
export async function loadPlan(context: Context, input: string) {
  const stored = object(await readJson(resolve(context.root, input)));
  requireThat(Object.keys(stored).every(key => ['protocolVersion', 'root', 'request', 'planHash'].includes(key)) && stored.protocolVersion === 1 && stored.root === context.root && typeof stored.planHash === 'string' && /^[a-f0-9]{64}$/.test(stored.planHash), 'PLAN_INVALID', 'Invalid, incompatible or wrong-root saved plan.');
  const request = validateRequest(stored.request);
  requireThat(descriptor(request.command).effect === 'plan' && !request.command.startsWith('plan ') && request.options['trust-custom'] !== true && JSON.stringify(request) === JSON.stringify(canonicalRequest(request)), 'PLAN_AUTHORITY', 'Saved plans contain canonical requests, never executable content or approvals.');
  const planned = await planOperation(request, context);
  requireThat(planned.planHash === stored.planHash, 'PLAN_STALE', 'The saved plan no longer matches current source/configuration/target.');
  return planned;
}
