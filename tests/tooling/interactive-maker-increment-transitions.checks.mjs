import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import {
  allowedIncrementTransitions, checkIncrementTransition, checkPullRequestTransition, incrementEditable, incrementStatus, pullRequestEdits, pullRequestPhase,
  pullRequestStatus, requireIncrementEditable, requireIncrementStatus, requirePullRequestEdit,
} from '../../bin/domain/increments/transitions.ts';
import { incrementStatuses, pullRequestStatuses } from '../../bin/domain/increments/model.ts';

const code = expected => error => { assert.equal(error.code, expected, error.message); assert.ok(error.message.startsWith(`${expected}: `)); return true; };
const allowed = {
  New: ['Refining', 'Ready', 'Cancelled'], Refining: ['Ready', 'Cancelled'], Ready: ['Refining', 'In progress', 'Cancelled'],
  'In progress': ['Refining', 'Done', 'Cancelled'], Done: [], Cancelled: ['Refining'],
};
/** A context that satisfies every guard, so only the table decides. */
const clear = { pullRequests: ['Merged', 'Closed'], readiness: [] };

test('every increment status pair is allowed or refused exactly as the lifecycle table says', () => {
  for (const from of incrementStatuses) {
    assert.deepEqual([...allowedIncrementTransitions(from)], allowed[from]);
    for (const to of incrementStatuses) {
      if (allowed[from].includes(to)) assert.equal(checkIncrementTransition(from, to, clear), to, `${from} → ${to}`);
      else assert.throws(() => checkIncrementTransition(from, to, clear), code('INCREMENT_STATUS_TRANSITION'), `${from} → ${to}`);
    }
  }
  assert.throws(() => checkIncrementTransition('Done', 'Refining', clear), error => error.details.allowed.length === 0 && /none \(terminal\)/.test(error.message));
});

test('status names accept the exact name or a slug alias and refuse anything else', () => {
  assert.equal(incrementStatus('in-progress'), 'In progress'); assert.equal(incrementStatus('In progress'), 'In progress'); assert.equal(incrementStatus(' READY '), 'Ready');
  assert.equal(incrementStatus('started'), null); assert.equal(pullRequestStatus('merged'), 'Merged'); assert.equal(pullRequestStatus('open'), null);
  assert.equal(requireIncrementStatus('cancelled'), 'Cancelled');
  assert.throws(() => requireIncrementStatus('Started'), code('INCREMENT_STATUS_TRANSITION'));
  assert.equal(checkIncrementTransition('in-progress', 'done', clear), 'Done');
});

test('Ready needs a clean readiness report; Cancelled and Done check the pull requests', () => {
  const problems = [{ code: 'INCREMENT_NOT_READY', message: 'Placeholder TBD is left.' }];
  assert.throws(() => checkIncrementTransition('Refining', 'Ready', { pullRequests: [], readiness: problems }), error => code('INCREMENT_NOT_READY')(error) && error.details.problems === problems);
  assert.equal(checkIncrementTransition('New', 'Ready', { pullRequests: [] }), 'Ready');
  for (const open of ['Draft', 'Ready']) assert.throws(() => checkIncrementTransition('In progress', 'Cancelled', { pullRequests: ['Merged', open] }), code('INCREMENT_OPEN_PULL_REQUESTS'));
  assert.equal(checkIncrementTransition('In progress', 'Cancelled', { pullRequests: ['New', 'Closed'] }), 'Cancelled');
  for (const pullRequests of [['Merged', 'New'], ['Merged', 'Draft'], ['Merged', 'Ready'], ['Closed'], []])
    assert.throws(() => checkIncrementTransition('In progress', 'Done', { pullRequests }), code('INCREMENT_OPEN_PULL_REQUESTS'), pullRequests.join());
  assert.equal(checkIncrementTransition('In progress', 'Done', { pullRequests: ['Merged', 'Closed'] }), 'Done');
});

test('content edits lock once an increment is Done or Cancelled', () => {
  for (const status of incrementStatuses) {
    const editable = !['Done', 'Cancelled'].includes(status);
    assert.equal(incrementEditable(status), editable, status);
    if (editable) requireIncrementEditable(status); else assert.throws(() => requireIncrementEditable(status), code('INCREMENT_LOCKED'));
  }
});

test('the pull-request lock table allows plan edits while New and only tasks and amendments once published', () => {
  const open = ['task-add', 'task-set', 'amend'];
  const cases = [['New', false, 'new'], ['Closed', false, 'closed'], ['Draft', true, 'open'], ['Ready', true, 'open'], ['Merged', true, 'terminal'], ['Closed', true, 'terminal']];
  for (const [status, published, phase] of cases) {
    assert.equal(pullRequestPhase(status, published), phase);
    for (const edit of pullRequestEdits) {
      const expected = phase === 'new' ? (edit === 'amend' ? 'PR_NOT_PUBLISHED' : null) : phase === 'open' ? (open.includes(edit) ? null : 'PR_LOCKED') : 'PR_TERMINAL';
      if (expected) assert.throws(() => requirePullRequestEdit(status, published, edit), code(expected), `${status}/${published}/${edit}`);
      else requirePullRequestEdit(status, published, edit);
    }
  }
  assert.throws(() => requirePullRequestEdit('Closed', false, 'task-add'), /until it is reopened with status New/);
});

test('local pull-request status changes are limited to closing and reopening unpublished plans', () => {
  assert.equal(checkPullRequestTransition('New', 'closed', false), 'Closed');
  assert.equal(checkPullRequestTransition('Closed', 'new', false), 'New');
  for (const to of pullRequestStatuses.filter(status => !['New', 'Closed'].includes(status)))
    assert.throws(() => checkPullRequestTransition('New', to, false), code('PR_STATUS_TRANSITION'), to);
  assert.throws(() => checkPullRequestTransition('New', 'Open', false), code('PR_STATUS_TRANSITION'));
  assert.throws(() => checkPullRequestTransition('New', 'New', false), code('PR_STATUS_TRANSITION'));
  assert.throws(() => checkPullRequestTransition('Draft', 'Closed', false), code('PR_STATUS_TRANSITION'));
  assert.throws(() => checkPullRequestTransition('Draft', 'Closed', true), code('PR_ALREADY_PUBLISHED'));
});
