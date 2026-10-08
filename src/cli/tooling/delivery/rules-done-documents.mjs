/**
 * Definition of Done rules that depend on the pull request kind. A change pull request (base = the increment
 * branch) completes its PullRequest document: its tasks, the criteria it `delivers` and an increment still In
 * progress. The kick-off (head = the increment branch) completes the Increment: every other pull request and
 * every issue of the increment is closed. `context.scope` is { kind, branches, pullRequest } from documents.mjs.
 */
import { acceptanceCriteria, taskItems } from './handoff.mjs';
import { belongsTo, entries, kindOf } from './documents.mjs';
import { evidencePath, fail, increment, known, pass, pullRequest, skip } from './rules-common.mjs';

const current = context => context.scope?.pullRequest ?? null;
const noDocument = () => skip('No PullRequest document for this change (see DOD-12).');

export const documentDoneRules = {
  'DOD-12': { title: 'PullRequest document of this change', appliesTo: pullRequest, params: {},
    run: context => {
      if (!context.handoff) return skip('No handoff to check (see DOD-01).');
      const document = current(context); const { branch } = context.scope.branches;
      if (!document) return fail(`No single PullRequest document of ${context.handoff.path} has base ${branch}${context.refs?.head ? ` and head ${context.refs.head}` : ''}.`,
        `Add docs/pull-requests/<id>.md with \`increment\`, \`kind: change\`, \`base: ${branch}\` and \`head: <this branch>\` (node bin/app pr new does it), and list it in the Increment.`, context.scope.candidates);
      return kindOf(document) === 'change' ? pass(`${document.path} (change into ${branch}).`)
        : fail(`${document.path} has kind ${kindOf(document)}, but it merges into the increment branch.`, 'Set `kind: change`: only the kick-off merges the increment branch into its base.');
    } },
  'DOD-13': { title: 'Pull request tasks done', appliesTo: pullRequest, params: {},
    run: context => {
      const document = current(context);
      if (!document) return noDocument();
      const items = taskItems(document.model.section('Tasks')).filter(item => item.valid);
      const open = items.filter(item => !item.checked).map(item => `${item.id}: ${item.text}`);
      if (!items.length) return fail(`${document.path} lists no tasks.`, 'List the tasks of this pull request as "- [x] T-n: task" under ## Tasks.');
      return open.length ? fail(`${open.length} of ${items.length} task(s) are open in ${document.path}.`, 'Finish each task and tick it ("- [x] T-n: …"), or move it to another pull request document.', open) : pass(`${items.length} task(s) done.`);
    } },
  'DOD-14': { title: 'Delivered criteria checked with evidence', appliesTo: pullRequest, params: { label: 'string' },
    run: (context, params) => {
      const document = current(context);
      if (!document || !context.handoff) return noDocument();
      const delivers = entries(document.data.delivers);
      if (!delivers.length) return pass(`${document.path} delivers no acceptance criterion.`);
      const criteria = new Map(acceptanceCriteria(context.handoff.model.section('Acceptance criteria'), params.label).filter(item => item.valid).map(item => [item.id, item]));
      const problems = delivers.flatMap(id => {
        const item = criteria.get(id);
        if (!item) return [`${id} is not an acceptance criterion of ${context.handoff.path}`];
        return [...(item.checked ? [] : [`${id} is not checked`]), ...(item.evidence.length ? [] : [`${id} names no ${params.label} \`path\``]),
          ...item.evidence.filter(path => !known(context.files, evidencePath(path))).map(path => `${id}: evidence ${path} does not exist`)];
      });
      return problems.length ? fail('Delivered criteria lack checks or evidence.', `Tick each delivered criterion in ${context.handoff.path} and append "${params.label} \`tests/…\`" naming an existing test.`, problems)
        : pass(`${delivers.length} delivered criteria checked with existing evidence.`);
    } },
  'DOD-15': { title: 'Increment still in progress', appliesTo: pullRequest, params: { status: 'string' }, statusParams: { status: 'handoff' },
    run: (context, params) => {
      if (!context.handoff) return skip('No handoff to check (see DOD-01).');
      const status = context.handoff.model.frontmatter.data.status;
      return status === params.status ? pass(`Increment status is ${params.status}.`)
        : fail(`Increment status is ${status ?? 'missing'}, not ${params.status}.`, `A change pull request merges into the increment branch; keep \`status: ${params.status}\` until the kick-off pull request completes the increment.`);
    } },
  'DOD-16': { title: 'Pull request completion record present', appliesTo: pullRequest, params: {},
    run: context => {
      const document = current(context);
      if (!document) return noDocument();
      const name = context.delivery.pullRequests.generatedSection;
      return document.model.section(name) ? pass(`## ${name} is present in ${document.path}.`) : fail(`## ${name} is missing in ${document.path}.`, 'Run `npm run dod -- --write` on this branch to generate it.');
    } },
  'DOD-17': { title: 'Increment pull requests and issues closed', appliesTo: increment, params: { pullRequestStatuses: 'string[]', issueStatuses: 'string[]' },
    statusParams: { pullRequestStatuses: 'pullRequests', issueStatuses: 'issues' },
    run: (context, params) => {
      if (!context.handoff) return skip('No handoff to check (see DOD-01).');
      const { delivery, handoff } = context; const head = context.refs?.head;
      const pulls = (context.documents?.pullRequests ?? []).filter(item => belongsTo(delivery, delivery.pullRequests, item, handoff.path) && kindOf(item) !== 'kickoff' && !(head && item.data.head === head));
      const issues = (context.documents?.issues ?? []).filter(item => belongsTo(delivery, delivery.issues, item, handoff.path));
      const open = [...pulls.filter(item => !params.pullRequestStatuses.includes(item.data.status)).map(item => `${item.path}: ${item.data.status ?? 'no status'}`),
        ...issues.filter(item => !params.issueStatuses.includes(item.data.status)).map(item => `${item.path}: ${item.data.status ?? 'no status'}`)];
      return open.length ? fail(`${open.length} pull request or issue document(s) of the increment are still open.`, `Merge or close every change pull request (${params.pullRequestStatuses.join('/')}) and finish or cancel every issue (${params.issueStatuses.join('/')}) before completing the increment.`, open)
        : pass(`${pulls.length} pull request(s) and ${issues.length} issue(s) closed.`);
    } },
};
