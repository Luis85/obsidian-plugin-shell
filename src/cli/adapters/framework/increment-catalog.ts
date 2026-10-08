import type { Command } from './catalog.ts';

const values = (...keys: string[]): Record<string, 'value'> => Object.fromEntries(keys.map(key => [key, 'value']));
const flags = (...keys: string[]): Record<string, 'flag'> => Object.fromEntries(keys.map(key => [key, 'flag']));
const branching = flags('branch', 'no-branch', 'switch', 'fetch');
/**
 * Increments, their issues and planned pull requests as frontmatter+Markdown documents in the configured
 * folders. Local commands are reviewed file plans (some add a reviewed `git branch` step); `pr publish|sync`
 * use the `remote` effect: the preview reads the hosting platform, --apply/--yes writes it, never --plan-out.
 */
export const incrementCommands: readonly Command[] = [
  { id: 'increment plan', summary: 'Start an iteration planning meeting: create linked Markdown records without creating a branch.', options: { ...values('title', 'owner', 'size', 'e2e', 'from', 'input'), ...flags('issue', 'no-issue') }, maxArgs: 1, effect: 'plan' },
  { id: 'increment commit', summary: 'Commit to the scoped iteration after readiness passes; --branch creates its branch and commits the planning records.', options: flags('branch', 'no-branch'), maxArgs: 1, effect: 'plan' },
  { id: 'increment present', summary: 'Save a Markdown review presentation of delivered criteria, evidence, pull requests and open items.', options: {}, maxArgs: 1, effect: 'plan' },
  { id: 'increment carry-over', summary: 'Copy unfinished issues into a planning iteration, preserving source history and mapping acceptance criteria.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr review', summary: 'Mark a published draft ready for review after its Definition of Done passes.', options: {}, maxArgs: 1, effect: 'remote' },
  { id: 'pr close', summary: 'Close a published pull request without merging; preview and approval required.', options: {}, maxArgs: 1, effect: 'remote' },
  { id: 'pr merge', summary: 'Merge a reviewed pull request with a merge commit after its Definition of Done passes.', options: {}, maxArgs: 1, effect: 'remote' },
  { id: 'increment new', summary: 'Plan a new Increment (the Definition of Ready handoff) with its kick-off pull request, optionally its issue, acceptance test stubs and the increment branch.', options: { ...values('title', 'owner', 'size', 'e2e', 'from', 'input'), ...flags('issue', 'no-issue'), ...branching }, maxArgs: 1, effect: 'plan' },
  { id: 'increment list', summary: 'List Increments with status, owner, size, linked pull requests and issues.', options: values('status'), maxArgs: 0, effect: 'read' },
  { id: 'increment show', summary: 'Show one Increment: frontmatter, sections, acceptance criteria, links, validation and allowed transitions.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'increment edit', summary: 'Plan editing Increment fields or replacing a section (from --input Markdown).', options: values('title', 'owner', 'size', 'e2e', 'section', 'input'), maxArgs: 1, effect: 'plan' },
  { id: 'increment status', summary: 'Plan an Increment status transition; Ready requires the Definition of Ready.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment scope add', summary: 'Plan adding one In scope item to an Increment.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment out-of-scope add', summary: 'Plan adding one Out of scope item to an Increment.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment ac add', summary: 'Plan adding an acceptance criterion and its pending acceptance test stub.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment ac set', summary: 'Plan ticking, reopening, rewording or setting the evidence of an acceptance criterion.', options: values('status', 'text', 'evidence'), maxArgs: 2, effect: 'plan' },
  { id: 'increment ref add', summary: 'Plan adding a reference (path or [[wikilink]]) to the Increment refs.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment attach', summary: 'Plan moving a New pull request to another Increment, updating both Increments.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'increment validate', summary: 'Validate one or all Increments, their pull requests and issues: structure, links and list drift.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'increment check', summary: 'Run the Definition of Ready or Done for one Increment; blocked (exit 1) with the refinement brief when it does not pass.', options: values('gate', 'base'), maxArgs: 1, effect: 'read' },
  { id: 'increment complete', summary: 'Plan the Definition of Done outputs (Completion record, changelog, docs index) and status Done.', options: values('base'), maxArgs: 1, effect: 'plan' },
  { id: 'pr new', summary: 'Plan a change pull request of an Increment, stacked on the increment branch; optionally create its branch.', options: { ...values('id', 'title', 'summary', 'head', 'base', 'delivers', 'input'), ...branching }, maxArgs: 1, effect: 'plan' },
  { id: 'pr list', summary: 'List planned pull requests with kind, status, branches and publication.', options: values('increment', 'status'), maxArgs: 0, effect: 'read' },
  { id: 'pr show', summary: 'Show one planned pull request from its local document; never contacts the hosting platform.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'pr edit', summary: 'Plan editing a New pull request: title, branches, summary or a section.', options: values('title', 'summary', 'head', 'base', 'section', 'input'), maxArgs: 1, effect: 'plan' },
  { id: 'pr status', summary: 'Plan closing or reopening an unpublished pull request (New or Closed).', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr task add', summary: 'Plan adding a task (T-n) to a pull request.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr task set', summary: 'Plan ticking, reopening or rewording a task.', options: values('status', 'text'), maxArgs: 2, effect: 'plan' },
  { id: 'pr doc add', summary: 'Plan linking a repository Markdown document under Documents.', options: values('label'), maxArgs: 2, effect: 'plan' },
  { id: 'pr scope add', summary: 'Plan adding one In scope item to a New pull request.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr out-of-scope add', summary: 'Plan adding one Out of scope item to a New pull request.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr notes', summary: 'Plan appending to (or with --replace replacing) the Notes of a New pull request.', options: { ...values('input'), replace: 'flag' }, maxArgs: 1, effect: 'plan' },
  { id: 'pr amend', summary: 'Plan appending a dated amendment (A-n) to a published pull request.', options: values('input'), maxArgs: 2, effect: 'plan' },
  { id: 'pr issue add', summary: 'Plan linking an issue the pull request resolves (both documents).', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'pr validate', summary: 'Validate one or all pull-request documents: structure, delivered criteria and links.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'pr publish', summary: 'Publish a New pull request as a draft on GitHub or Azure DevOps; previews the remote first and pushes its head only on apply.', options: { ...values('platform'), 'no-push': 'flag' }, maxArgs: 1, effect: 'remote' },
  { id: 'pr sync', summary: 'Three-way sync of a published pull request with the hosting platform (tasks, amendments, status).', options: values('prefer', 'resolutions'), maxArgs: 1, effect: 'remote' },
  { id: 'issue new', summary: 'Plan a new Issue of an Increment and link it from the Increment.', options: values('id', 'title', 'summary', 'input'), maxArgs: 1, effect: 'plan' },
  { id: 'issue list', summary: 'List Issues with status and Increment.', options: values('increment', 'status'), maxArgs: 0, effect: 'read' },
  { id: 'issue show', summary: 'Show one Issue with its criteria and validation.', options: {}, maxArgs: 1, effect: 'read' },
  { id: 'issue edit', summary: 'Plan editing an Issue title, summary or section.', options: values('title', 'summary', 'section', 'input'), maxArgs: 1, effect: 'plan' },
  { id: 'issue status', summary: 'Plan an Issue status transition; Done needs every criterion ticked.', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'issue ac add', summary: 'Plan adding an own criterion (IC-n) or a reference to an Increment criterion (AC-n).', options: {}, maxArgs: 2, effect: 'plan' },
  { id: 'issue ac set', summary: 'Plan ticking, reopening or rewording an Issue criterion.', options: values('status', 'text'), maxArgs: 2, effect: 'plan' },
];
