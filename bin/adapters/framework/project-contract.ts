import { resolve } from 'node:path';
import { companionProjectSchema } from '../../../scripts/companion/schema/project.mjs';
import { parseAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { inspectSitemap } from '../../../scripts/companion/sitemap/validate.ts';
import { readBounded, hash } from './files.ts';
import { requireThat, stringOption, result, type Request, type Context } from './contracts.ts';

/** Read-only transport validation, intentionally independent of generation-readiness restrictions. */
export async function projectContractOperation(request: Request, context: Context) {
  if (request.command === 'project schema') {
    const version = stringOption(request.options, 'version');
    requireThat(version === undefined || version === '6', 'SCHEMA_VERSION', 'Only the current project-v6 schema is published; earlier project formats are not supported.');
    return result(request.command, companionProjectSchema());
  }
  const path = stringOption(request.options, 'input');
  requireThat(path, 'INPUT_REQUIRED', 'Supply --input <project.json> or --input - with JSON stdin.');
  requireThat(path !== '-' || context.inputText !== undefined, 'STDIN_REQUIRED', 'Supply JSON on stdin.');
  const text = path === '-' ? context.inputText! : new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(resolve(context.root, path), 4_000_000));
  const document = parseAuthoringDocument(text);
  const findings = inspectSitemap(document.design);
  return result(request.command, { valid: true, inputSha256: hash(text), schemaVersion: document.schemaVersion,
    schemaId: 'urn:obsidian-plugin-shell:companion-project:6',
    counts: { surfaces: document.design.nodes.length, transitions: document.design.links.length,
      routes: document.design.sitemap?.routes.length ?? 0, journeys: document.design.sitemap?.journeys.length ?? 0 },
    findings, generationReadiness: 'not-inferred', written: [], contentIncluded: false });
}
