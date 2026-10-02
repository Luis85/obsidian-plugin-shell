import { join } from 'node:path';
import { conceptSchema } from '../../../scripts/companion/concepts/contract.ts';
import { inspectSitemapSummary } from '../../../scripts/companion/sitemap/summary.ts';
import { handoutRead } from './handout-adapter.ts';
import { inspectDesign } from '../../../scripts/framework/changes.ts';
import { readConfiguration, readJson, exists } from './files.ts';
import { status, releaseCheck } from './inspection.ts';
import { verifyKit } from '../../../scripts/framework/kit-integrity.ts';
import { measureProject } from './project-measure.ts';
import { projectContractOperation } from './project-contract.ts';
import { prototypesRead, prototypesCompare } from './prototypes.ts';
import { inspectStyles } from './styles.ts';
import { inspectConcept } from './concepts.ts';
import { supportReport } from './support-report.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';

async function versionInfo(context: Context) {
  const kit = await exists(join(context.frameworkRoot, '.framework/kit.json'));
  const metadata = await readJson(join(context.frameworkRoot, kit ? '.framework/kit.json' : 'package.json')) as { version?: string };
  return { frameworkVersion: metadata.version, nodeVersion: process.version, protocolVersion: 1, distribution: kit ? 'compiled-kit' : 'source' };
}
async function configurationInfo(context: Context) {
  return { configuration: await readConfiguration(context.root), source: 'shell.config.json', identityAuthority: 'manifest.json after generation', overrides: 'none' };
}
async function projectInspection(request: Request, context: Context) {
  const input = stringOption(request.options, 'input');
  requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json>.');
  const { model, source } = await inspectDesign(context, input);
  return {
    schemaVersion: source.document.schemaVersion,
    project: model.project,
    entities: model.entities.length,
    sources: model.sources.length,
    screens: model.screens.length,
    components: model.components.length,
    acceptanceObligations: model.requirements.length,
    warnings: model.warnings,
    sitemap: inspectSitemapSummary(source.document.design),
  };
}
async function frameworkStatus(context: Context) {
  const kit = await verifyKit(context.root);
  return { version: kit.version, sourceHash: kit.sourceHash, compilerVersion: kit.compilerVersion, verifiedFiles: kit.files.length, authenticity: 'checksums-are-not-signatures' };
}
type Reader = (request: Request, context: Context) => Promise<Result> | Result;
/** Read-only commands whose data is wrapped in a plain result envelope. */
const dataReaders: Record<string, (request: Request, context: Context) => Promise<unknown> | unknown> = {
  'prototypes list': (_request, context) => prototypesRead(context),
  'prototypes compare': prototypesCompare,
  'concept schema': () => conceptSchema(),
  'concept inspect': inspectConcept,
  version: (_request, context) => versionInfo(context),
  'styles inspect': inspectStyles,
  'project inspect': projectInspection,
  'framework status': (_request, context) => frameworkStatus(context),
};
/** Read-only commands that build their own result (status, diagnostics). */
const resultReaders: Record<string, Reader> = {
  'handout validate': handoutRead, 'handout inspect': handoutRead,
  'project measure': measureProject,
  'support report': (_request, context) => supportReport(context),
  'project schema': projectContractOperation, 'project validate': projectContractOperation,
  'release check': (request, context) => releaseCheck(context, stringOption(request.options, 'input')),
};
export async function readOperation(request: Request, context: Context): Promise<Result> {
  const command = request.command;
  if (Object.hasOwn(resultReaders, command)) return resultReaders[command]!(request, context);
  if (Object.hasOwn(dataReaders, command)) return result(command, await dataReaders[command]!(request, context));
  if (command.startsWith('config ')) return result(command, await configurationInfo(context));
  return status(context, command);
}
