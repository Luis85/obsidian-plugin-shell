/**
 * Which Increment a pull request delivers, and whether it is exempt. The Increment is named by --handoff, a
 * "Handoff: path" line in the pull-request body, the one Increment the diff changes, the `increment:` field of
 * the PullRequest or Issue documents it changes, or else the branch: a base or head named after the increment
 * branch pattern (`increment/{id}`) or a head named after the pull-request branch pattern.
 */
import { parseFrontmatter } from './handoff.mjs';
import { parseBranch, referencePath } from './documents.mjs';
import { matchesAny, safeRelative } from './paths.mjs';

/** The exemption notice for a head branch or pull-request author the config exempts, else null. */
export function exemption(delivery, { headRef = '', actor = '' }) {
  const branch = delivery.exemptions.branches.find(prefix => headRef.startsWith(prefix));
  if (branch) return `Head branch ${headRef} is exempt (${branch}*): no increment handoff is required.`;
  if (delivery.exemptions.actors.includes(actor)) return `Pull requests by ${actor} are exempt: no increment handoff is required.`;
  return null;
}

/** Increment paths named by the increment field of changed PullRequest and Issue documents. */
function referencedIncrements(delivery, snapshot, documents) {
  const paths = new Set();
  for (const [path, settings] of documents) {
    const data = parseFrontmatter(String(snapshot.readText(path) ?? '').replace(/\r\n?/g, '\n').split('\n')).data;
    const found = data.type === settings.type ? referencePath(delivery.handoff.glob, data[settings.incrementKey]) : null;
    if (found) paths.add(found);
  }
  return [...paths];
}
/** The Increment path a branch names: `increment/{id}` as base or head, or `increment/{increment}/{pr}` as head. */
function branchIncrement(delivery, refs = {}) {
  const id = parseBranch(delivery.branches.increment, refs.base)?.id ?? parseBranch(delivery.branches.increment, refs.head)?.id
    ?? parseBranch(delivery.branches.pullRequest, refs.head)?.increment;
  return id ? [delivery.handoff.glob.replace('*', id)] : [];
}

/** Picks the Increment; returns { path, source } or { problem: { message, hint } }. */
export function selectHandoff(delivery, snapshot, explicit) {
  const settings = delivery.handoff; const create = delivery.refinement.newHandoff;
  const named = explicit ?? new RegExp(`^\\s*${settings.bodyKey}:\\s*\`?([^\\s\`]+)\`?\\s*$`, 'mu').exec(snapshot.body ?? '')?.[1];
  const source = explicit ? '--handoff' : 'pull request body';
  if (named) {
    if (!safeRelative(named) || !matchesAny([settings.glob], named)) return { problem: { message: `${named} (${source}) is not a handoff path matching ${settings.glob}.`, hint: `Name a file such as docs/increments/<slug>.md; create one with \`${create}\`.` } };
    return snapshot.files.includes(named) ? { path: named, source } : { problem: { message: `${named} (${source}) does not exist.`, hint: `Create it with \`${create}\` and commit it.` } };
  }
  const changed = (glob, ignore) => snapshot.diff.filter(file => file.status !== 'D' && matchesAny([glob], file.path) && !ignore.includes(file.path)).map(file => file.path);
  const documents = [delivery.pullRequests, delivery.issues].flatMap(kind => changed(kind.glob, kind.ignore ?? []).map(path => [path, kind]));
  const origins = [['diff', () => changed(settings.glob, settings.ignore)], ['PullRequest document', () => referencedIncrements(delivery, snapshot, documents)], ['branch', () => branchIncrement(delivery, snapshot.refs)]];
  let candidates = []; let origin = 'diff';
  for (const [name, find] of origins) { candidates = find(); origin = name; if (candidates.length) break; }
  if (candidates.length === 1) return snapshot.files.includes(candidates[0]) ? { path: candidates[0], source: origin }
    : { problem: { message: `${candidates[0]} (${origin}) does not exist.`, hint: `Create it with \`${create}\` and commit it.` } };
  if (!candidates.length) return { problem: { message: `No handoff matching ${settings.glob} is added or changed in this pull request.`, hint: `Create one with \`${create}\`, fill it in (or use the increment-handoff skill) and commit it with the pull request.` } };
  return { problem: { message: `${candidates.length} handoffs changed: ${candidates.join(', ')}.`, hint: `Keep one handoff per pull request, or name it with --handoff or a "${settings.bodyKey}: docs/increments/<slug>.md" line in the pull-request body.` } };
}
