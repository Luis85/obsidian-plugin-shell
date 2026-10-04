import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import {
  appendAmendment, changePullRequestStatus, editPullRequest, isPublished, nextPullRequestId, parsePullRequest, renderPullRequest, replacePullRequestRegion,
  setPullRequestBinding, setPullRequestField, setPullRequestStatus, validatePullRequest, writeTasks,
} from '../../bin/domain/increments/pull-request-document.ts';
import { fragmentBody, fragmentItems, inputText, parseInputFragment, renderInputFragment } from '../../bin/domain/increments/input-fragment.ts';
import { limits } from '../../bin/domain/increments/model.ts';

const handoffScript = resolve(import.meta.dirname, '../../scripts/delivery/handoff.mjs');
const noScripts = existsSync(handoffScript) ? false : 'scripts/delivery is not on this branch yet; the DoR parser is compared once it lands';
const increment = { id: 'delivery', title: 'Delivery pipeline', path: 'docs/increments/delivery.md' };
const sections = ['Summary', 'Scope', 'Tasks', 'Documents', 'Notes'];
const code = expected => error => { assert.equal(error.code, expected, error.message); assert.ok(error.message.startsWith(`${expected}: `)); return true; };
const binding = { platform: 'github', repository: 'o/r', number: 74, url: 'https://github.com/o/r/pull/74', publishedAt: '2026-10-04T12:00:00Z', lastSyncedAt: '2026-10-05T08:00:00Z' };
const fresh = (extra = {}) => renderPullRequest({ id: 'delivery-1', title: 'Hosting set', increment, ...extra });
const published = (status = 'Draft') => setPullRequestStatus(setPullRequestBinding(fresh(), binding), status);
function apply(text, ...ops) { return ops.reduce((current, op) => editPullRequest(current, op).text, text); }

test('a new pull request is a New plan with every section and a link to its increment', () => {
  assert.equal(fresh(), ['---', 'type: PullRequest', 'id: delivery-1', 'title: "Hosting set"', 'increment: delivery', 'status: New', '---', '', '# Hosting set', '',
    '## Summary', '', '## Scope', '', '### In scope', '', '### Out of scope', '', '## Tasks', '', '## Documents', '', '- [[docs/increments/delivery|Increment: Delivery pipeline]]', '',
    '## Notes', '', '## Amendments', '', '<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->', ''].join('\n'));
  const text = fresh({ summary: 'Adds the hosting set command.', head: 'feature/hosting-set', base: 'main', delivers: ['AC-1', 'AC-3'] });
  assert.match(text, /^status: New\ndelivers: \[AC-1, AC-3\]\nhead: "feature\/hosting-set"\nbase: main\n---\n/m);
  const model = parsePullRequest(text);
  assert.deepEqual([model.id, model.title, model.increment, model.status, model.head, model.base, model.binding, isPublished(model)],
    ['delivery-1', 'Hosting set', 'delivery', 'New', 'feature/hosting-set', 'main', null, false]);
  assert.deepEqual(model.delivers, ['AC-1', 'AC-3']); assert.equal(model.regions.summary, 'Adds the hosting set command.');
  assert.deepEqual(model.sections.map(section => section.name), ['Summary', 'Scope', 'Tasks', 'Documents', 'Notes', 'Amendments']);
  assert.deepEqual(validatePullRequest(text, { path: 'docs/pull-requests/delivery-1.md', increment: { id: 'delivery', acceptance: [{ id: 'AC-1' }, { id: 'AC-3' }] } }), []);
  assert.throws(() => fresh({ id: 'Delivery 1' }), code('PR_ID_INVALID'));
  assert.throws(() => fresh({ increment: { ...increment, id: '' } }), code('PR_INCREMENT_REQUIRED'));
  for (const head of ['has space', 'a..b', '-flag', 'x:y']) assert.throws(() => fresh({ head }), code('PR_DOCUMENT_INVALID'), head);
});

test('pull-request ids count up per increment and refuse ids over the slug length', () => {
  assert.equal(nextPullRequestId('delivery', []), 'delivery-1');
  assert.equal(nextPullRequestId('delivery', ['delivery-1', 'delivery-3', 'delivery-x', 'other-9']), 'delivery-4');
  assert.throws(() => nextPullRequestId('a'.repeat(63), []), code('PR_ID_INVALID'));
});

test('while New every plan section is editable with exact Markdown and stable task ids', () => {
  let text = apply(fresh(), { kind: 'field', key: 'title', value: 'Hosting: set' }, { kind: 'field', key: 'head', value: 'feature/x' }, { kind: 'field', key: 'base', value: 'main' },
    { kind: 'section', name: 'summary', body: 'Short summary.' }, { kind: 'scope', side: 'in', text: 'Planner' }, { kind: 'scope', side: 'out', text: 'Sync' },
    { kind: 'task-add', text: 'Write the planner' }, { kind: 'task-add', text: 'Document it', checked: true }, { kind: 'task-set', id: 'T-1', checked: true, text: 'Write the planner first' },
    { kind: 'document', target: '[[docs/prds/delivery|Delivery PRD]]' }, { kind: 'document', target: 'HOSTING-PLATFORMS', label: 'Hosting' },
    { kind: 'notes', body: 'First note.' }, { kind: 'notes', body: 'Second note.' });
  assert.match(text, /^title: "Hosting: set"\n[\s\S]*^head: "feature\/x"\nbase: main\n---\n\n# Hosting: set\n/m);
  assert.ok(text.includes('## Summary\n\nShort summary.\n\n## Scope\n\n### In scope\n\n- Planner\n\n### Out of scope\n\n- Sync\n\n## Tasks\n\n- [x] T-1: Write the planner first\n- [x] T-2: Document it\n\n## Documents\n\n- [[docs/increments/delivery|Increment: Delivery pipeline]]\n- [[docs/prds/delivery|Delivery PRD]]\n- [[HOSTING-PLATFORMS|Hosting]]\n\n## Notes\n\nFirst note.\n\nSecond note.\n\n## Amendments'));
  assert.deepEqual(editPullRequest(text, { kind: 'document', target: 'docs/prds/delivery.md' }).edits, []);
  assert.equal(editPullRequest(text, { kind: 'notes', body: 'Only this.', replace: true }).text.split('## Notes\n\n')[1].split('\n\n## Amendments')[0], 'Only this.');
  assert.match(editPullRequest(text, { kind: 'section', name: 'In scope', body: '- Replaced' }).text, /### In scope\n\n- Replaced\n\n### Out of scope/);
  assert.throws(() => editPullRequest(text, { kind: 'task-set', id: 'T-9', checked: true }), code('PR_TASK_NOT_FOUND'));
  assert.throws(() => editPullRequest(text, { kind: 'document', target: 'docs/missing' }, ['docs/prds/delivery.md']), code('WIKILINK_UNRESOLVED'));
  assert.throws(() => editPullRequest(text, { kind: 'document', target: '[[#heading]]' }), code('PR_DOCUMENT_INVALID'));
  assert.throws(() => editPullRequest(text, { kind: 'section', name: 'Tasks', body: 'x' }), code('INCREMENT_SECTION_UNKNOWN'));
  assert.throws(() => editPullRequest(text, { kind: 'amend', body: 'x', date: '2026-10-05' }), code('PR_NOT_PUBLISHED'));
  const crlf = fresh().replace(/\n/g, '\r\n'), edited = editPullRequest(crlf, { kind: 'task-add', text: 'CRLF task' }).text;
  assert.ok(!/[^\r]\n/.test(edited)); assert.match(edited, /## Tasks\r\n\r\n- \[ \] T-1: CRLF task\r\n\r\n## Documents/);
});

test('an input fragment drives the same edits as the interview answers', () => {
  const answers = { title: 'Guided title', summary: 'Guided summary.', inScope: ['one', ' '], outOfScope: ['two'], tasks: ['First', '[x] Second'], documents: ['[[docs/prds/delivery|PRD]]', 'notes'] };
  const fragmentText = renderInputFragment(answers);
  assert.equal(fragmentText, '# Guided title\n\n## Summary\n\nGuided summary.\n\n## Scope\n\n### In scope\n\n- one\n\n### Out of scope\n\n- two\n\n## Tasks\n\n- First\n- [x] Second\n\n## Documents\n\n- [[docs/prds/delivery|PRD]]\n- notes\n');
  assert.equal(renderInputFragment({}), '');
  const fragment = parseInputFragment(fragmentText, sections);
  assert.equal(fragment.title, 'Guided title'); assert.equal(fragmentBody(fragment, 'scope', 'out of scope'), '- two');
  assert.equal(fragmentBody(fragment, 'Notes'), null); assert.deepEqual(fragmentItems(fragmentBody(fragment, 'Tasks')), ['First', '[x] Second']);
  const text = fresh({ fragment }), model = parsePullRequest(text);
  assert.equal(model.title, 'Guided title'); assert.equal(model.regions.summary, 'Guided summary.');
  assert.deepEqual(model.scope, { in: ['one'], out: ['two'] });
  assert.deepEqual(model.tasks.map(task => [task.id, task.checked, task.text]), [['T-1', false, 'First'], ['T-2', true, 'Second']]);
  assert.deepEqual(model.documents, ['[[docs/increments/delivery|Increment: Delivery pipeline]]', '[[docs/prds/delivery|PRD]]', '[[notes]]']);
  const scoped = editPullRequest(fresh(), { kind: 'fragment', fragment: parseInputFragment('## Scope\n\n- loose scope text\n\n## Notes\n\nn', sections) }).text;
  assert.match(scoped, /### In scope\n\n- loose scope text\n\n### Out of scope/); assert.match(scoped, /## Notes\n\nn\n/);
  for (const [input, expected] of [['---\na: b\n---\n## Summary', 'INCREMENT_INPUT_INVALID'], ['## Summary\n# Late title', 'INCREMENT_INPUT_INVALID'], ['## Summary\n## summary', 'INCREMENT_INPUT_INVALID'],
    ['## Unknown', 'INCREMENT_SECTION_UNKNOWN'], ['bad \u0007 control', 'INCREMENT_INPUT_INVALID']]) assert.throws(() => parseInputFragment(input, sections), code(expected), input);
  assert.throws(() => inputText('x'.repeat(11), 'PR_DOCUMENT_INVALID', 10), code('PR_DOCUMENT_INVALID'));
  assert.equal(inputText('﻿a\r\nb\rc'), 'a\nb\nc');
  assert.throws(() => editPullRequest(fresh(), { kind: 'fragment', fragment: parseInputFragment('loose', sections) }), code('PR_DOCUMENT_INVALID'));
  assert.throws(() => editPullRequest(fresh(), { kind: 'fragment', fragment: parseInputFragment('## Notes\n### Sub\nx', sections) }), code('INCREMENT_SECTION_UNKNOWN'));
});

test('a published pull request accepts only tasks and amendments, and nothing once merged or closed', () => {
  const draft = published();
  assert.deepEqual(parsePullRequest(draft).binding, binding); assert.equal(isPublished(parsePullRequest(draft)), true);
  assert.match(draft, /^base: main$|^lastSyncedAt: 2026-10-05T08:00:00Z\n---$/m);
  for (const op of [{ kind: 'field', key: 'title', value: 'x' }, { kind: 'section', name: 'Summary', body: 'x' }, { kind: 'scope', side: 'in', text: 'x' },
    { kind: 'document', target: 'x' }, { kind: 'notes', body: 'x' }, { kind: 'increment', ...increment }]) assert.throws(() => editPullRequest(draft, op), code('PR_LOCKED'), op.kind);
  let text = apply(draft, { kind: 'task-add', text: 'Late task' }, { kind: 'task-set', id: 'T-1', checked: true });
  const amended = editPullRequest(text, { kind: 'amend', body: 'Moved the planner.\n\n- detail', date: '2026-10-05' });
  assert.deepEqual(amended.edits, [{ section: 'Amendments', action: 'add', itemId: 'A-1' }]);
  text = editPullRequest(amended.text, { kind: 'amend', body: 'Second.', date: '2026-10-06' }).text;
  assert.ok(text.endsWith('-->\n\n### A-1 · 2026-10-05\n\nMoved the planner.\n\n- detail\n\n### A-2 · 2026-10-06\n\nSecond.\n'));
  assert.deepEqual(parsePullRequest(text).amendments.map(item => [item.id, item.date, item.body]), [['A-1', '2026-10-05', 'Moved the planner.\n\n- detail'], ['A-2', '2026-10-06', 'Second.']]);
  for (const [body, date] of [['x', '5 Oct'], ['', '2026-10-05'], ['## heading', '2026-10-05']]) assert.throws(() => editPullRequest(text, { kind: 'amend', body, date }), code('PR_DOCUMENT_INVALID'));
  assert.throws(() => appendAmendment(text, { id: 'A-1', body: 'dup', date: '2026-10-07' }), code('PR_DOCUMENT_INVALID'));
  assert.match(appendAmendment(text, { id: 'A-7', body: 'from sync', date: '2026-10-07' }).text, /### A-7 · 2026-10-07\n\nfrom sync\n$/);
  for (const status of ['Merged', 'Closed']) assert.throws(() => editPullRequest(setPullRequestStatus(text, status), { kind: 'task-add', text: 'x' }), code('PR_TERMINAL'));
  assert.throws(() => setPullRequestStatus(text, 'Open'), code('PR_DOCUMENT_INVALID'));
  assert.throws(() => setPullRequestBinding(text, { ...binding, number: 0 }), code('PR_DOCUMENT_INVALID'));
});

test('local status changes close and reopen only unpublished pull requests', () => {
  const closed = changePullRequestStatus(fresh(), 'closed');
  assert.match(closed, /^status: Closed$/m);
  assert.throws(() => editPullRequest(closed, { kind: 'task-add', text: 'x' }), code('PR_TERMINAL'));
  assert.match(changePullRequestStatus(closed, 'New'), /^status: New$/m);
  assert.throws(() => changePullRequestStatus(fresh(), 'New'), code('PR_STATUS_TRANSITION'));
  assert.throws(() => changePullRequestStatus(fresh(), 'Merged'), code('PR_STATUS_TRANSITION'));
  assert.throws(() => changePullRequestStatus(published(), 'Closed'), code('PR_ALREADY_PUBLISHED'));
});

test('attaching a New pull request to another increment moves its key and increment link', () => {
  const result = editPullRequest(fresh(), { kind: 'increment', id: 'other', title: 'Other work', path: 'docs/increments/other.md', previousPath: increment.path });
  assert.match(result.text, /^increment: other$/m);
  assert.deepEqual(parsePullRequest(result.text).documents, ['[[docs/increments/other|Increment: Other work]]']);
  assert.throws(() => editPullRequest(fresh(), { kind: 'increment', id: 'Bad Id', title: 'x', path: 'x' }), code('PR_INCREMENT_REQUIRED'));
});

test('sync writers replace regions, tasks, fields and binding without lock checks', () => {
  const draft = published('Ready');
  const tasks = writeTasks(draft, [{ id: 'T-2', checked: false, text: 'Second' }, { id: 'T-1', checked: true, text: 'First' }]);
  assert.deepEqual(parsePullRequest(tasks).tasks.map(task => [task.id, task.checked, task.text]), [['T-2', false, 'Second'], ['T-1', true, 'First']]);
  assert.throws(() => writeTasks(draft, Array.from({ length: limits.tasks + 1 }, (_, index) => ({ id: `T-${index}`, checked: false, text: 'x' }))), code('PR_LIMIT'));
  const scope = replacePullRequestRegion(draft, 'scope', '### In scope\r\n\r\n- remote in\n\n### Out of scope\n\n- remote out');
  assert.deepEqual(parsePullRequest(scope).scope, { in: ['remote in'], out: ['remote out'] });
  assert.equal(parsePullRequest(replacePullRequestRegion(draft, 'summary', 'Remote summary.')).regions.summary, 'Remote summary.');
  assert.equal(parsePullRequest(replacePullRequestRegion(draft, 'notes', '')).regions.notes, '');
  const moved = setPullRequestField(setPullRequestField(draft, 'head', 'feature/renamed'), 'title', 'Remote title');
  assert.deepEqual([parsePullRequest(moved).head, parsePullRequest(moved).title, parsePullRequest(moved).heading], ['feature/renamed', 'Remote title', 'Remote title']);
  const noScope = draft.replace(/## Scope[\s\S]*?(?=## Tasks)/, '');
  assert.match(replacePullRequestRegion(noScope, 'scope', '### In scope\n\n- x'), /## Summary\n\n## Scope\n\n### In scope\n\n- x\n\n## Tasks/);
});

test('validation reports frontmatter, binding, delivers, task, limit and link problems', () => {
  const text = fresh({ delivers: ['AC-9'] }).replace('type: PullRequest', 'type: Increment').replace('status: New', 'status: Open\nplatform: gitlab')
    .replace('## Notes', '## Remarks').replace('## Tasks\n', '## Tasks\n\n- [ ] not a task\n- [ ] T-1: a\n- [ ] T-1: b\n');
  const messages = validatePullRequest(text, { path: 'docs/pull-requests/other.md', increment: { id: 'delivery', acceptance: [{ id: 'AC-1' }] } }).map(problem => problem.message);
  for (const expected of ['type must be PullRequest.', 'id "delivery-1" must be a slug equal to the file name.', 'status must be one of New, Draft, Ready, Merged, Closed.',
    'The binding keys (platform, number, …) are incomplete or invalid.', 'delivers names AC-9, which is not an acceptance criterion of delivery.', '## Notes is missing.',
    '"[ ] not a task" is not "[ ] T-n: text".', 'T-1 appears more than once.']) assert.ok(messages.includes(expected), expected);
  assert.deepEqual(validatePullRequest('# none').slice(0, 1), [{ code: 'PR_DOCUMENT_INVALID', message: 'The file does not start with a --- frontmatter block.', line: 1 }]);
  assert.ok(validatePullRequest(fresh().replace('title: "Hosting set"\nincrement: delivery\n', '')).some(problem => problem.code === 'PR_INCREMENT_REQUIRED'));
  const linked = fresh().replace('## Notes\n', '## Notes\n\n[[missing]]\n');
  assert.deepEqual(validatePullRequest(linked, { files: ['docs/increments/delivery.md'] }).map(problem => [problem.code, problem.line]), [['WIKILINK_UNRESOLVED', 27]]);
  const many = writeTasks(fresh(), Array.from({ length: limits.tasks }, (_, index) => ({ id: `T-${index + 1}`, checked: false, text: 't' })));
  assert.throws(() => editPullRequest(many, { kind: 'task-add', text: 'one more' }), code('PR_LIMIT'));
  assert.throws(() => editPullRequest(fresh(), { kind: 'notes', body: 'x'.repeat(limits.notes + 1) }), code('PR_DOCUMENT_INVALID'));
  const full = editPullRequest(fresh(), { kind: 'notes', body: 'x'.repeat(limits.notes - 1) }).text;
  assert.throws(() => editPullRequest(full, { kind: 'notes', body: 'more' }), code('PR_LIMIT'));
  assert.ok(validatePullRequest(full.replace(/\n(x+)\n/, '\n$1$1\n')).some(problem => problem.code === 'PR_LIMIT'));
});

test('CLI-written pull requests parse through the DoR frontmatter reader without errors', { skip: noScripts }, async () => {
  const { parseHandoff } = await import(pathToFileURL(handoffScript).href);
  const text = setPullRequestField(setPullRequestBinding(fresh({ head: 'feature/a', base: 'main', delivers: ['AC-1'] }), binding), 'title', 'Quote "x", colon: [y]');
  const parsed = parseHandoff(text).frontmatter;
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.data, { type: 'PullRequest', id: 'delivery-1', title: 'Quote "x", colon: [y]', increment: 'delivery', status: 'New', delivers: ['AC-1'], head: 'feature/a', base: 'main',
    platform: 'github', repository: 'o/r', number: '74', url: 'https://github.com/o/r/pull/74', publishedAt: '2026-10-04T12:00:00Z', lastSyncedAt: '2026-10-05T08:00:00Z' });
});
