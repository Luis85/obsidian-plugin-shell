/**
 * In-memory HostingRemote (src/cli/application/increments/remote-port.ts) for publish/sync tests: records every call,
 * simulates people editing the pull request on the platform, and injects failures with the adapters' codes and
 * RemoteFailure details. `uncertain` failures can be applied or not, as a lost response would be in reality.
 * Never contacts GitHub or Azure DevOps.
 */
import { createHash } from 'node:crypto';
import { OperationError } from '../../scripts/contracts/errors.ts';
import { remoteRevision } from '../../src/cli/domain/increments/sync-record.ts';

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const webs = { github: repository => `https://github.com/${repository}`, 'azure-devops': () => 'https://dev.azure.com/contoso/Demo/_git/demo' };
const failureCodes = { rejected: 'PR_REMOTE_REJECTED', auth: 'PR_REMOTE_AUTH_REQUIRED', missing: 'PR_REMOTE_CLI_MISSING', notFound: 'PR_REMOTE_NOT_FOUND', rateLimited: 'PR_REMOTE_RATE_LIMITED' };
function coded(code, message, details, next) {
  const error = new OperationError(code, message, next);
  error.details = details;
  return error;
}
/** A representative view of a published pull request with wikilinks in every content region. */
export function samplePullRequestView(overrides = {}) {
  return {
    id: 'delivery-1', title: 'Hosting set command', kind: 'change',
    increment: { id: 'delivery', title: 'Delivery pipeline', path: 'docs/increments/delivery.md' },
    planPath: 'docs/pull-requests/delivery-1.md',
    summary: 'Adds `hosting set`; see [[docs/development/HOSTING-PLATFORMS|Hosting platforms]].',
    scope: { in: ['Planner for hosting set', 'Docs in [[docs/README]]'], out: ['Pipeline changes'] },
    acceptance: [{ id: 'AC-1', text: 'hosting set previews', done: true }, { id: 'AC-2', text: 'apply writes the plan', done: false }],
    tasks: [{ id: 'T-1', text: 'Add the hosting set planner', done: false }, { id: 'T-2', text: 'Document [[docs/development/HOSTING-PLATFORMS|Hosting platforms]]', done: true }],
    documents: [{ target: 'docs/increments/delivery', label: 'Increment: Delivery pipeline' }, { target: 'docs/prds/delivery', label: '' }],
    notes: 'Reviewed with the team.\n\n```\n[[not-a-link]]\n```',
    amendments: [{ id: 'A-1', date: '2026-10-05', markdown: 'Split the docs task.\n\n#### Why\n\nSmaller diff.' }],
    head: 'increment/delivery/delivery-1', base: 'increment/delivery', ...overrides,
  };
}

export function createFakeHostingRemote(options = {}) {
  const platform = options.platform ?? 'github', repository = options.repository ?? 'octo/demo';
  const branches = new Set(options.branches ?? ['main', 'increment/delivery']);
  const pulls = new Map(), calls = [], failures = [];
  let next = options.firstNumber ?? 1;
  const web = webs[platform](repository);
  const snapshot = pull => ({ ...pull, revision: remoteRevision(pull, sha256) });
  function fail(method) {
    const index = failures.findIndex(entry => entry.method === method);
    if (index < 0) return null;
    const [entry] = failures.splice(index, 1);
    return entry;
  }
  function throwFailure(entry, step) {
    if (entry.kind === 'timeout' && step === 'read') throw coded('PR_REMOTE_FAILED', 'Reading from the fake remote timed out.', { uncertain: false, step });
    if (entry.kind === 'timeout' || entry.kind === 'uncertain') {
      throw coded('PR_REMOTE_UNCERTAIN', `The ${step} request may or may not have reached the platform (${entry.kind}). Nothing was retried.`, { uncertain: true, step },
        'Inspect the pull request, then rerun the same command.');
    }
    throw coded(failureCodes[entry.kind] ?? 'PR_REMOTE_FAILED', `Fake ${entry.kind} failure.`, { uncertain: false, step });
  }
  /** Applies a write unless a failure says otherwise; an uncertain failure may still have been applied. */
  function write(method, step, apply) {
    const entry = fail(method);
    if (!entry) return snapshot(apply());
    if (entry.applied) apply();
    throwFailure(entry, step);
  }
  function read(method) {
    const entry = fail(method);
    if (entry) throwFailure(entry, 'read');
  }
  function existing(number) {
    const pull = pulls.get(number);
    if (!pull) throw coded('PR_REMOTE_NOT_FOUND', `No pull request ${number}.`, { uncertain: false, step: 'read' });
    return pull;
  }
  const remote = {
    platform, repository,
    async readiness() {
      calls.push(['readiness']); read('readiness');
      const ready = options.readiness ?? { cli: 'ok', auth: 'ok', diagnostics: [] };
      return { platform, repository, defaultBranch: 'main', ...ready, configured: ready.cli === 'ok' && ready.auth === 'ok' && !ready.diagnostics.length };
    },
    linkTarget: ref => ({ platform, web, ref }),
    async headExists(branch) { calls.push(['headExists', branch]); read('headExists'); return branches.has(branch); },
    async findMarked(head, base, marker) {
      calls.push(['findMarked', head, base, marker]); read('findMarked');
      const matching = [...pulls.values()].filter(pull => pull.head === head && pull.base === base);
      return { marked: matching.filter(pull => pull.body.includes(marker)).map(snapshot),
        unmarkedOpen: matching.filter(pull => !pull.body.includes(marker) && ['draft', 'open'].includes(pull.state)).length };
    },
    async get(number) { calls.push(['get', number]); read('get'); return snapshot(existing(number)); },
    async create(input) {
      calls.push(['create', { ...input }]);
      return write('create', 'create', () => {
        const number = next++;
        const pull = { number, url: platform === 'github' ? `${web}/pull/${number}` : `${web}/pullrequest/${number}`, title: input.title, body: input.body,
          state: 'draft', head: input.head, base: input.base };
        pulls.set(number, pull);
        return pull;
      });
    },
    async update(number, patch) {
      calls.push(['update', number, { ...patch }]);
      return write('update', 'update', () => Object.assign(existing(number), patch.title === undefined ? {} : { title: patch.title }, patch.body === undefined ? {} : { body: patch.body }));
    },
  };
  return {
    remote, calls, pulls,
    /** The next call of `method` fails: rejected | auth | missing | notFound | rateLimited | timeout | uncertain (`applied` for writes). */
    failNext(method, kind, { applied = false } = {}) { failures.push({ method, kind, applied }); },
    /** A person edits the body on the platform. */
    editBody(number, edit) { const pull = existing(number); pull.body = edit(pull.body); },
    setTitle(number, title) { existing(number).title = title; },
    /** The platform changes state: draft | open | merged | closed. */
    setState(number, state) { existing(number).state = state; },
    /** The publish plan's push step ran (outside the port): the branch now exists on the remote. */
    pushBranch(branch) { branches.add(branch); },
    writes: () => calls.filter(([method]) => method === 'create' || method === 'update').length,
  };
}
