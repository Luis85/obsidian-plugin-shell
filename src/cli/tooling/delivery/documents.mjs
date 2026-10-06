/**
 * The documents around an Increment and its branch model, as pure functions over a repository snapshot:
 * PullRequest and Issue documents, references between them (an id, a path or a [[wikilink]]), the configured
 * branch patterns and the scope of the pull request under check:
 *   change   - its base is the increment branch: the PullRequest-level Definition of Done applies;
 *   kickoff  - its head is the increment branch and its base the increment base: the Increment-level one;
 *   increment - any other pull request (the original one-handoff flow): the Increment-level one.
 */
import { parseHandoff } from './handoff.mjs';
import { matchesAny } from './paths.mjs';

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const placeholder = /\{(\w+)\}/g;
const text = value => (typeof value === 'string' ? value : '');
export const entries = value => (Array.isArray(value) ? value : []);

/** The repository path a reference names: an id becomes `<glob folder>/<id>.md`, a path keeps its folder. */
export function referencePath(glob, raw) {
  const value = text(raw).trim().replace(/^\[\[|\]\]$/g, '').split('|')[0].split('#')[0].trim();
  if (!value) return null;
  return value.includes('/') ? value.replace(/(?:\.md)?$/, '.md') : glob.replace('*', value.replace(/\.md$/i, ''));
}

/** A branch name from a pattern such as `increment/{id}`. */
export const branchName = (pattern, values) => pattern.replace(placeholder, (match, key) => values[key] ?? match);
/** The placeholder values of a branch name that matches the pattern, else null. */
export function parseBranch(pattern, name) {
  if (!name) return null;
  const source = pattern.split(placeholder).map((part, index) => (index % 2 ? `(?<${part}>[^/]+)` : escape(part))).join('');
  return new RegExp(`^${source}$`, 'u').exec(name)?.groups ?? null;
}
/** The increment branch and its base: the frontmatter `branch`/`base`, else the configured patterns. */
export function incrementBranches(delivery, model, id) {
  const data = model.frontmatter.data;
  return { branch: text(data.branch) || branchName(delivery.branches.increment, { id }), base: text(data.base) || delivery.branches.base };
}

function load(settings, snapshot, changed) {
  return snapshot.files.filter(path => matchesAny([settings.glob], path) && !settings.ignore.includes(path)).map(path => {
    const model = parseHandoff(snapshot.readText(path) ?? '');
    return { path, id: path.split('/').at(-1).replace(/\.md$/, ''), text: model.lines.join('\n'), model, data: model.frontmatter.data, changed: changed.has(path) };
  });
}
/** The Increment a reference names, read from the snapshot: { path, id, exists, model }. */
export function incrementAt(delivery, files, readText, raw) {
  const path = referencePath(delivery.handoff.glob, raw);
  const exists = Boolean(path) && files.includes(path) && matchesAny([delivery.handoff.glob], path);
  return { path, id: path?.split('/').at(-1).replace(/\.md$/, '') ?? '', exists, model: exists ? parseHandoff(readText(path) ?? '') : null };
}
/** The kind of a PullRequest document; a document without `kind` is a change. */
export const kindOf = document => text(document.data.kind) || 'change';
/** True when a PullRequest or Issue document names the Increment at `path` in its increment field. */
export const belongsTo = (delivery, settings, document, path) => document.data.type === settings.type && referencePath(delivery.handoff.glob, document.data[settings.incrementKey]) === path;

/** The pull request under check; `documents` are the PullRequest documents, `refs` its base and head branches. */
export function pullRequestScope(delivery, handoff, pullRequests, refs) {
  if (!handoff) return { kind: 'increment', branches: null, pullRequest: null };
  const branches = incrementBranches(delivery, handoff.model, handoff.path.split('/').at(-1).replace(/\.md$/, ''));
  const own = pullRequests.filter(document => belongsTo(delivery, delivery.pullRequests, document, handoff.path));
  if (refs.base && refs.base === branches.branch) {
    // The document whose head is this branch; without a known head (a detached checkout) the one changed change document.
    const chosen = refs.head ? own.filter(document => document.data.head === refs.head) : own.filter(document => document.changed && document.data.base === branches.branch);
    return { kind: 'change', branches, pullRequest: chosen.length === 1 ? chosen[0] : null, candidates: chosen.map(document => document.path) };
  }
  if (refs.head && refs.head === branches.branch && (!refs.base || refs.base === branches.base))
    return { kind: 'kickoff', branches, pullRequest: own.find(document => kindOf(document) === 'kickoff') ?? null };
  return { kind: 'increment', branches, pullRequest: null };
}

/**
 * The documents a run reads: every PullRequest and Issue document, those this pull request changes or is
 * (checked by the Definition of Ready), the scope and the document kinds whose ready rules run.
 */
export function documentState(delivery, snapshot, handoff) {
  const changed = new Set(snapshot.diff.filter(file => file.status !== 'D').map(file => file.path));
  const pullRequests = load(delivery.pullRequests, snapshot, changed), issues = load(delivery.issues, snapshot, changed);
  const refs = snapshot.refs ?? { base: '', head: '' };
  const scope = pullRequestScope(delivery, handoff, pullRequests, refs);
  const current = document => document.changed || (refs.head && document.data.head === refs.head) || document === scope.pullRequest;
  const inScope = { PullRequest: pullRequests.filter(current), Issue: issues.filter(document => document.changed) };
  const kinds = ['Increment', ...Object.keys(inScope).filter(kind => inScope[kind].length)];
  return { documents: { pullRequests, issues }, inScope, refs, scope, kinds };
}
