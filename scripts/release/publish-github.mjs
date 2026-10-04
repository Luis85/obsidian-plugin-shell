/**
 * Narrow `gh` adapter for release publishing. Only fixed repository API routes, `gh pr ready` and
 * `gh run download` are issued, always through the injectable runner. Error output can contain secrets,
 * so failures carry a code and HTTP status, never gh's raw text.
 */
const repositoryPattern = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const repoRoute = '[A-Za-z0-9][A-Za-z0-9-]*\\/[A-Za-z0-9][A-Za-z0-9_.-]*';
const safeRoute = new RegExp(`^(?:repos\\/${repoRoute}(?:\\/[A-Za-z0-9%_.?=&/:,+-]*)?|https:\\/\\/uploads\\.github\\.com\\/repos\\/${repoRoute}\\/releases\\/\\d+\\/assets\\?name=[A-Za-z0-9.-]+)$`);

export class GitHubError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}
function failure(result) {
  if (result.status === null && result.error === 'ENOENT') return new GitHubError('GH_CLI_REQUIRED: install the GitHub CLI (gh).');
  const stderr = String(result.stderr ?? '');
  const status = Number(/\(HTTP (\d{3})\)/.exec(stderr)?.[1]) || undefined;
  if (status === 401 || /gh auth login|GH_TOKEN|not logged in/i.test(stderr))
    return new GitHubError('GITHUB_AUTH_REQUIRED: authenticate gh (gh auth login, or GH_TOKEN with contents, pull-requests and actions access).', status);
  return new GitHubError(status ? `GITHUB_API_FAILED_HTTP_${status}` : 'GITHUB_API_FAILED', status);
}

export function createGitHub({ run, repository }) {
  if (typeof repository !== 'string' || !repositoryPattern.test(repository)) throw new GitHubError('INVALID_REPOSITORY');
  const prefix = `repos/${repository}`;
  function api(method, path, { body, file } = {}) {
    const target = path.startsWith('https://') ? path : `${prefix}${path}`;
    if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method) || !safeRoute.test(target) || /\/\.{1,2}(?:\/|$|\?)/.test(target)) throw new GitHubError('UNSAFE_GITHUB_API_REQUEST');
    const args = ['api', '--method', method, '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'];
    if (body !== undefined) args.push('--input', '-');
    else if (file) args.push('-H', 'Content-Type: application/octet-stream', '--input', file);
    args.push(target);
    const result = run('gh', args, body === undefined ? {} : { input: JSON.stringify(body) });
    if (result.status !== 0) throw failure(result);
    const text = String(result.stdout ?? '').trim();
    try { return text ? JSON.parse(text) : null; } catch { throw new GitHubError('GITHUB_API_RESPONSE_INVALID'); }
  }
  async function optional(path) {
    try { return api('GET', path); } catch (error) { if (error.status === 404) return null; throw error; }
  }
  /** Pages a list route; `key` names the array inside wrapped responses such as check_runs. */
  async function pages(path, key) {
    const values = [];
    for (let page = 1; page <= 50; page++) {
      const response = api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const items = key ? response?.[key] : response;
      if (!Array.isArray(items) || items.length > 100) throw new GitHubError('GITHUB_API_RESPONSE_INVALID');
      values.push(...items);
      if (items.length < 100) return values;
    }
    throw new GitHubError('GITHUB_PAGINATION_LIMIT');
  }
  function command(args, code) {
    const result = run('gh', [...args, '--repo', repository]);
    if (result.status !== 0) { const error = failure(result); throw error.code.startsWith('GITHUB_API_FAILED') ? new GitHubError(code, error.status) : error; }
    return result.stdout;
  }
  const prReady = number => command(['pr', 'ready', String(number)], 'PR_READY_FAILED');
  const download = (runId, name, directory) => command(['run', 'download', String(runId), '--name', name, '--dir', directory], 'CANDIDATE_DOWNLOAD_FAILED');
  return { repository, api, optional, pages, prReady, download };
}
