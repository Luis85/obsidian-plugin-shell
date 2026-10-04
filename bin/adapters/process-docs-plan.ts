import { posix } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hasPortableProjectSegments } from '../../scripts/shared/project-path.ts';
import { requireSketch } from '../domain/errors.ts';
import { renderProcessDocs } from '../domain/process-docs.ts';
import type { ProcessDefinition } from '../domain/process.ts';
import { hash } from './framework/files.ts';
import { stepFields, type ProcessCatalogContext } from './process-catalog.ts';
import { prepared, type Prepared } from './storage.ts';
import { guardedText } from './user-settings.ts';
/**
 * Generated documentation lives between two marker lines; the start marker records the SHA-256 of the block it wrote.
 * Everything outside the markers is hand-authored and kept byte for byte. A block whose text no longer matches its
 * recorded hash was edited by hand, so regeneration refuses instead of overwriting it.
 */
const startPattern = /^<!-- process:generated:start sha256=([0-9a-f]{64}) -->\r?$/;
const endMarker = '<!-- process:generated:end -->';
const startMarker = (digest: string) => `<!-- process:generated:start sha256=${digest} -->`;
const processDocsDefault = 'docs/processes';
interface Block { before: string[]; body: string; after: string[]; recorded: string }
function block(content: string, path: string): Block {
  const lines = content.split('\n'), starts = lines.flatMap((line, index) => startPattern.test(line) ? [index] : []);
  const ends = lines.flatMap((line, index) => line.replace(/\r$/, '') === endMarker ? [index] : []);
  requireSketch(starts.length === 1 && ends.length === 1 && starts[0]! < ends[0]!, 'PROCESS_DOCS_MARKERS',
    `${path} has no single generated block (${startMarker('<hash>')} … ${endMarker}). It looks hand-authored, so nothing was written; move it or add the markers.`);
  const [start, end] = [starts[0]!, ends[0]!];
  return { before: lines.slice(0, start), body: lines.slice(start + 1, end).join('\n'), after: lines.slice(end + 1),
    recorded: startPattern.exec(lines[start]!)![1]! };
}
const wrapped = (body: string) => `${startMarker(hash(body))}\n${body}\n${endMarker}`;
function fresh(body: string): string {
  return `${wrapped(body)}\n\n## Notes\n\nHand-written notes outside the generated block are kept when this page is regenerated.\n`;
}
/** Keeps authored text before and after the block; refuses a block edited by hand. */
function regenerated(current: string, body: string, path: string): string {
  const found = block(current, path);
  requireSketch(hash(found.body) === found.recorded, 'PROCESS_DOCS_EDITED',
    `${path}: the generated block was edited by hand since it was generated. Nothing was written. Move your edits outside the markers (that text is kept), or restore the block, then run process docs again.`);
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
