/**
 * GitHub adapter of the HostingRemote port over `gh api`, with the user's own gh sign-in. Only fixed REST routes
 * under `repos/<owner>/<repo>` are issued, request bodies go through stdin as JSON, every call has a timeout and a
 * bounded response, and failures carry a code, never gh's raw output (which can echo tokens). It never pushes,
 * marks a draft ready, merges or stores credentials.
 */
import { githubRemoteState } from '../../domain/increments/remote-state.ts';
import { bodySize } from '../../domain/increments/remote-body.ts';
import type { LinkTarget } from '../../domain/increments/remote-model.ts';
import type { CreatePullRequest, HostingRemote, RemoteDiagnostic, RemoteFailure, RemotePullRequest, RemoteReadiness } from '../../application/increments/remote-port.ts';
import { commandRunner, pullRequest, readinessResult, remoteError, remoteLimits, requireBranch, requireNumber, transportFailure, uncertainWrite } from './hosting-target.ts';
import type { CommandResult, CommandRunner } from './hosting-target.ts';

export interface GitHubRemoteOptions { repository: string; run?: CommandRunner; env?: NodeJS.ProcessEnv }
type Step = RemoteFailure['step'];
const routePattern = /^repos\/[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9%_.?=&/:,+-]*)?$/;
const encodeSegments = (value: string): string => value.split('/').map(encodeURIComponent).join('/');
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const definite = (code: string, message: string, step: Step, status?: number, next?: string) =>
  remoteError(code, message, { uncertain: false, step, ...(status ? { status } : {}) }, next);

function httpFailure(status: number, step: Step) {
  if (status === 401) return definite('PR_REMOTE_AUTH_REQUIRED', 'GitHub refused the credentials of gh.', step, status, 'gh auth login');
  if (status === 403 || status === 429) return definite('PR_REMOTE_RATE_LIMITED', 'GitHub refused the request as rate limited or forbidden.', step, status, 'Wait for the rate limit to reset, or check the token scopes (pull requests: write).');
  if (status === 404) return definite('PR_REMOTE_NOT_FOUND', 'GitHub reported the repository, branch or pull request as not found.', step, status);
  return definite('PR_REMOTE_REJECTED', step === 'create'
    ? `GitHub rejected the draft pull request (HTTP ${status}): the head may have no commits ahead of base, an open pull request may already exist, or draft pull requests may be unavailable for this repository.`
    : `GitHub rejected the request (HTTP ${status}).`, step, status);
}
/** Classifies a failed gh call; a write without a definite refusal is uncertain. */
function failure(result: CommandResult, step: Step) {
  return transportFailure(result, step, 'gh', 'Install gh (https://cli.github.com), then gh auth login') ?? answeredFailure(result.stderr, step);
}
function answeredFailure(stderr: string, step: Step) {
  const status = Number(/\(HTTP (\d{3})\)/.exec(stderr)?.[1]) || 0;
  if (status >= 400 && status < 500) return httpFailure(status, step);
  if (!status && /gh auth login|not logged in|authentication required/i.test(stderr)) return definite('PR_REMOTE_AUTH_REQUIRED', 'gh is not signed in to github.com.', step, undefined, 'gh auth login');
  const detail = status ? `HTTP ${status}` : 'no response';
  return step === 'read' ? definite('PR_REMOTE_FAILED', `Reading from GitHub failed (${detail}).`, step, status) : uncertainWrite(step, detail);
}
function invalid(step: Step) {
  return step === 'read' ? definite('PR_REMOTE_RESPONSE_INVALID', 'GitHub returned an unexpected response.', step) : uncertainWrite(step, 'the response could not be read');
}
const isText = (value: unknown): value is string => typeof value === 'string';
const refOf = (value: unknown): unknown => isObject(value) ? value.ref : undefined;
function toPullRequest(value: unknown, step: Step): RemotePullRequest {
  const pull = isObject(value) ? value : {};
  const head = refOf(pull.head), base = refOf(pull.base), body = pull.body === null ? '' : pull.body;
  const state = githubRemoteState({ state: pull.state, draft: pull.draft, merged: isText(pull.merged_at) });
  const valid = Number.isSafeInteger(pull.number) && [pull.html_url, pull.title, head, base, body].every(isText) && String(pull.html_url).startsWith('https://');
  if (!valid || state === null) throw invalid(step);
  return pullRequest({ number: pull.number as number, url: pull.html_url as string, title: pull.title as string, body: body as string, state, head: head as string, base: base as string });
}
function requireBody(body: string, step: Step): string {
  const size = bodySize(body, 'github');
  if (typeof body !== 'string' || !size.fits) throw definite('PR_BODY_TOO_LARGE', `The body has ${size.size} characters; GitHub accepts at most ${size.limit}. It is never truncated.`, step);
  return body;
}
function requireTitle(title: string): string {
  // oxlint-disable-next-line no-control-regex
  if (typeof title !== 'string' || !title.trim() || title.length > 256 || /[\u0000-\u001f\u007f]/.test(title)) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'A pull-request title is one line of at most 256 characters.', 'read');
  return title;
}

export function createGitHubRemote(options: GitHubRemoteOptions): HostingRemote {
  const { repository } = options, run = options.run ?? commandRunner;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)) throw definite('PR_REPOSITORY_UNRESOLVED', 'The GitHub repository must be owner/repo.', 'read');
  const env = { ...(options.env ?? process.env), GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' };
  const gh = (args: string[], input?: string) => run('gh', args, { ...remoteLimits, env, ...(input === undefined ? {} : { input }) });
  async function api(method: 'GET' | 'POST' | 'PATCH', path: string, step: Step, body?: Record<string, unknown>): Promise<unknown> {
    const route = `repos/${repository}${path}`;
    if (!routePattern.test(route) || /\/\.{1,2}(?:\/|$|\?)/.test(route)) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'Refusing an unexpected GitHub API route.', step);
    const result = await gh(['api', '--method', method, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28',
      ...(body ? ['--input', '-'] : []), route], body ? JSON.stringify(body) : undefined);
    if (result.status !== 0) throw failure(result, step);
    try { return JSON.parse(result.stdout); } catch { throw invalid(step); }
  }
  async function repositoryFacts(): Promise<{ defaultBranch: string | null; diagnostics: RemoteDiagnostic[] }> {
    try {
      const value = await api('GET', '', 'read');
      return { defaultBranch: isObject(value) && typeof value.default_branch === 'string' ? value.default_branch : null, diagnostics: [] };
    } catch (error) {
      const code = (error as { code?: string }).code === 'PR_REMOTE_NOT_FOUND' ? 'PR_REPOSITORY_UNRESOLVED' : String((error as { code?: string }).code);
      return { defaultBranch: null, diagnostics: [{ code, message: `The repository ${repository} could not be read with the current gh sign-in.` }] };
    }
  }
  return {
    platform: 'github', repository,
    async readiness(): Promise<RemoteReadiness> {
      const status = await gh(['auth', 'status', '--hostname', 'github.com']);
      if (status.error === 'ENOENT') return readinessResult('github', repository, { cli: 'missing', auth: 'unknown', defaultBranch: null },
        [{ code: 'PR_REMOTE_CLI_MISSING', message: 'The GitHub CLI (gh) was not found. Nothing was installed.', next: 'Install gh (https://cli.github.com), then gh auth login' }]);
      if (status.status !== 0) return readinessResult('github', repository, { cli: 'ok', auth: 'required', defaultBranch: null },
        [{ code: 'PR_REMOTE_AUTH_REQUIRED', message: 'gh is not signed in to github.com.', next: 'gh auth login' }]);
      const facts = await repositoryFacts();
      return readinessResult('github', repository, { cli: 'ok', auth: 'ok', defaultBranch: facts.defaultBranch }, facts.diagnostics);
    },
    linkTarget: (ref: string): LinkTarget => ({ platform: 'github', web: `https://github.com/${repository}`, ref }),
    async headExists(branch) {
      try { await api('GET', `/branches/${encodeSegments(requireBranch(branch))}`, 'read'); return true; }
      catch (error) { if ((error as { code?: string }).code === 'PR_REMOTE_NOT_FOUND') return false; throw error; }
    },
    async findMarked(head, base, marker) {
      const owner = repository.slice(0, repository.indexOf('/'));
      const list = await api('GET', `/pulls?state=all&head=${owner}:${encodeURIComponent(requireBranch(head))}&base=${encodeURIComponent(requireBranch(base))}&per_page=100`, 'read');
      if (!Array.isArray(list) || list.length > 100) throw invalid('read');
      const pulls = list.map(item => toPullRequest(item, 'read'));
      const marked = pulls.filter(pull => pull.body.includes(marker));
      return { marked, unmarkedOpen: pulls.filter(pull => !pull.body.includes(marker) && (pull.state === 'draft' || pull.state === 'open')).length };
    },
    get: async number => toPullRequest(await api('GET', `/pulls/${requireNumber(number)}`, 'read'), 'read'),
    async create(input: CreatePullRequest) {
      const payload = { title: requireTitle(input.title), head: requireBranch(input.head), base: requireBranch(input.base), body: requireBody(input.body, 'create'), draft: true };
      return toPullRequest(await api('POST', '/pulls', 'create', payload), 'create');
    },
    async update(number, patch) {
      const payload = { ...(patch.title === undefined ? {} : { title: requireTitle(patch.title) }), ...(patch.body === undefined ? {} : { body: requireBody(patch.body, 'update') }) };
      if (!Object.keys(payload).length) throw definite('PR_REMOTE_ARGUMENT_UNSAFE', 'An update needs a title or a body.', 'update');
      return toPullRequest(await api('PATCH', `/pulls/${requireNumber(number)}`, 'update', payload), 'update');
    },
  };
}
