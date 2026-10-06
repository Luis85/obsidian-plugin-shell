/** Owner approvals for exact flagged lines, read by the self-review guard. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const APPROVALS_PATH = 'configs/quality/self-review-approvals.json';
/**
 * How an approval matches. A `file` rule is approved only when every added and removed line of that file is listed; a
 * `line` rule approves just the flagged lines whose exact text is listed, one listed text per flagged line.
 */
const approvalScopes = Object.freeze({
  'SR-QUALITY-CONFIG': 'file', 'SR-LINT-CONFIG': 'line', 'SR-COVERAGE-THRESHOLD': 'line',
  'SR-LINT-DISABLE': 'line', 'SR-TS-SUPPRESSION': 'line', 'SR-UNSAFE-CAST': 'line',
});
const scopeOf = rule => (typeof rule === 'string' && Object.hasOwn(approvalScopes, rule) ? approvalScopes[rule] : undefined);
const isLines = value => Array.isArray(value) && value.every(line => typeof line === 'string');

function validEntry(entry) {
  const scope = scopeOf(entry?.rule);
  return Boolean(scope) && typeof entry.file === 'string' && entry.file !== '' && /^@\S+$/.test(entry.approvedBy ?? '')
    && typeof entry.reason === 'string' && entry.reason.trim() !== '' && isLines(entry.added) && isLines(entry.removed)
    && (scope === 'file' || entry.added.length + entry.removed.length > 0);
}

/** A malformed record fails the guard; it never silently approves or drops approvals. */
function parseApprovals(text) {
  const data = JSON.parse(text);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.approvals)) throw new Error(`SELF_REVIEW_APPROVALS: ${APPROVALS_PATH} needs schemaVersion 1 and an approvals array.`);
  return data.approvals.map((entry, index) => {
    if (!validEntry(entry)) throw new Error(`SELF_REVIEW_APPROVALS: approval ${index} needs rule (${Object.keys(approvalScopes).join(', ')}), file, approvedBy (@owner), reason, added[] and removed[]; a line rule lists at least one line.`);
    return entry;
  });
}

export async function readApprovals(root) {
  let text;
  try { text = await readFile(join(root, APPROVALS_PATH), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return parseApprovals(text);
}

/** Listed lines per side with their counts, so a repeated line must be listed once per occurrence. */
function budget(entries) {
  const left = { added: new Map(), removed: new Map() };
  for (const entry of entries) for (const side of ['added', 'removed']) for (const line of entry[side]) left[side].set(line, (left[side].get(line) ?? 0) + 1);
  return left;
}
/** Spends one listed occurrence of `line`; false when none is left. */
function take(left, line) {
  const count = left.get(line) ?? 0;
  left.set(line, count - 1);
  return count > 0;
}

/** File scope: all findings are approved when every added and removed line of their file is listed. */
function fileApproved(items, entries, file) {
  const left = budget(entries);
  const covered = file.added.every(line => take(left.added, line.text)) && file.removed.every(line => take(left.removed, line.text));
  return covered ? items : [];
}

/** Line scope: each flagged line (one per side and line number) spends one listed occurrence of its exact text. */
function linesApproved(items, entries, file) {
  const left = budget(entries);
  const decided = new Map();
  return items.filter(item => {
    const side = item.side === 'removed' ? 'removed' : 'added';
    const key = `${side}:${item.line}`;
    if (!decided.has(key)) {
      const text = file[side].find(entry => entry.line === item.line)?.text;
      decided.set(key, text !== undefined && take(left[side], text));
    }
    return decided.get(key);
  });
}

/** Findings covered by an approval for their rule and file, mapped to the approvers. */
export function approvedFindings(found, files, approvals) {
  const groups = new Map();
  for (const item of found.filter(finding => scopeOf(finding.rule))) {
    const key = `${item.rule}\n${item.file}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const approved = new Map();
  for (const items of groups.values()) {
    const { rule, file: path } = items[0];
    const entries = approvals.filter(entry => entry.rule === rule && entry.file === path);
    const file = files.find(change => change.path === path);
    if (!entries.length || !file) continue;
    const by = [...new Set(entries.map(entry => entry.approvedBy))].join(', ');
    const accepted = scopeOf(rule) === 'file' ? fileApproved(items, entries, file) : linesApproved(items, entries, file);
    for (const item of accepted) approved.set(item, by);
  }
  return approved;
}
