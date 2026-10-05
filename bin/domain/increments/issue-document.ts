/**
 * The Issue document: one unit of work an Increment is broken down into, kept as frontmatter+Markdown in the
 * issues folder. Local only for now; a hosting tracker could later sync it through a port like pull requests.
 * Criteria either refer to the increment's (`AC-n`) or are the issue's own (`IC-n`).
 */
import { insistDelivery } from './errors.ts';
import { defaultDeliverySchema, issueSections, issueStatuses, isDeliverySlug, requireLine, requireTitle, type DeliverySchema, type IssueCriterion, type IssueModel, type Problem } from './model.ts';
import { listField, parseFrontmatter, quoteScalar, setFrontmatterValue, stringField } from './frontmatter.ts';
import { appendListItem, blockText, ensureSection, findSection, outline, replaceRange, replaceSectionContent, sectionBody, sectionContent, sectionItems, words, type Outline } from './sections.ts';
import { linkProblems } from './wikilinks.ts';
import { canonicalSection, fragmentItems, inputText, type InputFragment } from './input-fragment.ts';
import { checkIssueTransition, requireIssueEditable } from './transitions.ts';
import { retitle, type EditSummary } from './increment-document.ts';

const issueKeys = ['type', 'id', 'title', 'status', 'increment', 'pullRequests'] as const;
const order: readonly string[] = issueSections, keyOrder: readonly string[] = issueKeys, statuses: readonly string[] = issueStatuses;
const set = (text: string, key: string, value: string | string[] | null, quote = false) =>
  setFrontmatterValue(text, key, value, { after: keyOrder.slice(0, keyOrder.indexOf(key)), quote, code: 'ISSUE_DOCUMENT_INVALID' });
const slug = (value: string, code: 'ISSUE_ID_INVALID' | 'ISSUE_INCREMENT_REQUIRED' | 'ISSUE_DOCUMENT_INVALID', schema: DeliverySchema = defaultDeliverySchema) => {
  insistDelivery(isDeliverySlug(value, schema), code, `"${value}" must match ${schema.handoff.slugPattern} with at most ${schema.handoff.maxSlugLength} characters.`);
  return value;
};

/** The first issue of an increment takes the increment id; later ones `<increment>-<n>`. */
export function nextIssueId(incrementId: string, existing: readonly string[], schema: DeliverySchema = defaultDeliverySchema): string {
  if (!existing.includes(incrementId)) return slug(incrementId, 'ISSUE_ID_INVALID', schema);
  const used = existing.map(id => id.startsWith(`${incrementId}-`) ? Number(id.slice(incrementId.length + 1)) : NaN).filter(Number.isInteger);
  return slug(`${incrementId}-${Math.max(0, ...used) + 1}`, 'ISSUE_ID_INVALID', schema);
}
export interface NewIssue { id: string; title: string; increment: string; summary?: string; fragment?: InputFragment | null }
/** A new Issue with status New. */
export function renderIssue(input: NewIssue, schema: DeliverySchema = defaultDeliverySchema): string {
  slug(input.id, 'ISSUE_ID_INVALID', schema); slug(input.increment, 'ISSUE_INCREMENT_REQUIRED', schema);
  const title = requireTitle(input.title, 'ISSUE_DOCUMENT_INVALID');
  const text = ['---', 'type: Issue', `id: ${input.id}`, `title: ${quoteScalar(title)}`, 'status: New', `increment: ${input.increment}`, '---', '', `# ${title}`, '',
    '## Summary', '', '## Acceptance criteria', '', '## Notes', ''].join('\n');
  const summarized = input.summary ? replaceIn(text, 'Summary', inputText(input.summary, 'ISSUE_DOCUMENT_INVALID')) : text;
  return input.fragment ? applyFragment(summarized, input.fragment).text : summarized;
}

const criterionPattern = /^\[( |x|X)\]\s+((?:AC|IC)-\d+):\s*(\S.*)$/;
interface CriterionItem extends IssueCriterion { valid: boolean; start: number; next: number }
function criteria(text: string, doc: Outline): CriterionItem[] {
  const found = findSection(doc, 'Acceptance criteria');
  return (found ? sectionItems(text, found) : []).map(item => {
    const match = criterionPattern.exec(item.full);
    return { valid: Boolean(match), id: match?.[2] ?? '', checked: match ? match[1] !== ' ' : false, text: match?.[3] ?? item.full, line: item.line, start: item.start, next: item.next };
  });
}
const region = (text: string, doc: Outline, name: string) => {
  const found = findSection(doc, name);
  return found ? blockText(sectionContent(text, found), '\n') : '';
};
/** The model of an Issue; problems are reported by validation, never thrown here. */
export function parseIssue(text: string): IssueModel {
  const data = parseFrontmatter(text).data, doc = outline(text), field = (key: string) => stringField(data, key);
  return {
    id: field('id'), title: field('title'), status: field('status'), increment: field('increment'), pullRequests: listField(data, 'pullRequests'), frontmatter: data,
    heading: doc.title?.name ?? null, sections: doc.sections.map(found => ({ name: found.name, line: found.line, words: words(sectionBody(text, found)) })),
    regions: { summary: region(text, doc, 'Summary'), notes: region(text, doc, 'Notes') },
    acceptance: criteria(text, doc).filter(item => item.valid).map(({ id, checked, text: body, line }) => ({ id, checked, text: body, line })),
  };
}

export type IssueOp =
  | { kind: 'title'; value: string }
  | { kind: 'section'; name: string; body: string }
  | { kind: 'notes'; body: string; replace?: boolean }
  /** An own criterion `IC-n`, or with `ref` a reference to the increment's `AC-n` (checked against `acceptance` when given). */
  | { kind: 'ac-add'; text: string; ref?: string; acceptance?: readonly string[] }
  | { kind: 'ac-set'; id: string; checked?: boolean; text?: string }
  | { kind: 'pull-requests'; ids: string[] }
  | { kind: 'increment'; id: string }
  | { kind: 'fragment'; fragment: InputFragment };
export interface IssueEditResult { text: string; edits: EditSummary[] }
/** Applies one edit after checking the issue is not Done or Cancelled. */
export function editIssue(text: string, op: IssueOp): IssueEditResult {
  requireIssueEditable(parseIssue(text).status);
  switch (op.kind) {
    case 'title': return { text: setIssueTitle(text, op.value), edits: [{ section: 'frontmatter', action: 'set', itemId: 'title' }] };
    case 'section': return setSection(text, op.name, op.body);
    case 'notes': return setNotes(text, op.body, op.replace === true);
    case 'ac-add': return addCriterion(text, op);
    case 'ac-set': return setCriterion(text, op);
    case 'pull-requests': return { text: set(text, 'pullRequests', op.ids.length ? [...new Set(op.ids.map(id => slug(id, 'ISSUE_DOCUMENT_INVALID')))] : null), edits: [{ section: 'frontmatter', action: 'set', itemId: 'pullRequests' }] };
    case 'increment': return { text: set(text, 'increment', slug(op.id, 'ISSUE_INCREMENT_REQUIRED')), edits: [{ section: 'frontmatter', action: 'set', itemId: 'increment' }] };
    default: return applyFragment(text, op.fragment);
  }
}
function setIssueTitle(text: string, value: string): string {
  const title = requireTitle(value, 'ISSUE_DOCUMENT_INVALID');
  return retitle(set(text, 'title', title, true), stringField(parseFrontmatter(text).data, 'title'), title);
}
function replaceIn(text: string, name: string, body: string): string {
  const prepared = ensureSection(text, name, order);
  return replaceSectionContent(prepared, findSection(outline(prepared), name)!, body, true);
}
function setSection(text: string, raw: string, body: string): IssueEditResult {
  const name = canonicalSection(raw, ['Summary', 'Notes']);
  return { text: replaceIn(text, name, inputText(body, 'ISSUE_DOCUMENT_INVALID')), edits: [{ section: name, action: 'replace' }] };
}
function setNotes(text: string, body: string, replace: boolean): IssueEditResult {
  const content = blockText(inputText(body, 'ISSUE_DOCUMENT_INVALID'), '\n'), current = parseIssue(text).regions.notes;
  return { text: replaceIn(text, 'Notes', replace || !current ? content : `${current}\n\n${content}`), edits: [{ section: 'Notes', action: replace ? 'replace' : 'add' }] };
}
function addCriterion(text: string, op: Extract<IssueOp, { kind: 'ac-add' }>): IssueEditResult {
  const items = criteria(text, outline(text)).filter(item => item.valid), body = requireLine(op.text, 'a criterion', 'ISSUE_DOCUMENT_INVALID');
  if (op.ref !== undefined) {
    insistDelivery(/^AC-\d+$/.test(op.ref) && (!op.acceptance || op.acceptance.includes(op.ref)), 'ISSUE_CRITERION_NOT_FOUND', `${op.ref} is not an acceptance criterion of the increment.`);
    insistDelivery(!items.some(item => item.id === op.ref), 'ISSUE_DOCUMENT_INVALID', `${op.ref} is already listed.`);
  }
  const id = op.ref ?? `IC-${Math.max(0, ...items.filter(item => item.id.startsWith('IC-')).map(item => Number(item.id.slice(3)))) + 1}`;
  const prepared = ensureSection(text, 'Acceptance criteria', order);
  return { text: appendListItem(prepared, doc => findSection(doc, 'Acceptance criteria'), `[ ] ${id}: ${body}`), edits: [{ section: 'Acceptance criteria', action: 'add', itemId: id }] };
}
function setCriterion(text: string, op: Extract<IssueOp, { kind: 'ac-set' }>): IssueEditResult {
  const item = criteria(text, outline(text)).find(entry => entry.valid && entry.id === op.id);
  insistDelivery(item, 'ISSUE_CRITERION_NOT_FOUND', `${op.id} is not a criterion of this issue.`);
  const body = op.text === undefined ? item.text : requireLine(op.text, 'the criterion text', 'ISSUE_DOCUMENT_INVALID');
  const ending = /(?:\r\n|\r|\n)$/.exec(text.slice(item.start, item.next))?.[0] ?? '';
  return { text: replaceRange(text, item.start, item.next, `- [${(op.checked ?? item.checked) ? 'x' : ' '}] ${item.id}: ${body}${ending}`), edits: [{ section: 'Acceptance criteria', action: 'set', itemId: item.id }] };
}
function applyFragment(text: string, fragment: InputFragment): IssueEditResult {
  insistDelivery(!fragment.preamble, 'ISSUE_DOCUMENT_INVALID', 'Start every part of the input with a ## section heading.');
  let result: IssueEditResult = { text: fragment.title ? setIssueTitle(text, fragment.title) : text, edits: [] };
  const run = (change: IssueEditResult) => { result = { text: change.text, edits: [...result.edits, ...change.edits] }; };
  for (const part of fragment.sections) {
    const name = canonicalSection(part.name, order);
    insistDelivery(!part.subsections.length, 'INCREMENT_SECTION_UNKNOWN', 'An issue has no ### subsections.');
    if (name !== 'Acceptance criteria') { run(setSection(result.text, name, part.body)); continue; }
    for (const item of fragmentItems(part.body)) {
      const ref = /^(?:\[[ xX]\]\s+)?(AC-\d+):\s*(\S.*)$/.exec(item);
      run(addCriterion(result.text, ref ? { kind: 'ac-add', ref: ref[1]!, text: ref[2]! } : { kind: 'ac-add', text: item.replace(/^\[[ xX]\]\s+/, '') }));
    }
  }
  return result;
}
/** Status changes follow the issue table; Done needs every criterion checked. */
export function changeIssueStatus(text: string, to: string): string {
  const model = parseIssue(text);
  return set(text, 'status', checkIssueTransition(model.status, to, model.acceptance));
}

export interface IssueValidation { path?: string; files?: readonly string[]; increment?: { id: string; acceptance: readonly { id: string }[] } | null; schema?: DeliverySchema }
const problem = (message: string, line?: number): Problem => ({ code: 'ISSUE_DOCUMENT_INVALID', message, ...(line ? { line } : {}) });
function frontmatterProblems(text: string, options: IssueValidation): Problem[] {
  const frontmatter = parseFrontmatter(text), data = frontmatter.data, field = (key: string) => stringField(data, key);
  if (!frontmatter.present) return [problem('The file does not start with a --- frontmatter block.', 1)];
  const name = options.path?.split('/').at(-1)?.replace(/\.md$/, ''), checks: [boolean, string][] = [
    [field('type') === 'Issue', 'type must be Issue.'], [isDeliverySlug(field('id'), options.schema) && (name === undefined || field('id') === name), `id "${field('id')}" must be a slug equal to the file name.`],
    [Boolean(field('title')), 'title is missing.'], [statuses.includes(field('status')), `status must be one of ${issueStatuses.join(', ')}.`],
    [data.pullRequests === undefined || Array.isArray(data.pullRequests), 'pullRequests must be a [list].']];
  const problems = [...frontmatter.errors.map(error => problem(error.message, error.line)), ...checks.filter(([ok]) => !ok).map(([, message]) => problem(message))];
  if (!field('increment')) problems.push({ code: 'ISSUE_INCREMENT_REQUIRED', message: 'increment names the Increment this issue belongs to.' });
  return problems;
}
/** Structural validation of an Issue, references to the increment's criteria and wikilinks when `files` is given. */
export function validateIssue(text: string, options: IssueValidation = {}): Problem[] {
  const doc = outline(text), items = criteria(text, doc), ids = items.filter(item => item.valid).map(item => item.id), known = options.increment?.acceptance.map(item => item.id);
  const problems = [...frontmatterProblems(text, options), ...order.filter(name => !findSection(doc, name)).map(name => problem(`## ${name} is missing.`))];
  for (const item of items.filter(entry => !entry.valid)) problems.push(problem(`"${item.text}" is not "[ ] AC-n: text" or "[ ] IC-n: text".`, item.line));
  for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) problems.push(problem(`${id} appears more than once.`));
  for (const item of items.filter(entry => entry.id.startsWith('AC-') && known && !known.includes(entry.id))) problems.push({ code: 'ISSUE_CRITERION_NOT_FOUND', message: `${item.id} is not an acceptance criterion of ${options.increment!.id}.`, line: item.line });
  const body = parseFrontmatter(text);
  return [...problems, ...(options.files ? linkProblems(text.slice(body.bodyStart), options.files, body.end).map(({ code, message, line }) => ({ code, message, line })) : [])];
}
