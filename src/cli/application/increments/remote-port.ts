/**
 * The hosting-platform port used by `pr publish` and `pr sync`. Types only: adapters live in
 * `src/cli/adapters/increments/{github-remote,azure-remote}.ts`, a test double in `tests/support/fake-hosting-remote.mjs`.
 *
 * Failure contract (adapters throw an OperationError whose `details` is a RemoteFailure):
 * - reads never write, so a failed read is `uncertain: false` and safe to repeat;
 * - a write that the platform definitely refused (CLI missing, unsafe argument, 4xx) is `uncertain: false`;
 * - a write whose outcome is unknown (timeout, transport error, 5xx, unreadable response) is `PR_REMOTE_UNCERTAIN`
 *   with `uncertain: true`. Callers must never retry it blindly: re-read the remote first (findMarked by the
 *   marker, then get) and resume from what is actually there. The CLI exits 2 for this outcome.
 */
import type { LinkTarget, RemoteState } from '../../domain/increments/remote-model.ts';
import type { HostingPlatform } from '../../domain/increments/model.ts';

export interface RemotePullRequest {
  number: number;
  url: string;
  title: string;
  body: string;
  state: RemoteState;
  head: string;
  base: string;
  /** sha256 of the canonical title, body, state, head and base (domain `remoteRevision`). */
  revision: string;
}
export interface RemoteDiagnostic { code: string; message: string; next?: string }
export interface RemoteReadiness {
  platform: HostingPlatform;
  cli: 'ok' | 'missing' | 'extension-missing';
  auth: 'ok' | 'required' | 'unknown';
  /** Display identity of the target: `owner/repo`, or `organization/project/repository` on Azure. Never a URL with credentials. */
  repository: string;
  defaultBranch: string | null;
  /** CLI present, signed in and the repository reachable. */
  configured: boolean;
  diagnostics: RemoteDiagnostic[];
}
export interface RemoteFailure { uncertain: boolean; step: 'read' | 'create' | 'update'; status?: number }
export interface CreatePullRequest { title: string; body: string; head: string; base: string }
export interface HostingRemote {
  readonly platform: HostingPlatform;
  /** Display identity, as in RemoteReadiness.repository. */
  readonly repository: string;
  readiness(): Promise<RemoteReadiness>;
  /** Where published wikilinks point for a ref (normally the pull request head). */
  linkTarget(ref: string): LinkTarget;
  /** Whether the head branch exists on the hosted repository (read-only). The CLI never pushes from an adapter:
   * a missing head becomes the separate `push-head` git step of the reviewed publish plan (domain `planPublish`). */
  headExists(head: string): Promise<boolean>;
  /** Pull requests for head→base whose body contains `marker` (domain `remoteMarker(id)`), and how many open ones do not. */
  findMarked(head: string, base: string, marker: string): Promise<{ marked: RemotePullRequest[]; unmarkedOpen: number }>;
  get(number: number): Promise<RemotePullRequest>;
  /** Always creates a draft; never falls back to a ready pull request. */
  create(input: CreatePullRequest): Promise<RemotePullRequest>;
  update(number: number, patch: { title?: string; body?: string }): Promise<RemotePullRequest>;
}
