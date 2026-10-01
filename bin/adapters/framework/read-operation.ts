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
import { prototypesRead, prototypesCompare } from '../../../scripts/framework/prototypes.ts';
import { inspectStyles } from './styles.ts';
import { inspectConcept } from '../../../scripts/framework/concepts.ts';
import { supportReport } from './support-report.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';

export async function readOperation(request: Request, context: Context): Promise<Result> {
  if (request.command === 'prototypes list') return result(request.command, await prototypesRead(context));
  if (request.command === 'prototypes compare') return result(request.command, await prototypesCompare(request, context));
  if (request.command === 'handout validate' || request.command === 'handout inspect') return handoutRead(request, context);
  if (request.command === 'project measure') return measureProject(request, context);
  if (request.command === 'support report') return supportReport(context);
  if (['project schema', 'project validate'].includes(request.command)) return projectContractOperation(request, context);
  if (request.command === 'concept schema') return result(request.command, conceptSchema());
  if (request.command === 'concept inspect') return result(request.command, await inspectConcept(request, context));
  if (request.command === 'version') {
    const kit = await exists(join(context.frameworkRoot, '.framework/kit.json'));
    const metadata = await readJson(join(context.frameworkRoot, kit ? '.framework/kit.json' : 'package.json')) as { version?: string };
    return result(request.command, {
      frameworkVersion: metadata.version,
      nodeVersion: process.version,
      protocolVersion: 1,
      distribution: kit ? 'compiled-kit' : 'source',
    });
  }
  if (request.command === 'styles inspect') return result(request.command, await inspectStyles(request, context));
  if (request.command.startsWith('config ')) {
    return result(request.command, {
      configuration: await readConfiguration(context.root),
      source: 'shell.config.json',
      identityAuthority: 'manifest.json after generation',
      overrides: 'none',
    });
  }
  if (request.command === 'project inspect') {
    const input = stringOption(request.options, 'input');
    requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json>.');
    const { model, source } = await inspectDesign(context, input);
    return result(request.command, {
      schemaVersion: source.document.schemaVersion,
      project: model.project,
      entities: model.entities.length,
      sources: model.sources.length,
      screens: model.screens.length,
      components: model.components.length,
      acceptanceObligations: model.requirements.length,
      warnings: model.warnings,
      sitemap: inspectSitemapSummary(source.document.design),
    });
  }
  if (request.command === 'framework status') {
    const kit = await verifyKit(context.root);
    return result(request.command, {
      version: kit.version,
      sourceHash: kit.sourceHash,
      compilerVersion: kit.compilerVersion,
      verifiedFiles: kit.files.length,
      authenticity: 'checksums-are-not-signatures',
    });
  }
  if (request.command === 'release check') return releaseCheck(context, stringOption(request.options, 'input'));
  return status(context, request.command);
}
