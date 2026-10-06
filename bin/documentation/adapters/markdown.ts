import { parseDocument, stringify, isMap, isAlias, isNode } from 'yaml';
import { DOC_TYPES, docsObject as object, insist, jsonData, validateEntity, normalizePayload, fieldNames, equal, type Entity, type ObjectData, type DocType } from '../domain/contracts.ts';
interface Span { start: number; end: number }
interface Regions { data: Span | null; generated: Span | null }
export interface MarkdownDocument {
  entity: Entity; source: string; name: string; header: Span; body: number;
  regions: Regions; properties: ObjectData;
}
/** Core-schema YAML only. No alias expansion, explicit tags, directives or non-JSON objects. */
function children(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];
  if ('items' in value && Array.isArray(value.items)) return value.items;
  return 'key' in value && 'value' in value ? [value.key, value.value] : [];
}
function assertCoreTree(contents: unknown, name: string): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: contents, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const { value, depth } = stack.pop()!;
    insist(depth <= 80 && ++count <= 360000, 'DOCS_LIMIT', name + ': YAML tree exceeds limits.');
    insist(!isAlias(value), 'DOCS_YAML_ALIAS', name + ': YAML aliases are not allowed.');
    if (isNode(value)) insist(!value.tag && !('anchor' in value && value.anchor), 'DOCS_YAML_TAG', name + ': Explicit tags and anchors are not allowed.');
    for (const child of children(value)) stack.push({ value: child, depth: depth + 1 });
  }
}
function yaml(source: string, name: string) {
  const doc = parseDocument(source, { uniqueKeys: true, strict: true, version: '1.2', stringKeys: true, keepSourceTokens: true });
  insist(!doc.errors.length && !doc.warnings.length, 'DOCS_YAML', name + ': ' + (doc.errors[0]?.message ?? doc.warnings[0]?.message ?? 'Invalid YAML.'));
  assertCoreTree(doc.contents, name);
  insist(!/^%/m.test(source), 'DOCS_YAML_DIRECTIVE', name + ': YAML directives are not supported.');
  const value: unknown = doc.toJS({ maxAliasCount: 0 }); jsonData(value);
  return { doc, value: object(value) };
}
interface Fence { character: string; length: number; start: number; data: boolean }
interface RegionScan { name: string; offset: number; fence: Fence | null; data: Span | null; generated: Span | null; generatedStart: number | null }
const SHELL_DATA_INFO = /^(?:yaml|json) shell-data$/;
function closesFence(fence: Fence, mark: RegExpExecArray | null): boolean {
  return !!mark && mark[1]![0] === fence.character && mark[1]!.length >= fence.length && !mark[2]!.trim();
}
function scanFenced(scan: RegionScan, fence: Fence, mark: RegExpExecArray | null, line: string): void {
  if (!closesFence(fence, mark)) return;
  if (fence.data) { insist(!scan.data, 'DOCS_DATA_DUPLICATE', scan.name + ': Use one shell-data block.'); scan.data = { start: fence.start, end: scan.offset + line.length }; }
  scan.fence = null;
}
function openFence(scan: RegionScan, mark: RegExpExecArray): void {
  const info = mark[2]!.trim();
  insist(!info.includes('shell-data') || SHELL_DATA_INFO.test(info), 'DOCS_DATA_FENCE', scan.name + ': Expected yaml shell-data or json shell-data.');
  scan.fence = { character: mark[1]![0]!, length: mark[1]!.length, start: scan.offset, data: SHELL_DATA_INFO.test(info) };
}
function scanMarker(scan: RegionScan, clean: string, line: string): void {
  if (clean === '<!-- shell:generated:start -->') {
    insist(scan.generatedStart === null && !scan.generated, 'DOCS_MARKERS', scan.name + ': Duplicate generated region.'); scan.generatedStart = scan.offset;
  } else if (clean === '<!-- shell:generated:end -->') {
    insist(scan.generatedStart !== null, 'DOCS_MARKERS', scan.name + ': Unmatched generated-region end.');
    scan.generated = { start: scan.generatedStart, end: scan.offset + line.length }; scan.generatedStart = null;
  }
}
function scanLine(scan: RegionScan, line: string): void {
  const clean = line.replace(/\r?\n$/, ''), mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(clean);
  if (scan.fence) scanFenced(scan, scan.fence, mark, line);
  else if (mark && !(mark[1]![0] === '`' && mark[2]!.includes('`'))) openFence(scan, mark);
  else scanMarker(scan, clean, line);
  scan.offset += line.length;
}
/** Line-state fenced-block parser: an example containing another fence is never interpreted. */
function regions(source: string, offset: number, name: string): Regions {
  const scan: RegionScan = { name, offset, fence: null, data: null, generated: null, generatedStart: null };
  for (const line of source.slice(offset).match(/[^\n]*(?:\n|$)/g) ?? []) scanLine(scan, line);
  insist(!scan.fence?.data && scan.generatedStart === null, 'DOCS_MARKERS', name + ': Unclosed managed block.');
  return { data: scan.data, generated: scan.generated };
}
function contents(source: string, span: Span): string {
  const lines = source.slice(span.start, span.end).split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines.slice(1, -1).join('\n');
}
function frontmatterSpan(source: string, name: string): { header: Span; body: number } | null {
  const start = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const first = /^---\r?\n/.exec(source.slice(start));
  if (!first) return null;
  const headerStart = start + first[0].length;
  const end = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(source.slice(headerStart));
  insist(end, 'DOCS_FRONTMATTER', name + ': Unclosed frontmatter.');
  const header = { start: headerStart, end: headerStart + end.index };
  return { header, body: header.end + end[0].length };
}
const reservedFields: ReadonlySet<string> = new Set(Object.values(fieldNames).flat());
function checkRegions(source: string, found: Regions, name: string): void {
  if (found.data && found.generated) insist(found.data.end <= found.generated.start || found.data.start >= found.generated.end, 'DOCS_MARKERS', name + ': Managed data and generated regions must not overlap.');
  if (!found.data || !/^ {0,3}(?:`{3,}|~{3,})json shell-data/.test(source.slice(found.data.start))) return;
  try { JSON.parse(contents(source, found.data)); } catch { insist(false, 'DOCS_JSON', name + ': Expected valid JSON in json shell-data.'); }
}
const identityOf = (properties: ObjectData) => ({ id: String(properties.id ?? ''), project: String(properties.project ?? ''), title: String(properties.title ?? '') });
export function parseMarkdown(source: string, name = 'document.md'): MarkdownDocument | null {
  insist(Buffer.byteLength(source, 'utf8') <= 4_000_000, 'DOCS_LIMIT', name + ': Document exceeds 4 MB.');
  const span = frontmatterSpan(source, name);
  if (!span) return null;
  const { header, body } = span, properties = yaml(source.slice(header.start, header.end), name).value;
  if (properties.doc_schema === undefined && !DOC_TYPES.includes(properties.type as DocType)) return null;
  insist(properties.doc_schema === 1, 'DOCS_VERSION', name + ': Expected doc_schema: 1; adopt legacy documents explicitly.');
  insist(DOC_TYPES.includes(properties.type as DocType), 'DOCS_TYPE', name + ': Unknown document type.');
  const type = properties.type as DocType, fields: ObjectData = {};
  for (const field of fieldNames[type]) if (Object.hasOwn(properties, field)) fields[field] = properties[field];
  const found = regions(source, body, name);
  insist(Object.keys(properties).every(key => !reservedFields.has(key) || fieldNames[type].includes(key)), 'DOCS_FIELD', name + ': Managed field belongs to another document type.');
  checkRegions(source, found, name);
  const entity: Entity = { type, ...identityOf(properties), fields,
    data: found.data ? yaml(contents(source, found.data), name + ':shell-data').value : {} };
  for (const field of ['id', 'project', 'title']) insist(typeof properties[field] === 'string', 'DOCS_FIELD', name + ': ' + field + ' must be text.');
  validateEntity(entity);
  return { entity: normalizePayload(entity), source, name, header, body, regions: found, properties };
}
const frontmatter = (entity: Entity): ObjectData => ({ doc_schema: 1, type: entity.type, id: entity.id, project: entity.project, title: entity.title, ...entity.fields });
function replace(source: string, changes: Array<Span & { value: string }>): string {
  for (const change of changes.sort((a, b) => b.start - a.start)) source = source.slice(0, change.start) + change.value + source.slice(change.end);
  return source;
}
type Edit = Span & { value: string };
type Pair = { key: unknown; value: unknown };
function obsoleteEdit(source: string, pair: Pair): Edit {
  insist(isNode(pair.key) && pair.key.range && isNode(pair.value) && pair.value.range,
    'DOCS_FRONTMATTER', 'Cannot locate an obsolete managed property.');
  const start = source.lastIndexOf('\n', pair.key.range[0] - 1) + 1;
  const end = source.indexOf('\n', pair.value.range[1]);
  return { start, end: end < 0 ? source.length : end + 1, value: '' };
}
function keepsAuthoredValue(document: MarkdownDocument, entity: Entity, key: string, value: unknown): boolean {
  if (key === 'title' && entity.type === 'route' && document.properties.title !== document.entity.title) return true;
  return equal(document.properties[key], value);
}
function managedEdit(document: MarkdownDocument, entity: Entity, pair: Pair, value: unknown): Edit | null {
  if (keepsAuthoredValue(document, entity, String(pair.key), value)) return null;
  insist(isNode(pair.value) && pair.value.range, 'DOCS_FRONTMATTER', 'Cannot locate a managed property.');
  return { start: pair.value.range[0], end: pair.value.range[1], value: JSON.stringify(value) };
}
/** Rewrite only managed top-level scalar spans; custom properties/comments retain exact bytes. */
function headerText(document: MarkdownDocument, entity: Entity, newline: string): string {
  const original = document.source.slice(document.header.start, document.header.end);
  const { doc } = yaml(original, document.name), fields = frontmatter(entity);
  insist(isMap(doc.contents), 'DOCS_FRONTMATTER', 'Frontmatter must be a mapping.');
  const edits: Edit[] = [], seen = new Set<string>();
  for (const pair of doc.contents.items) {
    const key = String(pair.key);
    const edit = Object.hasOwn(fields, key) ? managedEdit(document, entity, pair, fields[key])
      : fieldNames[entity.type].includes(key) ? obsoleteEdit(original, pair) : null;
    if (Object.hasOwn(fields, key)) seen.add(key);
    if (edit) edits.push(edit);
  }
  let source = replace(original, edits);
  for (const [key, value] of Object.entries(fields)) if (!seen.has(key)) source += `${key}: ${JSON.stringify(value)}${newline}`;
  return source;
}
function block(data: ObjectData, newline: string): string {
  return '```yaml shell-data' + newline + stringify(data, { lineWidth: 0, aliasDuplicateObjects: false }).replace(/\n/g, newline) + '```' + newline;
}
export function generatedSource(document: MarkdownDocument): string | null {
  const span = document.regions.generated; return span ? document.source.slice(span.start, span.end) : null;
}
export function renderMarkdown(entity: Entity, original?: MarkdownDocument, generated?: string): string {
  validateEntity(entity);
  const newline = original?.source.includes('\r\n') ? '\r\n' : '\n';
  if (!original) return '---\n' + stringify({ ...frontmatter(entity), doc_status: 'draft', tags: ['application-docs'] }, { lineWidth: 0 }) +
    '---\n\n# ' + entity.title.replace(/[[\]<>]/g, '') + '\n\n## Purpose\n\nDescribe the intent and expected outcome.\n\n' + block(entity.data, '\n') +
    '\n## Acceptance criteria\n\nDocument acceptance criteria here; prose does not create executable behavior.\n' + (generated ? '\n' + generated : '');
  const edits: Array<Span & { value: string }> = [];
  if (!equal(frontmatter(entity), frontmatter(original.entity))) edits.push({ ...original.header, value: headerText(original, entity, newline) });
  if (!equal(entity.data, original.entity.data)) {
    if (original.regions.data) edits.push({ ...original.regions.data, value: block(entity.data, newline) });
    else edits.push({ start: original.source.length, end: original.source.length, value: newline + block(entity.data, newline) });
  }
  if (generated && original.regions.generated) edits.push({ ...original.regions.generated, value: generated.replace(/\n/g, newline) });
  return replace(original.source, edits);
}
