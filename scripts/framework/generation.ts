import { join, resolve } from 'node:path';
import { planProject } from '../companion/compiler/plan.ts';
import { projectFiles } from '../companion/compiler/project-files.ts';
import { readConfiguration, readJson, readBounded, hash, exists } from './files.ts';
import { designFile, object } from './configuration.ts';
import { inspectDesign } from './changes.ts';
import { verifyKit } from './kit-integrity.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
export async function generationPlan(request: Request, context: Context) {
  const input = resolve(context.root, stringOption(request.options, 'input') ?? designFile);
  const target = stringOption(request.options, 'target');
  if (target !== undefined) return planProject({ input, target, vault: resolve(context.root, stringOption(request.options, 'vault') ?? '.'), templateRoot: context.frameworkRoot });
  requireThat(request.options.vault === undefined, 'TARGET_REQUIRED', '--vault requires an explicit legacy --target.');
  const config = await readConfiguration(context.root); requireThat(config, 'CONFIG_REQUIRED', 'Run setup and project import first.');
  requireThat(input === resolve(context.root, designFile), 'INPUT_REQUIRES_IMPORT', 'In-place generation compiles the imported ' + designFile + '; run project import to adopt a different file.');
  requireThat(await exists(join(context.root, '.framework/kit.json')), 'KIT_REQUIRED', 'In-place generation requires an extracted, verified framework kit; legacy --vault/--target remains available.');
  const kit = await verifyKit(context.root);
  const { model } = await inspectDesign(context, input);
  requireThat(Object.entries(config.project).every(([key, value]) => model.project[key] === value) && model.sourceRoot === config.paths.codebaseFolder + '/generated' && model.testRoot === config.paths.testsFolder + '/project', 'IMPORT_CONFIG_DRIFT', 'Re-import and resolve the design/configuration differences before generation.');
  const templateRoot = join(context.root, '.framework/template');
  const output = await projectFiles(templateRoot, model);
  const intake = object(await readJson(join(context.root, '.framework/intake.json')));
  const inputHash = hash(await readBounded(join(context.root, designFile), 4_000_000));
  requireThat(intake.schemaVersion === 1 && object(intake.files)[designFile] === inputHash, 'IMPORT_OWNERSHIP', 'The imported design changed outside the reviewed intake operation.');
  const bootstrap = [...kit.bootstrap, { path: designFile, hash: inputHash }];
  const planned = await planProject({ input, vault: context.root, target: '.', templateRoot, output, bootstrap });
  return planned;
}
