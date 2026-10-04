/**
 * Remote-facing projection of a PullRequest document, shared by the published-body codec, the three-way sync merge
 * and the hosting adapters. Pure types and guards: no I/O, no framework.
 *
 * Mapping expected from the PullRequest document model (`pull-request-document.ts`, owned by the domain foundation):
 * - `id`, `title`, `kind`, `head`, `base` come from the frontmatter keys of the same name; `increment.id` from `increment`.
 *   A `kickoff` pull request has head `increment/<id>` and base `main`; a `change` pull request stacks on the increment
 *   branch: head `increment/<id>/<pr-id>`, base `increment/<id>` (patterns from delivery.json `branches`).
 * - `increment.title` and `increment.path` come from the linked Increment document; `planPath` is the PR document path.
 * - `summary` and `notes` are the bodies of `## Summary` and `## Notes` (Markdown, wikilinks kept as `[[…]]`).
 * - `scope.in` / `scope.out` are the list-item texts (without `- `) of `### In scope` / `### Out of scope`.
 * - `tasks` are the `- [ ] T-n: text` items of `## Tasks` (`done` = ticked), in document order.
 * - `documents` are the `[[target|label]]` items of `## Documents`; an empty label means no alias.
 * - `amendments` are the `### A-n · YYYY-MM-DD` subsections of `## Amendments`, in document order.
 * - `acceptance` is derived from the increment: its `AC-n` criteria (filtered by `delivers` when set).
 * The local status (`New|Draft|Ready|Merged|Closed`) and the binding keys stay outside the view.
 */
export type HostingPlatform = 'github' | 'azure-devops';
export type PullRequestStatus = 'New' | 'Draft' | 'Ready' | 'Merged' | 'Closed';
export type PullRequestKind = 'kickoff' | 'change';
/** Platform-neutral state of a hosted pull request; Azure `abandoned` maps to `closed`. */
export type RemoteState = 'draft' | 'open' | 'merged' | 'closed';
export interface RemoteTask { id: string; text: string; done: boolean }
export interface RemoteAmendment { id: string; date: string; markdown: string }
export interface RemoteDocumentLink { target: string; label: string }
export interface RemoteAcceptance { id: string; text: string; done: boolean }
export interface RemotePullRequestView {
  id: string;
  title: string;
  kind: PullRequestKind;
  increment: { id: string; title: string; path: string };
  planPath: string;
  summary: string;
  scope: { in: string[]; out: string[] };
  acceptance: RemoteAcceptance[];
  tasks: RemoteTask[];
  documents: RemoteDocumentLink[];
  notes: string;
  amendments: RemoteAmendment[];
  head: string;
  base: string;
}
/** Frontmatter binding written on publish. `repository` is `owner/repo` on GitHub and the repository name on Azure. */
export interface RemoteBinding {
  platform: HostingPlatform;
  repository: string;
  organization?: string;
  project?: string;
  number: number;
  url: string;
  publishedAt?: string;
  lastSyncedAt?: string;
  /** sha256 of the serialized sync record the document was last synced against. */
  baseSnapshot?: string;
}
/** Where wikilinks point once published: the repository web URL and the ref (normally the PR head). */
export interface LinkTarget { platform: HostingPlatform; web: string; ref: string }
/** Resolves a wikilink target to a repository path (with extension), or null when unresolved or ambiguous. */
export type LinkResolver = (target: string) => string | null;
/** sha256 (or another stable digest) of UTF-8 text, injected so the domain stays free of node:crypto. */
export type TextHash = (text: string) => string;

export const limits = Object.freeze({ tasks: 200, amendments: 100, documents: 100, notes: 20_000, amendment: 10_000, title: 120, parse: 262_144 });

/** Domain failure whose message leads with its code, so CLI adapters keep the code (the DocsError convention). */
class RemoteSyncError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`${code}: ${message}`); this.name = 'RemoteSyncError'; this.code = code; }
}
export function insistRemote(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new RemoteSyncError(code, message);
}
const taskId = /^T-[1-9]\d{0,5}$/, amendmentId = /^A-[1-9]\d{0,5}$/;
export const isTaskId = (value: string): boolean => taskId.test(value);
export const isAmendmentId = (value: string): boolean => amendmentId.test(value);
/** Numeric part of `T-n`/`A-n`; 0 for anything else. */
export function idNumber(value: string | null | undefined): number {
  const match = /^[TA]-(\d+)$/.exec(value ?? '');
  return match ? Number(match[1]) : 0;
}
/** CRLF to LF, per-line trailing whitespace trimmed, ends trimmed: the form every hash and comparison uses. */
export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd()).join('\n').trim();
}
