import { relative, resolve, sep, extname } from 'node:path';
import { parseConcept, conceptRequire, type Concept } from '../companion/concepts/contract.ts';
import { companionRelativeFolder } from '../companion/authoring-contract.ts';
import { hash, readBounded } from './files.ts';
import { record } from '../companion/sitemap/safety.ts';
import type { Context } from './contracts.ts';

type Decoded = { status: 'data'; encoding: 'project-json' | 'concept-json' | 'prototype-base64'; payloadSha256: string; concept: Concept }
  | { status: 'reference-only'; reason: string };
const htmlLimit = 32_000_000, jsonLimit = 4_000_000;
function text(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw Error('CONCEPT_UTF8: Input must be valid UTF-8.'); }
}
/** This is a bounded data-marker reader, not a browser, DOM-to-code converter or HTML sanitizer. */
function payloads(html: string): Array<{ id: string; data: string }> {
  const result: Array<{ id: string; data: string }> = [];
  let cursor = 0, templateDepth = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) { const end = html.indexOf('-->', start + 4); cursor = end < 0 ? html.length : end + 3; continue; }
    const opening = /^<(\/?)([a-z][a-z0-9:-]*)(?=[\s/>])/i.exec(html.slice(start, start + 80));
    if (!opening) { cursor = start + 1; continue; }
    // Skip complete generic tags, including quoted attributes which can contain a fake script marker.
    let end = start + opening[0].length, quote = '';
    for (; end < html.length; end++) {
      const char = html[end]!;
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === html.length) break;
    const tag = opening[2]!.toLowerCase(), closing = opening[1] === '/';
    cursor = end + 1;
    if (tag === 'template') { templateDepth = Math.max(0, templateDepth + (closing ? -1 : 1)); continue; }
    if (closing) continue;
    if (tag === 'plaintext') break;
    if (!['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'].includes(tag)) continue;
    const endTag = new RegExp('</' + tag + '\\s*>', 'gi'); endTag.lastIndex = cursor;
    const close = endTag.exec(html);
    const attributes = html.slice(start + opening[0].length, end);
    const names = [...attributes.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi)].map(entry => entry[2]);
    const recognized = tag === 'script' && templateDepth === 0 && names.some(name => name === 'companion-project' || name === 'prototype-project-data');
    if (recognized) {
      const pairs = [...attributes.matchAll(/\s+([a-z-]+)\s*=\s*(["'])([^"']*)\2/gi)];
      const remainder = attributes.replace(/\s+([a-z-]+)\s*=\s*(["'])([^"']*)\2/gi, '').trim();
      const attrs = Object.fromEntries(pairs.map(pair => [pair[1]!.toLowerCase(), pair[3]!]));
      conceptRequire(close && pairs.length === 2 && !remainder && attrs.type === 'application/json' &&
        (attrs.id === 'companion-project' || attrs.id === 'prototype-project-data'),
      'CONCEPT_PAYLOAD', 'A data marker must close and have only application/json type and one id.');
      result.push({ id: attrs.id, data: html.slice(cursor, close.index) });
      conceptRequire(result.length <= 1, 'CONCEPT_AMBIGUOUS', 'Multiple project payloads require explicit reconciliation; no payload was selected.');
    }
    if (!close) break;
    cursor = endTag.lastIndex;
  }
  return result;
}
export function decodeConceptInput(bytes: Uint8Array, format: 'json' | 'html'): Decoded {
  conceptRequire(bytes.byteLength <= (format === 'html' ? htmlLimit : jsonLimit), 'CONCEPT_LIMIT', 'Input exceeds its bounded format limit.');
  let payloadSha256 = hash(bytes);
  let payload = text(bytes), encoding: 'project-json' | 'concept-json' | 'prototype-base64' = 'project-json';
  if (format === 'html') {
    const found = payloads(payload);
    if (!found.length) return { status: 'reference-only', reason: 'No recognized inert project data. Export project JSON alongside this HTML; no source was executed or inferred.' };
    const marker = found[0]!; payload = marker.data; payloadSha256 = hash(payload);
    if (marker.id === 'prototype-project-data') {
      conceptRequire(payload.length <= 5_500_000, 'CONCEPT_LIMIT', 'Encoded project data exceeds its limit.');
      let wrapper: unknown;
      try { wrapper = JSON.parse(payload); } catch { throw Error('CONCEPT_JSON: Malformed encoded payload.'); }
      conceptRequire(record(wrapper) && Object.keys(wrapper).length === 3 && wrapper.encoding === 'base64' &&
        typeof wrapper.content === 'string' && typeof wrapper.sha256 === 'string' && /^[a-f0-9]{64}$/.test(wrapper.sha256),
      'CONCEPT_PAYLOAD', 'Expected the prototype worker base64/checksum envelope.');
      const decoded = Buffer.from(wrapper.content, 'base64');
      conceptRequire(decoded.byteLength <= jsonLimit && decoded.toString('base64') === wrapper.content, 'CONCEPT_PAYLOAD', 'Invalid or oversized canonical base64.');
      conceptRequire(hash(decoded) === wrapper.sha256, 'CONCEPT_INTEGRITY', 'The embedded project checksum does not match.');
      payload = text(decoded); payloadSha256 = hash(decoded); encoding = 'prototype-base64';
    }
  }
  const concept = parseConcept(payload);
  if (encoding !== 'prototype-base64' && concept.id !== null) encoding = 'concept-json';
  return { status: 'data', concept, encoding, payloadSha256 };
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
