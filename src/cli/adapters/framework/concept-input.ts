import { relative, resolve, sep, extname } from 'node:path';
import { parseConcept, conceptRequire, type Concept } from '#shared/companion/concepts/contract.ts';
import { companionRelativeFolder } from '#shared/companion/authoring-contract.ts';
import { hash, readBounded } from './files.ts';
import { record } from '#shared/companion/sitemap/safety.ts';
import type { Context } from './contracts.ts';

type Decoded = { status: 'data'; encoding: 'project-json' | 'concept-json' | 'prototype-base64'; payloadSha256: string; concept: Concept }
  | { status: 'reference-only'; reason: string };
const htmlLimit = 32_000_000, jsonLimit = 4_000_000;
function text(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw Error('CONCEPT_UTF8: Input must be valid UTF-8.'); }
}
const rawTextTags = ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'];
const markerIds = ['companion-project', 'prototype-project-data'];
/** The index of the tag's closing `>`, skipping quoted attribute values; html.length when unterminated. */
function tagEnd(html: string, from: number): number {
  let end = from, quote = '';
  for (; end < html.length; end++) {
    const char = html[end]!;
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '>') break;
  }
  return end;
}
/** A recognized marker must close and carry exactly an application/json type and one known id. */
function markerPayload(attributes: string, html: string, cursor: number, close: RegExpExecArray | null): { id: string; data: string } {
  const pairs = [...attributes.matchAll(/\s+([a-z-]+)\s*=\s*(["'])([^"']*)\2/gi)];
  const remainder = attributes.replace(/\s+([a-z-]+)\s*=\s*(["'])([^"']*)\2/gi, '').trim();
  const attrs = Object.fromEntries(pairs.map(pair => [pair[1]!.toLowerCase(), pair[3]!]));
  conceptRequire(close && pairs.length === 2 && !remainder && attrs.type === 'application/json' && markerIds.includes(attrs.id ?? ''),
    'CONCEPT_PAYLOAD', 'A data marker must close and have only application/json type and one id.');
  return { id: attrs.id!, data: html.slice(cursor, close.index) };
}
function isMarker(tag: string, templateDepth: number, attributes: string): boolean {
  if (tag !== 'script' || templateDepth !== 0) return false;
  return [...attributes.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].some(entry => markerIds.includes(entry[2]!));
}
type Scan = { cursor: number; templateDepth: number; stop: boolean };
/** Advances past one raw-text element body; a script marker outside templates yields its payload. */
function rawTextElement(html: string, tag: string, attributes: string, scan: Scan, result: Array<{ id: string; data: string }>): void {
  const endTag = new RegExp('</' + tag + '\\s*>', 'gi'); endTag.lastIndex = scan.cursor;
  const close = endTag.exec(html);
  if (isMarker(tag, scan.templateDepth, attributes)) {
    result.push(markerPayload(attributes, html, scan.cursor, close));
    conceptRequire(result.length <= 1, 'CONCEPT_AMBIGUOUS', 'Multiple project payloads require explicit reconciliation; no payload was selected.');
  }
  if (!close) { scan.stop = true; return; }
  scan.cursor = endTag.lastIndex;
}
/** Handles one `<`: comments, ordinary tags, template nesting and raw-text elements. */
function scanTag(html: string, start: number, scan: Scan, result: Array<{ id: string; data: string }>): void {
  if (html.startsWith('<!--', start)) { const end = html.indexOf('-->', start + 4); scan.cursor = end < 0 ? html.length : end + 3; return; }
  const opening = /^<(\/?)([a-z][a-z0-9:-]*)(?=[\s/>])/i.exec(html.slice(start, start + 80));
  if (!opening) { scan.cursor = start + 1; return; }
  // Skip complete generic tags, including quoted attributes which can contain a fake script marker.
  const end = tagEnd(html, start + opening[0].length);
  if (end === html.length) { scan.stop = true; return; }
  const tag = opening[2]!.toLowerCase(), closing = opening[1] === '/';
  scan.cursor = end + 1;
  if (tag === 'template') { scan.templateDepth = Math.max(0, scan.templateDepth + (closing ? -1 : 1)); return; }
  if (closing) return;
  if (tag === 'plaintext') { scan.stop = true; return; }
  if (rawTextTags.includes(tag)) rawTextElement(html, tag, html.slice(start + opening[0].length, end), scan, result);
}
/** This is a bounded data-marker reader, not a browser, DOM-to-code converter or HTML sanitizer. */
function payloads(html: string): Array<{ id: string; data: string }> {
  const result: Array<{ id: string; data: string }> = [];
  const scan: Scan = { cursor: 0, templateDepth: 0, stop: false };
  while (scan.cursor < html.length && !scan.stop) {
    const start = html.indexOf('<', scan.cursor);
    if (start < 0) break;
    scanTag(html, start, scan, result);
  }
  return result;
}
/** Unwraps the prototype worker's base64/checksum envelope into canonical project JSON bytes. */
function prototypePayload(payload: string): Buffer {
  conceptRequire(payload.length <= 5_500_000, 'CONCEPT_LIMIT', 'Encoded project data exceeds its limit.');
  let wrapper: unknown;
  try { wrapper = JSON.parse(payload); } catch { throw Error('CONCEPT_JSON: Malformed encoded payload.'); }
  conceptRequire(record(wrapper) && Object.keys(wrapper).length === 3 && wrapper.encoding === 'base64' &&
    typeof wrapper.content === 'string' && typeof wrapper.sha256 === 'string' && /^[a-f0-9]{64}$/.test(wrapper.sha256),
  'CONCEPT_PAYLOAD', 'Expected the prototype worker base64/checksum envelope.');
  const decoded = Buffer.from(wrapper.content, 'base64');
  conceptRequire(decoded.byteLength <= jsonLimit && decoded.toString('base64') === wrapper.content, 'CONCEPT_PAYLOAD', 'Invalid or oversized canonical base64.');
  conceptRequire(hash(decoded) === wrapper.sha256, 'CONCEPT_INTEGRITY', 'The embedded project checksum does not match.');
  return decoded;
}
type Encoding = 'project-json' | 'concept-json' | 'prototype-base64';
/** The HTML marker payload, or null when the page carries no recognized inert project data. */
function htmlPayload(source: string): { payload: string; payloadSha256: string; encoding: Encoding } | null {
  const found = payloads(source);
  if (!found.length) return null;
  const marker = found[0]!;
  if (marker.id !== 'prototype-project-data') return { payload: marker.data, payloadSha256: hash(marker.data), encoding: 'project-json' };
  const decoded = prototypePayload(marker.data);
  return { payload: text(decoded), payloadSha256: hash(decoded), encoding: 'prototype-base64' };
}
export function decodeConceptInput(bytes: Uint8Array, format: 'json' | 'html'): Decoded {
  conceptRequire(bytes.byteLength <= (format === 'html' ? htmlLimit : jsonLimit), 'CONCEPT_LIMIT', 'Input exceeds its bounded format limit.');
  const source = text(bytes);
  const selected = format === 'html' ? htmlPayload(source) : { payload: source, payloadSha256: hash(bytes), encoding: 'project-json' as Encoding };
  if (!selected) return { status: 'reference-only', reason: 'No recognized inert project data. Export project JSON alongside this HTML; no source was executed or inferred.' };
  const concept = parseConcept(selected.payload);
  const encoding = selected.encoding !== 'prototype-base64' && concept.id !== null ? 'concept-json' : selected.encoding;
  return { status: 'data', concept, encoding, payloadSha256: selected.payloadSha256 };
}

/** Project-root containment and the shared bounded reader reject input links without granting HTML execution. */
export async function readConceptInput(context: Context, input: string) {
  const path = resolve(context.root, input), local = relative(context.root, path).split(sep).join('/');
  conceptRequire(local.startsWith('docs/concepts/') && companionRelativeFolder(local),
    'CONCEPT_PATH', 'Select a regular JSON or HTML file inside this project’s docs/concepts directory.');
  const extension = extname(local).toLowerCase();
  conceptRequire(['.json', '.html'].includes(extension), 'CONCEPT_FORMAT', 'Concept intake accepts JSON and data-bearing HTML, not ZIPs or executable source.');
  const format = extension === '.html' ? 'html' : 'json';
  const bytes = await readBounded(path, format === 'html' ? htmlLimit : jsonLimit);
  return { path: local, bytes, sha256: hash(bytes), decoded: decodeConceptInput(bytes, format) };
}
