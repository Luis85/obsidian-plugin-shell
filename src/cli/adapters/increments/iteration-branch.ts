/** Enforce the branch contract on every authoring/publication path of a committed iteration. */
import { OperationError } from '../framework/contracts.ts';
import { branchNames } from '../../domain/increments/branches.ts';
import type { IncrementModel } from '../../domain/increments/model.ts';
import type { Session } from './session.ts';

export async function requireIterationBranch(session: Session, id: string, increment: IncrementModel, pull: { kind: string; head: string | null; base: string | null }): Promise<void> {
  if (pull.kind !== 'change' || !increment.sections.some(section => section.name === 'Iteration commitment')) return;
  const names = branchNames(session.ws.schema.branches, id), expected = increment.branch ?? names.increment;
  if (pull.base !== expected || !pull.head || pull.head === expected || pull.head === (increment.base ?? names.base)) {
    throw new OperationError('PR_BASE_MISMATCH', 'All work for a committed iteration must use a separate head branch and target its iteration branch.');
  }
  if (await session.ws.git.branchExists(pull.head)) {
    const start = await session.ws.git.resolve(expected) ? expected : `origin/${expected}`;
    if (!await session.ws.git.contains(start, pull.head)) throw new OperationError('PR_BRANCH_MISMATCH', `Rebase or merge ${expected} into ${pull.head} before using that existing branch for this iteration.`);
  }
}
