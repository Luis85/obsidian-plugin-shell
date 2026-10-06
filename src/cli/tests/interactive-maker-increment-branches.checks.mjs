import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { branchNames, checkPullRequestBase, isBranchName, pullRequestBranches, requireBranchName } from '../domain/increments/branches.ts';
import { defaultDeliverySchema } from '../domain/increments/model.ts';

const code = expected => error => { assert.equal(error.code, expected, error.message); assert.ok(error.message.startsWith(`${expected}: `)); return true; };
const config = defaultDeliverySchema.branches;

test('branch names follow the ref-format rules without running the version-control tool', () => {
  for (const name of ['main', 'increment/delivery', 'pr/a/a-1', 'release-1.2', 'feature/ümlaut']) assert.equal(isBranchName(name), true, name);
  for (const name of ['', 'has space', 'a..b', '-flag', '/lead', 'trail/', 'end.', 'x.lock', 'a/x.lock/b', 'a//b', 'a@{b', '@', 'a:b', 'a?b', 'a*b', 'a[b', 'a\\b', 'a~b', 'a^b', '.hidden', 'a/.b', 'tab\tname', 'x'.repeat(201)])
    assert.equal(isBranchName(name), false, JSON.stringify(name));
  assert.equal(requireBranchName(' main '), 'main');
  assert.throws(() => requireBranchName('a b'), code('BRANCH_NAME_INVALID'));
  assert.throws(() => requireBranchName('a b', 'PR_DOCUMENT_INVALID'), code('PR_DOCUMENT_INVALID'));
});

test('the configured patterns name the base, increment and change branches', () => {
  assert.deepEqual(branchNames(config, 'delivery'), { base: 'main', increment: 'increment/delivery', pullRequest: null });
  assert.deepEqual(branchNames(config, 'delivery', 'delivery-2'), { base: 'main', increment: 'increment/delivery', pullRequest: 'pr/delivery/delivery-2' });
  assert.deepEqual(branchNames({ increment: 'inc-{id}', pullRequest: '{increment}+{pr}', base: 'trunk' }, 'x', 'x-1'), { base: 'trunk', increment: 'inc-x', pullRequest: 'x+x-1' });
  assert.throws(() => branchNames({ ...config, increment: 'increment/fixed' }, 'x'), code('BRANCH_NAME_INVALID'));
  assert.throws(() => branchNames({ ...config, pullRequest: 'pr/{increment}' }, 'x', 'x-1'), code('BRANCH_NAME_INVALID'));
  assert.throws(() => branchNames({ ...config, increment: 'increment/{id}/{owner}' }, 'x'), error => code('BRANCH_NAME_INVALID')(error) && /unknown placeholders owner/.test(error.message));
  assert.throws(() => branchNames({ ...config, base: 'bad base' }, 'x'), code('BRANCH_NAME_INVALID'));
  assert.throws(() => branchNames({ ...config, pullRequest: 'increment/{increment}/{pr}' }, 'x', 'x-1'), error => code('BRANCH_NAME_INVALID')(error) && /must not nest/.test(error.message));
  assert.throws(() => branchNames({ ...config, base: 'increment' }, 'x'), code('BRANCH_NAME_INVALID'));
});

test('kick-off and change pull requests get their base and head from the increment', () => {
  assert.deepEqual(pullRequestBranches('kickoff', { id: 'delivery' }, 'delivery-kickoff'), { base: 'main', head: 'increment/delivery' });
  assert.deepEqual(pullRequestBranches('change', { id: 'delivery' }, 'delivery-2'), { base: 'increment/delivery', head: 'pr/delivery/delivery-2' });
  const recorded = { id: 'delivery', branch: 'feature/delivery', base: 'develop' };
  assert.deepEqual(pullRequestBranches('kickoff', recorded, 'delivery-kickoff'), { base: 'develop', head: 'feature/delivery' });
  assert.deepEqual(pullRequestBranches('change', recorded, 'delivery-2'), { base: 'feature/delivery', head: 'pr/delivery/delivery-2' });
  assert.deepEqual(pullRequestBranches('change', { id: 'delivery', branch: null, base: null }, 'delivery-2', { ...config, base: 'trunk' }).base, 'increment/delivery');
});

test('a base other than the expected one refuses unless passed explicitly, then warns', () => {
  assert.deepEqual(checkPullRequestBase('change', 'increment/delivery', { id: 'delivery' }, false), []);
  assert.deepEqual(checkPullRequestBase('kickoff', 'main', { id: 'delivery' }, false), []);
  assert.throws(() => checkPullRequestBase('change', 'main', { id: 'delivery' }, false), error => code('PR_BASE_MISMATCH')(error) && error.details.expected === 'increment/delivery');
  assert.deepEqual(checkPullRequestBase('change', 'main', { id: 'delivery' }, true), [{ code: 'PR_BASE_MISMATCH', message: 'A change pull request of delivery normally targets increment/delivery, not main.' }]);
  assert.deepEqual(checkPullRequestBase('kickoff', 'develop', { id: 'delivery', base: 'develop' }, false), []);
});
