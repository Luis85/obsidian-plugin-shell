// iteration-lifecycle AC-3: carry unfinished items forward without losing source history.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspace, planThenApply } from '../../support/increment-workspace.mjs';
import { parseIssue } from '../../../src/cli/domain/increments/issue-document.ts';

test('AC-3: a cancelled iteration carries open issues into the next plan exactly once', async () => {
  const ws = createWorkspace({ delivery: true });
  try {
    for (const id of ['previous', 'next']) assert.equal((await planThenApply(ws, 'increment plan', [id], { title: id })).status, 'applied');
    assert.equal((await planThenApply(ws, 'issue ac add', ['previous', 'AC-1'])).status, 'applied');
    assert.equal((await planThenApply(ws, 'increment status', ['previous', 'Cancelled'])).status, 'applied');
    const carried = await planThenApply(ws, 'increment carry-over', ['previous', 'next']);
    assert.equal(carried.status, 'applied', JSON.stringify(carried));
    const id = carried.data.summary.copied[0].to, copy = parseIssue(ws.read(`docs/issues/${id}.md`));
    assert.equal(copy.increment, 'next'); assert.equal(copy.acceptance[0].id, carried.data.summary.criteria['AC-1']);
    assert.equal(parseIssue(ws.read('docs/issues/previous.md')).increment, 'previous');
    assert.match(copy.regions.notes, /Carried from/);
    const repeated = await ws.run('increment carry-over', ['previous', 'next']);
    assert.equal(repeated.diagnostics[0].code, 'INCREMENT_UNCHANGED');
  } finally { ws.remove(); }
});
