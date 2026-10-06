const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandRunner, readTargetSources, resolveHostingTarget } from '../../src/cli/adapters/increments/hosting-target.ts';
import { remoteLockPath, withRemoteLock } from '../../src/cli/adapters/increments/remote-lock.ts';
import { remoteMarker, renderManagedBlock } from '../../src/cli/domain/increments/remote-body.ts';
import { planPublish } from '../../src/cli/domain/increments/remote-state.ts';
import { createFakeHostingRemote, samplePullRequestView } from '../support/fake-hosting-remote.mjs';
import { starterDocument } from '../support/starter-documents.mjs';

const throwsCode = code => error => error.code === code;
const githubOrigin = { origin: 'https://github.com/octo/demo.git', hosting: null };
const azureOrigin = { origin: 'https://contoso@dev.azure.com/contoso/Demo/_git/demo', hosting: null };
async function temporary(t, prefix) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  after(t, () => rm(path, { recursive: true, force: true }));
  return path;
}

test('the platform comes from --platform, the binding, tooling.hosting or the origin, in that order', () => {
  assert.deepEqual(resolveHostingTarget({}, githubOrigin), { platform: 'github', repository: 'octo/demo', github: { repository: 'octo/demo' }, azure: null, source: 'origin', warnings: [] });
  for (const origin of ['git@github.com:octo/demo.git', 'ssh://git@ssh.github.com:443/octo/demo.git', 'https://token@github.com/octo/demo']) {
    assert.equal(resolveHostingTarget({}, { origin, hosting: null }).repository, 'octo/demo', origin);
  }
  const azure = resolveHostingTarget({}, azureOrigin);
  assert.deepEqual([azure.platform, azure.repository, azure.azure], ['azure-devops', 'dev.azure.com/contoso/Demo/demo',
    { organization: 'https://dev.azure.com/contoso', project: 'Demo', repository: 'demo' }]);
  const configured = { origin: 'https://github.com/octo/demo.git', hosting: { platform: 'azure-devops', azureDevOps: { organization: 'https://contoso.visualstudio.com', project: 'Web' } } };
  const project = resolveHostingTarget({}, configured);
  assert.deepEqual([project.source, project.azure, project.warnings.map(warning => warning.code)],
    ['project', { organization: 'https://contoso.visualstudio.com', project: 'Web', repository: 'Web' }, ['PR_HOSTING_ORIGIN_MISMATCH']]);
  assert.equal(resolveHostingTarget({ platform: 'github' }, configured).source, 'flag');
  const bound = resolveHostingTarget({ binding: { platform: 'azure-devops', organization: 'https://dev.azure.com/other', project: 'P', repository: 'r' } }, githubOrigin);
  assert.deepEqual([bound.source, bound.repository], ['binding', 'dev.azure.com/other/P/r']);
  assert.equal(resolveHostingTarget({ binding: { platform: 'github', repository: 'octo/bound' } }, azureOrigin).repository, 'octo/bound');
});

test('hosting none, unknown platforms and unresolvable repositories are refused with distinct codes', () => {
  assert.throws(() => resolveHostingTarget({}, { origin: 'https://gitlab.com/a/b.git', hosting: null }), throwsCode('PR_HOSTING_UNCONFIGURED'));
  assert.throws(() => resolveHostingTarget({}, { origin: null, hosting: null }), throwsCode('PR_HOSTING_UNCONFIGURED'));
  assert.throws(() => resolveHostingTarget({}, { origin: null, hosting: { platform: 'none' } }), throwsCode('PR_HOSTING_NONE'));
  assert.throws(() => resolveHostingTarget({ platform: 'none' }, githubOrigin), throwsCode('PR_HOSTING_NONE'));
  assert.throws(() => resolveHostingTarget({ platform: 'gitlab' }, githubOrigin), throwsCode('PR_PLATFORM_INVALID'));
  assert.throws(() => resolveHostingTarget({ platform: 'github' }, azureOrigin), throwsCode('PR_REPOSITORY_UNRESOLVED'));
  assert.throws(() => resolveHostingTarget({ platform: 'azure-devops' }, githubOrigin), throwsCode('PR_REPOSITORY_UNRESOLVED'));
  assert.throws(() => resolveHostingTarget({ binding: { platform: 'github', repository: 'octo/../x' } }, githubOrigin), throwsCode('PR_REPOSITORY_UNRESOLVED'));
  const error = (() => { try { resolveHostingTarget({ platform: 'github' }, { origin: 'https://user:secret@gitlab.com/a/b', hosting: null }); } catch (caught) { return caught; } })();
  assert.ok(!JSON.stringify([error.message, error.next]).includes('secret'), 'the origin URL is never printed');
});

test('target sources are read from .git/config and design/project.json without running git', async t => {
  const root = await temporary(t, 'hosting-target-');
  assert.deepEqual(await readTargetSources(root), { origin: null, hosting: null });
  await mkdir(join(root, '.git'));
  await writeFile(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:octo/demo.git\n');
  assert.deepEqual(await readTargetSources(root), { origin: 'git@github.com:octo/demo.git', hosting: null });
  const document = starterDocument('quick-capture');
  document.tooling = { hosting: { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Demo' } } };
  await mkdir(join(root, 'design'));
  await writeFile(join(root, 'design', 'project.json'), JSON.stringify(document));
  const sources = await readTargetSources(root);
  assert.deepEqual(sources.hosting, document.tooling.hosting);
  assert.deepEqual(resolveHostingTarget({}, sources).warnings.map(warning => warning.code), ['PR_HOSTING_ORIGIN_MISMATCH']);
});

test('the remote lock admits one publish or sync per pull request and is released even on failure', async t => {
  const directory = await temporary(t, 'remote-lock-');
  const path = remoteLockPath('/repo', 'delivery-1', directory);
  assert.equal(path, remoteLockPath('/repo/./', 'delivery-1', directory)); assert.notEqual(path, remoteLockPath('/repo', 'delivery-2', directory));
  const order = [];
  await withRemoteLock('/repo', 'delivery-1', async () => {
    order.push('outer');
    await assert.rejects(withRemoteLock('/repo', 'delivery-1', async () => order.push('inner'), directory), error => error.code === 'PR_SYNC_LOCKED' && error.message.includes(path));
    await withRemoteLock('/repo', 'delivery-2', async () => order.push('other pull request'), directory);
  }, directory);
  assert.deepEqual(order, ['outer', 'other pull request']);
  await assert.rejects(withRemoteLock('/repo', 'delivery-1', async () => { throw new Error('boom'); }, directory), /boom/);
  assert.deepEqual(await readdir(directory), [], 'released after success and after failure');
  await mkdir(path);
  await assert.rejects(withRemoteLock('/repo', 'delivery-1', async () => order.push('stale'), directory), throwsCode('PR_SYNC_LOCKED'));
  assert.deepEqual(await readdir(directory), [path.slice(directory.length + 1)], 'a lock left by another run is never removed automatically');
});

test('the command runner passes stdin, bounds output and time, and reports a missing program without throwing', async () => {
  const base = { timeoutMs: 10_000, maxBytes: 1024, env: process.env };
  const echo = await commandRunner(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { ...base, input: 'payload; $(id) `x`' });
  assert.deepEqual(echo, { status: 0, stdout: 'payload; $(id) `x`', stderr: '', timedOut: false, overflow: false });
  const exit = await commandRunner(process.execPath, ['-e', 'process.stderr.write("bad"); process.exit(3)'], base);
  assert.deepEqual([exit.status, exit.stderr, exit.timedOut], [3, 'bad', false]);
  const slow = await commandRunner(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { ...base, timeoutMs: 200 });
  assert.deepEqual([slow.status, slow.timedOut, slow.overflow], [null, true, false]);
  const large = await commandRunner(process.execPath, ['-e', 'process.stdout.write("x".repeat(5000))'], base);
  assert.deepEqual([large.overflow, large.timedOut, large.status], [true, false, null]);
  const missing = await commandRunner('workbench-no-such-program', [], base);
  assert.deepEqual([missing.status, missing.error], [null, 'ENOENT']);
});

test('publish plans a separate push step for a missing head, adopts a marked pull request and refuses duplicates', async () => {
  const fake = createFakeHostingRemote(), { remote } = fake, view = samplePullRequestView();
  const facts = async (extra = {}) => ({ status: 'New', head: view.head, base: view.base, headExists: await remote.headExists(view.head),
    baseExists: await remote.headExists(view.base), ...await remote.findMarked(view.head, view.base, remoteMarker(view.id)), push: true, ...extra });
  const refused = code => error => error.message.startsWith(`${code}:`);
  assert.deepEqual(planPublish(await facts()), { action: 'create', adopt: null, needsPush: true, steps: ['push-head', 'create', 'readback', 'record'] });
  assert.throws(() => planPublish({ status: 'New', head: view.head, base: view.base, headExists: false, baseExists: true, marked: [], unmarkedOpen: 0, push: false }),
    refused('PR_HEAD_NOT_PUSHED'));
  fake.pushBranch(view.head);
  assert.deepEqual(planPublish(await facts()), { action: 'create', adopt: null, needsPush: false, steps: ['create', 'readback', 'record'] });
  const body = renderManagedBlock(view, { links: remote.linkTarget(view.head) });
  await remote.create({ title: view.title, body, head: view.head, base: view.base });
  assert.deepEqual(planPublish(await facts()), { action: 'adopt', adopt: 1, needsPush: false, steps: ['adopt', 'readback', 'record'] }, 'a crash after create is recovered by adoption');
  await assert.rejects(async () => planPublish(await facts({ status: 'Draft' })), refused('PR_ALREADY_PUBLISHED'));
  await remote.create({ title: view.title, body, head: view.head, base: view.base });
  await assert.rejects(async () => planPublish(await facts()), refused('PR_REMOTE_DUPLICATE'));
  const unmarked = createFakeHostingRemote({ branches: ['main', 'increment/delivery', view.head] });
  await unmarked.remote.create({ title: 'Manual', body: 'no marker', head: view.head, base: view.base });
  const manual = await unmarked.remote.findMarked(view.head, view.base, remoteMarker(view.id));
  assert.throws(() => planPublish({ status: 'New', head: view.head, base: view.base, headExists: true, baseExists: true, ...manual, push: true }), refused('PR_REMOTE_DUPLICATE'));
  const noIncrementBranch = createFakeHostingRemote({ branches: ['main'] });
  const incrementBranchPushed = await noIncrementBranch.remote.headExists(view.base);
  assert.equal(incrementBranchPushed, false);
  assert.throws(() => planPublish({ status: 'New', head: view.head, base: view.base, headExists: false, baseExists: incrementBranchPushed,
    marked: [], unmarkedOpen: 0, push: true }), refused('PR_BASE_NOT_ON_REMOTE'));
  const kickoff = samplePullRequestView({ id: 'delivery-kickoff', kind: 'kickoff', head: 'increment/delivery', base: 'main' });
  assert.deepEqual(planPublish({ status: 'New', head: kickoff.head, base: kickoff.base, headExists: await noIncrementBranch.remote.headExists(kickoff.head),
    baseExists: await noIncrementBranch.remote.headExists('main'), marked: [], unmarkedOpen: 0, push: true }).steps, ['push-head', 'create', 'readback', 'record'],
  'the kick-off publish pushes the increment branch');
});

test('the fake remote records calls, simulates platform edits and injects rejected, timed-out and uncertain writes', async () => {
  const fake = createFakeHostingRemote();
  const { remote } = fake, view = samplePullRequestView();
  const body = renderManagedBlock(view, { links: remote.linkTarget(view.head) });
  assert.equal((await remote.readiness()).configured, true);
  fake.failNext('create', 'uncertain', { applied: true });
  await assert.rejects(remote.create({ title: view.title, body, head: view.head, base: view.base }), error => error.code === 'PR_REMOTE_UNCERTAIN' && error.details.uncertain);
  const found = await remote.findMarked(view.head, view.base, remoteMarker(view.id));
  assert.deepEqual([found.marked.map(pull => [pull.number, pull.state]), found.unmarkedOpen], [[[1, 'draft']], 0], 'recovery re-reads and adopts by marker');
  fake.editBody(1, text => text.replace('- [ ] T-1:', '- [x] T-1:')); fake.setState(1, 'open');
  const pull = await remote.get(1);
  assert.ok(pull.body.includes('- [x] T-1:')); assert.equal(pull.state, 'open');
  fake.failNext('update', 'timeout');
  await assert.rejects(remote.update(1, { title: 'x' }), error => error.code === 'PR_REMOTE_UNCERTAIN' && error.details.step === 'update');
  assert.equal((await remote.get(1)).title, view.title, 'an unapplied uncertain write leaves the remote unchanged');
  fake.failNext('update', 'rejected');
  await assert.rejects(remote.update(1, { title: 'x' }), error => error.code === 'PR_REMOTE_REJECTED' && error.details.uncertain === false);
  fake.failNext('get', 'timeout');
  await assert.rejects(remote.get(1), error => error.code === 'PR_REMOTE_FAILED');
  const updated = await remote.update(1, { title: 'Renamed' });
  assert.notEqual(updated.revision, pull.revision);
  assert.deepEqual(fake.calls.map(([method]) => method), ['readiness', 'create', 'findMarked', 'get', 'update', 'get', 'update', 'get', 'update']);
  assert.equal(fake.writes(), 4);
  const unready = createFakeHostingRemote({ platform: 'azure-devops', readiness: { cli: 'ok', auth: 'required', diagnostics: [{ code: 'PR_REMOTE_AUTH_REQUIRED', message: 'az login' }] } });
  assert.equal((await unready.remote.readiness()).configured, false);
  assert.equal(unready.remote.linkTarget('main').web, 'https://dev.azure.com/contoso/Demo/_git/demo');
});
