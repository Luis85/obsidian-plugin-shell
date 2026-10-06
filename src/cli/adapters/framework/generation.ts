import { createFilePlan } from '../../../../scripts/shared/file-plan.ts';
import { serializeJson as json } from '../../../../scripts/contracts/serialization.ts';
import { parseJsonData } from '../../../../scripts/contracts/json-data.ts';
import { storybookFlags } from './storybook-options.ts';
import { join, resolve } from 'node:path';
import { planProject } from '../../compiler/adapters/project-plan.ts';
import { readConfiguration, readBounded, hash, exists } from './files.ts';
import { designFile, object } from './configuration.ts';
import { inspectDesign } from './changes.ts';
import { kitPresent, verifyKit } from './kit-integrity.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
import { managedGenerationPlan } from './prototype-generation.ts';
export async function generationPlan(request: Request, context: Context) {
  return managedGenerationPlan(request, context, generateSourcePlan);
}
/** In-place generation compiles the imported design with a verified kit whose configuration still matches it. */
async function inPlaceKit(request: Request, context: Context, input: string) {
  const config = await readConfiguration(context.root); requireThat(config, 'CONFIG_REQUIRED', 'Run setup and project import first.');
  requireThat(input === resolve(context.root, designFile), 'INPUT_REQUIRES_IMPORT', 'In-place generation compiles the imported ' + designFile + '; run project import to adopt a different file.');
  requireThat(await kitPresent(context.root), 'KIT_REQUIRED', 'In-place generation requires an extracted, verified framework kit.');
  const kit = await verifyKit(context.root);
  const { model } = await inspectDesign(context, input);
  const identityMatches = Object.entries(config.project).every(([key, value]) => model.project[key] === value);
  const pathsMatch = model.sourceRoot === config.paths.codebaseFolder + '/generated' && model.testRoot === config.paths.testsFolder + '/project';
  requireThat(identityMatches && pathsMatch, 'IMPORT_CONFIG_DRIFT', 'Re-import and resolve the design/configuration differences before generation.');
  return kit;
}
export async function generateSourcePlan(request: Request, context: Context) {
  requireThat(request.options.vault === undefined && request.options.target === undefined, 'INVALID_OPTION', 'Generation runs in the configured project; --vault and --target are not supported.');
  const input = resolve(context.root, stringOption(request.options, 'input') ?? designFile);
  const outputKind = stringOption(request.options, 'output-kind');
  requireThat(outputKind === undefined || ['obsidian-plugin','clickdummy'].includes(outputKind),'INVALID_OUTPUT_KIND','Use obsidian-plugin or clickdummy.');
  const compilation = {storybook:storybookFlags(request.options),outputKind:outputKind as 'obsidian-plugin'|'clickdummy'|undefined,signal:context.signal,scope:stringOption(request.options, 'scope')};
  const kit = await inPlaceKit(request, context, input);
  const templateRoot = join(context.root, 'bin/template');
  const intakePath = '.framework/intake.json';
  const intakeBytes = await readBounded(join(context.root, intakePath));
  const intake = object(parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(intakeBytes)));
  const inputHash = hash(await readBounded(join(context.root, designFile), 4_000_000));
  requireThat(intake.schemaVersion === 1 && object(intake.files)[designFile] === inputHash, 'IMPORT_OWNERSHIP', 'The imported design changed outside the reviewed intake operation.');
  const presentBootstrap = await Promise.all(kit.bootstrap.map(async file => await exists(join(context.root, file.path)) ? file : null));
  const bootstrap = [...presentBootstrap.filter((file): file is { path: string; hash: string } => file !== null), { path: designFile, hash: inputHash }];
  // The kit owns bin/ (its runtime and template); generation never writes the template's own bin sources over it.
  const planned = await planProject({ ...compilation, input, vault: context.root, target: '.', templateRoot, bootstrap, reservedRoot: 'bin' });
  const generatedDesign = planned.plan.changes.find(change => change.path === designFile);
  if (!generatedDesign || generatedDesign.afterHash === inputHash) return planned;
  // Overrides replace the canonical input in this same plan. Both receipts must describe
  // those accepted bytes, not the pre-override input, or the first replay writes again.
  // planned.hash and every beforeHash still bind the original input to the approval.
  const entries = planned.plan.changes.map(({ path, content, encoding }) => {
    if (path !== '.companion/generation.json') return { path, content, ...(encoding ? { encoding } : {}) };
    requireThat(typeof content === 'string' && !encoding, 'GENERATION_RECEIPT_INVALID', 'Expected the generated ownership receipt.');
    return { path, content: json({ ...object(parseJsonData(content)), inputHash: generatedDesign.afterHash }) };
  });
  entries.push({ path: intakePath, content: json({ ...intake, files: { ...object(intake.files), [designFile]: generatedDesign.afterHash } }) });
  const plan = await createFilePlan(context.root, entries);
  requireThat(plan.changes.at(-1)!.beforeHash === hash(intakeBytes) && planned.plan.changes.every((change, i) => change.beforeHash === plan.changes[i]!.beforeHash),
    'PLAN_STALE', 'Input ownership changed while planning the generation override.');
  return { ...planned, plan, hash: hash(json({ generation: planned.hash, changes: plan.changes.map(({ path, beforeHash, afterHash }) => ({ path, beforeHash, afterHash })) })) };
}
