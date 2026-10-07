/** Iteration planning builds on the canonical Increment, Issue and PullRequest records. */
import { OperationError, type Context, type Request } from '../framework/contracts.ts';
import { hash } from '../framework/files.ts';
import { branchNames } from '../../domain/increments/branches.ts';
import { editIncrement } from '../../domain/increments/increment-document.ts';
import { parseIssue } from '../../domain/increments/issue-document.ts';
import { setFrontmatterValue } from '../../domain/increments/frontmatter.ts';
import { ensureSection, findSection, outline, replaceSectionContent, sectionContent } from '../../domain/increments/sections.ts';
import { checkIncrementTransition } from '../../domain/increments/transitions.ts';
import { acceptanceStubPath } from '../../domain/increments/model.ts';
import { planBranch, runBranch } from '../../application/increments/git-port.ts';
import { Session, type SessionPlan } from './session.ts';
import { readiness } from './delivery-gates.ts';
import { branchStep, flag } from './inputs.ts';
import { planAcceptanceStubs } from './stubs.ts';

type Planner = (request: Request, context: Context) => Promise<SessionPlan>;
const document = (session: Session, id: string) => ({ kind: 'increment' as const, id, path: session.ws.path('increment', id) });
const link = (path: string) => `[[${path.replace(/\.md$/, '')}]]`;
function section(text: string, name: string, body: string): string {
  const prepared = ensureSection(text, name, [name]);
  return replaceSectionContent(prepared, findSection(outline(prepared), name)!, `\n${body.trim()}\n\n`);
}
function append(text: string, name: string, body: string): string {
  const found = findSection(outline(text), name);
  return section(text, name, `${found ? sectionContent(text, found).trim() : ''}\n\n${body}`);
}

const commit: Planner = async (request, context) => {
  const session = await Session.open(context), doc = await session.get('increment', request.args[0]);
  if (flag(request, 'branch') === flag(request, 'no-branch')) throw new OperationError('ITERATION_BRANCH_CHOICE_REQUIRED',
    'Choose --branch to create and switch to the iteration branch, or --no-branch for local planning.');
  const ready = await readiness(session.ws, doc.path, doc.text);
  if (ready.problems.length) throw new OperationError('INCREMENT_NOT_READY', ready.problems.map(problem => problem.message).join('\n'));
  const pulls = (await session.all('pullRequest')).filter(pull => pull.model.increment === doc.id);
  const kickoff = pulls.find(pull => pull.model.kind === 'kickoff');
  if (!kickoff || pulls.filter(pull => pull.model.kind === 'kickoff').length !== 1 || ['Closed', 'Merged'].includes(kickoff.model.status)) {
    throw new OperationError('ITERATION_KICKOFF_REQUIRED', 'Commitment needs exactly one open or planned kick-off pull request.');
  }
  if (doc.model.sections.some(item => item.name === 'Iteration commitment')) throw new OperationError('ITERATION_ALREADY_COMMITTED', 'This iteration already has a commitment record.');
  const to = doc.model.status === 'Ready' ? 'Ready' : checkIncrementTransition(doc.model.status, 'Ready', { pullRequests: [], readiness: ready.problems });
  const names = branchNames(session.ws.schema.branches, doc.id), name = doc.model.branch ?? names.increment, base = doc.model.base ?? names.base;
  if (pulls.some(pull => pull.model.kind !== 'kickoff' && pull.model.base !== name)) throw new OperationError('PR_BASE_MISMATCH', 'Every change pull request must target the iteration branch before commitment.');
  if (kickoff.model.head !== name || kickoff.model.base !== base) throw new OperationError('PR_BASE_MISMATCH', 'The kick-off must join the iteration branch to its configured base.');
  const git = session.ws.git, current = await git.currentBranch();
  if (flag(request, 'branch') && current !== base && current !== name) throw new OperationError('ITERATION_BASE_CHECKOUT_REQUIRED', `Check out ${base} before committing a new iteration, or ${name} to resume its branch.`);
  if (flag(request, 'branch') && !await git.indexClean()) throw new OperationError('GIT_INDEX_NOT_CLEAN', 'Commit or unstage existing staged changes before committing iteration records.');
  const branch = await planBranch(git, { name, starts: [base, `origin/${base}`], create: flag(request, 'branch'), switch: true, fetch: false });
  if (flag(request, 'branch') && !['planned', 'exists'].includes(branch.status)) throw new OperationError('GIT_UNAVAILABLE', 'The iteration branch cannot be created from its base.');
  if (branch.status === 'exists' && current !== name) throw new OperationError('ITERATION_BASE_CHECKOUT_REQUIRED', `Check out the existing ${name} branch before committing its plan.`);
  let text = setFrontmatterValue(doc.text, 'status', to);
  text = section(text, 'Iteration commitment', `Scope agreed after the Definition of Ready passed.\n\n- Branch: \`${name}\`\n- Base: \`${base}\`\n- Pull request: ${link(kickoff.path)}\n- Planning record SHA-256: \`${hash(doc.text)}\``);
  session.write(doc.path, text);
  const paths = [doc.path, ...pulls.map(pull => pull.path), ...(await session.all('issue')).filter(issue => issue.model.increment === doc.id).map(issue => issue.path)];
  for (const ac of doc.model.acceptance) {
    const path = acceptanceStubPath(session.ws.schema.acceptance, doc.id, ac.id);
    if (await session.ws.read(path) !== null) paths.push(path);
  }
  const snapshots = await Promise.all(paths.map(async path => ({ path, hash: hash((await session.ws.read(path))!) })));
  const extra = branch.status === 'exists' ? { steps: [{ kind: 'git-switch', name, commit: await session.ws.git.resolve(name) }], prepare: () => session.ws.git.switchBranch(name) }
    : branchStep(branch, plan => runBranch(session.ws.git, plan));
  if (flag(request, 'branch')) extra.steps = [...(extra.steps ?? []), { kind: 'git-commit-records', paths: snapshots, head: await git.resolve('HEAD'), current }];
  const finalize = flag(request, 'branch') ? async () => {
    for (const snapshot of snapshots) {
      const expected = snapshot.path === doc.path ? hash(text) : snapshot.hash;
      if (hash((await session.ws.read(snapshot.path)) ?? '') !== expected) throw new OperationError('ITERATION_COMMIT_FAILED', 'A planning record changed before its Git commit. Inspect the saved records and take a fresh review.');
    }
    if (await git.currentBranch() !== name) throw new OperationError('ITERATION_COMMIT_FAILED', 'The iteration records were saved, but the checkout changed before their commit. Inspect git status.');
    await git.commitPaths(paths, `Commit to iteration ${doc.id}`);
  } : undefined;
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: to,
    edits: [{ section: 'Iteration commitment', action: 'add' }], branch, readiness: ready.source, commitPaths: flag(request, 'branch') ? paths : [],
    next: flag(request, 'branch') ? `node bin/app pr publish ${kickoff.id} --dry-run` : 'Planning committed locally; no branch or hosted pull request was created.' }, { ...extra, ...(finalize ? { finalize } : {}) });
};

const present: Planner = async (request, context) => {
  const session = await Session.open(context), doc = await session.get('increment', request.args[0]);
  const issues = (await session.all('issue')).filter(issue => issue.model.increment === doc.id);
  const pulls = (await session.all('pullRequest')).filter(pull => pull.model.increment === doc.id);
  const rows = (done: boolean) => doc.model.acceptance.filter(ac => ac.checked === done).map(ac => `- ${ac.id}: ${ac.text}`).join('\n') || '- None.';
  const body = [`Iteration: ${link(doc.path)}`, '### Delivered criteria and evidence', rows(true), '### Unfinished criteria', rows(false),
    '### Work items', ...issues.map(issue => `- ${link(issue.path)} — ${issue.model.status}`),
    '### Pull requests', ...pulls.map(pull => `- ${link(pull.path)} — ${pull.model.status}${pull.model.binding ? ` — ${pull.model.binding.url}` : ''}`),
    '### Review decision', 'Review the delivered work and evidence. Approve and merge the kick-off, or close it and carry unfinished items into the next plan.'].join('\n\n');
  session.write(doc.path, section(doc.text, 'Iteration review', body));
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: doc.model.status,
    edits: [{ section: 'Iteration review', action: 'replace' }] });
};

const carryOver: Planner = async (request, context) => {
  const session = await Session.open(context), source = await session.get('increment', request.args[0]), target = await session.get('increment', request.args[1]);
  if (source.id === target.id || !['New', 'Refining'].includes(target.model.status)) throw new OperationError('ITERATION_CARRY_OVER_INVALID', 'Choose a different iteration still in planning (New or Refining).');
  const pulls = (await session.all('pullRequest')).filter(pull => pull.model.increment === source.id);
  if (!['Done', 'Cancelled'].includes(source.model.status) && !pulls.some(pull => pull.model.kind === 'kickoff' && ['Closed', 'Merged'].includes(pull.model.status))) {
    throw new OperationError('ITERATION_NOT_FINISHED', 'Finish or cancel the source iteration, or sync its closed/merged kick-off before carrying work forward.');
  }
  if (pulls.some(pull => ['Draft', 'Ready'].includes(pull.model.status))) throw new OperationError('INCREMENT_OPEN_PULL_REQUESTS', 'Sync and close or merge open pull requests before carrying items forward.');
  const issues = (await session.all('issue')).filter(issue => issue.model.increment === source.id && !['Done', 'Cancelled'].includes(issue.model.status));
  const mapping = new Map<string, string>(), copied: { from: string; to: string }[] = [];
  let targetText = target.text;
  for (const issue of issues) {
    const id = `${target.id.slice(0, session.ws.schema.handoff.maxSlugLength - 11).replace(/-$/, '')}-${hash(`${target.id}/${source.id}/${issue.id}`).slice(0, 10)}`;
    const marker = `Carried from ${link(issue.path)} in ${link(source.path)}.`;
    if (await session.exists('issue', id)) {
      const existing = await session.get('issue', id);
      if (existing.model.increment !== target.id || !existing.model.regions.notes.includes(marker)) throw new OperationError('ISSUE_EXISTS', `${existing.path} conflicts with the carry-over record.`);
      continue;
    }
    let text = setFrontmatterValue(setFrontmatterValue(setFrontmatterValue(issue.text, 'id', id), 'increment', target.id), 'status', 'New');
    text = setFrontmatterValue(text, 'pullRequests', []);
    const issueMapping = new Map<string, string>();
    for (const ac of issue.model.acceptance) {
      let criterionId = ac.id;
      if (ac.id.startsWith('AC-')) {
        const original = source.model.acceptance.find(item => item.id === ac.id);
        if (!original) throw new OperationError('ISSUE_DOCUMENT_INVALID', `${issue.id} refers to missing criterion ${ac.id}.`);
        if (!mapping.has(ac.id)) {
          const edited = editIncrement(targetText, { kind: 'ac-add', text: original.text.replace(/\s*Evidence:.*$/s, '') }, { schema: session.ws.schema });
          targetText = edited.text;
          mapping.set(ac.id, edited.created!.id);
        }
        criterionId = mapping.get(ac.id)!;
      }
      if (ac.id.startsWith('AC-')) issueMapping.set(ac.id, criterionId);
    }
    const lines = text.split('\n');
    for (const criterion of parseIssue(text).acceptance) {
      const mapped = issueMapping.get(criterion.id);
      if (mapped) lines[criterion.line - 1] = lines[criterion.line - 1]!.replace(/(\[)[ xX](\]\s+)AC-\d+:/, `$1 $2${mapped}:`);
    }
    text = lines.join('\n');
    text = append(text, 'Notes', marker);
    // Parse before planning so malformed authored frontmatter cannot become a silent copy.
    if (parseIssue(text).id !== id) throw new OperationError('ISSUE_DOCUMENT_INVALID', 'Could not construct the carry-over issue.');
    session.write(session.ws.path('issue', id), text);
    session.write(issue.path, append(issue.text, 'Notes', `Carried forward to ${link(session.ws.path('issue', id))} in ${link(target.path)}.`));
    copied.push({ from: issue.id, to: id });
  }
  if (!copied.length) throw new OperationError('INCREMENT_UNCHANGED', 'No unfinished issues remain to carry into this iteration.');
  session.write(target.path, append(targetText, 'Carry-over', `From ${link(source.path)}:\n\n${copied.map(item => `- ${link(session.ws.path('issue', item.to))}`).join('\n')}`));
  session.touch(target.id);
  const stubs = await planAcceptanceStubs(session, target.id);
  return session.plan({ document: document(session, target.id), statusBefore: target.model.status, statusAfter: target.model.status,
    edits: [{ section: 'Carry-over', action: 'add' }], copied, criteria: Object.fromEntries(mapping), stubs });
};

export const iterationPlanners: Record<string, Planner> = {
  'increment commit': commit, 'increment present': present, 'increment carry-over': carryOver,
};
