/**
 * The PullRequest document ("increment plan"): one planned pull request of an Increment, rendered, parsed and
 * edited with span edits. While New every plan section is editable; once published only tasks and amendments
 * change locally, and sync owns status, head, base and the binding keys.
 */
import { insistDelivery } from './errors.ts';
import {
  bindingKeys, defaultDeliverySchema, hostingPlatforms, isDeliverySlug, limits, pullRequestSections, pullRequestStatuses, requireLine, requireTitle,
  scopeSubsections, type Amendment, type DeliverySchema, type HostingPlatform, type Problem, type PullRequestBinding, type PullRequestModel,
  type PullRequestRegion, type ScopeSide, type Task,
} from './model.ts';
import { lineEnding, listField, parseFrontmatter, quoteScalar, setFrontmatterValue, stringField, type SetOptions } from './frontmatter.ts';
import {
  appendListItem, appendScopeItem, blockText, ensureSection, ensureSubsection, findSection, findSubsection, hasPlaceholder, outline, replaceRange,
  replaceSectionContent, sectionBody, sectionContent, sectionItems, scopeItems, words, type Outline, type SectionSpan,
} from './sections.ts';
import { extractWikilinks, formatWikilink, linkProblems, parseWikilink, resolveWikilink } from './wikilinks.ts';
import { canonicalSection, fragmentItems, inputText, type InputFragment } from './input-fragment.ts';
import { checkPullRequestTransition, requirePullRequestEdit, type PullRequestEdit } from './transitions.ts';
import { retitle, type EditSummary } from './increment-document.ts';

export const pullRequestKeys = ['type', 'id', 'title', 'increment', 'status', 'delivers', 'head', 'base', ...bindingKeys] as const;
const order: readonly string[] = pullRequestSections, keyOrder: readonly string[] = pullRequestKeys;
const platforms: readonly string[] = hostingPlatforms, statuses: readonly string[] = pullRequestStatuses;
const isPlatform = (value: string): value is HostingPlatform => platforms.includes(value);
const scopeNames: readonly string[] = [scopeSubsections.in, scopeSubsections.out];
const amendmentsComment = '<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->';
const set = (text: string, key: string, value: string | string[] | null, quote = false) =>
  setFrontmatterValue(text, key, value, { after: keyOrder.slice(0, keyOrder.indexOf(key)), quote, code: 'PR_DOCUMENT_INVALID' } satisfies SetOptions);

export interface NewPullRequest {
  id: string; title: string; increment: { id: string; title: string; path: string };
  summary?: string; head?: string; base?: string; delivers?: string[]; fragment?: InputFragment | null;
}
/** The next free `<increment>-<n>` id; refuses when it would exceed the slug length. */
export function nextPullRequestId(incrementId: string, existing: readonly string[], schema: DeliverySchema = defaultDeliverySchema): string {
  const used = existing.map(id => id.startsWith(`${incrementId}-`) ? Number(id.slice(incrementId.length + 1)) : NaN).filter(Number.isInteger);
  const id = `${incrementId}-${Math.max(0, ...used) + 1}`;
  insistDelivery(isDeliverySlug(id, schema), 'PR_ID_INVALID', `${id} is longer than ${schema.handoff.maxSlugLength} characters; pass --id with a shorter slug.`);
  return id;
}
/** A new PullRequest document with status New, linked to its Increment. */
export function renderPullRequest(input: NewPullRequest, schema: DeliverySchema = defaultDeliverySchema): string {
  insistDelivery(isDeliverySlug(input.id, schema), 'PR_ID_INVALID', `"${input.id}" must match ${schema.handoff.slugPattern} with at most ${schema.handoff.maxSlugLength} characters.`);
  insistDelivery(isDeliverySlug(input.increment.id, schema), 'PR_INCREMENT_REQUIRED', 'A pull request belongs to an existing increment.');
  const title = requireTitle(input.title, 'PR_DOCUMENT_INVALID');
  const lines = ['---', 'type: PullRequest', `id: ${input.id}`, `title: ${quoteScalar(title)}`, `increment: ${input.increment.id}`, 'status: New', '---', '', `# ${title}`, '',
    '## Summary', '', '## Scope', '', '### In scope', '', '### Out of scope', '', '## Tasks', '', '## Documents', '',
    `- ${formatWikilink(input.increment.path, `Increment: ${input.increment.title}`)}`, '', '## Notes', '', '## Amendments', '', amendmentsComment, ''];
  let text = lines.join('\n');
  if (input.delivers?.length) text = set(text, 'delivers', input.delivers.map(id => requireLine(id, 'an acceptance criterion id', 'PR_DOCUMENT_INVALID')));
  for (const key of ['head', 'base'] as const) if (input[key]) text = set(text, key, branch(input[key]!), key === 'head');
  if (input.summary) text = replaceIn(text, 'Summary', inputText(input.summary));
  return input.fragment ? applyFragment(text, input.fragment).text : text;
}
/** A branch name: one line without spaces, control characters or `..`. */
function branch(value: string): string {
  const name = requireLine(value, 'a branch name', 'PR_DOCUMENT_INVALID', 200);
  insistDelivery(/^[^\s~^:?*[\\]+$/u.test(name) && !name.includes('..') && !name.startsWith('-'), 'PR_DOCUMENT_INVALID', `"${name}" is not a branch name.`);
  return name;
}

const taskPattern = /^\[( |x|X)\]\s+(T-\d+):\s*(\S.*)$/;
const amendmentPattern = /^(A-\d+)\s+·\s+(\d{4}-\d{2}-\d{2})$/u;
const block = (text: string) => blockText(text, '\n');
const section = (doc: Outline, name: string) => findSection(doc, name);
interface TaskItem extends Task { valid: boolean; start: number; next: number }
function taskItems(text: string, doc: Outline): TaskItem[] {
  const tasks = section(doc, 'Tasks');
  return (tasks ? sectionItems(text, tasks) : []).map(item => {
    const match = taskPattern.exec(item.full);
    return { valid: Boolean(match), id: match?.[2] ?? '', checked: match ? match[1] !== ' ' : false, text: match?.[3] ?? item.full, line: item.line, start: item.start, next: item.next };
  });
}
function amendments(text: string, doc: Outline): Amendment[] {
  return (section(doc, 'Amendments')?.subsections ?? []).flatMap(sub => {
    const match = amendmentPattern.exec(sub.name);
    return match ? [{ id: match[1]!, date: match[2]!, body: block(sectionBody(text, sub)), line: sub.line }] : [];
  });
}
function binding(data: Record<string, string | string[]>): PullRequestBinding | null {
  const value = (key: string) => stringField(data, key), number = Number(value('number')), platform = value('platform');
  if (!isPlatform(platform) || !Number.isInteger(number) || number < 1) return null;
  return { platform, repository: value('repository'), number, url: value('url'), publishedAt: value('publishedAt'), lastSyncedAt: value('lastSyncedAt') };
}
const regionText = (text: string, doc: Outline, name: string, whole = false) => {
  const found = section(doc, name);
  return found ? block(whole ? sectionBody(text, found) : sectionContent(text, found)) : '';
};
/** The model of a PullRequest; problems are reported by validation, never thrown here. */
export function parsePullRequest(text: string): PullRequestModel {
  const data = parseFrontmatter(text).data, doc = outline(text), field = (key: string) => stringField(data, key);
  const regions: Record<PullRequestRegion, string> = { summary: regionText(text, doc, 'Summary'), scope: regionText(text, doc, 'Scope', true),
    documents: regionText(text, doc, 'Documents'), notes: regionText(text, doc, 'Notes') };
  const documents = section(doc, 'Documents');
  return {
    id: field('id'), title: field('title'), increment: field('increment'), status: field('status'), delivers: listField(data, 'delivers'),
    head: field('head') || null, base: field('base') || null, binding: binding(data), frontmatter: data, heading: doc.title?.name ?? null,
    sections: doc.sections.map(found => ({ name: found.name, line: found.line, words: words(sectionBody(text, found)) })), regions, scope: scopeItems(text, doc),
    tasks: taskItems(text, doc).filter(item => item.valid).map(({ id, checked, text: body, line }) => ({ id, checked, text: body, line })),
    amendments: amendments(text, doc), documents: documents ? sectionItems(text, documents).map(item => item.full) : [],
  };
}
/** Published means the document carries a binding to a hosting-platform pull request. */
export const isPublished = (model: PullRequestModel): boolean => model.binding !== null;

export type PullRequestOp =
  | { kind: 'field'; key: 'title' | 'head' | 'base'; value: string }
  | { kind: 'section'; name: string; body: string }
  | { kind: 'scope'; side: ScopeSide; text: string }
  | { kind: 'document'; target: string; label?: string }
  | { kind: 'notes'; body: string; replace?: boolean }
  | { kind: 'task-add'; text: string; checked?: boolean }
  | { kind: 'task-set'; id: string; checked?: boolean; text?: string }
  | { kind: 'amend'; body: string; date: string }
  | { kind: 'fragment'; fragment: InputFragment }
  | { kind: 'increment'; id: string; title: string; path: string; previousPath?: string };
export interface PullRequestEditResult { text: string; edits: EditSummary[] }
const lockFor = (op: PullRequestOp): PullRequestEdit => op.kind === 'field' ? op.key : op.kind === 'fragment' ? 'section' : op.kind === 'increment' ? 'attach' : op.kind;
/** Applies one edit after the lock table allows it for the document's status and publication. */
export function editPullRequest(text: string, op: PullRequestOp, files?: readonly string[]): PullRequestEditResult {
  const model = parsePullRequest(text);
  requirePullRequestEdit(model.status, isPublished(model), lockFor(op));
  return op.kind === 'task-add' || op.kind === 'task-set' || op.kind === 'amend' ? itemEdit(text, op) : planEdit(text, op, files);
}
function itemEdit(text: string, op: Extract<PullRequestOp, { kind: 'task-add' | 'task-set' | 'amend' }>): PullRequestEditResult {
  if (op.kind === 'task-add') return addTask(text, op.text, op.checked);
  return op.kind === 'task-set' ? setTask(text, op.id, op) : appendAmendment(text, { body: op.body, date: op.date });
}
function planEdit(text: string, op: Exclude<PullRequestOp, { kind: 'task-add' | 'task-set' | 'amend' }>, files?: readonly string[]): PullRequestEditResult {
  switch (op.kind) {
    case 'field': return { text: setPullRequestField(text, op.key, op.value), edits: [{ section: 'frontmatter', action: 'set', itemId: op.key }] };
    case 'section': return setSection(text, op.name, op.body);
    case 'scope': return { text: appendScopeItem(text, order, op.side, requireLine(op.text, 'a scope item', 'PR_DOCUMENT_INVALID')), edits: [{ section: scopeSubsections[op.side], action: 'add' }] };
    case 'document': return addDocument(text, op.target, op.label, files);
    case 'notes': return setNotes(text, op.body, op.replace === true);
    case 'fragment': return applyFragment(text, op.fragment);
    default: return attach(text, op);
  }
}
/** Sets title (and the matching `# heading`), head or base without a lock check (sync uses it). */
export function setPullRequestField(text: string, key: 'title' | 'head' | 'base', value: string): string {
  if (key !== 'title') return set(text, key, branch(value), key === 'head');
  const title = requireTitle(value, 'PR_DOCUMENT_INVALID');
  return retitle(set(text, 'title', title, true), stringField(parseFrontmatter(text).data, 'title'), title);
}
function replaceIn(text: string, name: string, body: string, find: (doc: Outline) => SectionSpan | null = doc => findSection(doc, name)): string {
  const prepared = ensureSection(text, name, order);
  return replaceSectionContent(prepared, find(outline(prepared))!, body, true);
}
function setSection(text: string, raw: string, body: string): PullRequestEditResult {
  const name = canonicalSection(raw, ['Summary', 'Notes', ...scopeNames]), content = inputText(body, 'PR_DOCUMENT_INVALID');
  if (!scopeNames.includes(name)) return { text: replaceIn(text, name, content), edits: [{ section: name, action: 'replace' }] };
  const prepared = ensureSubsection(ensureSection(text, 'Scope', order), 'Scope', name, scopeNames);
  return { text: replaceIn(prepared, 'Scope', content, doc => findSubsection(findSection(doc, 'Scope'), name)), edits: [{ section: name, action: 'replace' }] };
}
const stem = (path: string) => path.replace(/\.md$/i, '').toLowerCase();
/** Adds `- [[target|label]]` under Documents; a target already listed is a no-op, a missing one refuses when `files` is known. */
function addDocument(text: string, target: string, label: string | undefined, files?: readonly string[]): PullRequestEditResult {
  const parsed = parseWikilink(requireLine(target, 'a document target', 'PR_DOCUMENT_INVALID').replace(/^\[\[|\]\]$/g, ''));
  insistDelivery(parsed.path, 'PR_DOCUMENT_INVALID', 'A document target names a Markdown file.');
  insistDelivery(!files || resolveWikilink(files, parsed.path).status !== 'missing', 'WIKILINK_UNRESOLVED', `[[${parsed.path}]] does not resolve to a Markdown file.`, { target: parsed.path });
  const alias = label === undefined ? parsed.alias ?? undefined : requireLine(label, 'a label', 'PR_DOCUMENT_INVALID');
  const link = formatWikilink(parsed.path + (parsed.heading ? `#${parsed.heading}` : ''), alias), model = parsePullRequest(text);
  insistDelivery(model.documents.length < limits.documents, 'PR_LIMIT', `A pull request lists at most ${limits.documents} documents.`);
  if (model.documents.some(item => extractWikilinks(item).some(found => stem(found.path) === stem(parsed.path)))) return { text, edits: [] };
  return { text: appendListItem(ensureSection(text, 'Documents', order), doc => findSection(doc, 'Documents'), link), edits: [{ section: 'Documents', action: 'add' }] };
}
function setNotes(text: string, body: string, replace: boolean): PullRequestEditResult {
  const content = block(inputText(body, 'PR_DOCUMENT_INVALID', limits.notes)), current = parsePullRequest(text).regions.notes;
  const next = replace || !current ? content : `${current}\n\n${content}`;
  insistDelivery(next.length <= limits.notes, 'PR_LIMIT', `Notes hold at most ${limits.notes} characters.`);
  return { text: replaceIn(text, 'Notes', next), edits: [{ section: 'Notes', action: replace ? 'replace' : 'add' }] };
}
const nextId = (prefix: string, ids: readonly string[]) => `${prefix}-${Math.max(0, ...ids.map(id => Number(id.slice(prefix.length + 1))).filter(Number.isInteger)) + 1}`;
function addTask(text: string, body: string, checked = false): PullRequestEditResult {
  const items = taskItems(text, outline(text));
  insistDelivery(items.length < limits.tasks, 'PR_LIMIT', `A pull request holds at most ${limits.tasks} tasks.`);
  const id = nextId('T', items.filter(item => item.valid).map(item => item.id)), line = `[${checked ? 'x' : ' '}] ${id}: ${requireLine(body, 'a task', 'PR_DOCUMENT_INVALID')}`;
  return { text: appendListItem(ensureSection(text, 'Tasks', order), doc => findSection(doc, 'Tasks'), line), edits: [{ section: 'Tasks', action: 'add', itemId: id }] };
}
function setTask(text: string, id: string, change: { checked?: boolean; text?: string }): PullRequestEditResult {
  const item = taskItems(text, outline(text)).find(entry => entry.valid && entry.id === id);
  insistDelivery(item, 'PR_TASK_NOT_FOUND', `${id} is not a task of this pull request.`);
  const body = change.text === undefined ? item.text : requireLine(change.text, 'the task text', 'PR_DOCUMENT_INVALID');
  const ending = /(?:\r\n|\r|\n)$/.exec(text.slice(item.start, item.next))?.[0] ?? '';
  return { text: replaceRange(text, item.start, item.next, `- [${(change.checked ?? item.checked) ? 'x' : ' '}] ${id}: ${body}${ending}`), edits: [{ section: 'Tasks', action: 'set', itemId: id }] };
}
/** Rewrites the task list in the given order (sync merge output); keeps a leading guidance comment. */
export function writeTasks(text: string, tasks: readonly Pick<Task, 'id' | 'checked' | 'text'>[]): string {
  insistDelivery(tasks.length <= limits.tasks, 'PR_LIMIT', `A pull request holds at most ${limits.tasks} tasks.`);
  const lines = tasks.map(task => `- [${task.checked ? 'x' : ' '}] ${task.id}: ${requireLine(task.text, 'a task', 'PR_DOCUMENT_INVALID')}`);
  return replaceIn(text, 'Tasks', lines.join('\n'));
}
/** Appends `### A-n · date` with Markdown under Amendments; an explicit id comes from sync, otherwise the next id. */
export function appendAmendment(text: string, amendment: { id?: string; date: string; body: string }): PullRequestEditResult {
  const prepared = ensureSection(text, 'Amendments', order), doc = outline(prepared), existing = amendments(prepared, doc);
  insistDelivery(existing.length < limits.amendments, 'PR_LIMIT', `A pull request holds at most ${limits.amendments} amendments.`);
  insistDelivery(/^\d{4}-\d{2}-\d{2}$/.test(amendment.date), 'PR_DOCUMENT_INVALID', 'Amendment dates are YYYY-MM-DD.');
  const id = amendment.id ?? nextId('A', existing.map(item => item.id)), body = block(inputText(amendment.body, 'PR_DOCUMENT_INVALID', limits.amendment));
  insistDelivery(/^A-\d+$/.test(id) && !existing.some(item => item.id === id), 'PR_DOCUMENT_INVALID', `${id} is not a new amendment id.`);
  insistDelivery(body.length > 0 && !/^#{1,3}\s/m.test(body), 'PR_DOCUMENT_INVALID', 'An amendment needs text and cannot contain #, ## or ### headings.');
  const eol = lineEnding(prepared), amendmentsSection = findSection(doc, 'Amendments')!, at = amendmentsSection.end, before = prepared.slice(0, at);
  const lead = /(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)$/.test(before) ? '' : /[\r\n]$/.test(before) ? eol : eol + eol;
  const entry = `${lead}### ${id} · ${amendment.date}${eol}${eol}${body.split('\n').join(eol)}${eol}${at < prepared.length ? eol : ''}`;
  return { text: replaceRange(prepared, at, at, entry), edits: [{ section: 'Amendments', action: 'add', itemId: id }] };
}
function attach(text: string, op: Extract<PullRequestOp, { kind: 'increment' }>): PullRequestEditResult {
  insistDelivery(isDeliverySlug(op.id), 'PR_INCREMENT_REQUIRED', 'A pull request belongs to an existing increment.');
  let next = set(text, 'increment', op.id);
  const documents = findSection(outline(next), 'Documents');
  const old = op.previousPath?.replace(/\.md$/i, ''), stale = documents && old ? sectionItems(next, documents).find(item => extractWikilinks(item.full).some(link => link.path === old)) : undefined;
  if (stale) next = replaceRange(next, stale.start, stale.next, '');
  next = appendListItem(ensureSection(next, 'Documents', order), doc => findSection(doc, 'Documents'), formatWikilink(op.path, `Increment: ${op.title}`));
  return { text: next, edits: [{ section: 'frontmatter', action: 'set', itemId: 'increment' }, { section: 'Documents', action: 'add' }] };
}
function applyFragment(text: string, fragment: InputFragment): PullRequestEditResult {
  insistDelivery(!fragment.preamble, 'PR_DOCUMENT_INVALID', 'Start every part of the input with a ## section heading.');
  let result: PullRequestEditResult = { text: fragment.title ? setPullRequestField(text, 'title', fragment.title) : text, edits: [] };
  const run = (change: PullRequestEditResult) => { result = { text: change.text, edits: [...result.edits, ...change.edits] }; };
  for (const part of fragment.sections) {
    const name = canonicalSection(part.name, ['Summary', 'Scope', 'Tasks', 'Documents', 'Notes']);
    if (name === 'Tasks') fragmentItems(part.body).forEach(item => { const match = /^\[( |x|X)\]\s+(.*)$/.exec(item); run(addTask(result.text, match?.[2] ?? item, Boolean(match && match[1] !== ' '))); });
    else if (name === 'Documents') fragmentItems(part.body).forEach(item => run(addDocument(result.text, item, undefined)));
    else if (name !== 'Scope' || part.body) run(setSection(result.text, name === 'Scope' ? 'In scope' : name, part.body));
    for (const sub of part.subsections) {
      insistDelivery(name === 'Scope', 'INCREMENT_SECTION_UNKNOWN', `### ${sub.name} is only allowed under ## Scope.`);
      run(setSection(result.text, sub.name, sub.body));
    }
  }
  return result;
}

/** Status changes the CLI makes locally: closing or reopening an unpublished pull request. */
export function changePullRequestStatus(text: string, to: string): string {
  const model = parsePullRequest(text);
  return set(text, 'status', checkPullRequestTransition(model.status, to, isPublished(model)));
}
/** Writes a status without the local transition table; sync applies the hosting platform's state. */
export function setPullRequestStatus(text: string, status: string): string {
  insistDelivery(statuses.includes(status), 'PR_DOCUMENT_INVALID', `Unknown pull-request status ${status}.`);
  return set(text, 'status', status);
}
/** Writes the binding keys after publication or sync. */
export function setPullRequestBinding(text: string, value: PullRequestBinding): string {
  insistDelivery(isPlatform(value.platform) && Number.isInteger(value.number) && value.number > 0, 'PR_DOCUMENT_INVALID', 'A binding needs a platform and a pull-request number.');
  const values: Record<(typeof bindingKeys)[number], string> = { ...value, number: String(value.number) };
  return bindingKeys.reduce((next, key) => set(next, key, requireLine(values[key], key, 'PR_DOCUMENT_INVALID'), ['repository', 'url'].includes(key)), text);
}
/** Replaces one whole body region with sync output (summary, documents and notes; scope includes its subsections). */
export function replacePullRequestRegion(text: string, region: PullRequestRegion, body: string): string {
  const name = { summary: 'Summary', scope: 'Scope', documents: 'Documents', notes: 'Notes' }[region], prepared = ensureSection(text, name, order);
  const found = findSection(outline(prepared), name)!;
  if (region !== 'scope') return replaceSectionContent(prepared, found, body, true);
  const eol = lineEnding(prepared), content = blockText(body, eol);
  return replaceRange(prepared, found.bodyStart, found.end, `${eol}${content ? content + eol : ''}${found.end < prepared.length ? eol : ''}`);
}

export interface PullRequestValidation { path?: string; files?: readonly string[]; increment?: { id: string; acceptance: readonly { id: string }[] } | null; schema?: DeliverySchema }
const problem = (message: string, line?: number): Problem => ({ code: 'PR_DOCUMENT_INVALID', message, ...(line ? { line } : {}) });
function frontmatterProblems(text: string, options: PullRequestValidation): Problem[] {
  const frontmatter = parseFrontmatter(text), data = frontmatter.data, field = (key: string) => stringField(data, key);
  if (!frontmatter.present) return [problem('The file does not start with a --- frontmatter block.', 1)];
  const problems = frontmatter.errors.map(error => problem(error.message, error.line)), slug = options.path?.split('/').at(-1)?.replace(/\.md$/, '');
  if (field('type') !== 'PullRequest') problems.push(problem('type must be PullRequest.'));
  if (!isDeliverySlug(field('id'), options.schema) || (slug !== undefined && field('id') !== slug)) problems.push(problem(`id "${field('id')}" must be a slug equal to the file name.`));
  if (!field('title')) problems.push(problem('title is missing.'));
  if (!statuses.includes(field('status'))) problems.push(problem(`status must be one of ${pullRequestStatuses.join(', ')}.`));
  if (!field('increment')) problems.push({ code: 'PR_INCREMENT_REQUIRED', message: 'increment names the Increment this pull request delivers.' });
  if (bindingKeys.some(key => data[key] !== undefined) && !binding(data)) problems.push(problem('The binding keys (platform, number, …) are incomplete or invalid.'));
  const acceptance = options.increment?.acceptance.map(item => item.id);
  for (const id of listField(data, 'delivers').filter(value => acceptance && !acceptance.includes(value))) problems.push(problem(`delivers names ${id}, which is not an acceptance criterion of ${field('increment')}.`));
  return problems;
}
/** Structural validation of a PullRequest plus wikilinks when `files` is given. */
export function validatePullRequest(text: string, options: PullRequestValidation = {}): Problem[] {
  const doc = outline(text), problems = frontmatterProblems(text, options), items = taskItems(text, doc), ids = items.filter(item => item.valid).map(item => item.id);
  for (const name of order.filter(name => !section(doc, name))) problems.push(problem(`## ${name} is missing.`));
  for (const item of items.filter(entry => !entry.valid && !hasPlaceholder(entry.text))) problems.push(problem(`"${item.text}" is not "[ ] T-n: text".`, item.line));
  for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) problems.push(problem(`${id} appears more than once.`));
  const model = parsePullRequest(text), sizes = [[model.tasks.length, limits.tasks], [model.amendments.length, limits.amendments], [model.documents.length, limits.documents], [model.regions.notes.length, limits.notes]];
  if (sizes.some(([size, limit]) => size! > limit!)) problems.push({ code: 'PR_LIMIT', message: `At most ${limits.tasks} tasks, ${limits.amendments} amendments, ${limits.documents} documents and ${limits.notes} characters of notes.` });
  const body = parseFrontmatter(text);
  return [...problems, ...(options.files ? linkProblems(text.slice(body.bodyStart), options.files, body.end).map(({ code, message, line }) => ({ code, message, line })) : [])];
}
