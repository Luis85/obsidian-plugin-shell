/**
 * Which hosting platform and repository `pr publish|sync` talks to, plus the primitives both remote adapters share:
 * the injectable command runner (argument arrays, no shell interpolation, timeouts, bounded output), argument
 * guards and the coded failures of the HostingRemote port. Resolution order: --platform, the document binding,
 * `tooling.hosting` in design/project.json, then the origin remote. The origin URL is never printed.
 */
import { execFile, type ExecException } from 'node:child_process';
import { join } from 'node:path';
import { parseAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { azureRemoteDetails, classifyRemote, projectHosting, validateHosting, type ProjectHosting } from '../../../scripts/companion/hosting-contract.mjs';
import { readOriginUrl } from '../framework/adopt-git.ts';
import { designFile } from '../framework/configuration.ts';
import { exists, hash, readBounded } from '../framework/files.ts';
import { OperationError } from '../framework/contracts.ts';
import { remoteRevision } from '../../domain/increments/sync-record.ts';
import type { HostingPlatform, RemoteBinding, RemoteState } from '../../domain/increments/remote-model.ts';
import type { RemoteDiagnostic, RemoteFailure, RemotePullRequest, RemoteReadiness } from '../../application/increments/remote-port.ts';

export interface CommandResult { status: number | null; stdout: string; stderr: string; error?: string; timedOut: boolean; overflow: boolean }
export interface CommandOptions { input?: string; timeoutMs: number; maxBytes: number; env: NodeJS.ProcessEnv; shell?: boolean }
/** Runs one program with an argument array; never throws, so adapters classify every outcome themselves. */
export type CommandRunner = (command: string, args: readonly string[], options: CommandOptions) => Promise<CommandResult>;
export const remoteLimits = Object.freeze({ timeoutMs: 60_000, maxBytes: 4 * 1024 * 1024 });

function commandResult(error: ExecException | null, stdout: string, stderr: string): CommandResult {
  if (!error) return { status: 0, stdout, stderr, timedOut: false, overflow: false };
  const code: unknown = error.code, overflow = code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
  return { status: typeof code === 'number' ? code : null, stdout, stderr, ...(typeof code === 'string' ? { error: code } : {}),
    timedOut: error.killed === true && !overflow, overflow };
}
export const commandRunner: CommandRunner = (command, args, options) => new Promise(accept => {
  const child = execFile(command, [...args], { timeout: options.timeoutMs, maxBuffer: options.maxBytes, env: options.env, shell: options.shell ?? false,
    windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => accept(commandResult(error, String(stdout), String(stderr))));
  child.stdin?.on('error', () => undefined);
  child.stdin?.end(options.input ?? '');
});

/** A port failure: `details` carries the RemoteFailure that callers branch on. */
export function remoteError(code: string, message: string, failure: RemoteFailure, next?: string): OperationError {
  const error = new OperationError(code, message, next);
  error.details = failure;
  return error;
}
const recovery = 'Inspect the pull request, then rerun the same command; it rediscovers the pull request by its marker and resumes without repeating finished steps.';
/** A write whose outcome is unknown: never retried, always re-read first. */
export function uncertainWrite(step: 'create' | 'update', reason: string): OperationError {
  return remoteError('PR_REMOTE_UNCERTAIN', `The ${step} request may or may not have reached the platform (${reason}). Nothing was retried.`, { uncertain: true, step }, recovery);
}
/** A missing CLI, a timeout or an oversized response; null when the platform answered. Writes become uncertain. */
export function transportFailure(result: CommandResult, step: RemoteFailure['step'], tool: string, install: string): OperationError | null {
  if (result.error === 'ENOENT') return remoteError('PR_REMOTE_CLI_MISSING', `The ${tool} CLI was not found. Nothing was installed.`, { uncertain: false, step }, install);
  if (!result.timedOut && !result.overflow) return null;
  const reason = result.timedOut ? `${tool} timed out` : 'the response exceeded its size limit';
  if (step !== 'read') return uncertainWrite(step, reason);
  return remoteError(result.timedOut ? 'PR_REMOTE_FAILED' : 'PR_REMOTE_RESPONSE_INVALID', `Reading through ${tool} failed: ${reason}.`, { uncertain: false, step });
}
/** Git branch names accepted as arguments: no option-like, traversal, whitespace or shell-significant characters. */
export function requireBranch(name: string): string {
  const valid = typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(name) && !/\.\.|\/\/|\/$|\.lock$|\.$|@\{/.test(name);
  if (!valid) throw remoteError('PR_REMOTE_ARGUMENT_UNSAFE', 'Branch names may use letters, digits, dot, underscore, hyphen and slash only.', { uncertain: false, step: 'read' });
  return name;
}
export function requireNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw remoteError('PR_REMOTE_ARGUMENT_UNSAFE', 'A pull-request number is a positive integer.', { uncertain: false, step: 'read' });
  return value;
}
/** Builds a port pull request with its revision; adapters validate the platform fields first. */
export function pullRequest(fields: { number: number; url: string; title: string; body: string; state: RemoteState; head: string; base: string }): RemotePullRequest {
  return { ...fields, revision: remoteRevision(fields, text => hash(text)) };
}
export function readinessResult(platform: HostingPlatform, repository: string, facts: Pick<RemoteReadiness, 'cli' | 'auth' | 'defaultBranch'>, diagnostics: RemoteDiagnostic[]): RemoteReadiness {
  return { platform, repository, ...facts, configured: facts.cli === 'ok' && facts.auth === 'ok' && diagnostics.length === 0, diagnostics };
}
/** Throws the first readiness diagnostic, so publish and sync refuse before any write. */
export function requireConfigured(readiness: RemoteReadiness): void {
  if (readiness.configured) return;
  const first = readiness.diagnostics[0] ?? { code: 'PR_HOSTING_UNCONFIGURED', message: 'The hosting platform is not ready.' };
  throw remoteError(first.code, first.message, { uncertain: false, step: 'read' }, first.next);
}

export interface AzureCoordinates { organization: string; project: string; repository: string }
export interface HostingTarget {
  platform: HostingPlatform;
  /** Display identity: `owner/repo`, or `organization/project/repository` for Azure. */
  repository: string;
  github: { repository: string } | null;
  azure: AzureCoordinates | null;
  source: 'flag' | 'binding' | 'project' | 'origin';
  warnings: RemoteDiagnostic[];
}
export interface TargetSources { origin: string | null; hosting: ProjectHosting | null }
/** `platform` is the raw --platform value; `binding` comes from a published document's frontmatter. */
export interface TargetRequest { platform?: string; binding?: Pick<RemoteBinding, 'platform' | 'repository' | 'organization' | 'project'> }
const githubRepository = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const githubOrigin = /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|(?:ssh:\/\/)?git@(?:ssh\.)?github\.com(?::443\/|[:/]))([^/]+\/[^/]+?)(?:\.git)?\/?$/;

/** Reads the origin URL and `tooling.hosting` without running git or contacting a host. */
export async function readTargetSources(root: string): Promise<TargetSources> {
  const origin = await readOriginUrl(root);
  if (!await exists(join(root, designFile))) return { origin, hosting: null };
  const document = parseAuthoringDocument((await readBounded(join(root, designFile), 4_000_000)).toString('utf8'));
  return { origin, hosting: projectHosting(document) ?? null };
}
const refuse = (code: string, message: string, next?: string): never => { throw remoteError(code, message, { uncertain: false, step: 'read' }, next); };
type PlatformChoice = { platform: HostingPlatform; source: HostingTarget['source'] };
function explicitPlatform(explicit: string, source: HostingTarget['source']): PlatformChoice {
  if (explicit === 'none') refuse('PR_HOSTING_NONE', 'Hosting is set to none, so there is no platform to publish to.', 'hosting set github|azure-devops --dry-run');
  if (explicit !== 'github' && explicit !== 'azure-devops') refuse('PR_PLATFORM_INVALID', 'The platform must be github or azure-devops.');
  return { platform: explicit as HostingPlatform, source };
}
function choosePlatform(request: TargetRequest, sources: TargetSources): PlatformChoice {
  if (request.platform !== undefined) return explicitPlatform(request.platform, 'flag');
  if (request.binding !== undefined) return explicitPlatform(request.binding.platform, 'binding');
  if (sources.hosting?.platform === 'none') refuse('PR_HOSTING_NONE', 'tooling.hosting.platform is none, so there is no platform to publish to.', 'hosting set github|azure-devops --dry-run');
  if (sources.hosting) return { platform: sources.hosting.platform as HostingPlatform, source: 'project' };
  const origin = classifyRemote(sources.origin);
  if (origin) return { platform: origin, source: 'origin' };
  return refuse('PR_HOSTING_UNCONFIGURED', 'No hosting platform is configured and the origin remote is not GitHub or Azure DevOps.', 'pr publish <pr> --platform github|azure-devops, or hosting set');
}
function githubTarget(request: TargetRequest, sources: TargetSources): string {
  const bound = request.binding?.platform === 'github' ? request.binding.repository : undefined;
  const repository = bound ?? (classifyRemote(sources.origin) === 'github' ? githubOrigin.exec(sources.origin ?? '')?.[1] : undefined);
  if (repository === undefined || !githubRepository.test(repository)) return refuse('PR_REPOSITORY_UNRESOLVED', 'The GitHub repository could not be resolved from the binding or the origin remote.', 'git remote add origin https://github.com/<owner>/<repo>.git');
  return repository;
}
type AzureCandidate = { organization: string; project: string; repository?: string | undefined };
function azureCandidate(request: TargetRequest, sources: TargetSources): AzureCandidate | null {
  const binding = request.binding;
  if (binding?.platform === 'azure-devops' && binding.organization && binding.project) return { organization: binding.organization, project: binding.project, repository: binding.repository };
  if (sources.hosting?.platform === 'azure-devops' && sources.hosting.azureDevOps) return sources.hosting.azureDevOps;
  return azureRemoteDetails(sources.origin);
}
function azureTarget(request: TargetRequest, sources: TargetSources): AzureCoordinates {
  const candidate = azureCandidate(request, sources);
  if (!candidate) return refuse('PR_REPOSITORY_UNRESOLVED', 'The Azure DevOps organization, project and repository could not be resolved.', 'hosting set azure-devops --azure-organization <url> --azure-project <name> --dry-run');
  try { validateHosting({ platform: 'azure-devops', azureDevOps: candidate }); }
  catch { refuse('PR_REPOSITORY_UNRESOLVED', 'The Azure DevOps coordinates are not valid organization, project and repository names.'); }
  return { organization: candidate.organization, project: candidate.project, repository: candidate.repository ?? candidate.project };
}
/** Pure resolution over already read sources; throws PR_HOSTING_NONE, PR_HOSTING_UNCONFIGURED, PR_PLATFORM_INVALID or PR_REPOSITORY_UNRESOLVED. */
export function resolveHostingTarget(request: TargetRequest, sources: TargetSources): HostingTarget {
  const { platform, source } = choosePlatform(request, sources);
  const origin = classifyRemote(sources.origin), configured = sources.hosting?.platform;
  const warnings: RemoteDiagnostic[] = configured && origin && configured !== origin
    ? [{ code: 'PR_HOSTING_ORIGIN_MISMATCH', message: `tooling.hosting says ${configured} but the origin remote is ${origin}; ${platform} is used.` }] : [];
  if (platform === 'github') {
    const repository = githubTarget(request, sources);
    return { platform, repository, github: { repository }, azure: null, source, warnings };
  }
  const azure = azureTarget(request, sources);
  return { platform, repository: `${azure.organization.replace(/^https:\/\//, '')}/${azure.project}/${azure.repository}`, github: null, azure, source, warnings };
}
