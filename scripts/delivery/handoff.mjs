/**
 * Dependency-free model of an increment handoff (docs/increments/<slug>.md): a small frontmatter subset
 * (`key: value`, quoted strings, `[a, b]` lists), `##` sections with `###` subsections and the structured
 * list lines the Definition of Ready and Done read. Pure functions; nothing here touches the filesystem.
 */
const fence = /^\s{0,3}(`{3,}|~{3,})/;
const noneWithReason = /^None\s*(?:—|–|--?|:)\s*\S/;

function unquote(value) {
  const match = /^"((?:[^"\\]|\\.)*)"$/.exec(value) ?? /^'([^']*)'$/.exec(value);
  return match ? match[1].replace(/\\(["\\])/g, '$1') : null;
}
function scalar(raw) {
  const value = raw.trim();
  if (!value) return { value: '' };
  const quoted = unquote(value);
  if (quoted !== null) return { value: quoted };
  if (/^["']/.test(value)) return { error: 'unterminated quoted string' };
  return { value };
}
function listValue(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return { value: [] };
  const items = [];
  for (const part of inner.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^,]+/g) ?? []) {
    const item = scalar(part);
    if (item.error) return item;
    if (item.value) items.push(item.value);
  }
  return { value: items };
}

/** Frontmatter between the first two `---` lines; problems are returned, never thrown. */
export function parseFrontmatter(lines) {
  const result = { present: false, data: {}, errors: [], end: 0 };
  if (lines[0]?.trim() !== '---') return result;
  const close = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (close < 0) { result.errors.push({ line: 1, message: 'frontmatter has no closing ---' }); return result; }
  result.present = true; result.end = close + 1;
  for (let index = 1; index < close; index++) {
    const line = lines[index];
    if (!line.trim()) continue;
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!match) { result.errors.push({ line: index + 1, message: `"${line.trim()}" is not "key: value"` }); continue; }
    const [, key, raw] = match;
    if (Object.hasOwn(result.data, key)) { result.errors.push({ line: index + 1, message: `duplicate key ${key}` }); continue; }
    const parsed = /^\s*\[.*\]\s*$/.test(raw) ? listValue(raw) : scalar(raw);
    if (parsed.error) result.errors.push({ line: index + 1, message: `${key}: ${parsed.error}` });
    else result.data[key] = parsed.value;
  }
  return result;
}

/** `##` sections in order, each with its body lines and `###` subsections; headings inside fences are content. */
function parseSections(lines, start = 0) {
  const sections = []; let open = null; let section = null; let sub = null; let title = null;
  for (let index = start; index < lines.length; index++) {
    const text = lines[index];
    const marker = fence.exec(text);
    if (marker) open = !open ? marker[1] : (marker[1][0] === open[0] && marker[1].length >= open.length ? null : open);
    const heading = !open && !marker && /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(text);
    if (heading?.[1] === '#') { title ??= heading[2]; section = null; sub = null; continue; }
    if (heading?.[1] === '##') { section = { name: heading[2], line: index + 1, lines: [], subsections: [] }; sections.push(section); sub = null; continue; }
    if (heading?.[1] === '###' && section) { sub = { name: heading[2], line: index + 1, lines: [] }; section.subsections.push(sub); }
    if (section) section.lines.push({ text, line: index + 1 });
    if (sub && !heading) sub.lines.push({ text, line: index + 1 });
  }
  return { title, sections };
}

/** Blanks HTML comments, fenced blocks and inline code, keeping line numbers: what is left is authored prose. */
export function prose(text) {
  const kept = []; let open = null;
  for (const line of String(text).replace(/<!--[\s\S]*?-->/g, comment => comment.replace(/[^\n]/g, '')).split('\n')) {
    const marker = fence.exec(line);
    if (marker) open = !open ? marker[1] : (marker[1][0] === open[0] && marker[1].length >= open.length ? null : open);
    kept.push(marker || open ? '' : line.replace(/`[^`\n]*`/g, ' '));
  }
  return kept.join('\n');
}
export const bodyText = lines => lines.map(entry => entry.text).join('\n');
export const words = text => (prose(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;
/** "None — reason" (em/en dash, hyphen or colon) with a reason after it. */
const isNoneWithReason = text => noneWithReason.test(text.trim());

/** Top-level `- ` list items with their indented continuation lines; HTML comments are ignored. */
export function listItems(lines) {
  const items = []; let current = null; let comment = false;
  for (const { text, line } of lines) {
    if (comment) { if (text.includes('-->')) comment = false; continue; }
    if (/^\s*<!--/.test(text)) { if (!text.includes('-->')) comment = true; continue; }
    const item = /^[-*]\s+(.*)$/.exec(text);
    if (item) { current = { text: item[1].trim(), full: item[1].trim(), line }; items.push(current); }
    else if (current && /^\s+\S/.test(text)) current.full += ` ${text.trim()}`;
    else if (!text.trim()) continue;
    else current = null;
  }
  return items;
}
/** Obsidian wikilink targets (`[[path]]`, `[[path|alias]]`, `[[Name#heading]]`) in authored prose, outside code. */
export const wikilinks = text => [...prose(text).matchAll(/\[\[([^\[\]\n]+)\]\]/g)].map(match => match[1].trim());
const firstCode = text => /`([^`\n]+)`/.exec(text)?.[1] ?? null;

/** The parsed handoff: frontmatter, title, sections by name (case-insensitive) and the raw lines. */
export function parseHandoff(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const frontmatter = parseFrontmatter(lines);
  const { title, sections } = parseSections(lines, frontmatter.end);
  const byName = new Map(sections.map(section => [section.name.toLowerCase(), section]));
  return { lines, frontmatter, title, sections, section: name => byName.get(name.toLowerCase()) ?? null };
}
export const subsection = (section, name) => section?.subsections.find(item => item.name.toLowerCase() === name.toLowerCase()) ?? null;

const acPattern = /^\[( |x|X)\]\s+(AC-\d+):\s*(\S.*)$/;
/** `- [ ] AC-n: text` items; a list item in that shape with `Evidence:` names backticked evidence paths. */
export function acceptanceCriteria(section, label = 'Evidence:') {
  return listItems(section?.lines ?? []).map(item => {
    const match = acPattern.exec(item.text);
    if (!match) return { line: item.line, valid: false, text: item.text };
    const at = item.full.indexOf(label);
    const evidence = at < 0 ? [] : [...item.full.slice(at + label.length).matchAll(/`([^`\n]+)`/g)].map(found => found[1]);
    return { line: item.line, valid: true, checked: match[1] !== ' ', id: match[2], text: match[3], evidence };
  });
}
/** `- \`path or glob\`: note` items. */
export function affectedAreas(section) {
  return listItems(section?.lines ?? []).map(item => ({ line: item.line, pattern: /^`[^`]+`/.test(item.text) ? firstCode(item.text) : null, text: item.text }));
}

const planKinds = [['suite', /^Suite\s+`([^`]+)`/i], ['gate', /^Gate\s+`([^`]+)`/i], ['newTest', /^New test\s+`([^`]+)`/i]];
/** Suites, gates, new test files, a "No test change — reason" line and an "E2E: reason" line. */
export function testPlan(section, { noTestChange = /^No test change\s*(?:—|–|--?|:)\s*\S/, e2e = /^E2E\b/ } = {}) {
  const plan = { suites: [], gates: [], newTests: [], noTestChange: false, e2eReason: null, entries: 0 };
  for (const item of listItems(section?.lines ?? [])) {
    if (noTestChange.test(item.text)) { plan.noTestChange = true; plan.entries++; continue; }
    if (e2e.test(item.text)) { plan.e2eReason = item.text; continue; }
    for (const [kind, pattern] of planKinds) {
      const match = pattern.exec(item.text);
      if (match) { plan[`${kind}s`].push({ value: match[1], line: item.line }); plan.entries++; }
    }
  }
  return plan;
}
/** `- \`target\` (type): note` items or a single "None — reason". */
export function docsImpact(section) {
  const items = listItems(section?.lines ?? []);
  const text = prose(bodyText(section?.lines ?? [])).trim();
  if (isNoneWithReason(text.replace(/^[-*]\s+/, ''))) return { none: true, items: [], invalid: [] };
  const parsed = items.map(item => ({ item, match: /^`([^`]+)`\s*\(([^)]+)\)\s*(?::\s*(.*))?$/.exec(item.text) }));
  return { none: false, items: parsed.filter(entry => entry.match).map(({ item, match }) => ({ line: item.line, target: match[1], type: match[2].trim(), note: (match[3] ?? '').trim() })),
    invalid: parsed.filter(entry => !entry.match).map(({ item }) => item) };
}
/** `- Category: text` items or a single "None — reason". */
export function changelogEntries(section, categories) {
  const text = prose(bodyText(section?.lines ?? [])).trim();
  if (isNoneWithReason(text.replace(/^[-*]\s+/, ''))) return { none: true, entries: [], invalid: [] };
  const entries = [], invalid = [];
  for (const item of listItems(section?.lines ?? [])) {
    const match = /^([A-Z][a-z]+):\s+(\S.*)$/.exec(item.full);
    if (match && categories.includes(match[1])) entries.push({ line: item.line, category: match[1], text: match[2].trim() });
    else invalid.push(item);
  }
  return { none: false, entries, invalid };
}
