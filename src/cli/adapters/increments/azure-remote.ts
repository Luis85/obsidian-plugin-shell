/**
 * Azure Repos adapter of the HostingRemote port over `az repos pr create|show|update|list`, `az repos ref list` and
 * `az repos show`, signed in with `az login` or a session AZURE_DEVOPS_EXT_PAT (passed through, never logged).
 * Title and description travel through az's `@file` argument syntax from a private temporary directory (mode 0600,
 * removed afterwards), never as argv text. Every argument is whitelisted, so the Windows `az.cmd` shim can be
 * started through a shell with each argument double-quoted. Descriptions over 4,000 characters are refused, never
 * truncated. Unverified against a live organization: `@file` expansion of `--title/--description`, and whether
 * HTML comments survive in descriptions (the body codec also accepts reference-style markers as a fallback).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateHosting } from '../../../../scripts/companion/schema/hosting.mjs';
import { parseAzureVersion } from '../framework/hosting-cli.ts';
import { hasControls } from '../../domain/errors.ts';
import { azureRemoteState } from '../../domain/increments/remote-state.ts';
import { bodySize } from '../../domain/increments/remote-body.ts';
import type { LinkTarget } from '../../domain/increments/remote-model.ts';
import type { CreatePullRequest, HostingRemote, RemoteFailure, RemotePullRequest, RemoteReadiness } from '../../application/increments/remote-port.ts';
import { commandRunner, pullRequest, readinessResult, remoteError, remoteLimits, requireBranch, requireNumber, transportFailure, uncertainWrite } from './hosting-target.ts';
import type { AzureCoordinates, CommandResult, CommandRunner } from './hosting-target.ts';

export interface AzureRemoteOptions extends AzureCoordinates { run?: CommandRunner; env?: NodeJS.ProcessEnv; windows?: boolean; tempRoot?: string }
type Step = RemoteFailure['step'];
const safeArgument = /^[A-Za-z0-9 ._:/@=\\~-]{1,1024}$/;
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const definite = (code: string, message: string, step: Step, next?: string) => remoteError(code, message, { uncertain: false, step }, next);
const branchOf = (ref: unknown): string | null => typeof ref === 'string' && ref.startsWith('refs/heads/') ? ref.slice(11) : null;
const patterns: ReadonlyArray<[RegExp, string, string, string?]> = [
  [/misspelled or not recognized|is not in the '?az'? command group|az extension add/i, 'PR_REMOTE_CLI_MISSING', 'The az CLI has no azure-devops extension. Nothing was installed.', 'az extension add --name azure-devops'],
  [/unrecognized arguments|arguments are required|invalid choice|error: argument/i, 'PR_REMOTE_REJECTED', 'az refused the arguments; the azure-devops extension may be outdated.', 'az extension update --name azure-devops'],
  [/TF400813|TF401444|\b401\b|unauthori[sz]ed|az login|AZURE_DEVOPS_EXT_PAT|az devops login/i, 'PR_REMOTE_AUTH_REQUIRED', 'Azure DevOps refused the current az sign-in.', 'az login (or set AZURE_DEVOPS_EXT_PAT for this shell session only)'],
  [/TF400733|\b429\b|too many requests|rate limit/i, 'PR_REMOTE_RATE_LIMITED', 'Azure DevOps refused the request as rate limited.'],
  [/TF401019|TF200016|TF401180|\b404\b|does not exist|could not be found|not found/i, 'PR_REMOTE_NOT_FOUND', 'Azure DevOps reported the organization, project, repository, branch or pull request as not found.'],
  [/TF\d{5,6}\b|\b40[039]\b|\b422\b/, 'PR_REMOTE_REJECTED', 'Azure DevOps rejected the request (for example an active pull request already exists for these branches).'],
];
/** Classifies a failed az call by its exit facts and stderr; stderr itself is never returned. */
function failure(result: CommandResult, step: Step) {
  const transport = transportFailure(result, step, 'az', 'Install the Azure CLI (https://aka.ms/installazurecli), then az extension add --name azure-devops; az login');
  if (transport) return transport;
  const known = patterns.find(([pattern]) => pattern.test(result.stderr));
  if (known) return definite(known[1], known[2], step, known[3]);
  return step === 'read' ? definite('PR_REMOTE_FAILED', 'Reading from Azure DevOps failed.', step) : uncertainWrite(step, 'az failed without a recognisable refusal');
}
const invalid = (step: Step) => step === 'read' ? definite('PR_REMOTE_RESPONSE_INVALID', 'Azure DevOps returned an unexpected response.', step) : uncertainWrite(step, 'the response could not be read');
function requireText(title: string, body: string | undefined, step: Step): void {
  if (typeof title !== 'string' || !title.trim() || title.length > 400 || hasControls(title)) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'A pull-request title is one line of at most 400 characters.', step);
  const size = body === undefined ? null : bodySize(body, 'azure-devops');
  if (size && !size.fits) throw definite('PR_BODY_TOO_LARGE', `The description has ${size.size} characters; Azure DevOps accepts at most ${size.limit}. It is never truncated.`, step);
}

function sourceCommit(value: unknown): string | undefined {
  return isObject(value) && typeof value.commitId === 'string' ? value.commitId : undefined;
}

export function createAzureRemote(options: AzureRemoteOptions): HostingRemote {
  const { organization, project, repository } = options, run = options.run ?? commandRunner, windows = options.windows ?? process.platform === 'win32';
  try { validateHosting({ platform: 'azure-devops', azureDevOps: { organization, project, repository } }); }
  catch { throw definite('PR_REPOSITORY_UNRESOLVED', 'The Azure DevOps organization, project or repository name is not valid.', 'read'); }
  const web = `${organization}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repository)}`;
  const display = `${organization.replace(/^https:\/\//, '')}/${project}/${repository}`;
  const env = { ...(options.env ?? process.env), AZURE_CORE_COLLECT_TELEMETRY: 'false', AZURE_CORE_NO_COLOR: 'true', AZURE_CORE_ONLY_SHOW_ERRORS: 'true' };
  const scope = ['--detect', 'false', '--organization', organization, '--output', 'json', '--only-show-errors'];
  const inRepository = [...scope, '--project', project, '--repository', repository];
  async function az(args: string[], step: Step): Promise<CommandResult> {
    if (!args.every(argument => safeArgument.test(argument))) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'Refusing an az argument outside the safe character set (set TMP to a plain path if this is a temporary file).', step);
    return run(windows ? 'az.cmd' : 'az', windows ? args.map(argument => `"${argument}"`) : args, { ...remoteLimits, env, shell: windows });
  }
  async function json(args: string[], step: Step): Promise<unknown> {
    const result = await az(args, step);
    if (result.status !== 0) throw failure(result, step);
    try { return JSON.parse(result.stdout); } catch { throw invalid(step); }
  }
  /** Writes title/description to private files for az's @file syntax and always removes them. */
  async function withFiles<T>(contents: Record<string, string>, action: (paths: Record<string, string>) => Promise<T>): Promise<T> {
    const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'wb-pr-'));
    try {
      const paths: Record<string, string> = {};
      for (const [name, text] of Object.entries(contents)) { paths[name] = join(directory, `${name}.txt`); await writeFile(paths[name]!, text, { mode: 0o600, flag: 'wx' }); }
      return await action(paths);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  function toPullRequest(value: unknown, step: Step): RemotePullRequest {
    if (!isObject(value)) throw invalid(step);
    const state = azureRemoteState({ status: value.status, isDraft: value.isDraft });
    const head = branchOf(value.sourceRefName), base = branchOf(value.targetRefName), description = value.description ?? '';
    if (!Number.isSafeInteger(value.pullRequestId) || state === null || head === null || base === null || typeof value.title !== 'string' || typeof description !== 'string') throw invalid(step);
    const headCommit = sourceCommit(value.lastMergeSourceCommit);
    return { ...(headCommit ? { headCommit } : {}), ...pullRequest({ number: value.pullRequestId as number, url: `${web}/pullrequest/${value.pullRequestId}`, title: value.title, body: description, state, head, base }) };
  }
  const get = async (number: number) => toPullRequest(await json(['repos', 'pr', 'show', '--id', String(requireNumber(number)), ...scope], 'read'), 'read');
  async function readiness(): Promise<RemoteReadiness> {
    const version = await az(['version', '--output', 'json'], 'read');
    const cli = version.status === 0 ? parseAzureVersion(version.stdout) : null;
    if (!cli?.available) return readinessResult('azure-devops', display, { cli: 'missing', auth: 'unknown', defaultBranch: null }, [{ code: 'PR_REMOTE_CLI_MISSING', message: 'The az CLI was not found. Nothing was installed.', next: 'Install the Azure CLI (https://aka.ms/installazurecli)' }]);
    if (!cli.devopsExtension) return readinessResult('azure-devops', display, { cli: 'extension-missing', auth: 'unknown', defaultBranch: null }, [{ code: 'PR_REMOTE_CLI_MISSING', message: 'The az CLI has no azure-devops extension. Nothing was installed.', next: 'az extension add --name azure-devops' }]);
    try {
      const value = await json(['repos', 'show', ...scope, '--project', project, '--repository', repository], 'read');
      return readinessResult('azure-devops', display, { cli: 'ok', auth: 'ok', defaultBranch: isObject(value) ? branchOf(value.defaultBranch) : null }, []);
    } catch (error) {
      const code = (error as { code: string }).code, next = (error as { next?: string }).next;
      const auth = code === 'PR_REMOTE_AUTH_REQUIRED' ? 'required' : 'unknown';
      return readinessResult('azure-devops', display, { cli: 'ok', auth, defaultBranch: null },
        [{ code: code === 'PR_REMOTE_NOT_FOUND' ? 'PR_REPOSITORY_UNRESOLVED' : code, message: (error as Error).message, ...(next ? { next } : {}) }]);
    }
  }
  return {
    platform: 'azure-devops', repository: display, readiness, get,
    async transition(number, action, headCommit) {
      requireNumber(number);
      if (!/^[0-9a-f]{40,64}$/.test(headCommit)) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'A reviewed source commit is required.', 'read');
      if (action !== 'merge') {
        await json(['repos', 'pr', 'update', '--id', String(number), ...scope,
          ...(action === 'review' ? ['--draft', 'false'] : ['--status', 'abandoned'])], 'update');
        return;
      }
      // The REST completion contract pins the source commit and preserves platform policies.
      const body = JSON.stringify({ status: 'completed', lastMergeSourceCommit: { commitId: headCommit },
        completionOptions: { mergeStrategy: 'noFastForward', deleteSourceBranch: false, bypassPolicy: false } });
      await withFiles({ body }, async paths => {
        await json(['devops', 'invoke', '--area', 'git', '--resource', 'pullRequests', '--route-parameters',
          `project=${project}`, `repositoryId=${repository}`, `pullRequestId=${number}`, '--http-method', 'PATCH',
          '--api-version', '7.1', '--in-file', paths.body!, ...scope.slice(2)], 'update');
      });
    },
    linkTarget: (ref: string): LinkTarget => ({ platform: 'azure-devops', web, ref }),
    async headExists(branch) {
      const refs = await json(['repos', 'ref', 'list', ...inRepository, '--filter', `heads/${requireBranch(branch)}`], 'read');
      if (!Array.isArray(refs)) throw invalid('read');
      return refs.some(ref => isObject(ref) && ref.name === `refs/heads/${branch}`);
    },
    async findMarked(head, base, marker) {
      const list = await json(['repos', 'pr', 'list', ...inRepository, '--source-branch', requireBranch(head), '--target-branch', requireBranch(base), '--status', 'all', '--top', '100'], 'read');
      if (!Array.isArray(list) || list.length > 100) throw invalid('read');
      const pulls = list.map(item => toPullRequest(item, 'read')), candidates = pulls.filter(pull => pull.body.includes(marker));
      if (candidates.length > 3) throw definite('PR_REMOTE_DUPLICATE', 'More than three pull requests carry this marker; resolve them on Azure DevOps first.', 'read');
      // List responses may shorten descriptions, so marked pull requests are read in full.
      const marked = await Promise.all(candidates.map(pull => get(pull.number)));
      return { marked, unmarkedOpen: pulls.filter(pull => !pull.body.includes(marker) && (pull.state === 'draft' || pull.state === 'open')).length };
    },
    async create(input: CreatePullRequest) {
      requireText(input.title, input.body, 'create');
      const branches = ['--source-branch', requireBranch(input.head), '--target-branch', requireBranch(input.base)];
      return withFiles({ title: input.title, description: input.body }, async paths => toPullRequest(await json(['repos', 'pr', 'create', ...inRepository, ...branches,
        '--title', `@${paths.title}`, '--description', `@${paths.description}`, '--draft', 'true'], 'create'), 'create'));
    },
    async update(number, patch) {
      if (patch.title === undefined && patch.body === undefined) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'An update needs a title or a body.', 'update');
      requireText(patch.title ?? 'unchanged', patch.body, 'update');
      const contents = { ...(patch.title === undefined ? {} : { title: patch.title }), ...(patch.body === undefined ? {} : { description: patch.body }) };
      return withFiles(contents, async paths => toPullRequest(await json(['repos', 'pr', 'update', '--id', String(requireNumber(number)), ...scope,
        ...(paths.title ? ['--title', `@${paths.title}`] : []), ...(paths.description ? ['--description', `@${paths.description}`] : [])], 'update'), 'update'));
    },
  };
}
