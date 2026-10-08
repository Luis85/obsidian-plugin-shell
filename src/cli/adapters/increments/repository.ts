/**
 * The delivery workspace of one project: the configured folders, the delivery.json vocabulary, the handoff
 * template and bounded reads of the Increment, PullRequest and Issue documents. Reads only; planners build file
 * plans from it. Paths are repository-relative with forward slashes.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSettings } from '../user-settings.ts';
import { exists, readBounded } from '../framework/files.ts';
import { OperationError, type Context } from '../framework/contracts.ts';
import { incrementsRoot, issuesRoot, pullRequestsRoot } from '../../domain/user-settings.ts';
import { defaultDeliverySchema, deliveryPathsDrift, deliverySchemaFrom, type DeliverySchema, type IncrementModel, type IssueModel, type Problem, type PullRequestModel } from '../../domain/increments/model.ts';
import { parseIncrement } from '../../domain/increments/increment-document.ts';
import { parsePullRequest } from '../../domain/increments/pull-request-document.ts';
import { parseIssue } from '../../domain/increments/issue-document.ts';
import { isProtectedSegment } from '#shared/platform/protected-directories.ts';
import { createGitPort, type GitRunner } from './git.ts';
import type { GitPort } from '../../application/increments/git-port.ts';
import type { HostingRemote } from '../../application/increments/remote-port.ts';
import type { HostingTarget } from './hosting-target.ts';

/** Test seams: a fake git runner, hosting remote, clock and lock folder. Production leaves them unset. */
export interface IncrementServices {
  gitRunner?: GitRunner;
  remote?: (target: HostingTarget) => HostingRemote;
  now?: () => Date;
  lockDirectory?: string;
}
export type DocumentKind = 'increment' | 'pullRequest' | 'issue';
export interface StoredDocument<Model> { id: string; path: string; text: string; model: Model }
export interface Folders { increments: string; pullRequests: string; issues: string }
const deliveryFile = 'configs/delivery/delivery.json';
const maxDocuments = 2_000, maxDocumentBytes = 1_000_000;

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
async function readText(root: string, path: string, limit = maxDocumentBytes): Promise<string | null> {
  if (!await exists(join(root, path))) return null;
  return decode(await readBounded(join(root, path), limit));
}
async function schemaOf(root: string): Promise<{ schema: DeliverySchema; configured: boolean }> {
  const text = await readText(root, deliveryFile);
  if (text === null) return { schema: defaultDeliverySchema, configured: false };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new OperationError('DELIVERY_SCHEMA_UNSUPPORTED', `${deliveryFile} is not valid JSON.`); }
  return { schema: deliverySchemaFrom(raw), configured: true };
}
async function folderFiles(root: string, folder: string, ignore: readonly string[]): Promise<string[]> {
  if (!await exists(join(root, folder))) return [];
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  const names = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md').map(entry => `${folder}/${entry.name}`);
  if (names.length > maxDocuments) throw new OperationError('DELIVERY_FOLDER_LIMIT', `${folder} holds more than ${maxDocuments} documents.`);
  return names.filter(path => !ignore.includes(path)).sort();
}
async function walk(root: string, folder = '', found: string[] = []): Promise<string[]> {
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  for (const entry of entries) {
    if (found.length >= 20_000 || isProtectedSegment(entry.name)) continue;
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(root, path, found);
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

export class DeliveryWorkspace {
  readonly git: GitPort;
  readonly context: Context;
  readonly schema: DeliverySchema;
  /** configs/delivery/delivery.json exists (the DoR/DoD vocabulary is the project's, not the built-in default). */
  readonly configured: boolean;
  readonly folders: Folders;
  readonly template: string | undefined;
  readonly services: IncrementServices;
  private listed: Promise<string[]> | null = null;
  private constructor(context: Context, delivery: { schema: DeliverySchema; configured: boolean }, folders: Folders, template: string | undefined) {
    this.context = context; this.schema = delivery.schema; this.configured = delivery.configured; this.folders = folders; this.template = template;
    this.services = context.increments ?? {};
    this.git = createGitPort(context.root, this.services.gitRunner);
  }
  static async open(context: Context): Promise<DeliveryWorkspace> {
    const { settings } = await loadSettings(context.root);
    const delivery = await schemaOf(context.root);
    const folders = { increments: incrementsRoot(settings.paths), pullRequests: pullRequestsRoot(settings.paths), issues: issuesRoot(settings.paths) };
    return new DeliveryWorkspace(context, delivery, folders, await readText(context.root, delivery.schema.handoff.template) ?? undefined);
  }
  get root(): string { return this.context.root; }
  /** delivery.json globs that point at other folders than the settings; read commands warn, writes refuse. */
  drift(): Problem[] { return this.configured ? deliveryPathsDrift(this.schema, this.folders) : []; }
  requireNoDrift(): void {
    const [first] = this.drift();
    if (first) throw new OperationError(first.code, first.message, 'node bin/app settings, or align configs/delivery/delivery.json');
  }
  /** Whether delivery.json lets the CLI write this Increment key (DOR-02 refuses unknown keys). */
  allows(key: string): boolean { return [...this.schema.handoff.requiredKeys, ...this.schema.handoff.optionalKeys].includes(key); }
  now(): Date { return this.services.now?.() ?? new Date(); }
  path(kind: DocumentKind, id: string): string { return `${this.folders[kind === 'increment' ? 'increments' : kind === 'pullRequest' ? 'pullRequests' : 'issues']}/${id}.md`; }
  read(path: string): Promise<string | null> { return readText(this.root, path); }
  /** Repository files for wikilink resolution: git's list, else a bounded walk that skips protected folders. */
  files(): Promise<string[]> {
    this.listed ??= this.git.listFiles().then(files => files ?? walk(this.root).then(found => found.sort()));
    return this.listed;
  }
  private async documents<Model>(folder: string, ignore: readonly string[], parse: (text: string) => Model): Promise<StoredDocument<Model>[]> {
    const paths = await folderFiles(this.root, folder, ignore);
    return Promise.all(paths.map(async path => {
      const text = (await this.read(path))!;
      return { id: path.slice(folder.length + 1, -3), path, text, model: parse(text) };
    }));
  }
  increments(): Promise<StoredDocument<IncrementModel>[]> { return this.documents(this.folders.increments, this.schema.handoff.ignore, parseIncrement); }
  pullRequests(): Promise<StoredDocument<PullRequestModel>[]> { return this.documents(this.folders.pullRequests, [], parsePullRequest); }
  issues(): Promise<StoredDocument<IssueModel>[]> { return this.documents(this.folders.issues, [], parseIssue); }
  async one<Model>(kind: DocumentKind, id: string | undefined, parse: (text: string) => Model): Promise<StoredDocument<Model>> {
    const noun = { increment: 'INCREMENT', pullRequest: 'PR', issue: 'ISSUE' }[kind];
    if (!id) throw new OperationError(`${noun}_NOT_FOUND`, `Name the ${kind === 'pullRequest' ? 'pull request' : kind}.`);
    const path = this.path(kind, id), text = /^[a-z0-9-]{1,64}$/.test(id) ? await this.read(path) : null;
    if (text === null) throw new OperationError(`${noun}_NOT_FOUND`, `${path} does not exist.`, `node bin/app ${kind === 'pullRequest' ? 'pr' : kind} list`);
    return { id, path, text, model: parse(text) };
  }
  increment(id: string | undefined): Promise<StoredDocument<IncrementModel>> { return this.one('increment', id, parseIncrement); }
  pullRequest(id: string | undefined): Promise<StoredDocument<PullRequestModel>> { return this.one('pullRequest', id, parsePullRequest); }
  issue(id: string | undefined): Promise<StoredDocument<IssueModel>> { return this.one('issue', id, parseIssue); }
}
