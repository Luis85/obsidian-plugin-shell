// Human views of the increment, pr and issue commands over fixed result shapes (src/cli/presentation/terminal/increment-view.ts
// and pull-request-view.ts): which facts each view shows, its Next: line, and that --json output is untouched.
import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { renderHuman } from '../presentation/terminal/terminal-render.ts';
import { renderCliResult } from '../presentation/terminal/cli-output.ts';

const plain = { color: false, unicode: false }, rich = { color: true, unicode: true };
const view = (value, style = plain) => renderHuman({ diagnostics: [], ...value }, style);
const has = (text, parts) => { for (const part of parts) assert.ok(text.includes(part), `${part}\n--- in ---\n${text}`); };
const kickoff = { id: 'demo-kickoff', path: 'docs/pull-requests/demo-kickoff.md', status: 'Draft', kind: 'kickoff', head: 'increment/demo', base: 'main', number: 7, url: 'https://github.com/o/r/pull/7' };

test('increment list shows status, size, owner, branch, pull requests and issues per increment, and an empty folder offers increment new', () => {
  const listed = view({ command: 'increment list', status: 'ok', data: { folder: 'docs/increments', drift: [{ code: 'DELIVERY_PATHS_DRIFT', message: 'globs differ' }],
    increments: [{ id: 'demo', title: 'Demo', status: 'In progress', size: 'M', owner: 'Luis', path: 'docs/increments/demo.md', branch: 'increment/demo',
      pullRequests: [kickoff, { id: 'demo-1', status: 'New', kind: 'change' }], issues: [{ id: 'demo', status: 'New' }], problems: 2 }] } });
  has(listed.text, ['increment list: ok', 'ID    STATUS       SIZE  OWNER  BRANCH          PULL REQUESTS', 'demo  In progress  M     Luis   increment/demo  2: kickoff Draft #7, change New  1       2',
    'Path drift\n  [warn] DELIVERY_PATHS_DRIFT  globs differ', 'Next: node bin/app increment show demo']);
  assert.equal(listed.diagnosticsShown, false);
  has(view({ command: 'increment list', status: 'ok', data: { folder: 'docs/increments', increments: [], drift: [] } }).text,
    ['No increments yet.', 'Next: node bin/app increment new <id> --title "<title>" --dry-run']);
});

test('increment show lists transitions, branch, scope, criteria with evidence, pull requests, links and problems', () => {
  const data = { increment: { id: 'demo', title: 'Demo', owner: '', size: 'S', status: 'Ready', e2e: 'required', refs: ['[[docs/prds/demo]]'], issues: ['demo'], branch: 'increment/demo', base: 'main',
    path: 'docs/increments/demo.md', scope: { in: ['The export'], out: ['Import'] },
    acceptance: [{ id: 'AC-1', checked: true, text: 'Exports both notes Evidence: `tests/a.checks.mjs`', evidence: ['tests/a.checks.mjs'] }, { id: 'AC-2', checked: false, text: 'Refuses an existing file', evidence: [] }],
    links: [{ target: 'docs/prds/demo', status: 'resolved' }, { target: 'docs/missing', status: 'missing' }], pullRequests: [kickoff] },
  validation: { problems: [{ code: 'WIKILINK_UNRESOLVED', message: 'docs/missing does not resolve', line: 9 }] }, readiness: true, transitions: ['Refining', 'In progress', 'Cancelled'],
  next: 'node bin/app pr list --increment demo' };
  has(view({ command: 'increment show', status: 'ok', data }).text, ['Demo (demo)', 'Status       Ready; can move to Refining, In progress, Cancelled', 'Owner        not set', 'E2E          required',
    'Branch       increment/demo → main', 'Refs         [[docs/prds/demo]]', 'Links        1 resolved, 1 not: docs/missing (missing)', 'Ready shape  yes', 'in   The export', 'out  Import',
    '[x] AC-1  Exports both notes\n        evidence: tests/a.checks.mjs', '[ ] AC-2  Refuses an existing file', 'demo-kickoff  kickoff  Draft   increment/demo → main  #7 https://github.com/o/r/pull/7',
    'Problems (1)\n  [warn] WIKILINK_UNRESOLVED  docs/missing does not resolve (line 9)', 'Next: node bin/app pr list --increment demo']);
  const done = view({ command: 'increment show', status: 'ok', data: { ...data, transitions: [], readiness: false, increment: { ...data.increment, status: 'Done', branch: null, base: null, links: [], pullRequests: [] } } }).text;
  has(done, ['Status       Done (final)', 'Branch       not set', 'Ready shape  no; run the Definition of Ready check']);
  assert.ok(!done.includes('Pull requests\n') && !done.includes('Links'));
});

test('the Definition of Ready check shows failing rules with hints and details, warnings and the refinement brief; diagnostics are not repeated', () => {
  const rules = [{ id: 'DOR-03', title: 'Required sections', severity: 'error', status: 'pass', message: 'ok' },
    { id: 'DOR-04', title: 'No placeholders', severity: 'error', status: 'fail', message: '4 placeholder(s) left.', hint: 'Replace every placeholder.', details: ['line 1: <a>', 'line 2: <b>', 'line 3: <c>', 'line 4: <d>'] },
    { id: 'DOR-14', title: 'E2E decision', severity: 'warning', status: 'fail', message: 'No reason.' }, { id: 'DOR-15', title: 'Status', severity: 'warning', status: 'warn', message: 'Status is New.' },
    { id: 'DOR-18', title: 'Branches', severity: 'error', status: 'skip', message: 'Applies to PullRequest documents.' }];
  const data = { gate: 'ready', status: 'not-ready', handoff: 'docs/increments/demo.md', base: { ref: 'origin/main', sha: '0123456789abcdef' }, scope: { kind: 'increment', pullRequest: null },
    rules, generated: { paths: [] }, refinement: { skills: ['increment-handoff'], questions: [{ rule: 'DOR-04', title: 'No placeholders', questions: ['Which placeholders still need content?'] }] }, source: 'definition-of-ready' };
  const blocked = view({ command: 'increment check', status: 'blocked', data, diagnostics: [{ code: 'INCREMENT_NOT_READY', message: 'DOR-04 No placeholders: 4 left.', next: 'Replace every placeholder.' }] });
  assert.equal(blocked.diagnosticsShown, true);
  has(blocked.text, ['Gate     Definition of Ready', 'Result   not passed (not-ready)', 'Base     origin/main (0123456789ab)', 'Scope    increment', 'Rules    1 pass, 2 fail, 1 warn, 1 skip',
    'Failing (1)\n  [FAIL] DOR-04  No placeholders: 4 placeholder(s) left.\n         fix: Replace every placeholder.\n         - line 1: <a>', '… 1 more (see --json)',
    'Warnings (2)\n  [warn] DOR-14  E2E decision: No reason.\n  [warn] DOR-15', 'Refinement brief\n  Skills: increment-handoff\n  DOR-04 No placeholders\n    - Which placeholders still need content?',
    'Next: fix the failing rules (fix: lines above), then rerun node bin/app increment check demo']);
  assert.ok(!blocked.text.includes('DOR-18'), 'skipped rules are only counted');
  const ready = view({ command: 'increment check', status: 'ok', data: { ...data, status: 'ready', rules: rules.slice(0, 1), refinement: {} } }).text;
  has(ready, ['Result   passed (ready)', 'Next: node bin/app increment status demo Ready --dry-run']);
  assert.ok(!ready.includes('Failing') && !ready.includes('Refinement brief'));
  const done = view({ command: 'increment check', status: 'ok', data: { ...data, gate: 'done', status: 'done', scope: { kind: 'pull-request', pullRequest: 'demo-1' }, rules: [], refinement: {},
    generated: { paths: ['docs/increments/demo.md', 'CHANGELOG.md'] } } }).text;
  has(done, ['Gate     Definition of Done', 'Scope    pull-request demo-1', 'Rules    none', 'Would generate\n  docs/increments/demo.md\n  CHANGELOG.md', 'Next: node bin/app increment complete demo --dry-run']);
  const notDone = view({ command: 'increment check', status: 'blocked', data: { ...data, gate: 'done', status: 'not-done', refinement: {} } }).text;
  has(notDone, ['rerun node bin/app increment check demo --gate done']);
  const structural = view({ command: 'increment check', status: 'blocked', data: { gate: 'ready', status: 'not-ready', handoff: 'docs/increments/demo.md', source: 'structural',
    problems: [{ code: 'INCREMENT_PLACEHOLDER', message: 'Summary has a placeholder.', line: 12 }] } }, rich).text;
  has(structural, ['structural: delivery scripts, configuration or a base commit unavailable', 'Result   not ready', '\u001b[31m✗\u001b[0m INCREMENT_PLACEHOLDER  Summary has a placeholder. (line 12)']);
});

test('validate, issue list and issue show summarize documents and criteria', () => {
  const documents = [{ kind: 'increment', id: 'demo', path: 'docs/increments/demo.md', problems: [{ code: 'X', message: 'y' }] }, { kind: 'issue', id: 'demo', path: 'docs/issues/demo.md', problems: [] }];
  has(view({ command: 'increment validate', status: 'blocked', data: { documents, drift: [], problems: 1 } }).text,
    ['[FAIL] 2 documents, 1 problems', 'KIND       ID    PATH                     PROBLEMS', 'increment  demo  docs/increments/demo.md  1', 'Next: fix the problems listed below']);
  const clean = view({ command: 'pr validate', status: 'ok', data: { documents: [], drift: [], problems: 0 } }).text;
  assert.ok(clean.includes('[ok]   0 documents, 0 problems') && !clean.includes('Next:'));
  has(view({ command: 'issue list', status: 'ok', data: { folder: 'docs/issues', issues: [{ id: 'demo', path: 'docs/issues/demo.md', title: 'Demo', status: 'In progress', increment: 'demo',
    pullRequests: ['demo-1'], criteria: { total: 2, done: 1 } }] } }).text, ['demo  In progress  demo       1/2       demo-1         Demo', 'Next: node bin/app issue show demo']);
  assert.ok(view({ command: 'issue list', status: 'ok', data: { folder: 'docs/issues', issues: [] } }).text.includes('No issues yet.'));
  const issue = { id: 'demo', title: 'Demo', status: 'New', increment: 'demo', pullRequests: [], path: 'docs/issues/demo.md', acceptance: [{ id: 'AC-1', checked: true, text: 'Exports' }, { id: 'IC-1', checked: false, text: 'Own' }] };
  has(view({ command: 'issue show', status: 'ok', data: { issue, validation: { problems: [] } } }).text, ['Criteria       1/2 done', '[x] AC-1  Exports', '[ ] IC-1  Own', 'Next: node bin/app increment show demo']);
  assert.ok(view({ command: 'issue show', status: 'ok', data: { issue: { ...issue, acceptance: [] }, validation: { problems: [] } } }).text.includes('Criteria       none'));
});

test('pr list and pr show show kind, branches, tasks, publication and amendments', () => {
  has(view({ command: 'pr list', status: 'ok', data: { folder: 'docs/pull-requests', pullRequests: [{ ...kickoff, title: 'Kick-off: Demo', increment: 'demo', tasks: { total: 2, done: 1 } }] } }).text,
    ['ID            KIND     STATUS  INCREMENT  BRANCHES               TASKS  REMOTE', 'demo-kickoff  kickoff  Draft   demo       increment/demo → main  1/2    #7 https://github.com/o/r/pull/7', 'Next: node bin/app pr show demo-kickoff']);
  assert.ok(view({ command: 'pr list', status: 'ok', data: { folder: 'docs/pull-requests', pullRequests: [] } }).text.includes('No pull requests planned yet.'));
  const pull = { id: 'demo-1', title: 'Export', kind: 'change', increment: 'demo', status: 'Draft', head: 'pr/demo/demo-1', base: 'increment/demo', delivers: ['AC-1'], issues: ['demo'],
    binding: { platform: 'github', repository: 'o/r', number: 8, url: 'https://github.com/o/r/pull/8', lastSyncedAt: '2026-10-04T12:00:00Z' }, scope: { in: ['Exporter'], out: [] },
    tasks: [{ id: 'T-1', checked: true, text: 'Write it' }, { id: 'T-2', checked: false, text: 'Test it' }], documents: ['[[docs/increments/demo|Increment]]'],
    amendments: [{ id: 'A-1', date: '2026-10-05', body: 'Narrowed.' }], path: 'docs/pull-requests/demo-1.md' };
  has(view({ command: 'pr show', status: 'ok', data: { pullRequest: pull, remote: 'not-contacted', validation: { problems: [] }, next: 'node bin/app pr sync demo-1' } }).text,
    ['Export (demo-1)', 'Branches   pr/demo/demo-1 → increment/demo', 'Delivers   AC-1', 'Remote     github o/r #8 https://github.com/o/r/pull/8; last synced 2026-10-04T12:00:00Z',
      'Tasks (1/2 done)\n  [x] T-1  Write it\n  [ ] T-2  Test it', 'Documents\n  [[docs/increments/demo|Increment]]', 'Amendments\n  A-1 · 2026-10-05', 'Next: node bin/app pr sync demo-1']);
  const local = view({ command: 'pr show', status: 'ok', data: { pullRequest: { ...pull, kind: 'kickoff', delivers: [], binding: null, amendments: [] }, validation: { problems: [] }, next: null } }).text;
  has(local, ['Delivers   every criterion (kick-off)', 'Remote     not published (local document only)']);
});

const preview = { planHash: 'a'.repeat(64), mode: 'preview', pullRequest: { id: 'demo-kickoff', path: 'docs/pull-requests/demo-kickoff.md', increment: 'demo' },
  remote: { platform: 'github', repository: 'o/r', head: 'increment/demo', base: 'main', action: 'create', existing: null, headExists: false, needsPush: true,
    steps: ['push-head', 'create', 'readback', 'record'], readiness: { platform: 'github', cli: 'ok', auth: 'ok', defaultBranch: 'main' } },
  rendered: { title: 'Kick-off: Demo', bodyChars: 1200, bodySha256: 'b'.repeat(64), limit: 4000 },
  changes: [{ path: 'docs/pull-requests/demo-kickoff.md', status: 'update' }, { path: '.workbench/pull-requests/demo-kickoff.sync.json', status: 'create' }],
  increment: { statusBefore: 'Ready', statusAfter: 'In progress' }, warnings: [{ code: 'PR_HOSTING_ORIGIN_MISMATCH', message: 'origin differs' }], push: 'git push -u origin increment/demo' };

test('the pr publish preview shows the remote action, the push of a missing head, the steps and the body size; apply shows the draft', () => {
  const planned = view({ command: 'pr publish', status: 'planned', data: preview });
  has(planned.text, ['Platform      github o/r', 'Readiness     cli ok, sign-in ok, default branch main', 'Branches      increment/demo → main',
    'Head branch   increment/demo is not on the remote; apply pushes it (git push -u origin increment/demo)', 'Action        create a draft pull request', 'Steps         push-head → create → readback → record',
    'Body          1200 of 4000 characters (30%), sha256 bbbbbbbbbbbb', 'Increment     Ready → In progress', 'Local records on apply\n    update  docs/pull-requests/demo-kickoff.md\n    create  .workbench/pull-requests/demo-kickoff.sync.json',
    '[warn] PR_HOSTING_ORIGIN_MISMATCH  origin differs', `Next: review the steps above, then rerun with --apply ${'a'.repeat(64)} (or --yes); only that writes the hosting platform`]);
  assert.ok(!planned.text.includes('Published'));
  const applied = view({ command: 'pr publish', status: 'applied', data: { ...preview, mode: 'applied', pushed: true, warnings: [],
    remote: { ...preview.remote, action: 'adopt', needsPush: false, existing: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'draft' }, number: 7, url: 'https://github.com/o/r/pull/7', state: 'Draft' },
    increment: { statusBefore: 'In progress', statusAfter: 'In progress' } } }).text;
  has(applied, ['Head branch   increment/demo is on the remote', 'Action        adopt #7 draft https://github.com/o/r/pull/7', 'Increment     In progress (unchanged)',
    'Published     #7 Draft https://github.com/o/r/pull/7; head pushed', 'Local records written', 'Next: node bin/app pr sync demo-kickoff']);
});

const syncData = { planHash: 'c'.repeat(64), remote: { number: 7, url: 'https://github.com/o/r/pull/7', state: 'open', revision: 'r', unmanagedChars: 42 },
  merge: { title: 'unchanged', regions: { summary: 'pull', scope: 'unchanged', documents: 'unchanged', notes: 'conflict' },
    tasks: { pulled: ['T-1'], pushed: ['T-3'], imported: ['T-4'], restored: [], removed: [] }, amendments: { pulled: [], pushed: [], imported: [], restored: [], removed: [] }, status: { before: 'Draft', after: 'Ready' } },
  pullOnly: false, conflicts: [], remoteWrite: { title: false, body: true }, localWrite: true, changes: [{ path: 'docs/pull-requests/demo-kickoff.md', beforeHash: 'x' }], warnings: [] };

test('the pr sync view shows each merge decision, conflicts with both sides and how to resolve them', () => {
  has(view({ command: 'pr sync', status: 'planned', data: syncData }).text, ['Remote     #7 open https://github.com/o/r/pull/7', 'Unmanaged  42 characters outside the managed block',
    'Summary       pull', 'Notes         conflict', 'Tasks         pulled T-1; pushed T-3; imported T-4', 'Amendments    unchanged', 'Status        Draft → Ready',
    'Remote write  title no, body yes', 'Local write   yes', `Next: rerun with --apply ${'c'.repeat(64)} (or --yes) to write exactly this merge`]);
  const conflicts = [{ key: 'task:T-3:text', kind: 'text', code: 'PR_SYNC_CONFLICT', local: 'Local wording', remote: null, allowed: ['local', 'remote'] }];
  const blocked = view({ command: 'pr sync', status: 'blocked', data: { ...syncData, conflicts }, diagnostics: [{ code: 'PR_SYNC_CONFLICT', message: 'x' }] });
  assert.equal(blocked.diagnosticsShown, true);
  has(blocked.text, ['Conflicts (1)\n  [FAIL] task:T-3:text  (text)\n         local:  Local wording\n         remote: (absent)\n         resolve: local or remote',
    `Next: node bin/app pr sync demo-kickoff --prefer local|remote (every conflict), or --resolutions '{"<key>":"local|remote"}' per key`]);
  const unchanged = view({ command: 'pr sync', status: 'unchanged', data: { ...syncData, pullOnly: true, remote: { ...syncData.remote, state: 'merged', unmanagedChars: 0 } } }).text;
  has(unchanged, ['#7 merged https://github.com/o/r/pull/7 (merged or closed: pull only)', 'Nothing to sync']);
  assert.ok(!unchanged.includes('Unmanaged') && !unchanged.includes('Next:'));
});

test('an uncertain remote write explains exit 2 and the recovery; other failures and every --json result stay unchanged', () => {
  const recovery = 'Inspect the pull request, then rerun the same command.';
  const lost = view({ command: 'pr publish', status: 'failed', data: { uncertain: true, step: 'create', recovery }, diagnostics: [{ code: 'PR_REMOTE_UNCERTAIN', message: 'x', next: recovery }] });
  assert.equal(lost.diagnosticsShown, false);
  has(lost.text, ['pr publish: failed', 'Outcome    uncertain at step create', 'Exit code  2 (nothing was retried)', `Recovery   ${recovery}`]);
  const refused = view({ command: 'pr publish', status: 'failed', data: { uncertain: false, step: 'read' } }).text;
  assert.ok(refused.includes('uncertain  false') && !refused.includes('Exit code'), 'a refusal keeps the generic view');
  const written = [], value = { protocolVersion: 1, command: 'pr sync', status: 'planned', data: syncData, diagnostics: [] };
  renderCliResult(value, true, { output: { write: text => written.push(text) }, error: { write: text => written.push(text) } });
  assert.deepEqual(written, [JSON.stringify(value) + '\n']);
});

test('increment, pr and issue plans add their document facts and branch step to the plan view', () => {
  const plan = summary => view({ command: 'pr new', status: 'planned', data: { planHash: 'd'.repeat(64), conflicts: [], changes: [{ path: 'docs/pull-requests/demo-1.md', status: 'create' }], summary } }).text;
  has(plan({ document: { kind: 'pullRequest', id: 'demo-1', path: 'docs/pull-requests/demo-1.md' }, statusBefore: null, statusAfter: 'New', edits: [{ section: 'document', action: 'add' }],
    kind: 'change', head: 'pr/demo/demo-1', base: 'increment/demo', delivers: ['AC-1', 'AC-2'], warnings: [{ code: 'PR_BASE_EXPLICIT', message: 'base differs' }],
    branch: { status: 'planned', name: 'pr/demo/demo-1', start: 'increment/demo', commit: '0123456789abcdef', switch: true, fetch: { remote: 'origin', branch: 'increment/demo' } } }),
  ['create  docs/pull-requests/demo-1.md', 'Document     pullRequest demo-1', 'Status       New (new document)', 'Kind         change', 'Branches     pr/demo/demo-1 → increment/demo',
    'Delivers     AC-1, AC-2', 'Edits        document add', 'Branch step  create pr/demo/demo-1 from increment/demo at 0123456789ab after fetching origin/increment/demo, then switch to it',
    '[warn] PR_BASE_EXPLICIT  base differs', `Next: rerun the same command with --apply ${'d'.repeat(64)}`]);
  const created = view({ command: 'increment new', status: 'planned', data: { planHash: 'e'.repeat(64), conflicts: [], changes: [], summary: { document: { kind: 'increment', id: 'demo' }, statusBefore: null, statusAfter: 'New',
    edits: [], created: { increment: 'docs/increments/demo.md', issue: 'docs/issues/demo.md', stubs: ['tests/acceptance/demo/ac-1.checks.mjs'] }, branch: { status: 'exists', name: 'increment/demo', reason: 'the branch already exists' } } } }).text;
  has(created, ['Creates      increment docs/increments/demo.md; issue docs/issues/demo.md; 1 acceptance test stub', 'Branch step  increment/demo: exists (the branch already exists)']);
  const status = view({ command: 'increment status', status: 'applied', data: { planHash: 'f'.repeat(64), conflicts: [], changes: [], applied: { written: ['docs/increments/demo.md'] },
    summary: { document: { kind: 'increment', id: 'demo' }, statusBefore: 'Refining', statusAfter: 'Ready', edits: [] } } }).text;
  has(status, ['Written    1 files', 'Status    Refining → Ready']);
  assert.ok(!status.includes('Branch step') && !status.includes('Next:'));
  const other = view({ command: 'setup', status: 'planned', data: { planHash: 'g'.repeat(64), conflicts: [], changes: [], summary: { document: { kind: 'increment', id: 'x' } } } }).text;
  assert.ok(!other.includes('Document '), 'only the delivery families get the document facts');
});
