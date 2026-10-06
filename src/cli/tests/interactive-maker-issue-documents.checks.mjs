import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { changeIssueStatus, editIssue, nextIssueId, parseIssue, renderIssue, validateIssue } from '../domain/increments/issue-document.ts';
import { checkIssueTransition, issueStatus, issueTransitions, requireIssueEditable } from '../domain/increments/transitions.ts';
import { parseInputFragment } from '../domain/increments/input-fragment.ts';
import { issueStatuses } from '../domain/increments/model.ts';

const code = expected => error => { assert.equal(error.code, expected, error.message); assert.ok(error.message.startsWith(`${expected}: `)); return true; };
const fresh = (extra = {}) => renderIssue({ id: 'delivery', title: 'Plan the delivery', increment: 'delivery', ...extra });
const apply = (text, ...ops) => ops.reduce((current, op) => editIssue(current, op).text, text);
const path = 'docs/issues/delivery.md';

test('a new issue is a New document of its increment with Summary, Acceptance criteria and Notes', () => {
  assert.equal(fresh(), ['---', 'type: Issue', 'id: delivery', 'title: "Plan the delivery"', 'status: New', 'increment: delivery', '---', '', '# Plan the delivery', '',
    '## Summary', '', '## Acceptance criteria', '', '## Notes', ''].join('\n'));
  const model = parseIssue(fresh({ summary: 'Break the increment down.' }));
  assert.deepEqual([model.id, model.title, model.status, model.increment, model.pullRequests, model.regions.summary, model.heading], ['delivery', 'Plan the delivery', 'New', 'delivery', [], 'Break the increment down.', 'Plan the delivery']);
  assert.deepEqual(model.sections.map(section => section.name), ['Summary', 'Acceptance criteria', 'Notes']);
  assert.deepEqual(validateIssue(fresh(), { path }), []);
  assert.throws(() => fresh({ id: 'Bad Id' }), code('ISSUE_ID_INVALID'));
  assert.throws(() => fresh({ increment: '' }), code('ISSUE_INCREMENT_REQUIRED'));
  assert.throws(() => fresh({ title: '' }), code('ISSUE_DOCUMENT_INVALID'));
});

test('the first issue takes the increment id and later ones count up', () => {
  assert.equal(nextIssueId('delivery', []), 'delivery');
  assert.equal(nextIssueId('delivery', ['delivery']), 'delivery-1');
  assert.equal(nextIssueId('delivery', ['delivery', 'delivery-1', 'delivery-4', 'other']), 'delivery-5');
  assert.throws(() => nextIssueId('a'.repeat(63), ['a'.repeat(63)]), code('ISSUE_ID_INVALID'));
});

test('issue edits add own and referenced criteria, notes and links with exact Markdown', () => {
  let text = apply(fresh(), { kind: 'title', value: 'Plan: delivery' }, { kind: 'section', name: 'summary', body: 'Summary text.' },
    { kind: 'ac-add', text: 'Own criterion' }, { kind: 'ac-add', ref: 'AC-2', text: 'Increment criterion', acceptance: ['AC-1', 'AC-2'] }, { kind: 'ac-add', text: 'Second own' },
    { kind: 'ac-set', id: 'IC-1', checked: true }, { kind: 'ac-set', id: 'AC-2', text: 'Renamed' }, { kind: 'notes', body: 'First.' }, { kind: 'notes', body: 'Second.' },
    { kind: 'pull-requests', ids: ['delivery-1', 'delivery-1'] });
  assert.equal(text, ['---', 'type: Issue', 'id: delivery', 'title: "Plan: delivery"', 'status: New', 'increment: delivery', 'pullRequests: [delivery-1]', '---', '', '# Plan: delivery', '',
    '## Summary', '', 'Summary text.', '', '## Acceptance criteria', '', '- [x] IC-1: Own criterion', '- [ ] AC-2: Renamed', '- [ ] IC-2: Second own', '', '## Notes', '', 'First.', '', 'Second.', ''].join('\n'));
  assert.deepEqual(parseIssue(text).acceptance.map(item => [item.id, item.checked, item.text]), [['IC-1', true, 'Own criterion'], ['AC-2', false, 'Renamed'], ['IC-2', false, 'Second own']]);
  assert.equal(parseIssue(editIssue(text, { kind: 'notes', body: 'Only.', replace: true }).text).regions.notes, 'Only.');
  assert.doesNotMatch(editIssue(text, { kind: 'pull-requests', ids: [] }).text, /pullRequests/);
  assert.match(editIssue(text, { kind: 'increment', id: 'other' }).text, /^increment: other$/m);
  assert.throws(() => editIssue(text, { kind: 'ac-add', ref: 'AC-2', text: 'dup' }), code('ISSUE_DOCUMENT_INVALID'));
  assert.throws(() => editIssue(text, { kind: 'ac-add', ref: 'AC-9', text: 'x', acceptance: ['AC-1'] }), code('ISSUE_CRITERION_NOT_FOUND'));
  assert.throws(() => editIssue(text, { kind: 'ac-set', id: 'IC-9', checked: true }), code('ISSUE_CRITERION_NOT_FOUND'));
  assert.throws(() => editIssue(text, { kind: 'section', name: 'Acceptance criteria', body: 'x' }), code('INCREMENT_SECTION_UNKNOWN'));
  assert.throws(() => editIssue(text, { kind: 'increment', id: 'Bad Id' }), code('ISSUE_INCREMENT_REQUIRED'));
  assert.throws(() => editIssue(text, { kind: 'pull-requests', ids: ['Bad Id'] }), code('ISSUE_DOCUMENT_INVALID'));
  const crlf = editIssue(fresh().replace(/\n/g, '\r\n'), { kind: 'ac-add', text: 'CRLF' }).text;
  assert.ok(!/[^\r]\n/.test(crlf)); assert.match(crlf, /## Acceptance criteria\r\n\r\n- \[ \] IC-1: CRLF\r\n\r\n## Notes/);
});

test('an input fragment fills an issue like the interview answers', () => {
  const fragment = parseInputFragment('# Guided\n\n## Summary\n\nWhy.\n\n## Acceptance criteria\n\n- AC-1: From the increment\n- [ ] Own one\n\n## Notes\n\nn\n', ['Summary', 'Acceptance criteria', 'Notes']);
  const model = parseIssue(fresh({ fragment }));
  assert.equal(model.title, 'Guided'); assert.equal(model.regions.summary, 'Why.'); assert.equal(model.regions.notes, 'n');
  assert.deepEqual(model.acceptance.map(item => [item.id, item.text]), [['AC-1', 'From the increment'], ['IC-1', 'Own one']]);
  assert.throws(() => editIssue(fresh(), { kind: 'fragment', fragment: parseInputFragment('loose', ['Summary']) }), code('ISSUE_DOCUMENT_INVALID'));
  assert.throws(() => editIssue(fresh(), { kind: 'fragment', fragment: parseInputFragment('## Summary\n### Sub\nx', ['Summary']) }), code('INCREMENT_SECTION_UNKNOWN'));
});

test('issue statuses follow their table, Done needs every criterion checked and locks edits', () => {
  for (const from of issueStatuses) for (const to of issueStatuses) {
    if (issueTransitions[from].includes(to)) assert.equal(checkIssueTransition(from, to, []), to, `${from} → ${to}`);
    else assert.throws(() => checkIssueTransition(from, to, []), code('ISSUE_STATUS_TRANSITION'), `${from} → ${to}`);
  }
  assert.equal(issueStatus('in-progress'), 'In progress');
  assert.throws(() => checkIssueTransition('New', 'Open', []), error => code('ISSUE_STATUS_TRANSITION')(error) && /Unknown status "Open"/.test(error.message));
  assert.throws(() => checkIssueTransition('Bogus', 'New', []), error => /Unknown status "Bogus"/.test(error.message));
  let text = apply(fresh(), { kind: 'ac-add', text: 'One' });
  text = changeIssueStatus(changeIssueStatus(text, 'Ready'), 'in-progress');
  assert.throws(() => changeIssueStatus(text, 'Done'), error => code('ISSUE_STATUS_TRANSITION')(error) && error.details.open[0] === 'IC-1');
  const done = changeIssueStatus(editIssue(text, { kind: 'ac-set', id: 'IC-1', checked: true }).text, 'Done');
  assert.match(done, /^status: Done$/m);
  assert.throws(() => editIssue(done, { kind: 'notes', body: 'x' }), code('ISSUE_LOCKED'));
  assert.throws(() => requireIssueEditable('Cancelled'), code('ISSUE_LOCKED'));
  assert.match(changeIssueStatus(done, 'In progress'), /^status: In progress$/m);
});

test('validation reports frontmatter, section, criterion and link problems', () => {
  const broken = fresh().replace('type: Issue', 'type: Task').replace('status: New', 'status: Open\npullRequests: x').replace('increment: delivery\n', '')
    .replace('## Notes', '## Remarks').replace('## Acceptance criteria\n', '## Acceptance criteria\n\n- [ ] nothing\n- [ ] AC-3: a\n- [ ] AC-3: b\n');
  const problems = validateIssue(broken, { path: 'docs/issues/other.md', increment: { id: 'delivery', acceptance: [{ id: 'AC-1' }] } });
  for (const expected of ['type must be Issue.', 'id "delivery" must be a slug equal to the file name.', 'status must be one of New, Ready, In progress, Done, Cancelled.',
    'pullRequests must be a [list].', 'increment names the Increment this issue belongs to.', '## Notes is missing.', '"[ ] nothing" is not "[ ] AC-n: text" or "[ ] IC-n: text".',
    'AC-3 appears more than once.', 'AC-3 is not an acceptance criterion of delivery.']) assert.ok(problems.some(problem => problem.message === expected), expected);
  assert.deepEqual(validateIssue('# none')[0], { code: 'ISSUE_DOCUMENT_INVALID', message: 'The file does not start with a --- frontmatter block.', line: 1 });
  assert.ok(validateIssue(fresh().replace('title: "Plan the delivery"\n', '')).some(problem => problem.message === 'title is missing.'));
  const linked = fresh().replace('## Notes\n', '## Notes\n\n[[gone]] [[docs/increments/delivery]]\n');
  assert.deepEqual(validateIssue(linked, { files: ['docs/increments/delivery.md'] }).map(problem => [problem.code, problem.line]), [['WIKILINK_UNRESOLVED', 17]]);
});
