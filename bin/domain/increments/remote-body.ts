/**
 * The managed block of a published pull-request body, rendered from a RemotePullRequestView and parsed back
 * tolerantly after people edit it on GitHub or Azure Repos (ticking or adding tasks, editing summary or amendments).
 * Every region sits between hidden markers: HTML comments by default, or Markdown reference definitions
 * (`[//]: # (wb:summary)`) where a platform does not keep comments. Parsing accepts both styles, and HTML-escaped
 * comments, so a body written in one style is still recognised after a switch. Text outside `wb:pr … /wb:pr` is
 * never imported and is preserved byte-for-byte by composeRemoteBody.
 */
import { insistRemote, isAmendmentId, isTaskId, limits, normalizeText } from './remote-model.ts';
import type { HostingPlatform, LinkResolver, LinkTarget, RemoteDocumentLink, RemotePullRequestView } from './remote-model.ts';
import { blobUrl, remoteToWikilinks, wikilinksToRemote } from './remote-links.ts';
import { hasControls } from '../errors.ts';

export type MarkerStyle = 'html' | 'reference';
export interface BodyOptions { links: LinkTarget; resolve?: LinkResolver; markers?: MarkerStyle }
export interface ParsedTask { id: string | null; text: string; done: boolean }
export interface ParsedAmendment { id: string | null; date: string; markdown: string }
export interface ParsedRemoteBody {
  status: 'ok' | 'missing' | 'malformed';
  problem: string | null;
  id: string | null;
  increment: string | null;
  kind: string | null;
  /** Normalized header and acceptance text, only to detect discarded edits of derived regions. */
  derived: string;
  summary: string;
  scope: { in: string[]; out: string[] };
  tasks: ParsedTask[];
  documents: RemoteDocumentLink[];
  notes: string;
  amendments: ParsedAmendment[];
  /** Offsets of the managed block (open marker line to the end of the close marker) in the original body. */
  span: { start: number; end: number } | null;
  unmanagedChars: number;
}
const regionNames = ['summary', 'scope', 'acceptance', 'tasks', 'documents', 'notes', 'amendments'] as const;
type RegionName = typeof regionNames[number];
const headings: Record<RegionName, string> = { summary: 'Summary', scope: 'Scope', acceptance: 'Acceptance criteria', tasks: 'Tasks',
  documents: 'Documents', notes: 'Notes', amendments: 'Amendments' };
const none = '_None._';
const bodyLimits: Readonly<Record<HostingPlatform, number>> = Object.freeze({ github: 65_536, 'azure-devops': 4_000 });
const safeToken = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const markerLine = /^[ \t]*(?:(?:<!--|&lt;!--)[ \t]*(\/?)wb:([a-z]+)([^\n]*?)[ \t]*(?:-->|--&gt;)|\[\/\/\]: # \((\/?)wb:([a-z]+)([^)\n]*)\))[ \t]*\r?$/;

/** The text every published body of this pull request contains; adapters search remote bodies for it. */
export const remoteMarker = (id: string): string => `wb:pr v1 id=${id} `;
const marker = (style: MarkerStyle, text: string): string => style === 'html' ? `<!-- ${text} -->` : `[//]: # (${text})`;
const escapeLabel = (text: string): string => text.replace(/[\\[\]]/g, '\\$&');
const list = (items: string[]): string => items.length ? items.map(item => `- ${item}`).join('\n') : none;
const prose = (text: string): string => normalizeText(text) || none;

function requireLine(text: string, what: string, max: number): void {
  insistRemote(text.trim().length > 0 && text.length <= max && !hasControls(text), 'PR_REMOTE_CONTENT_INVALID', `${what} must be one line of 1-${max} characters.`);
}
function requireMarkdown(text: string, what: string, max: number): void {
  insistRemote(text.length <= max, 'PR_LIMIT', `${what} exceeds ${max} characters.`);
  insistRemote(!text.split(/\r?\n/).some(line => markerLine.test(line)), 'PR_REMOTE_CONTENT_INVALID', `${what} contains a wb: marker line.`);
}
function requireUnique(ids: string[], valid: (id: string) => boolean, what: string): void {
  insistRemote(ids.every(valid) && new Set(ids).size === ids.length, 'PR_REMOTE_CONTENT_INVALID', `${what} ids must be unique and well-formed.`);
}
function validateCounts(view: RemotePullRequestView): void {
  insistRemote(view.tasks.length <= limits.tasks && view.amendments.length <= limits.amendments && view.documents.length <= limits.documents,
    'PR_LIMIT', `A pull request holds at most ${limits.tasks} tasks, ${limits.amendments} amendments and ${limits.documents} documents.`);
}
function validateView(view: RemotePullRequestView): void {
  insistRemote(safeToken.test(view.id) && safeToken.test(view.increment.id), 'PR_REMOTE_CONTENT_INVALID', 'Pull request and increment ids must be slugs.');
  requireLine(view.title, 'The title', limits.title);
  insistRemote(view.kind === 'kickoff' || view.kind === 'change', 'PR_REMOTE_CONTENT_INVALID', 'The pull-request kind must be kickoff or change.');
  for (const branch of [view.head, view.base]) insistRemote(/^[^\s`]{1,200}$/.test(branch), 'PR_REMOTE_CONTENT_INVALID', 'Branch names are 1-200 characters without spaces or backticks.');
  validateCounts(view);
  requireUnique(view.tasks.map(task => task.id), isTaskId, 'Task');
  requireUnique(view.amendments.map(amendment => amendment.id), isAmendmentId, 'Amendment');
  for (const item of [...view.scope.in, ...view.scope.out, ...view.acceptance.map(entry => entry.text)]) requireLine(item, 'A list item', 2_000);
  for (const task of view.tasks) requireLine(task.text, `Task ${task.id}`, 2_000);
  requireMarkdown(view.summary, 'The summary', limits.notes);
  requireMarkdown(view.notes, 'The notes', limits.notes);
  for (const amendment of view.amendments) {
    insistRemote(/^\d{4}-\d{2}-\d{2}$/.test(amendment.date), 'PR_REMOTE_CONTENT_INVALID', `Amendment ${amendment.id} needs a YYYY-MM-DD date.`);
    requireMarkdown(amendment.markdown, `Amendment ${amendment.id}`, limits.amendment);
    insistRemote(!outsideFences(amendment.markdown).some(line => /^#{1,3}\s/.test(line)), 'PR_REMOTE_CONTENT_INVALID',
      `Amendment ${amendment.id} may use only #### or deeper headings, so it stays one amendment after a round trip.`);
  }
}
function outsideFences(markdown: string): string[] {
  let fenced = false;
  return markdown.split(/\r?\n/).filter(line => {
    if (/^\s{0,3}(?:```|~~~)/.test(line)) { fenced = !fenced; return false; }
    return !fenced;
  });
}
function documentLink(link: RemoteDocumentLink): string {
  return `[[${link.target}${link.label ? '|' + link.label : ''}]]`;
}
function regionBody(name: RegionName, view: RemotePullRequestView, link: (markdown: string) => string): string {
  switch (name) {
    case 'summary': return prose(link(view.summary));
    case 'scope': return `### In scope\n\n${list(view.scope.in.map(link))}\n\n### Out of scope\n\n${list(view.scope.out.map(link))}`;
    case 'acceptance': return list(view.acceptance.map(entry => `${entry.id}: ${link(entry.text)}${entry.done ? ' (done)' : ''}`));
    case 'tasks': return view.tasks.length ? view.tasks.map(task => `- [${task.done ? 'x' : ' '}] ${task.id}: ${link(task.text)}`).join('\n') : none;
    case 'documents': return list(view.documents.map(entry => link(documentLink(entry))));
    case 'notes': return prose(link(view.notes));
    default: return view.amendments.length ? view.amendments.map(entry => `### ${entry.id} · ${entry.date}\n\n${prose(link(entry.markdown))}`).join('\n\n') : none;
  }
}
/** The managed block for a view. Throws PR_REMOTE_CONTENT_INVALID or PR_LIMIT for content that cannot round-trip. */
export function renderManagedBlock(view: RemotePullRequestView, options: BodyOptions): string {
  validateView(view);
  const style = options.markers ?? 'html', links = options.links;
  const link = (markdown: string) => wikilinksToRemote(markdown, links, options.resolve);
  const context = view.kind === 'kickoff' ? `> Kick-off of increment [${escapeLabel(view.increment.title)}](${blobUrl(links, view.increment.path)})`
    : `> Increment: [${escapeLabel(view.increment.title)}](${blobUrl(links, view.increment.path)}) · Stacks on \`${view.base}\``;
  const header = [marker(style, `wb:pr v1 id=${view.id} increment=${view.increment.id} kind=${view.kind}`), `Handoff: ${view.increment.path}`,
    `${context} · Plan: [${escapeLabel(view.planPath)}](${blobUrl(links, view.planPath)})`].join('\n');
  const regions = regionNames.map(name => `${marker(style, `wb:${name}`)}\n## ${headings[name]}\n\n${regionBody(name, view, link)}\n\n${marker(style, `/wb:${name}`)}`);
  const block = [header, ...regions, marker(style, '/wb:pr')].join('\n\n');
  const parsed = parseRemoteBody(block, links);
  insistRemote(parsed.status === 'ok', 'PR_REMOTE_CONTENT_INVALID', `The rendered body does not parse back (${parsed.problem}).`);
  return block;
}
/** The full body: the block replaces the managed span of the previous body, or is prepended to text without one. */
export function composeRemoteBody(previous: string | null, parsed: ParsedRemoteBody | null, block: string): string {
  if (previous === null || previous.length === 0) return block;
  if (parsed?.span) return previous.slice(0, parsed.span.start) + block + previous.slice(parsed.span.end);
  return `${block}\n\n${previous}`;
}
/** Character count against the platform limit; bodies are never truncated. */
export function bodySize(body: string, platform: HostingPlatform): { limit: number; size: number; fits: boolean } {
  const limit = bodyLimits[platform];
  return { limit, size: body.length, fits: body.length <= limit };
}
export function requireBodyFits(body: string, platform: HostingPlatform): void {
  const { limit, size, fits } = bodySize(body, platform);
  insistRemote(fits, 'PR_BODY_TOO_LARGE', `The pull-request body has ${size} characters; ${platform} accepts at most ${limit}. Shorten notes or amendments; the body is never truncated.`);
}

interface Marker { name: string; closing: boolean; args: string; start: number; end: number; next: number }
function scanMarkers(body: string): Marker[] {
  const markers: Marker[] = [];
  let offset = 0;
  for (const line of body.split('\n')) {
    const match = markerLine.exec(line);
    const next = offset + line.length + 1;
    if (match) markers.push({ name: match[2] ?? match[5] ?? '', closing: (match[1] ?? match[4]) === '/', args: (match[3] ?? match[6] ?? '').trim(),
      start: offset, end: offset + line.replace(/\r$/, '').length, next: Math.min(next, body.length) });
    offset = next;
  }
  return markers;
}
const emptyParse = (status: ParsedRemoteBody['status'], problem: string | null, span: ParsedRemoteBody['span'], length: number): ParsedRemoteBody => ({
  status, problem, id: null, increment: null, kind: null, derived: '', summary: '', scope: { in: [], out: [] }, tasks: [], documents: [], notes: '', amendments: [],
  span, unmanagedChars: length - (span ? span.end - span.start : 0) });
function structureProblem(markers: Marker[]): string | null {
  const inner = markers.slice(1, -1);
  if (inner.length !== regionNames.length * 2) return 'every region needs one open and one close marker';
  for (let index = 0; index < inner.length; index += 2) {
    const open = inner[index]!, close = inner[index + 1]!;
    if (open.closing || !close.closing || open.name !== close.name || !(regionNames as readonly string[]).includes(open.name)) return `unexpected marker wb:${open.name}`;
  }
  return new Set(inner.map(entry => entry.name)).size === regionNames.length ? null : 'a region is repeated';
}
/** Parses the managed block of a remote body; never throws for user edits, reporting `missing`/`malformed` instead. */
export function parseRemoteBody(body: string, links: LinkTarget): ParsedRemoteBody {
  insistRemote(body.length <= limits.parse, 'PR_REMOTE_RESPONSE_INVALID', `The remote body exceeds ${limits.parse} characters.`);
  const markers = scanMarkers(body), block = locateBlock(markers, body.length);
  if (!block) return emptyParse('missing', 'no wb:pr marker', null, body.length);
  if (block.problem) return emptyParse('malformed', block.problem, block.span, body.length);
  const problem = structureProblem(block.managed) ?? headerProblem(block.managed[0]!.args);
  if (problem) return emptyParse('malformed', problem, block.span, body.length);
  return regions(body, block.managed, links, block.span);
}
/** The span of the one `wb:pr` block, or why it cannot be located; null without any `wb:pr` marker. */
function locateBlock(markers: Marker[], length: number): { span: { start: number; end: number }; managed: Marker[]; problem: string | null } | null {
  const pr = markers.filter(entry => entry.name === 'pr');
  if (!pr.length) return null;
  const open = pr.find(entry => !entry.closing), close = open ? pr.find(entry => entry.closing && entry.start > open.start) : undefined;
  const span = { start: (open ?? pr[0]!).start, end: close ? close.end : length };
  const valid = pr.length === 2 && open === pr[0] && close === pr[1];
  return { span, managed: valid ? markers.slice(markers.indexOf(open!), markers.indexOf(close!) + 1) : [], problem: valid ? null : 'one wb:pr open and close marker are required' };
}
function headerProblem(args: string): string | null {
  return /^v1 id=[A-Za-z0-9][A-Za-z0-9._-]{0,127} increment=[A-Za-z0-9][A-Za-z0-9._-]{0,127}(?: kind=(?:kickoff|change))?$/.test(args) ? null : 'unsupported wb:pr header';
}
function regions(body: string, managed: Marker[], links: LinkTarget, span: { start: number; end: number }): ParsedRemoteBody {
  const text = new Map<string, string>();
  for (let index = 1; index < managed.length - 1; index += 2) {
    const open = managed[index]!, close = managed[index + 1]!;
    text.set(open.name, normalizeText(remoteToWikilinks(stripHeading(body.slice(open.next, close.start)), links)));
  }
  const header = normalizeText(body.slice(managed[0]!.next, managed[1]!.start));
  const [, id = null, increment = null, kind = null] = /^v1 id=(\S+) increment=(\S+)(?: kind=(\S+))?$/.exec(managed[0]!.args) ?? [];
  return { status: 'ok', problem: null, id, increment, kind, derived: `${header}\n${text.get('acceptance') ?? ''}`,
    summary: proseText(text.get('summary')), scope: parseScope(text.get('scope') ?? ''), tasks: parseTasks(text.get('tasks') ?? ''),
    documents: parseDocuments(text.get('documents') ?? ''), notes: proseText(text.get('notes')), amendments: parseAmendments(text.get('amendments') ?? ''),
    span, unmanagedChars: body.length - (span.end - span.start) };
}
function stripHeading(text: string): string {
  return text.replace(/^\s*##[ \t]+[^\n]*\n?/, '');
}
const proseText = (text: string | undefined): string => !text || text === none ? '' : text;
const listItems = (text: string): string[] => text.split('\n').map(line => /^\s{0,3}[-*+]\s+(.*\S)\s*$/.exec(line)?.[1]).filter((item): item is string => item !== undefined);
function parseScope(text: string): { in: string[]; out: string[] } {
  const out = /^###[ \t]+Out of scope[ \t]*$/im.exec(text);
  const inside = out ? text.slice(0, out.index) : text, outside = out ? text.slice(out.index + out[0].length) : '';
  return { in: listItems(inside), out: listItems(outside) };
}
function parseTasks(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s{0,3}[-*+]\s+\[([ xX])\]\s+(?:(T-[1-9]\d{0,5})\s*:\s*)?(.*\S)\s*$/.exec(line);
    if (match) tasks.push({ id: match[2] ?? null, text: match[3]!, done: match[1] !== ' ' });
  }
  insistRemote(tasks.length <= limits.tasks, 'PR_LIMIT', `The remote body lists more than ${limits.tasks} tasks.`);
  return tasks;
}
function parseDocuments(text: string): RemoteDocumentLink[] {
  const documents = listItems(text).flatMap(item => {
    const match = /^\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/.exec(item);
    return match ? [{ target: match[1]!.trim(), label: (match[2] ?? '').trim() }] : [];
  });
  insistRemote(documents.length <= limits.documents, 'PR_LIMIT', `The remote body lists more than ${limits.documents} documents.`);
  return documents;
}
function amendmentHeading(line: string): { id: string | null; date: string; lead: string } | null {
  const match = /^###[ \t]+(.*?)[ \t]*$/.exec(line);
  if (!match) return null;
  const known = /^(A-[1-9]\d{0,5})\s*[·:—-]\s*(\S.*)$/.exec(match[1]!);
  if (known) return { id: known[1]!, date: known[2]!.trim(), lead: '' };
  const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(match[1]!)?.[0] ?? '';
  return { id: null, date, lead: match[1]! === date ? '' : match[1]! };
}
function parseAmendments(text: string): ParsedAmendment[] {
  if (text === none) return [];
  const result: ParsedAmendment[] = [];
  let current: { id: string | null; date: string; lines: string[] } = { id: null, date: '', lines: [] };
  let fenced = false;
  const flush = () => {
    const markdown = normalizeText(current.lines.join('\n'));
    if (markdown || current.id) result.push({ id: current.id, date: current.date, markdown });
  };
  for (const line of text.split('\n')) {
    if (/^\s{0,3}(?:```|~~~)/.test(line)) fenced = !fenced;
    const heading = fenced ? null : amendmentHeading(line);
    if (!heading) { current.lines.push(line); continue; }
    flush();
    current = { id: heading.id, date: heading.date, lines: heading.lead ? [heading.lead, ''] : [] };
  }
  flush();
  insistRemote(result.length <= limits.amendments, 'PR_LIMIT', `The remote body lists more than ${limits.amendments} amendments.`);
  return result;
}
