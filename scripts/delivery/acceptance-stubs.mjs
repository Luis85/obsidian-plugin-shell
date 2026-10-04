/**
 * Acceptance criterion test stubs, as pure functions. Every `- [ ] AC-n: text` of an Increment gets one test
 * file at `acceptance.pattern` (`{increment}` names the folder, `{ac}` the lower-cased criterion id and the
 * optional `{slug}` the criterion text), rendered from `acceptance.template` with a pending
 * marker. A stub is found by its `ac-n` prefix, so an edited criterion text keeps its stub; existing stubs are
 * never rewritten because they become the real tests. An empty `Evidence:` of a criterion is set to its stub.
 */
import { acceptanceCriteria } from './handoff.mjs';
import { evidencePath } from './rules-common.mjs';

const lineEnd = /\r?\n/;
const fill = (pattern, values) => pattern.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
const prefixOf = id => id.toLowerCase();

/** The criterion text as a file-name slug of at most `max` characters, cut at a word boundary. */
export function criterionSlug(text, max) {
  const words = String(text).toLowerCase().replace(/`[^`]*`/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
  let slug = '';
  for (const word of words) { const next = slug ? `${slug}-${word}` : word; if (next.length > max) break; slug = next; }
  return slug || 'criterion';
}
/** The folder and file-name parts of `acceptance.pattern` (`tests/…/{increment}/{ac}.checks.mjs`). */
export function stubLayout(settings) {
  const at = settings.pattern.lastIndexOf('/');
  return { folder: settings.pattern.slice(0, at), file: settings.pattern.slice(at + 1) };
}
const stubFolder = (settings, incrementId) => fill(stubLayout(settings).folder, { increment: incrementId });
/** The new stub path for a criterion: `{ac}` is the lower-cased id (ac-1), `{slug}` the criterion text. */
export const stubPath = (settings, incrementId, criterion) => `${stubFolder(settings, incrementId)}/${fill(stubLayout(settings).file, { ac: prefixOf(criterion.id), slug: criterionSlug(criterion.text, settings.maxSlugLength) })}`;

/** Stub files of the increment by criterion id: files directly in the folder named `ac-n-…` or `ac-n.…`. */
export function stubsOf(settings, incrementId, files) {
  const folder = `${stubFolder(settings, incrementId)}/`; const found = new Map();
  for (const file of files) {
    if (!file.startsWith(folder) || file.slice(folder.length).includes('/')) continue;
    const match = /^ac-(\d+)(?:[-.])/i.exec(file.slice(folder.length));
    if (match) found.set(`AC-${Number(match[1])}`, [...(found.get(`AC-${Number(match[1])}`) ?? []), file]);
  }
  return found;
}

/** Given/When/Then parts of a criterion text as comment lines, or none when it does not use that form. */
function steps(text) {
  const parts = String(text).split(/\b(?=(?:Given|When|Then|And)\b)/).map(part => part.trim().replace(/[,;]$/, '')).filter(Boolean);
  return parts.some(part => /^Given\b/.test(part)) && parts.some(part => /^Then\b/.test(part)) ? parts.filter(part => /^(?:Given|When|Then|And)\b/.test(part)).map(part => `// ${part}`) : [];
}
const quoted = text => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const comment = text => text.replace(/\s+/g, ' ').replace(/\*\//g, '* /').trim();

/** The stub body of a template: the first fenced block of a Markdown template, else the whole text. */
const templateBody = template => /^(`{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/m.exec(String(template))?.[2].concat('\n') ?? String(template);

/** A new stub from the template; the template line that holds `{{steps}}` becomes the Given/When/Then lines. */
export function renderStub(template, { incrementId, incrementPath, criterion }) {
  const values = { increment: incrementId, incrementPath: incrementPath.replace(/\.md$/, ''), criterion: criterion.id, text: comment(criterion.text), title: quoted(comment(criterion.text)) };
  return templateBody(template).split(lineEnd).flatMap(line => (line.includes('{{steps}}') ? steps(criterion.text) : [line.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match)])).join('\n');
}

/** The Increment text with `Evidence: \`path\`` appended to each listed criterion that names no evidence yet. */
export function withEvidence(text, additions, label) {
  const lines = String(text).split('\n');
  for (const { line, path } of [...additions].sort((a, b) => b.line - a.line)) {
    let end = line - 1;
    while (end + 1 < lines.length && /^\s+\S/.test(lines[end + 1]) && !/^\s*[-*]\s/.test(lines[end + 1])) end++;
    lines[end] = `${lines[end].replace(/\s+$/, '')} ${label} \`${path}\``;
  }
  return lines.join('\n');
}

/**
 * The stub plan of one Increment: `create` (new stub files), `existing` stubs, `orphans` (stubs of criteria
 * that no longer exist) and the Increment text with the new evidence. Nothing is written here.
 */
export function planStubs(settings, { incrementId, incrementPath, incrementText, model, files, template, label = 'Evidence:' }) {
  const criteria = acceptanceCriteria(model.section('Acceptance criteria'), label).filter(item => item.valid);
  const stubs = stubsOf(settings, incrementId, files); const create = []; const evidence = [];
  for (const criterion of criteria) {
    const path = stubs.get(criterion.id)?.[0] ?? stubPath(settings, incrementId, criterion);
    if (!stubs.has(criterion.id) && !hasTestEvidence(settings, criterion, files)) create.push({ id: criterion.id, path, text: renderStub(template, { incrementId, incrementPath, criterion }) });
    if (!criterion.evidence.length && (stubs.has(criterion.id) || create.some(item => item.id === criterion.id))) evidence.push({ id: criterion.id, line: criterion.line, path });
  }
  const ids = new Set(criteria.map(item => item.id));
  const orphans = [...stubs].filter(([id]) => !ids.has(id)).flatMap(([, paths]) => paths);
  return { create, existing: [...stubs].filter(([id]) => ids.has(id)).flatMap(([, paths]) => paths), orphans, evidence: evidence.map(item => item.id),
    incrementText: evidence.length ? withEvidence(incrementText, evidence, label) : incrementText };
}

/** Existing test files a criterion names as evidence (outside its own stub folder lookup). */
export function testEvidence(settings, criterion, files) {
  const pattern = new RegExp(settings.evidencePattern, 'u');
  return criterion.evidence.map(evidencePath).filter(path => pattern.test(path) && files.includes(path));
}
/** A criterion whose evidence already names an existing test file needs no generated stub. */
export const hasTestEvidence = (settings, criterion, files) => testEvidence(settings, criterion, files).length > 0;
