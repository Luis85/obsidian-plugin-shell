import test from 'node:test';
import assert from 'node:assert/strict';
import { baseContext, changelog, configs, handoffPath, issueDoc, linkedHandoff, pullRequestDoc, readyHandoff, results } from './delivery-fixture.mjs';
import { branchName, parseBranch, pullRequestScope, referencePath } from '../tooling/delivery/documents.mjs';
import { branchOf } from '../tooling/delivery/repository.mjs';
import { runDone, selectHandoff } from '../tooling/delivery/run.mjs';

const config = await configs();
const prPath = id => `docs/pull-requests/${id}.md`;
const issuePath = id => `docs/issues/${id}.md`;
const failing = outcome => Object.values(outcome).filter(rule => rule.status === 'fail').map(rule => rule.id);
const documentRules = ['DOR-16', 'DOR-17', 'DOR-18', 'DOR-19', 'DOR-20', 'DOR-21', 'DOR-22', 'DOR-23'];

/** A context with documents; every document is changed in the diff unless `unchanged` lists it. */
function scenario({ handoff = linkedHandoff({ pullRequests: ['sample-increment-1'] }), docs = { [prPath('sample-increment-1')]: pullRequestDoc() }, refs, unchanged = [], extraDiff = [] } = {}) {
  const diff = [...baseContext(config).diff, ...Object.keys(docs).filter(path => !unchanged.includes(path)).map(path => ({ path, status: 'M', added: [] })), ...extraDiff];
  return baseContext(config, handoff, { texts: docs, refs, diff });
}
const ready = options => results('ready', config, scenario(options));
const complete = { pullRequests: ['sample-increment-kickoff', 'sample-increment-1'], issues: ['sample-issue'] };
const completeDocs = (change = {}) => ({ [prPath('sample-increment-kickoff')]: pullRequestDoc({ id: 'sample-increment-kickoff', kind: 'kickoff', status: 'Ready', delivers: null, tasks: ['- [ ] T-1: Refine the increment until the Definition of Ready passes.'] }),
  [prPath('sample-increment-1')]: pullRequestDoc({ issues: ['sample-issue'], ...change }), [issuePath('sample-issue')]: issueDoc() });

test('kick-off, change and issue documents linked both ways pass every Definition of Ready rule', () => {
  const outcome = ready({ handoff: linkedHandoff(complete), docs: completeDocs() });
  assert.deepEqual(failing(outcome), []);
  assert.deepEqual(documentRules.map(id => outcome[id].status), Array(8).fill('pass'));
  assert.match(outcome['DOR-16'].message, /3 document/); assert.match(outcome['DOR-23'].message, /match/);
  const remote = ready({ handoff: readyHandoff().replace('refs: [', 'pullRequests: ["#74", "https://example.com/pr/1"]\nrefs: ['), docs: {} });
  assert.deepEqual(failing(remote), [], 'remote pull requests (#74, an https URL) of increments without documents stay valid');
  assert.deepEqual(documentRules.filter(id => remote[id].status === 'skip'), documentRules.slice(0, 7));
});

test('negative: each document defect fails exactly its own rule with a hint', () => {
  const change = overrides => ({ docs: { [prPath('sample-increment-1')]: pullRequestDoc(overrides) } });
  const swap = (from, to, overrides = {}) => ({ docs: { [prPath('sample-increment-1')]: pullRequestDoc(overrides).replace(from, to) } });
  const cases = [
    ['DOR-16', swap('kind: change', 'kind: feature')], ['DOR-16', swap('status: Draft', 'status: Open')], ['DOR-16', swap('id: sample-increment-1', 'id: other-id')],
    ['DOR-16', swap('kind: change\n', 'kind: change\nreviewer: someone\n')], ['DOR-16', swap('head: "pr/sample-increment/sample-increment-1"\n', '')],
    ['DOR-17', { handoff: linkedHandoff(), docs: { [prPath('sample-increment-1')]: pullRequestDoc().replace('increment: sample-increment', 'increment: gone') } }],
    ['DOR-18', change({ base: 'main' })], ['DOR-18', change({ head: 'increment/sample-increment' })],
    ['DOR-18', { handoff: linkedHandoff({ pullRequests: ['sample-increment-kickoff'] }), docs: { [prPath('sample-increment-kickoff')]: pullRequestDoc({ id: 'sample-increment-kickoff', kind: 'kickoff', head: 'feature/x' }) } }],
    ['DOR-18', { ...change(), refs: { base: 'main', head: 'pr/sample-increment/sample-increment-1' } }],
    ['DOR-19', change({ tasks: [] })], ['DOR-19', change({ tasks: ['- [ ] Add the command.'] })], ['DOR-19', change({ tasks: ['- [ ] T-1: a.', '- [x] T-1: b.'] })],
    ['DOR-20', swap('- Translations.\n', '')],
    ['DOR-21', change({ delivers: ['AC-9'] })],
    ['DOR-22', change({ extra: '\nSee [[Nowhere]].\n' })], ['DOR-22', change({ issues: ['missing-issue'] })],
    ['DOR-23', { handoff: linkedHandoff({ pullRequests: ['sample-increment-1', 'ghost'] }) }],
    ['DOR-23', { handoff: linkedHandoff({ pullRequests: ['sample-increment-1'], issues: ['sample-issue'] }), docs: { [prPath('sample-increment-1')]: pullRequestDoc(), [issuePath('sample-issue')]: issueDoc({ increment: 'other' }) }, unchanged: [issuePath('sample-issue')] }],
    ['DOR-23', { handoff: linkedHandoff(), unchanged: [prPath('sample-increment-1')] }]];
  for (const [id, options] of cases) {
    const outcome = ready(options);
    assert.deepEqual(failing(outcome), [id], `${id}: ${JSON.stringify(Object.values(outcome).filter(rule => rule.status === 'fail').map(rule => rule.details))}`);
    assert.ok(outcome[id].hint && outcome[id].details?.length, `${id} explains the fix`);
  }
  const twoKickoffs = ready({ handoff: linkedHandoff({ pullRequests: ['a-kickoff', 'b-kickoff'] }), docs: { [prPath('a-kickoff')]: pullRequestDoc({ id: 'a-kickoff', kind: 'kickoff', delivers: null }), [prPath('b-kickoff')]: pullRequestDoc({ id: 'b-kickoff', kind: 'kickoff', delivers: null }) } });
  assert.deepEqual(failing(twoKickoffs), ['DOR-23']); assert.match(twoKickoffs['DOR-23'].details.at(-1), /2 kick-off pull requests/);
  assert.deepEqual(failing(ready(swap('kind: change\n', ''))), [], 'a pull request document without kind is a change');
  const criteria = text => ({ handoff: linkedHandoff({ pullRequests: ['sample-increment-1'], issues: ['sample-issue'] }), docs: { [prPath('sample-increment-1')]: pullRequestDoc(), [issuePath('sample-issue')]: `${issueDoc()}\n## Acceptance criteria\n\n${text}\n` } });
  assert.deepEqual(failing(ready(criteria('- [ ] AC-2: The failing notice.\n- [ ] IC-1: Its own criterion.'))), [], 'an Issue references increment criteria (AC-n) and owns IC-n');
  const unknown = ready(criteria('- [ ] AC-9: Not in the increment.'));
  assert.deepEqual(failing(unknown), ['DOR-21']); assert.match(unknown['DOR-21'].details[0], /sample-issue\.md: references AC-9/);
  const notCriterion = ready(change({ delivers: ['ac1'] }));
  assert.deepEqual(failing(notCriterion), ['DOR-16', 'DOR-21'], '`delivers` must name criterion ids that exist');
});

test('branch patterns, references, base refs and the pull request kind', () => {
  assert.equal(branchName(config.delivery.branches.pullRequest, { increment: 'a', pr: 'a-1' }), 'pr/a/a-1');
  assert.deepEqual({ ...parseBranch(config.delivery.branches.pullRequest, 'pr/a/a-1') }, { increment: 'a', pr: 'a-1' });
  assert.equal(parseBranch(config.delivery.branches.increment, 'increment/a/b'), null); assert.equal(parseBranch(config.delivery.branches.increment, ''), null);
  for (const raw of ['x', 'x.md', '[[x]]', '[[docs/pull-requests/x|X]]', 'docs/pull-requests/x.md']) assert.equal(referencePath('docs/pull-requests/*.md', raw), 'docs/pull-requests/x.md', raw);
  assert.equal(referencePath('docs/x/*.md', ''), null);
  assert.deepEqual(['origin/main', 'refs/remotes/origin/increment/a', 'refs/heads/main', 'upstream/x/y', 'main'].map(ref => branchOf(ref, ['origin'])), ['main', 'increment/a', 'main', 'upstream/x/y', 'main']);
  const context = scenario({ handoff: linkedHandoff(complete), docs: completeDocs() });
  const scope = refs => pullRequestScope(config.delivery, context.handoff, context.documents.pullRequests, refs);
  assert.equal(scope({ base: 'increment/sample-increment', head: 'pr/sample-increment/sample-increment-1' }).pullRequest.path, prPath('sample-increment-1'));
  assert.equal(scope({ base: 'increment/sample-increment', head: 'other' }).pullRequest, null, 'a change without its own document');
  assert.equal(scope({ base: 'increment/sample-increment', head: '' }).pullRequest.path, prPath('sample-increment-1'), 'locally the one changed change document');
  assert.deepEqual([scope({ base: 'main', head: 'increment/sample-increment' }).kind, scope({ base: 'main', head: 'feature/x' }).kind], ['kickoff', 'increment']);
  const custom = pullRequestScope(config.delivery, scenario({ handoff: linkedHandoff().replace('refs: [', 'branch: "feature/sample"\nbase: develop\nrefs: [') }).handoff, [], { base: 'develop', head: 'feature/sample' });
  assert.equal(custom.kind, 'kickoff', 'the frontmatter branch and base override the patterns');
});

test('the Increment is found from changed Issue documents and from increment branches', () => {
  const texts = { [issuePath('sample-issue')]: issueDoc() };
  const snapshot = (diff, refs) => ({ files: [handoffPath], body: '', readText: path => texts[path] ?? null, diff, refs });
  assert.deepEqual(selectHandoff(config.delivery, snapshot([{ path: issuePath('sample-issue'), status: 'M' }])), { path: handoffPath, source: 'PullRequest document' });
  assert.deepEqual(selectHandoff(config.delivery, snapshot([], { base: 'increment/sample-increment', head: 'pr/sample-increment/x' })), { path: handoffPath, source: 'branch' });
  assert.deepEqual(selectHandoff(config.delivery, snapshot([], { base: 'main', head: 'increment/sample-increment' })), { path: handoffPath, source: 'branch' });
  assert.match(selectHandoff(config.delivery, snapshot([], { base: 'main', head: 'feature/x' })).problem.message, /No handoff/);
});

const record = '\n## Completion record\n\nGenerated.\n';
function done(handoff, docs, refs, overrides = {}) {
  const context = scenario({ handoff, docs, refs, ...overrides });
  const snapshot = { ...context, base: { ref: `origin/${refs.base}`, sha: 'e'.repeat(40) }, body: '' };
  const writes = {};
  const io = { gates: () => null, refresh: () => ({ ...snapshot, readText: path => writes[path] ?? snapshot.readText(path) }), write: (path, text) => { writes[path] = text; } };
  const result = runDone({ delivery: config.delivery, rules: config.done, ready: config.ready }, snapshot, overrides.write ? { write: true } : {}, io);
  return { result, writes, rules: Object.fromEntries(result.rules.map(rule => [rule.id, rule])) };
}
const changeRefs = { base: 'increment/sample-increment', head: 'pr/sample-increment/sample-increment-1' };
const inProgress = linkedHandoff({ ...complete, status: 'In progress' }).replace('- [ ] AC-1: The palette lists the greeting command.', '- [x] AC-1: The palette lists the greeting command.');
const finishedChange = (change = {}) => completeDocs({ tasks: ['- [x] T-1: Add the command.'], extra: record, ...change });

test('a change pull request completes its PullRequest document, not the Increment', () => {
  const { result, rules } = done(inProgress, finishedChange(), changeRefs);
  assert.equal(result.status, 'done', JSON.stringify(result.rules.filter(rule => rule.status === 'fail')));
  assert.deepEqual(result.scope, { kind: 'change', pullRequest: prPath('sample-increment-1'), base: changeRefs.base, head: changeRefs.head });
  assert.deepEqual(['DOD-02', 'DOD-09', 'DOD-11', 'DOD-17'].map(id => rules[id].status), Array(4).fill('skip'), 'AC-2 is open and the Increment is In progress, which is fine here');
  assert.deepEqual(['DOD-12', 'DOD-13', 'DOD-14', 'DOD-15', 'DOD-16'].map(id => rules[id].status), Array(5).fill('pass'));
  const failingIds = outcome => outcome.result.rules.filter(rule => rule.status === 'fail').map(rule => rule.id);
  assert.deepEqual(failingIds(done(inProgress, finishedChange({ tasks: ['- [x] T-1: a.', '- [ ] T-2: b.'] }), changeRefs)), ['DOD-13']);
  assert.deepEqual(failingIds(done(inProgress, finishedChange({ delivers: ['AC-2'] }), changeRefs)), ['DOD-14'], 'a delivered criterion must be ticked');
  assert.deepEqual(failingIds(done(inProgress.replace('status: In progress', 'status: Done'), finishedChange(), changeRefs)), ['DOD-15']);
  const lost = done(inProgress, finishedChange(), { ...changeRefs, head: 'pr/sample-increment/other' });
  assert.deepEqual(failingIds(lost), ['DOD-12']); assert.match(lost.rules['DOD-12'].hint, /kind: change/);
  assert.deepEqual(['DOD-13', 'DOD-14', 'DOD-16'].map(id => lost.rules[id].status), Array(3).fill('skip'));
  assert.equal(done(inProgress, finishedChange({ extra: '' }), changeRefs).rules['DOD-16'].status, 'warn');
  const scoped = done(inProgress, finishedChange(), changeRefs, { extraDiff: [] });
  assert.match(scoped.rules['DOD-04'].message, /kick-off/);
  const noChangelog = scenario({ handoff: inProgress, docs: finishedChange(), refs: changeRefs });
  noChangelog.diff = noChangelog.diff.filter(file => !['CHANGELOG.md', 'docs/guide.md'].includes(file.path));
  const diffOnly = results('done', config, { ...noChangelog, kinds: ['PullRequest'] });
  assert.deepEqual([diffOnly['DOD-04'].status, diffOnly['DOD-05'].status], ['pass', 'pass'], 'changelog entries and docs targets are checked on the kick-off');
  const broken = results('done', config, { ...scenario({ handoff: inProgress, docs: finishedChange(), refs: changeRefs }), kinds: ['PullRequest'], texts: undefined, readText: path => (path === 'CHANGELOG.md' ? '# Changelog\n' : scenario({ handoff: inProgress, docs: finishedChange() }).readText(path)) });
  assert.equal(broken['DOD-04'].status, 'fail', 'a changed changelog must still be valid');
});

test('--write on a change pull request writes its Completion record into the PullRequest document only', () => {
  const { result, writes } = done(inProgress, finishedChange({ extra: '' }), changeRefs, { write: true });
  assert.deepEqual(Object.keys(writes), [prPath('sample-increment-1')], 'no changelog, increment record or status change');
  assert.match(writes[prPath('sample-increment-1')], /## Completion record\n[\s\S]*head `pr\/sample-increment\/sample-increment-1`[\s\S]*\| T-1: Add the command\. \| yes \|[\s\S]*\| AC-1 \| yes \| `tests\/greeting\.checks\.mjs` \|/);
  assert.equal(result.generated.status, undefined);
});

test('the kick-off completes the Increment only when every other pull request and issue is closed', () => {
  const finished = linkedHandoff({ ...complete, checked: true, status: 'Done' }) + record;
  const kickoff = { base: 'main', head: 'increment/sample-increment' };
  const closed = completeDocs({ status: 'Merged' }); closed[issuePath('sample-issue')] = issueDoc({ status: 'Done' });
  const { result, rules } = done(finished, closed, kickoff);
  assert.equal(result.status, 'done', JSON.stringify(result.rules.filter(rule => rule.status === 'fail')));
  assert.equal(result.scope.kind, 'kickoff'); assert.match(rules['DOD-17'].message, /1 pull request\(s\) and 1 issue\(s\) closed/);
  assert.equal(rules['DOD-12'].status, 'skip');
  const open = done(finished, completeDocs({ status: 'Ready' }), kickoff);
  assert.deepEqual(open.result.rules.filter(rule => rule.status === 'fail').map(rule => rule.id), ['DOD-17']);
  assert.deepEqual(open.rules['DOD-17'].details, [`${prPath('sample-increment-1')}: Ready`, `${issuePath('sample-issue')}: In progress`]);
  const blocked = done(linkedHandoff({ ...complete, checked: true, status: 'In progress' }) + record, completeDocs({ status: 'Draft' }), kickoff, { write: true });
  assert.match(blocked.writes[handoffPath] ?? '', /status: In progress/, 'open pull requests keep the Increment from status Done');
  assert.ok(changelog.includes('greeting'));
});
