import { posix } from 'node:path';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { hasPortableProjectSegments } from '#shared/platform/project-path.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { readGeneratedBlock, requireIntactBlock, wrapGeneratedBlock, type GeneratedBlockFormat } from '../domain/generated-block.ts';
import { renderProcessDocs } from '../domain/process-docs.ts';
import type { ProcessDefinition } from '../domain/process.ts';
import { hash } from './framework/files.ts';
import { stepFields, type ProcessCatalogContext } from './process-catalog.ts';
import { prepared, type Prepared } from './storage.ts';
import { guardedText } from './user-settings.ts';
/** Generated documentation sits between hash-stamped markers; text outside them is kept (see generated-block.ts). */
const processBlock: GeneratedBlockFormat = { marker: 'process', code: 'PROCESS', command: 'process docs' };
const processDocsDefault = 'docs/processes';
const wrapped = (body: string) => wrapGeneratedBlock(body, hash(body), processBlock);
function fresh(body: string): string {
  return `${wrapped(body)}\n\n## Notes\n\nHand-written notes outside the generated block are kept when this page is regenerated.\n`;
}
/** Keeps authored text before and after the block; refuses a block edited by hand. */
function regenerated(current: string, body: string, path: string): string {
  const found = readGeneratedBlock(current, path, processBlock);
  requireIntactBlock(found, hash(found.body), path, processBlock);
  return [...found.before, wrapped(body), ...found.after].join('\n');
}
function outputFolder(out: string): string {
  const folder = out.replace(/\/+$/, '');
  requireSketch(hasPortableProjectSegments(folder) && !folder.startsWith('configs/'), 'PROCESS_DOCS_OUT', 'Use --out with a project-relative folder such as docs/processes.');
  return folder;
}
/** Relative links from the generated page to repository files. */
function docsLinker(folder: string): (target: string) => string {
  return target => posix.relative(folder, target);
}
/** A reviewed plan for one generated page; the file plan's before-hash also guards against concurrent edits. */
export async function processDocsPlan(definition: ProcessDefinition, context: ProcessCatalogContext, docs: ReadonlyMap<string, string>, out = processDocsDefault): Promise<Prepared> {
  const folder = outputFolder(out), path = `${folder}/${definition.id}.md`, lookup = stepFields(context);
  const body = renderProcessDocs(definition, { files: docs, link: docsLinker(folder), fields: step => step.form ? lookup(step.form) ?? [] : step.fields ?? [] });
  const current = await guardedText(context.root, path);
  const content = current.content === null ? fresh(body) : regenerated(current.content, body, path);
  const plan = await createFilePlan(context.root, [{ path, content }]);
  requireSketch(plan.changes[0]!.beforeHash === current.beforeHash, 'MAKER_STALE', `${path} changed while planning. Nothing was written; run process docs again.`);
  return prepared(plan, { process: definition.id, path, generatedHash: hash(body) });
}
