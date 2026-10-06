import { requireSketch } from './errors.ts';
/**
 * Generated Markdown lives between two marker lines; the start marker records the SHA-256 of what it wrote. Text
 * outside the markers is hand-authored and kept byte for byte. A block whose text no longer matches its recorded hash
 * was edited by hand, so regeneration refuses instead of overwriting it. Shared by process and test-workflow docs.
 */
export interface GeneratedBlockFormat { marker: string; code: string; command: string }
export interface GeneratedBlock { before: string[]; body: string; after: string[]; recorded: string }
const startMarker = (format: GeneratedBlockFormat, digest: string) => `<!-- ${format.marker}:generated:start sha256=${digest} -->`;
const endMarker = (format: GeneratedBlockFormat) => `<!-- ${format.marker}:generated:end -->`;
export function readGeneratedBlock(content: string, path: string, format: GeneratedBlockFormat): GeneratedBlock {
  const start = new RegExp(`^<!-- ${format.marker}:generated:start sha256=([0-9a-f]{64}) -->\\r?$`), end = endMarker(format);
  const lines = content.split('\n'), starts = lines.flatMap((line, index) => start.test(line) ? [index] : []);
  const ends = lines.flatMap((line, index) => line.replace(/\r$/, '') === end ? [index] : []);
  requireSketch(starts.length === 1 && ends.length === 1 && starts[0]! < ends[0]!, `${format.code}_DOCS_MARKERS`,
    `${path} has no single generated block (${startMarker(format, '<hash>')} … ${end}). It looks hand-authored, so nothing was written; move it or add the markers.`);
  const [first, last] = [starts[0]!, ends[0]!];
  return { before: lines.slice(0, first), body: lines.slice(first + 1, last).join('\n'), after: lines.slice(last + 1), recorded: start.exec(lines[first]!)![1]! };
}
/** Refuses a block whose recorded hash does not match `digest`, the hash of what the generator would have written. */
export function requireIntactBlock(found: GeneratedBlock, digest: string, path: string, format: GeneratedBlockFormat): void {
  requireSketch(digest === found.recorded, `${format.code}_DOCS_EDITED`,
    `${path}: the generated block was edited by hand since it was generated. Nothing was written. Move your edits outside the markers (that text is kept), or restore the block, then run ${format.command} again.`);
}
export function wrapGeneratedBlock(body: string, digest: string, format: GeneratedBlockFormat): string {
  return `${startMarker(format, digest)}\n${body}\n${endMarker(format)}`;
}
