import { resolve } from 'node:path';
import { parseAuthoringDocument, type AuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { sitemapProjection } from '../../../../scripts/companion/sitemap/projection.ts';
import { arrangeSitemap } from '../../../../scripts/companion/sitemap/arrangement.ts';
import { readBounded, hash } from './files.ts';
import { measureOperation } from './measurement.ts';
import { result, requireThat, stringOption, type Request, type Context } from './contracts.ts';

async function measuredInput(context: Context, input: string): Promise<string> {
  requireThat(input !== '-' || context.inputText !== undefined, 'STDIN_REQUIRED', 'Supply JSON on stdin.');
  if (input === '-') return context.inputText!;
  return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(resolve(context.root, input), 4_000_000));
}
function designCounts(design: AuthoringDocument['design']) {
  return { surfaces: design.nodes.length, transitions: design.links.length,
    routes: design.sitemap?.routes.length ?? 0, journeys: design.sitemap?.journeys.length ?? 0 };
}
/** Explicit local measurement, never code execution from the imported document. */
export async function measureProject(request: Request, context: Context) {
  const input = stringOption(request.options, 'input');
  const samples = stringOption(request.options, 'samples') ?? '10';
  const count = Number(samples);
  requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json> or --input - with JSON stdin.');
  requireThat(/^(?:[3-9]|[12]\d|30)$/.test(samples) && Number.isInteger(count) && count >= 3 && count <= 30, 'MEASUREMENT_COUNT', 'Choose 3 to 30 measured samples.');
  const operations = ['import-validate', 'export-json', 'hierarchy-projection', 'arrange-proposal'];
  if (request.options['dry-run']) return result(request.command, { execution: 'not-run', operations, samples: count, written: [], network: false }, 'planned');
  const text = await measuredInput(context, input);
  const document = parseAuthoringDocument(text);
  const heapBeforeBytes = process.memoryUsage().heapUsed;
  const actions = [
    () => parseAuthoringDocument(text),
    () => JSON.stringify(document),
    () => sitemapProjection(document.design, { lens: 'hierarchy' }),
    () => arrangeSitemap(document.design, 'all'),
  ];
  const measured=[];
  for(const [index,operation] of actions.entries())measured.push({operation:operations[index]!,...await measureOperation(operation,count,context.signal)});
  return result(request.command, { kind: 'companion-authoring-measurements', schemaVersion: 1,
    inputSha256: hash(text), inputBytes: Buffer.byteLength(text), projectSchema: document.schemaVersion,
    counts: designCounts(document.design),
    runtime: { node: process.versions.node, platform: process.platform, architecture: process.arch, clock: 'performance.now' },
    measured, memory: { heapBeforeBytes, heapAfterBytes: process.memoryUsage().heapUsed, isolated: false, forcedCollection: false },
    budgets: 'not-established', qualification: 'not-inferred',
    scope: 'Synchronous model operations only; excludes rendering, native lifecycle, I/O timing and generated builds.',
    contentIncluded: false, written: [], network: false });
}
