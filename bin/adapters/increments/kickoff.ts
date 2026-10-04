/**
 * Starting content of the documents `increment new` creates next to the Increment: the kick-off pull request
 * (summary, bounded scope and the refinement tasks the Definition of Ready asks for) and the corresponding Issue.
 * Mirrors scripts/delivery/increment-kickoff.mjs so both authoring paths produce documents that pass DOR-16..23.
 */
import { editPullRequest, renderPullRequest, type NewPullRequest, type PullRequestOp } from '../../domain/increments/pull-request-document.ts';
import { editIssue, renderIssue } from '../../domain/increments/issue-document.ts';
import { formatWikilink } from '../../domain/increments/wikilinks.ts';
import type { DeliverySchema } from '../../domain/increments/model.ts';

/** The kick-off document: it carries the increment documents and merges the increment branch once the work landed. */
export function kickoffDocument(input: NewPullRequest, schema: DeliverySchema, branches: { increment: string; base: string }): string {
  const increment = formatWikilink(input.increment.path);
  const summary = `Carries the increment documents, refines them together until the Definition of Ready passes and, once every change pull request is merged, merges \`${branches.increment}\` into \`${branches.base}\`.`;
  const ops: PullRequestOp[] = [
    { kind: 'scope', side: 'in', text: `The Increment document ${increment}, its acceptance test stubs and their refinement.` },
    { kind: 'scope', side: 'out', text: `Implementation: it lands through change pull requests into \`${branches.increment}\`.` },
    { kind: 'task-add', text: 'Refine the increment until the Definition of Ready passes.' },
    { kind: 'task-add', text: 'Review the generated acceptance test stubs, one per criterion.' },
  ];
  return ops.reduce((text, op) => editPullRequest(text, op).text, renderPullRequest({ ...input, summary }, schema));
}
/** The corresponding Issue of a new increment. */
export function issueDocument(input: { id: string; title: string; increment: string; path: string }, schema: DeliverySchema): string {
  const text = renderIssue({ id: input.id, title: input.title, increment: input.increment, summary: `Tracks ${formatWikilink(input.path, input.title)}.` }, schema);
  return editIssue(text, { kind: 'notes', body: 'None.' }).text;
}
