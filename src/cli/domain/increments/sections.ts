/**
 * `#`/`##`/`###` structure of a Markdown document with byte offsets, read exactly like the Definition of Ready
 * (headings inside fenced code are content), plus span edits that keep every byte outside the edited range.
 */
import { lineEnding, parseFrontmatter, textLines, type TextLine } from './frontmatter.ts';
import { scopeSubsections, type Scope, type ScopeSide } from './model.ts';

const fence = /^\s{0,3}(`{3,}|~{3,})/;
const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
export interface SectionSpan {
  name: string; level: 2 | 3; line: number;
  /** Offsets: heading line start, first body byte, end of the section (next sibling or parent heading, or EOF). */
  headingStart: number; bodyStart: number; end: number;
  /** Where the section's own content ends: its first `###` or its end. */
  contentEnd: number;
  subsections: SectionSpan[];
}
export interface Outline { title: { name: string; line: number; start: number; next: number } | null; sections: SectionSpan[] }

function nextFence(open: string | null, text: string): { open: string | null; marker: boolean } {
  const marker = fence.exec(text)?.[1];
  if (!marker) return { open, marker: false };
  if (!open) return { open: marker, marker: true };
  return { open: marker[0] === open[0] && marker.length >= open.length ? null : open, marker: true };
}
interface Found { level: number; name: string; line: TextLine; index: number }
function headings(lines: TextLine[], from: number): Found[] {
  const found: Found[] = [];
  let open: string | null = null;
  for (let index = from; index < lines.length; index++) {
    const line = lines[index]!, state = nextFence(open, line.text);
    const match = !open && !state.marker ? heading.exec(line.text) : null;
    open = state.open;
    if (match) found.push({ level: match[1]!.length, name: match[2]!, line, index });
  }
  return found;
}
function span(item: Found, level: 2 | 3): SectionSpan {
  return { name: item.name, level, line: item.index + 1, headingStart: item.line.start, bodyStart: item.line.next, end: 0, contentEnd: 0, subsections: [] };
}
/** The document outline after the frontmatter; `###` belongs to the open `##`, `#` closes it (DoR semantics). */
export function outline(text: string): Outline {
  const lines = textLines(text), result: Outline = { title: null, sections: [] };
  let section: SectionSpan | null = null, sub: SectionSpan | null = null;
  const close = (at: number, level: number) => {
    if (sub) { sub.end = at; sub.contentEnd = at; sub = null; }
    if (section && level <= 2) { section.end = at; section.contentEnd = section.subsections[0]?.headingStart ?? at; section = null; }
  };
  for (const item of headings(lines, parseFrontmatter(text).end)) {
    close(item.line.start, item.level);
    if (item.level === 1) result.title ??= { name: item.name, line: item.index + 1, start: item.line.start, next: item.line.next };
    else if (item.level === 2) { section = span(item, 2); result.sections.push(section); }
    else if (section) { sub = span(item, 3); section.subsections.push(sub); }
  }
  close(text.length, 1);
  return result;
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const findSection = (doc: Outline, name: string): SectionSpan | null => doc.sections.find(item => same(item.name, name)) ?? null;
export const findSubsection = (section: SectionSpan | null, name: string): SectionSpan | null => section?.subsections.find(item => same(item.name, name)) ?? null;
/** The section text between its heading and its end, including `###` subsections. */
export const sectionBody = (text: string, section: SectionSpan): string => text.slice(section.bodyStart, section.end);
/** The section's own text before its first `###`. */
export const sectionContent = (text: string, section: SectionSpan): string => text.slice(section.bodyStart, section.contentEnd);

/** Blanks HTML comments, fenced blocks and inline code, keeping line numbers: what is left is authored prose (DoR `prose`). */
export function prose(text: string): string {
  const kept: string[] = [];
  let open: string | null = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, comment => comment.replace(/[^\n]/g, '')).split('\n')) {
    const state = nextFence(open, line);
    kept.push(state.marker || open ? '' : line.replace(/`[^`\n]*`/g, ' '));
    open = state.open;
  }
  return kept.join('\n');
}
export const words = (text: string): number => (prose(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;
const placeholder = /<[A-Za-z][^>\n]*>/u;
/** True when authored prose still holds a template `<placeholder>` (the DOR-04 angle-bracket pattern). */
export const hasPlaceholder = (text: string): boolean => placeholder.test(prose(text));

export interface ListItem { text: string; full: string; line: number; start: number; next: number }
/** Top-level `- `/`* ` items with indented continuation lines; HTML comment lines are skipped (DoR `listItems`). */
export function listItems(text: string, from: number, to: number): ListItem[] {
  const items: ListItem[] = [];
  let current: ListItem | null = null, comment = false;
  for (const [index, line] of textLines(text).entries()) {
    if (line.start < from || line.start >= to) continue;
    if (comment) { comment = !line.text.includes('-->'); continue; }
    if (/^\s*<!--/.test(line.text)) { comment = !line.text.includes('-->'); continue; }
    const item = /^[-*]\s+(.*)$/.exec(line.text);
    if (item) { current = { text: item[1]!.trim(), full: item[1]!.trim(), line: index + 1, start: line.start, next: line.next }; items.push(current); }
    else if (current && /^\s+\S/.test(line.text)) { current.full += ` ${line.text.trim()}`; current.next = line.next; }
    else if (line.text.trim()) current = null;
  }
  return items;
}
export const sectionItems = (text: string, section: SectionSpan): ListItem[] => listItems(text, section.bodyStart, section.contentEnd);

/** Converts any line breaks to the document's ending and drops leading/trailing blank lines. */
export function blockText(body: string, eol: string): string {
  return body.split(/\r\n|\r|\n/).join('\n').replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '').split('\n').join(eol);
}
export function replaceRange(text: string, start: number, end: number, value: string): string {
  return text.slice(0, start) + value + text.slice(end);
}
/** A blank line after the heading, the content, and a blank line before the next heading. */
function layout(text: string, at: number, end: number, content: string): string {
  const eol = lineEnding(text), lead = at > 0 && !/[\r\n]$/.test(text.slice(0, at)) ? eol : '';
  return lead + eol + (content ? content + eol : '') + (end < text.length ? eol : '');
}
/** Replaces a section's own content (before any `###`); `keepComment` retains a leading guidance comment. */
export function replaceSectionContent(text: string, section: SectionSpan, body: string, keepComment = false): string {
  const eol = lineEnding(text), current = sectionContent(text, section);
  const comment = keepComment ? /^\s*(<!--[\s\S]*?-->)/.exec(current)?.[1] : undefined;
  const content = [comment ? blockText(comment, eol) : '', blockText(body, eol)].filter(Boolean).join(eol + eol);
  return replaceRange(text, section.bodyStart, section.contentEnd, layout(text, section.bodyStart, section.contentEnd, content));
}
/**
 * Appends `- item` after the last list item of the section's own content. Template items that still hold a
 * `<placeholder>` are removed first, so the first real item replaces the template example.
 */
export function appendListItem(text: string, find: (doc: Outline) => SectionSpan | null, item: string): string {
  let section = find(outline(text))!;
  for (const stale of sectionItems(text, section).filter(entry => hasPlaceholder(entry.full)).reverse()) text = replaceRange(text, stale.start, stale.next, '');
  section = find(outline(text))!;
  const eol = lineEnding(text), items = sectionItems(text, section), last = items.at(-1);
  if (last) return replaceRange(text, last.next, last.next, (/[\r\n]$/.test(text.slice(0, last.next)) ? '' : eol) + `- ${item}` + eol);
  const content = blockText(sectionContent(text, section), eol);
  return replaceSectionContent(text, section, [content, `- ${item}`].filter(Boolean).join(eol + eol));
}
/** Inserts a `## name` section before the first existing section named in `before`, or at the end. */
export function insertSection(text: string, name: string, body: string, before: readonly string[] = []): string {
  const eol = lineEnding(text), doc = outline(text);
  const next = before.map(item => findSection(doc, item)).find(Boolean);
  const content = blockText(body, eol), block = `## ${name}${eol}${eol}${content ? content + eol : ''}`;
  if (next) return replaceRange(text, next.headingStart, next.headingStart, block + eol);
  const trimmed = text.replace(/(?:\r\n|\r|\n)*$/, '');
  return trimmed + eol + eol + block;
}
/** Adds an empty `## name` section in document order when it is missing; `order` lists the section names in order. */
export function ensureSection(text: string, name: string, order: readonly string[], before: readonly string[] = []): string {
  if (findSection(outline(text), name)) return text;
  return insertSection(text, name, '', [...order.slice(order.indexOf(name) + 1), ...before]);
}
const scopeOrder = [scopeSubsections.in, scopeSubsections.out];
/** Appends an item under `## Scope` / `### In scope` or `### Out of scope`, adding the headings when missing. */
export function appendScopeItem(text: string, order: readonly string[], side: ScopeSide, item: string): string {
  const sub = scopeSubsections[side];
  const prepared = ensureSubsection(ensureSection(text, 'Scope', order), 'Scope', sub, scopeOrder);
  return appendListItem(prepared, doc => findSubsection(findSection(doc, 'Scope'), sub), item);
}
/** The `### In scope` and `### Out of scope` items. */
export function scopeItems(text: string, doc: Outline = outline(text)): Scope {
  const items = (side: ScopeSide) => {
    const sub = findSubsection(findSection(doc, 'Scope'), scopeSubsections[side]);
    return sub ? sectionItems(text, sub).filter(item => !hasPlaceholder(item.full)).map(item => item.full) : [];
  };
  return { in: items('in'), out: items('out') };
}
/** Adds an empty `### sub` heading to an existing section when it is missing, before the next subsection in `order`. */
export function ensureSubsection(text: string, name: string, sub: string, order: readonly string[]): string {
  const section = findSection(outline(text), name)!;
  if (findSubsection(section, sub)) return text;
  const eol = lineEnding(text), next = order.slice(order.indexOf(sub) + 1).map(item => findSubsection(section, item)).find(Boolean);
  const at = next ? next.headingStart : section.end, before = text.slice(0, at);
  const lead = /(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)$/.test(before) ? '' : /[\r\n]$/.test(before) ? eol : eol + eol;
  return replaceRange(text, at, at, `${lead}### ${sub}${eol}${at < text.length ? eol : ''}`);
}

export interface MarkedRegion { openStart: number; start: number; end: number; closeNext: number }
/** `<!-- wb:name … -->` … `<!-- /wb:name -->`; `start..end` is the content between the marker lines. */
export function findMarkedRegion(text: string, name: string): MarkedRegion | null {
  const lines = textLines(text);
  const open = lines.findIndex(line => line.text.trimStart().startsWith(`<!-- wb:${name} `) || line.text.trim() === `<!-- wb:${name} -->`);
  const close = lines.findIndex((line, index) => index > open && line.text.trim() === `<!-- /wb:${name} -->`);
  if (open < 0 || close < 0) return null;
  return { openStart: lines[open]!.start, start: lines[open]!.next, end: lines[close]!.start, closeNext: lines[close]!.next };
}
/** Replaces the content between the markers, or returns null when the region is missing. */
export function replaceMarkedRegion(text: string, name: string, content: string): string | null {
  const region = findMarkedRegion(text, name), eol = lineEnding(text);
  if (!region) return null;
  const block = blockText(content, eol);
  return replaceRange(text, region.start, region.end, block ? block + eol : '');
}
