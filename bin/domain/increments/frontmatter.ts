/**
 * The frontmatter subset of the Definition of Ready (scripts/delivery/handoff.mjs `parseFrontmatter`): flat
 * `key: value` lines, `"…"` strings where only `\"` and `\\` are unescaped, `'…'` strings and `[a, b]` lists.
 * Edits replace one line and keep every other byte, line ending, BOM and custom key.
 */
import { insistDelivery, type DeliveryErrorCode } from './errors.ts';
import type { FrontmatterData, FrontmatterValue } from './model.ts';

/** One physical line: `start..end` is its text, `next` the offset after its line ending (CRLF, LF or CR). */
export interface TextLine { text: string; start: number; end: number; next: number }
export function textLines(text: string): TextLine[] {
  const lines: TextLine[] = [], pattern = /\r\n|\r|\n/g;
  let start = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    lines.push({ text: text.slice(start, match.index), start, end: match.index, next: match.index + match[0].length });
    start = match.index + match[0].length;
  }
  lines.push({ text: text.slice(start), start, end: text.length, next: text.length });
  return lines;
}
/** The line ending new lines use: the document's first one, LF when it has none. */
export function lineEnding(text: string): '\r\n' | '\n' {
  return /\r\n|\n/.exec(text)?.[0] === '\r\n' ? '\r\n' : '\n';
}

export interface FrontmatterField { key: string; line: number; start: number; next: number; error?: string }
export interface Frontmatter {
  present: boolean; data: FrontmatterData; errors: { line: number; message: string }[]; fields: FrontmatterField[];
  /** Lines the block occupies (DoR `end`); body parsing starts at this line index. */
  end: number;
  /** Offsets of the closing `---` line and of the first body byte. */
  close: number; bodyStart: number;
}
type Parsed = { value: FrontmatterValue } | { error: string };
function unquote(value: string): string | null {
  const match = /^"((?:[^"\\]|\\.)*)"$/.exec(value) ?? /^'([^']*)'$/.exec(value);
  return match ? match[1]!.replace(/\\(["\\])/g, '$1') : null;
}
function scalar(raw: string): Parsed {
  const value = raw.trim();
  if (!value) return { value: '' };
  const quoted = unquote(value);
  if (quoted !== null) return { value: quoted };
  return /^["']/.test(value) ? { error: 'unterminated quoted string' } : { value };
}
function listValue(raw: string): Parsed {
  const inner = raw.trim().slice(1, -1).trim(), items: string[] = [];
  for (const part of inner.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^,]+/g) ?? []) {
    const item = scalar(part);
    if ('error' in item) return item;
    if (item.value) items.push(item.value as string);
  }
  return { value: items };
}
const parseValue = (raw: string): Parsed => /^\s*\[.*\]\s*$/.test(raw) ? listValue(raw) : scalar(raw);

/** Frontmatter between the first two `---` lines; problems are returned, never thrown. */
export function parseFrontmatter(text: string): Frontmatter {
  const lines = textLines(text);
  const result: Frontmatter = { present: false, data: {}, errors: [], fields: [], end: 0, close: 0, bodyStart: 0 };
  if (lines[0]?.text.trim() !== '---') return result;
  const close = lines.findIndex((line, index) => index > 0 && line.text.trim() === '---');
  if (close < 0) { result.errors.push({ line: 1, message: 'frontmatter has no closing ---' }); return result; }
  Object.assign(result, { present: true, end: close + 1, close: lines[close]!.start, bodyStart: lines[close]!.next });
  for (let index = 1; index < close; index++) readField(result, lines[index]!, index + 1);
  return result;
}
function readField(result: Frontmatter, line: TextLine, number: number): void {
  if (!line.text.trim()) return;
  const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line.text);
  if (!match) { result.errors.push({ line: number, message: `"${line.text.trim()}" is not "key: value"` }); return; }
  const key = match[1]!, field: FrontmatterField = { key, line: number, start: line.start, next: line.next };
  result.fields.push(field);
  if (Object.hasOwn(result.data, key)) { result.errors.push({ line: number, message: `duplicate key ${key}` }); return; }
  const parsed = parseValue(match[2]!);
  if ('error' in parsed) { field.error = parsed.error; result.errors.push({ line: number, message: `${key}: ${parsed.error}` }); }
  else result.data[key] = parsed.value;
}

const bare = /^[A-Za-z0-9][\w./+:-]*(?: [\w./+-]+)*$/u;
const isBare = (value: string): boolean => bare.test(value) && !value.endsWith(':') && !value.includes(': ') && !/^(?:true|false|null|yes|no|on|off|~)$/i.test(value);
/** A double-quoted string the DoR grammar and YAML both read back as the same text. */
export const quoteScalar = (value: string): string => `"${value.replace(/["\\]/g, '\\$&')}"`;
/** Plain when it is a simple word sequence, quoted otherwise (or always with `quote`). */
export function formatScalar(value: string, quote = false): string {
  return !quote && isBare(value) ? value : quoteScalar(value);
}
/**
 * `[a, "b c"]`. The DoR list reader takes ` 'x` before a quoted item, so a quoted item that contains a comma
 * follows its comma without a space.
 */
export function formatList(values: readonly string[]): string {
  return `[${values.map((value, index) => {
    const item = formatScalar(value);
    return index === 0 ? item : (item.startsWith('"') && value.includes(',') ? ',' : ', ') + item;
  }).join('')}]`;
}
/** Values with line breaks, or empty list items, cannot be written in the subset. */
export function formatValue(value: FrontmatterValue, quote = false): string {
  const parts = Array.isArray(value) ? value : [value];
  insistDelivery(parts.every(part => !/[\r\n]/.test(part)) && (!Array.isArray(value) || value.every(Boolean)), 'INCREMENT_INPUT_INVALID', 'Frontmatter values are single-line and list items are non-empty.');
  return Array.isArray(value) ? formatList(value) : formatScalar(value, quote);
}

export interface SetOptions {
  /** Insert a new key after the last of these keys present (in the given order), otherwise before the closing `---`. */
  after?: readonly string[];
  quote?: boolean;
  code?: DeliveryErrorCode;
}
/** Sets, inserts or (with null) removes one key, keeping every other byte. */
export function setFrontmatterValue(text: string, key: string, value: FrontmatterValue | null, options: SetOptions = {}): string {
  const frontmatter = parseFrontmatter(text), code = options.code ?? 'INCREMENT_DOCUMENT_INVALID';
  insistDelivery(frontmatter.present, code, 'The document has no frontmatter block.');
  insistDelivery(frontmatter.fields.filter(item => item.key === key).length < 2, code, `Frontmatter key ${key} appears more than once.`);
  const field = frontmatter.fields.find(item => item.key === key);
  if (field && value === null) return text.slice(0, field.start) + text.slice(field.next);
  if (value === null) return text;
  if (field) {
    const ending = /(?:\r\n|\r|\n)$/.exec(text.slice(field.start, field.next))?.[0] ?? '';
    return text.slice(0, field.start) + `${key}: ${formatValue(value, options.quote)}` + ending + text.slice(field.next);
  }
  const anchor = [...(options.after ?? [])].reverse().map(name => frontmatter.fields.find(item => item.key === name)).find(Boolean);
  const at = anchor ? anchor.next : frontmatter.close;
  return text.slice(0, at) + `${key}: ${formatValue(value, options.quote)}` + lineEnding(text) + text.slice(at);
}
/** A string field, or '' when absent or a list. */
export const stringField = (data: FrontmatterData, key: string): string => typeof data[key] === 'string' ? data[key] : '';
/** A list field, or [] when absent or a scalar. */
export const listField = (data: FrontmatterData, key: string): string[] => Array.isArray(data[key]) ? [...data[key]] : [];
