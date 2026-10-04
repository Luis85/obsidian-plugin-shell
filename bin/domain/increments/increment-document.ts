/**
 * The Increment document (the Definition of Ready handoff): rendering from the delivery template, parsing to
 * the model and the span edits behind `increment new|edit|scope|ac|ref|attach`. Every edit keeps the bytes it
 * does not own, including CRLF line endings and custom frontmatter keys.
 */
import { insistDelivery } from './errors.ts';
import {
  acceptanceStubPath, defaultDeliverySchema, isDeliverySlug, issuesSection, pullRequestsSection, requireIncrementKey, requireLine, requireTitle, scopeSubsections,
  type AcceptanceCriterion, type DeliverySchema, type FrontmatterData, type IncrementModel, type IssueRow, type Problem, type PullRequestRow, type ScopeSide, type SectionSummary,
} from './model.ts';
import { formatList, lineEnding, listField, parseFrontmatter, quoteScalar, setFrontmatterValue, stringField } from './frontmatter.ts';
import { generatedListDrift, setIssues, setPullRequests } from './generated-lists.ts';
import { isBranchName, requireBranchName } from './branches.ts';
import {
  appendListItem, appendScopeItem, ensureSection, ensureSubsection, findSection, findSubsection, hasPlaceholder, outline,
  prose, replaceRange, replaceSectionContent, sectionBody, sectionItems, scopeItems, words, type Outline, type SectionSpan,
} from './sections.ts';
import { linkProblems, resolveWikilink } from './wikilinks.ts';
import { canonicalSection, inputText, type InputFragment } from './input-fragment.ts';
import { incrementTemplate } from './increment-template.ts';
import { requireIncrementEditable } from './transitions.ts';

export interface NewIncrement {
  id: string; title: string; owner?: string; size?: string; e2e?: string; refs?: string[]; fragment?: InputFragment | null;
  /** The increment branch and its base (`branchNames()`); written only when given, and only when delivery.json lists the keys. */
  branch?: string; base?: string;
}
export interface IncrementOptions { schema?: DeliverySchema; files?: readonly string[] }
export interface EditSummary { section: string; action: 'set' | 'add' | 'replace'; itemId?: string }
export interface IncrementEditResult {
  text: string; edits: EditSummary[];
  /** `ac-add` only: the new criterion and its acceptance stub path, so the plan can add the stub in the same review. */
  created?: { id: string; stub: string };
}
export type IncrementField = 'title' | 'owner' | 'size' | 'e2e' | 'branch' | 'base';
export type IncrementEdit =
  | { kind: 'field'; key: IncrementField; value: string }
  | { kind: 'section'; name: string; body: string }
  | { kind: 'scope'; side: ScopeSide; text: string }
  /** `evidence` defaults to the criterion's acceptance stub path; pass [] to write none. */
  | { kind: 'ac-add'; text: string; evidence?: string[] }
  | { kind: 'ac-set'; id: string; checked?: boolean; text?: string; evidence?: string[] }
  | { kind: 'ref-add'; ref: string }
  | { kind: 'fragment'; fragment: InputFragment }
  | { kind: 'pull-requests'; ids: string[]; rows: PullRequestRow[] }
  | { kind: 'issues'; ids: string[]; rows: IssueRow[] };

const schemaOf = (options: IncrementOptions) => options.schema ?? defaultDeliverySchema;
const sectionOrder = (schema: DeliverySchema) => [...schema.handoff.sections, issuesSection, pullRequestsSection, schema.handoff.generatedSection];
/** Renders a new Increment from the template, with the same substitutions as `scripts/delivery/increment.mjs new`. */
export function renderIncrement(input: NewIncrement, options: IncrementOptions & { template?: string } = {}): string {
  const schema = schemaOf(options);
  insistDelivery(isDeliverySlug(input.id, schema), 'INCREMENT_ID_INVALID', `"${input.id}" must match ${schema.handoff.slugPattern} with at most ${schema.handoff.maxSlugLength} characters.`);
  const title = requireTitle(input.title), owner = input.owner === undefined ? null : requireLine(input.owner, 'the owner', 'INCREMENT_INPUT_INVALID', 80);
  const refs = (input.refs ?? []).map(ref => requireLine(ref, 'a reference'));
  let text = (options.template ?? incrementTemplate).replaceAll('{{slug}}', () => input.id).replaceAll('"{{title}}"', () => quoteScalar(title))
    .replaceAll('{{title}}', () => title).replaceAll('"{{owner}}"', () => owner ? quoteScalar(owner) : '"<owner>"')
    .replaceAll('{{refs}}', () => formatList(refs).slice(1, -1));
  for (const key of ['size', 'e2e', 'branch', 'base'] as const) if (input[key] !== undefined) text = setField(text, key, input[key], schema);
  return input.fragment ? applyFragment(text, input.fragment, schema).text : text;
}

const acPattern = /^\[( |x|X)\]\s+(AC-\d+):\s*(\S.*)$/;
interface AcceptanceItem extends AcceptanceCriterion { valid: boolean; start: number; next: number }
/** `- [ ] AC-n: text` items with `Evidence:` backticked paths, read like the DoR `acceptanceCriteria`. */
function acceptanceItems(text: string, doc: Outline): AcceptanceItem[] {
  const section = findSection(doc, 'Acceptance criteria');
  return (section ? sectionItems(text, section) : []).map(item => {
    const match = acPattern.exec(item.text), at = item.full.indexOf('Evidence:');
    const evidence = at < 0 ? [] : [...item.full.slice(at + 9).matchAll(/`([^`\n]+)`/g)].map(found => found[1]!);
    return { valid: Boolean(match), checked: match?.[1] !== ' ', id: match?.[2] ?? '', text: match?.[3] ?? item.text, evidence, line: item.line, start: item.start, next: item.next };
  });
}
const summaries = (text: string, doc: Outline): SectionSummary[] => doc.sections.map(section => ({ name: section.name, line: section.line, words: words(sectionBody(text, section)) }));
/** The model of an Increment; structural problems are reported by validation, never thrown here. */
export function parseIncrement(text: string): IncrementModel {
  const data = parseFrontmatter(text).data, doc = outline(text), field = (key: string) => stringField(data, key);
  return {
    id: field('id'), title: field('title'), owner: field('owner'), size: field('size'), status: field('status'), e2e: field('e2e'),
    refs: listField(data, 'refs'), pullRequests: listField(data, 'pullRequests'), issues: listField(data, 'issues'),
    branch: field('branch') || null, base: field('base') || null, frontmatter: data, heading: doc.title?.name ?? null,
    sections: summaries(text, doc), scope: scopeItems(text, doc),
    acceptance: acceptanceItems(text, doc).filter(item => item.valid).map(({ id, checked, text: body, evidence, line }) => ({ id, checked, text: body, evidence, line })),
  };
}
/** Every `- …` line that is not a valid `[ ] AC-n: text` criterion. */
export const malformedCriteria = (text: string): { line: number; text: string }[] =>
  acceptanceItems(text, outline(text)).filter(item => !item.valid).map(item => ({ line: item.line, text: item.text }));

/** Applies one edit after checking the Increment is still editable (not Done or Cancelled). */
export function editIncrement(text: string, edit: IncrementEdit, options: IncrementOptions = {}): IncrementEditResult {
  requireIncrementEditable(parseIncrement(text).status);
  const schema = schemaOf(options);
  switch (edit.kind) {
    case 'field': return { text: setField(text, edit.key, edit.value, schema), edits: [{ section: 'frontmatter', action: 'set', itemId: edit.key }] };
    case 'section': return setSection(text, edit.name, edit.body, schema);
    case 'scope': return { text: appendScopeItem(text, sectionOrder(schema), edit.side, requireLine(edit.text, 'a scope item')), edits: [{ section: scopeSubsections[edit.side], action: 'add' }] };
    case 'ac-add': return addCriterion(text, edit, schema);
    case 'ac-set': return setCriterion(text, edit);
    case 'ref-add': return addRef(text, edit.ref, options.files);
    case 'fragment': return applyFragment(text, edit.fragment, schema);
    default: return linkLists(text, edit, schema);
  }
}

function linkLists(text: string, edit: Extract<IncrementEdit, { kind: 'pull-requests' | 'issues' }>, schema: DeliverySchema): IncrementEditResult {
  if (edit.kind === 'pull-requests') return { text: setPullRequests(text, edit.ids, edit.rows), edits: [{ section: pullRequestsSection, action: 'replace' }] };
  requireIncrementKey(schema, 'issues');
  return { text: setIssues(text, edit.ids, edit.rows), edits: [{ section: issuesSection, action: 'replace' }] };
}
const keyOrder = ['type', 'id', 'title', 'owner', 'size', 'status', 'e2e', 'refs', 'pullRequests', 'issues', 'branch', 'base'];
function setField(text: string, key: IncrementField, value: string, schema: DeliverySchema): string {
  if (key === 'branch' || key === 'base') {
    requireIncrementKey(schema, key);
    return setFrontmatterValue(text, key, requireBranchName(value), { after: keyOrder.slice(0, keyOrder.indexOf(key)), quote: key === 'branch' });
  }
  const allowed = key === 'size' ? Object.keys(schema.sizes) : key === 'e2e' ? schema.handoff.e2e : null;
  insistDelivery(!allowed || allowed.includes(value), 'INCREMENT_INPUT_INVALID', `${key} must be one of ${allowed?.join(', ')}.`);
  if (allowed) return setFrontmatterValue(text, key, value, { after: schema.handoff.requiredKeys });
  const next = key === 'title' ? requireTitle(value) : requireLine(value, 'the owner', 'INCREMENT_INPUT_INVALID', 80);
  const updated = setFrontmatterValue(text, key, next, { after: schema.handoff.requiredKeys, quote: true });
  return key === 'title' ? retitle(updated, stringField(parseFrontmatter(text).data, 'title'), next) : updated;
}
/** Keeps the `# Title` heading in step with the title key when it still shows the old title. */
export function retitle(text: string, before: string, after: string): string {
  const heading = outline(text).title;
  if (!heading || heading.name !== before) return text;
  const line = text.slice(heading.start, heading.next), ending = /(?:\r\n|\r|\n)$/.exec(line)?.[0] ?? '';
  return replaceRange(text, heading.start, heading.next, `# ${after}${ending}`);
}
const scopeNames: readonly string[] = [scopeSubsections.in, scopeSubsections.out];
function setSection(text: string, name: string, body: string, schema: DeliverySchema): IncrementEditResult {
  const section = canonicalSection(name, [...schema.handoff.sections, ...scopeNames]), content = inputText(body);
  return { text: replaceBody(text, section, content, schema), edits: [{ section, action: 'replace' }] };
}
function replaceBody(text: string, name: string, body: string, schema: DeliverySchema): string {
  const order = sectionOrder(schema);
  if (!scopeNames.includes(name)) return replaceIn(ensureSection(text, name, order), doc => findSection(doc, name), body);
  const prepared = ensureSubsection(ensureSection(text, 'Scope', order), 'Scope', name, scopeNames);
  return replaceIn(prepared, doc => findSubsection(findSection(doc, 'Scope'), name), body);
}
const replaceIn = (text: string, find: (doc: Outline) => SectionSpan | null, body: string) => replaceSectionContent(text, find(outline(text))!, body, true);

function addCriterion(text: string, edit: Extract<IncrementEdit, { kind: 'ac-add' }>, schema: DeliverySchema): IncrementEditResult {
  const item = requireLine(edit.text, 'an acceptance criterion');
  const ids = acceptanceItems(text, outline(text)).filter(entry => entry.valid && !hasPlaceholder(entry.text)).map(entry => Number(entry.id.slice(3)));
  const id = `AC-${Math.max(0, ...ids) + 1}`;
  const stub = acceptanceStubPath(schema.acceptance, stringField(parseFrontmatter(text).data, 'id'), id), evidence = (edit.evidence ?? [stub]).map(evidencePath);
  const prepared = ensureSection(text, 'Acceptance criteria', sectionOrder(schema)), eol = lineEnding(text);
  const line = `[ ] ${id}: ${item}${evidence.length ? `${eol}  Evidence: ${evidence.map(path => `\`${path}\``).join(', ')}` : ''}`;
  return { text: appendListItem(prepared, doc => findSection(doc, 'Acceptance criteria'), line), edits: [{ section: 'Acceptance criteria', action: 'add', itemId: id }], created: { id, stub } };
}
function evidencePath(path: string): string {
  const value = requireLine(path, 'an evidence path');
  insistDelivery(!value.includes('`'), 'INCREMENT_INPUT_INVALID', 'Evidence paths cannot contain backticks.');
  return value;
}
function setCriterion(text: string, edit: Extract<IncrementEdit, { kind: 'ac-set' }>): IncrementEditResult {
  const item = acceptanceItems(text, outline(text)).find(entry => entry.valid && entry.id === edit.id);
  insistDelivery(item, 'INCREMENT_AC_NOT_FOUND', `${edit.id} is not an acceptance criterion of this increment.`);
  const evidence = (edit.evidence ?? item.evidence).map(evidencePath);
  const body = edit.text === undefined ? item.text.replace(/\s*Evidence:.*$/, '') : requireLine(edit.text, 'the criterion text');
  const eol = lineEnding(text), checked = edit.checked ?? item.checked, ending = /(?:\r\n|\r|\n)$/.test(text.slice(item.start, item.next)) ? eol : '';
  const lines = [`- [${checked ? 'x' : ' '}] ${item.id}: ${body}`, ...(evidence.length ? [`  Evidence: ${evidence.map(path => `\`${path}\``).join(', ')}`] : [])];
  return { text: replaceRange(text, item.start, item.next, lines.join(eol) + ending), edits: [{ section: 'Acceptance criteria', action: 'set', itemId: item.id }] };
}
function addRef(text: string, raw: string, files: readonly string[] | undefined): IncrementEditResult {
  const ref = requireLine(raw, 'a reference'), refs = listField(parseFrontmatter(text).data, 'refs');
  const link = /^\[\[([^[\]\n]+)\]\]$/.exec(ref)?.[1];
  insistDelivery(!files || !link || resolveWikilink(files, link).status !== 'missing', 'WIKILINK_UNRESOLVED', `${ref} does not resolve to a Markdown file.`, { target: link });
  if (refs.includes(ref)) return { text, edits: [] };
  return { text: setFrontmatterValue(text, 'refs', [...refs, ref], { after: ['e2e'] }), edits: [{ section: 'frontmatter', action: 'add', itemId: 'refs' }] };
}
/** Fragment sections replace the matching Increment sections; `# Title` sets the title. */
function applyFragment(text: string, fragment: InputFragment, schema: DeliverySchema): IncrementEditResult {
  insistDelivery(!fragment.preamble, 'INCREMENT_INPUT_INVALID', 'Start every part of the input with a ## section heading.');
  let next = fragment.title ? setField(text, 'title', fragment.title, schema) : text;
  const edits: EditSummary[] = fragment.title ? [{ section: 'frontmatter', action: 'set', itemId: 'title' }] : [];
  for (const section of fragment.sections) {
    const name = canonicalSection(section.name, schema.handoff.sections);
    if (section.body || !section.subsections.length) { next = replaceBody(next, name, section.body, schema); edits.push({ section: name, action: 'replace' }); }
    for (const sub of section.subsections) {
      insistDelivery(name === 'Scope', 'INCREMENT_SECTION_UNKNOWN', `### ${sub.name} is only allowed under ## Scope.`);
      const subName = canonicalSection(sub.name, scopeNames);
      next = replaceBody(next, subName, sub.body, schema); edits.push({ section: subName, action: 'replace' });
    }
  }
  return { text: next, edits };
}

export interface ValidationOptions extends IncrementOptions { path?: string }
const invalid = (message: string, line?: number): Problem => ({ code: 'INCREMENT_DOCUMENT_INVALID', message, ...(line ? { line } : {}) });
/** The DOR-02 frontmatter checks, reported with line numbers. */
const isEmpty = (value: unknown) => !value || (Array.isArray(value) && !value.length);
const notList = (value: unknown) => value !== undefined && !Array.isArray(value);
const notBranch = (value: unknown) => value !== undefined && !isBranchName(String(value));
/** Key presence: required keys filled, nothing the DoR does not know. */
function keyProblems(data: FrontmatterData, schema: DeliverySchema): Problem[] {
  const known = [...schema.handoff.requiredKeys, ...schema.handoff.optionalKeys];
  return [...schema.handoff.requiredKeys.filter(key => isEmpty(data[key])).map(key => invalid(`${key} is missing or empty.`)),
    ...Object.keys(data).filter(key => !known.includes(key)).map(key => invalid(`Unknown key ${key}; the Definition of Ready refuses it.`))];
}
/** Key values: type, id and file name, enumerations, lists and branch names. */
function valueProblems(data: FrontmatterData, schema: DeliverySchema, slug: string | undefined): Problem[] {
  const id = stringField(data, 'id'), settings = schema.handoff;
  const enums = [['size', Object.keys(schema.sizes)], ['status', settings.statuses], ['e2e', settings.e2e]] as const;
  const checks: [boolean, string][] = [[Boolean(data.type) && data.type !== settings.type, `type must be ${settings.type}.`],
    [Boolean(id) && !isDeliverySlug(id, schema), `id "${id}" is not a slug of at most ${settings.maxSlugLength} characters.`],
    [Boolean(id) && slug !== undefined && id !== slug, `id "${id}" differs from the file name "${slug}".`],
    ...enums.map(([key, allowed]): [boolean, string] => [Boolean(data[key]) && !allowed.includes(String(data[key])), `${key} must be one of ${allowed.join(', ')}.`]),
    ...['refs', 'pullRequests', 'issues'].map((key): [boolean, string] => [notList(data[key]), `${key} must be a [list].`]),
    ...['branch', 'base'].map((key): [boolean, string] => [notBranch(data[key]), `${key} "${String(data[key])}" is not a branch name.`])];
  return checks.filter(([failed]) => failed).map(([, message]) => invalid(message));
}
/** The DOR-02 frontmatter checks, reported with line numbers. */
function frontmatterProblems(text: string, options: ValidationOptions): Problem[] {
  const frontmatter = parseFrontmatter(text), schema = schemaOf(options);
  if (!frontmatter.present) return [invalid(frontmatter.errors[0]?.message ?? 'The file does not start with a --- frontmatter block.', 1)];
  const slug = options.path?.split('/').at(-1)?.replace(/\.md$/, '');
  return [...frontmatter.errors.map(error => invalid(error.message, error.line)), ...keyProblems(frontmatter.data, schema), ...valueProblems(frontmatter.data, schema, slug)];
}
function structureProblems(text: string, schema: DeliverySchema): Problem[] {
  const doc = outline(text), problems = schema.handoff.sections.filter(name => !findSection(doc, name)).map(name => invalid(`## ${name} is missing.`));
  const items = acceptanceItems(text, doc), ids = items.filter(item => item.valid).map(item => item.id);
  for (const item of items.filter(entry => !entry.valid)) problems.push(invalid(`"${item.text}" is not "[ ] AC-n: text".`, item.line));
  for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) problems.push(invalid(`${id} appears more than once.`));
  return [...problems, ...generatedListDrift(text)];
}
const refTargets = (refs: readonly string[]) => refs.map(ref => /^\[\[([^[\]\n]+)\]\]$/.exec(ref)?.[1]).filter((target): target is string => Boolean(target));
/** Structural validation (frontmatter, sections, criteria, generated list) plus wikilinks when `files` is given. */
export function validateIncrement(text: string, options: ValidationOptions = {}): Problem[] {
  const frontmatter = parseFrontmatter(text), files = options.files;
  const refsLine = frontmatter.fields.find(field => field.key === 'refs')?.line;
  const links = files ? [...linkProblems(text.slice(frontmatter.bodyStart), files, frontmatter.end), ...refTargets(listField(frontmatter.data, 'refs')).flatMap(target => linkProblems(`[[${target}]]`, files, (refsLine ?? 1) - 1))] : [];
  return [...frontmatterProblems(text, options), ...structureProblems(text, schemaOf(options)), ...links.map(({ code, message, line }) => ({ code, message, line }))];
}
const notReady = (message: string, line?: number): Problem => ({ code: 'INCREMENT_NOT_READY', message, ...(line ? { line } : {}) });
const placeholders = [/\bTBD\b/u, /\bTODO\b/u, /\bFIXME\b/u, /\bXXX\b/u, /[Ll]orem ipsum/u, /<[A-Za-z][^>\n]*>/u];
const resolved = (text: string) => /^None\b/u.test(prose(text).trim().replace(/^[-*]\s+/, ''));
/**
 * The structural Ready gate used when the DoR scripts are unavailable: validation plus non-empty sections,
 * no placeholders, at least one criterion, both scope lists and `None` under Open questions.
 */
export function readinessProblems(text: string, options: ValidationOptions = {}): Problem[] {
  const doc = outline(text), model = parseIncrement(text), problems = validateIncrement(text, options);
  for (const section of schemaOf(options).handoff.sections.map(name => findSection(doc, name)).filter(found => found !== null)) {
    const body = sectionBody(text, section);
    if (!resolved(body) && words(body) < 3) problems.push(notReady(`## ${section.name} needs at least three words or "None".`, section.line));
  }
  prose(text).split(/\r\n|\r|\n/).forEach((line, index) => {
    const found = placeholders.map(pattern => pattern.exec(line)?.[0]).find(Boolean);
    if (found) problems.push(notReady(`Placeholder ${found} is left.`, index + 1));
  });
  if (!model.acceptance.length) problems.push(notReady('Add at least one acceptance criterion.'));
  if (!model.scope.in.length || !model.scope.out.length) problems.push(notReady('State both ### In scope and ### Out of scope.'));
  const questions = findSection(doc, 'Open questions');
  if (questions && !resolved(sectionBody(text, questions))) problems.push(notReady('Resolve the open questions and write "None".', questions.line));
  return problems;
}
