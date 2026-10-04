/** Owner approvals for exact quality-configuration lines, read by the self-review guard. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const APPROVALS_PATH = 'configs/quality/self-review-approvals.json';
const approvableRules = ['SR-QUALITY-CONFIG'];
const isLines = value => Array.isArray(value) && value.every(line => typeof line === 'string');

/** A malformed record fails the guard; it never silently approves or drops approvals. */
function parseApprovals(text) {
  const data = JSON.parse(text);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.approvals)) throw new Error(`SELF_REVIEW_APPROVALS: ${APPROVALS_PATH} needs schemaVersion 1 and an approvals array.`);
  return data.approvals.map((entry, index) => {
    const valid = approvableRules.includes(entry?.rule) && typeof entry.file === 'string' && /^@\S+$/.test(entry.approvedBy ?? '')
      && typeof entry.reason === 'string' && entry.reason.trim() !== '' && isLines(entry.added) && isLines(entry.removed);
    if (!valid) throw new Error(`SELF_REVIEW_APPROVALS: approval ${index} needs rule (${approvableRules.join(', ')}), file, approvedBy (@owner), reason, added[] and removed[].`);
    return entry;
  });
}

export async function readApprovals(root) {
  let text;
  try { text = await readFile(join(root, APPROVALS_PATH), 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return parseApprovals(text);
}

/** True when every changed line is listed, counting repeated lines separately. */
function covers(approved, changed) {
  const left = new Map();
  for (const line of approved) left.set(line, (left.get(line) ?? 0) + 1);
  return changed.every(line => {
    const count = left.get(line) ?? 0;
    left.set(line, count - 1);
    return count > 0;
  });
}

/** Findings whose file's every added and removed line is listed by an approval for that rule and file, mapped to the approvers. */
export function approvedFindings(found, files, approvals) {
  const approved = new Map();
  for (const item of found) {
    const entries = approvals.filter(entry => entry.rule === item.rule && entry.file === item.file);
    const file = files.find(change => change.path === item.file);
    if (!entries.length || !file) continue;
    const added = covers(entries.flatMap(entry => entry.added), file.added.map(line => line.text));
    const removed = covers(entries.flatMap(entry => entry.removed), file.removed.map(line => line.text));
    if (added && removed) approved.set(item, [...new Set(entries.map(entry => entry.approvedBy))].join(', '));
  }
  return approved;
}
