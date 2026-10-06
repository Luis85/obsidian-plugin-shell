const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitHubRemote } from '../adapters/increments/github-remote.ts';
import { createAzureRemote } from '../adapters/increments/azure-remote.ts';
import { requireConfigured } from '../adapters/increments/hosting-target.ts';
import { remoteRevision } from '../domain/increments/sync-record.ts';
import { sha256 } from './support/fake-hosting-remote.mjs';

const secret = 'ghp_SECRETTOKEN1234567890';
const ok = value => ({ status: 0, stdout: JSON.stringify(value), stderr: '', timedOut: false, overflow: false });
const failed = (stderr, extra = {}) => ({ status: 1, stdout: '', stderr: `${stderr} ${secret}`, timedOut: false, overflow: false, ...extra });
/** Fake CommandRunner: records argv and options and answers from a queue; it never starts a process. */
function runner(...answers) {
  const calls = [];
  const run = async (command, args, options) => {
    calls.push({ command, args: [...args], options });
    const answer = answers.shift();
    return typeof answer === 'function' ? answer(command, args, options) : answer;
  };
  return { run, calls };
}
const githubPull = (overrides = {}) => ({ number: 74, html_url: 'https://github.com/octo/demo/pull/74', title: 'T', body: 'B', state: 'open', draft: true,
  merged_at: null, head: { ref: 'feature/x' }, base: { ref: 'main' }, ...overrides });
const apiPrefix = ['api', '--method'];
const headers = ['-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28'];
async function rejects(promise, code, uncertain) {
  const error = await promise.then(() => null, caught => caught);
  assert.ok(error, `expected ${code}`); assert.equal(error.code, code, error.message);
  if (uncertain !== undefined) assert.equal(error.details.uncertain, uncertain);
  assert.ok(!JSON.stringify([error.message, error.next, error.details]).includes(secret), 'stderr is never echoed');
  return error;
}

test('GitHub readiness checks gh, the sign-in and the repository with exact read-only argv', async () => {
  const fake = runner(ok(''), ok({ default_branch: 'main' }));
  const remote = createGitHubRemote({ repository: 'octo/demo', run: fake.run, env: { GH_TOKEN: 'from-env' } });
  const ready = await remote.readiness();
  assert.deepEqual(ready, { platform: 'github', repository: 'octo/demo', cli: 'ok', auth: 'ok', defaultBranch: 'main', configured: true, diagnostics: [] });
  assert.deepEqual(fake.calls.map(call => [call.command, call.args]), [['gh', ['auth', 'status', '--hostname', 'github.com']], ['gh', [...apiPrefix, 'GET', ...headers, 'repos/octo/demo']]]);
  const options = fake.calls[0].options;
  assert.deepEqual([options.timeoutMs, options.maxBytes, options.env.GH_TOKEN, options.env.GH_PROMPT_DISABLED, options.shell], [60_000, 4 * 1024 * 1024, 'from-env', '1', undefined]);
  const missing = await createGitHubRemote({ repository: 'octo/demo', run: runner({ status: null, stdout: '', stderr: '', error: 'ENOENT', timedOut: false, overflow: false }).run }).readiness();
  assert.deepEqual([missing.cli, missing.configured, missing.diagnostics[0].code], ['missing', false, 'PR_REMOTE_CLI_MISSING']);
  const signedOut = await createGitHubRemote({ repository: 'octo/demo', run: runner(failed('You are not logged into any GitHub hosts.')).run }).readiness();
  assert.deepEqual([signedOut.auth, signedOut.diagnostics[0].code], ['required', 'PR_REMOTE_AUTH_REQUIRED']);
  const unknown = await createGitHubRemote({ repository: 'octo/demo', run: runner(ok(''), failed('gh: Not Found (HTTP 404)')).run }).readiness();
  assert.deepEqual([unknown.configured, unknown.diagnostics[0].code], [false, 'PR_REPOSITORY_UNRESOLVED']);
  assert.throws(() => requireConfigured(unknown), error => error.code === 'PR_REPOSITORY_UNRESOLVED');
  assert.doesNotThrow(() => requireConfigured(ready));
});

test('GitHub create sends one POST with the payload on stdin and always as a draft', async () => {
  const fake = runner(ok(githubPull()));
  const remote = createGitHubRemote({ repository: 'octo/demo', run: fake.run });
  const pull = await remote.create({ title: 'T', body: 'B; $(rm -rf /) `x`', head: 'feature/x', base: 'main' });
  assert.deepEqual(fake.calls[0].args, [...apiPrefix, 'POST', ...headers, '--input', '-', 'repos/octo/demo/pulls']);
  assert.deepEqual(JSON.parse(fake.calls[0].options.input), { title: 'T', head: 'feature/x', base: 'main', body: 'B; $(rm -rf /) `x`', draft: true });
  assert.deepEqual(pull, { number: 74, url: 'https://github.com/octo/demo/pull/74', title: 'T', body: 'B', state: 'draft', head: 'feature/x', base: 'main',
    revision: remoteRevision({ title: 'T', body: 'B', state: 'draft', head: 'feature/x', base: 'main' }, sha256) });
  assert.deepEqual(remote.linkTarget('feature/x'), { platform: 'github', web: 'https://github.com/octo/demo', ref: 'feature/x' });
});

test('GitHub reads: get, update, branch lookup and marker discovery use fixed routes', async () => {
  const marker = 'wb:pr v1 id=delivery-1 ';
  const fake = runner(ok(githubPull({ state: 'closed', merged_at: '2026-10-05T00:00:00Z' })), ok(githubPull({ title: 'New' })), failed('gh: Not Found (HTTP 404)'), ok({ name: 'main' }),
    ok([githubPull({ body: `x <!-- ${marker}increment=d -->` }), githubPull({ number: 75, body: 'other', draft: false }), githubPull({ number: 76, body: 'closed', state: 'closed' })]));
  const remote = createGitHubRemote({ repository: 'octo/demo', run: fake.run });
  assert.equal((await remote.get(74)).state, 'merged');
  assert.equal((await remote.update(74, { title: 'New' })).title, 'New');
  assert.equal(await remote.headExists('feature/x'), false);
  assert.equal(await remote.headExists('main'), true);
  const found = await remote.findMarked('feature/x', 'main', marker);
  assert.deepEqual([found.marked.map(pull => pull.number), found.unmarkedOpen], [[74], 1]);
  assert.deepEqual(fake.calls.map(call => call.args.at(-1)), ['repos/octo/demo/pulls/74', 'repos/octo/demo/pulls/74', 'repos/octo/demo/branches/feature/x',
    'repos/octo/demo/branches/main', 'repos/octo/demo/pulls?state=all&head=octo:feature%2Fx&base=main&per_page=100']);
  assert.deepEqual(JSON.parse(fake.calls[1].options.input), { title: 'New' });
});

test('GitHub failures map to codes; writes without a definite refusal are uncertain and never retried', async () => {
  const github = (...answers) => { const fake = runner(...answers); return { fake, remote: createGitHubRemote({ repository: 'octo/demo', run: fake.run }) }; };
  const input = { title: 'T', body: 'B', head: 'feature/x', base: 'main' };
  await rejects(github(failed('HTTP 401: Bad credentials (HTTP 401)')).remote.create(input), 'PR_REMOTE_AUTH_REQUIRED', false);
  await rejects(github(failed('API rate limit exceeded (HTTP 403)')).remote.get(1), 'PR_REMOTE_RATE_LIMITED', false);
  await rejects(github(failed('(HTTP 429)')).remote.update(1, { body: 'x' }), 'PR_REMOTE_RATE_LIMITED', false);
  const rejected = await rejects(github(failed('Validation Failed (HTTP 422)')).remote.create(input), 'PR_REMOTE_REJECTED', false);
  assert.match(rejected.message, /no commits ahead of base.*already exist.*draft pull requests may be unavailable/);
  for (const answer of [failed('(HTTP 502)'), failed('connection reset'), failed('', { status: null, timedOut: true }), { ...ok({}), stdout: 'not json' }, ok({ number: 'x' })]) {
    const { fake, remote } = github(answer);
    const error = await rejects(remote.create(input), 'PR_REMOTE_UNCERTAIN', true);
    assert.equal(error.details.step, 'create'); assert.match(error.next, /rerun the same command/); assert.equal(fake.calls.length, 1, 'no automatic retry');
  }
  await rejects(github(failed('', { status: null, timedOut: true })).remote.update(3, { title: 'x' }), 'PR_REMOTE_UNCERTAIN', true);
  await rejects(github(failed('', { status: null, timedOut: true })).remote.get(3), 'PR_REMOTE_FAILED', false);
  await rejects(github(failed('', { status: null, overflow: true })).remote.get(3), 'PR_REMOTE_RESPONSE_INVALID', false);
  await rejects(github({ status: null, stdout: '', stderr: '', error: 'ENOENT', timedOut: false, overflow: false }).remote.create(input), 'PR_REMOTE_CLI_MISSING', false);
});

test('GitHub refuses unsafe arguments and oversized bodies before running anything', async () => {
  const fake = runner();
  const remote = createGitHubRemote({ repository: 'octo/demo', run: fake.run });
  for (const head of ['-x', 'a..b', 'feat;rm', 'a b', 'x/', 'x.lock', 'a//b', '$(id)']) await rejects(remote.create({ title: 'T', body: 'B', head, base: 'main' }), 'PR_REMOTE_ARGUMENT_UNSAFE', false);
  await rejects(remote.create({ title: 'Two\nlines', body: 'B', head: 'x', base: 'main' }), 'PR_REMOTE_ARGUMENT_UNSAFE');
  await rejects(remote.get(0), 'PR_REMOTE_ARGUMENT_UNSAFE');
  await rejects(remote.update(1, {}), 'PR_REMOTE_ARGUMENT_UNSAFE');
  await rejects(remote.create({ title: 'T', body: 'x'.repeat(65_537), head: 'x', base: 'main' }), 'PR_BODY_TOO_LARGE', false);
  assert.equal(fake.calls.length, 0);
  assert.throws(() => createGitHubRemote({ repository: 'octo/demo/../x', run: fake.run }), error => error.code === 'PR_REPOSITORY_UNRESOLVED');
});

const coordinates = { organization: 'https://dev.azure.com/contoso', project: 'Demo Project', repository: 'demo' };
const azurePull = (overrides = {}) => ({ pullRequestId: 12, title: 'T', description: 'B', status: 'active', isDraft: true,
  sourceRefName: 'refs/heads/feature/x', targetRefName: 'refs/heads/main', ...overrides });
const scope = ['--detect', 'false', '--organization', 'https://dev.azure.com/contoso', '--output', 'json', '--only-show-errors'];
const inRepository = [...scope, '--project', 'Demo Project', '--repository', 'demo'];

test('Azure create passes title and description through private @files that are removed afterwards', async t => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'azure-remote-'));
  after(t, () => rm(tempRoot, { recursive: true, force: true }));
  const seen = {};
  const fake = runner(async (command, args) => {
    for (const flag of ['--title', '--description']) {
      const path = args[args.indexOf(flag) + 1].slice(1);
      seen[flag] = { text: await readFile(path, 'utf8'), mode: (await stat(path)).mode & 0o777 };
    }
    return ok(azurePull());
  });
  const remote = createAzureRemote({ ...coordinates, run: fake.run, windows: false, tempRoot, env: { AZURE_DEVOPS_EXT_PAT: 'pat-value' } });
  const pull = await remote.create({ title: 'Title "quoted" & more', body: '<!-- wb:pr -->\n- [ ] T-1: $(x)', head: 'feature/x', base: 'main' });
  const args = fake.calls[0].args, files = args.filter(arg => arg.startsWith('@'));
  assert.deepEqual(args, ['repos', 'pr', 'create', ...inRepository, '--source-branch', 'feature/x', '--target-branch', 'main',
    '--title', files[0], '--description', files[1], '--draft', 'true']);
  // Windows reports only the write bit (0o666 for a writable file); POSIX keeps the owner-only 0o600.
  const privateMode = process.platform === 'win32' ? 0o666 : 0o600;
  assert.deepEqual(seen, { '--title': { text: 'Title "quoted" & more', mode: privateMode }, '--description': { text: '<!-- wb:pr -->\n- [ ] T-1: $(x)', mode: privateMode } });
  assert.deepEqual(await readdir(tempRoot), [], 'payload files are removed');
  assert.equal(fake.calls[0].command, 'az');
  const env = fake.calls[0].options.env;
  assert.deepEqual([env.AZURE_DEVOPS_EXT_PAT, env.AZURE_CORE_COLLECT_TELEMETRY], ['pat-value', 'false']);
  assert.ok(!args.join(' ').includes('pat-value'), 'the PAT never appears in argv');
  assert.deepEqual(pull, { number: 12, url: 'https://dev.azure.com/contoso/Demo%20Project/_git/demo/pullrequest/12', title: 'T', body: 'B', state: 'draft',
    head: 'feature/x', base: 'main', revision: remoteRevision({ title: 'T', body: 'B', state: 'draft', head: 'feature/x', base: 'main' }, sha256) });
});

test('Azure on Windows starts az.cmd through a shell with every whitelisted argument quoted, and refuses anything else', async t => {
  const unsafeRoot = await mkdtemp(join(tmpdir(), 'azure&remote-'));
  after(t, () => rm(unsafeRoot, { recursive: true, force: true }));
  const fake = runner(ok(azurePull({ status: 'completed', isDraft: false })));
  const remote = createAzureRemote({ ...coordinates, run: fake.run, windows: true });
  assert.equal((await remote.get(12)).state, 'merged');
  assert.deepEqual([fake.calls[0].command, fake.calls[0].options.shell], ['az.cmd', true]);
  assert.deepEqual(fake.calls[0].args, ['repos', 'pr', 'show', '--id', '12', ...scope].map(argument => `"${argument}"`));
  const unsafe = createAzureRemote({ ...coordinates, run: fake.run, windows: true, tempRoot: unsafeRoot });
  await rejects(unsafe.update(12, { body: 'x' }), 'PR_REMOTE_ARGUMENT_UNSAFE', false);
  assert.equal(fake.calls.length, 1); assert.deepEqual(await readdir(unsafeRoot), [], 'files are removed after a refusal too');
  assert.throws(() => createAzureRemote({ ...coordinates, project: 'Demo"&calc', run: fake.run }), error => error.code === 'PR_REPOSITORY_UNRESOLVED');
});

test('Azure descriptions over 4,000 characters are refused, never truncated', async () => {
  const fake = runner();
  const remote = createAzureRemote({ ...coordinates, run: fake.run, windows: false });
  const error = await rejects(remote.create({ title: 'T', body: 'x'.repeat(4001), head: 'feature/x', base: 'main' }), 'PR_BODY_TOO_LARGE', false);
  assert.match(error.message, /4001 characters; Azure DevOps accepts at most 4000/);
  await rejects(remote.update(1, { body: 'x'.repeat(4001) }), 'PR_BODY_TOO_LARGE', false);
  assert.equal(fake.calls.length, 0);
});

test('Azure failures map to codes; unrecognised write failures and timeouts are uncertain', async () => {
  const azure = answer => createAzureRemote({ ...coordinates, run: runner(answer).run, windows: false });
  const input = { title: 'T', body: 'B', head: 'feature/x', base: 'main' };
  await rejects(azure(failed("ERROR: TF400813: The user is not authorized to access this resource.")).create(input), 'PR_REMOTE_AUTH_REQUIRED', false);
  await rejects(azure(failed('ERROR: TF401179: An active pull request for the source and target branch already exists.')).create(input), 'PR_REMOTE_REJECTED', false);
  await rejects(azure(failed("ERROR: 'repos' is misspelled or not recognized by the system.")).create(input), 'PR_REMOTE_CLI_MISSING', false);
  await rejects(azure(failed('ERROR: unrecognized arguments: --draft true')).create(input), 'PR_REMOTE_REJECTED', false);
  await rejects(azure(failed('TF401180: The requested pull request was not found.')).get(9), 'PR_REMOTE_NOT_FOUND', false);
  await rejects(azure(failed('Connection aborted.')).create(input), 'PR_REMOTE_UNCERTAIN', true);
  await rejects(azure(failed('', { status: null, timedOut: true })).update(9, { title: 'x' }), 'PR_REMOTE_UNCERTAIN', true);
  await rejects(azure({ ...ok({}), stdout: '{"pullRequestId":12' }).create(input), 'PR_REMOTE_UNCERTAIN', true);
  await rejects(azure(failed('Connection aborted.')).get(9), 'PR_REMOTE_FAILED', false);
  await rejects(azure(ok(azurePull({ status: 'notSet' }))).get(9), 'PR_REMOTE_RESPONSE_INVALID', false);
});

test('Azure readiness, branch lookup and marker discovery', async () => {
  const version = extensions => ok({ 'azure-cli': '2.67.0', extensions });
  const ready = await createAzureRemote({ ...coordinates, windows: false, run: runner(version({ 'azure-devops': '1.0.1' }), ok({ defaultBranch: 'refs/heads/main' })).run }).readiness();
  assert.deepEqual(ready, { platform: 'azure-devops', repository: 'dev.azure.com/contoso/Demo Project/demo', cli: 'ok', auth: 'ok', defaultBranch: 'main', configured: true, diagnostics: [] });
  const noExtension = await createAzureRemote({ ...coordinates, windows: false, run: runner(version({})).run }).readiness();
  assert.deepEqual([noExtension.cli, noExtension.diagnostics[0].next], ['extension-missing', 'az extension add --name azure-devops']);
  const signedOut = await createAzureRemote({ ...coordinates, windows: false, run: runner(version({ 'azure-devops': '1.0.1' }), failed('Please run az login')).run }).readiness();
  assert.deepEqual([signedOut.auth, signedOut.configured, signedOut.diagnostics[0].code], ['required', false, 'PR_REMOTE_AUTH_REQUIRED']);
  const marker = 'wb:pr v1 id=delivery-1 ';
  const fake = runner(ok([{ name: 'refs/heads/feature/x-old' }, { name: 'refs/heads/feature/x' }]),
    ok([azurePull({ description: `<!-- ${marker}` }), azurePull({ pullRequestId: 13, description: 'other', isDraft: false })]), ok(azurePull({ description: `<!-- ${marker}full` })));
  const remote = createAzureRemote({ ...coordinates, windows: false, run: fake.run });
  assert.equal(await remote.headExists('feature/x'), true);
  const found = await remote.findMarked('feature/x', 'main', marker);
  assert.deepEqual([found.marked.map(pull => pull.body), found.unmarkedOpen], [[`<!-- ${marker}full`], 1]);
  assert.deepEqual(fake.calls.map(call => call.args), [['repos', 'ref', 'list', ...inRepository, '--filter', 'heads/feature/x'],
    ['repos', 'pr', 'list', ...inRepository, '--source-branch', 'feature/x', '--target-branch', 'main', '--status', 'all', '--top', '100'], ['repos', 'pr', 'show', '--id', '12', ...scope]]);
  assert.deepEqual(remote.linkTarget('feature/x'), { platform: 'azure-devops', web: 'https://dev.azure.com/contoso/Demo%20Project/_git/demo', ref: 'feature/x' });
});
