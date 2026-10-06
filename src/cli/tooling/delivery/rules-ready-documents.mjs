/**
 * Definition of Ready rules for the documents around an Increment: the PullRequest documents (one planned pull
 * request each) and Issue documents this pull request changes or is, and the Increment's links to them. A
 * pull request without such documents skips them, so increments written before the documents existed pass.
 */
import { acceptanceCriteria, bodyText, subsection, taskItems, wikilinks, words } from './handoff.mjs';
import { branchName, belongsTo, entries, incrementAt, incrementBranches, kindOf, referencePath } from './documents.mjs';
import { changeDocuments, fail, frontmatterProblems, increment, list, pass, pullRequest, resolveWikilink, skip } from './rules-common.mjs';

const settingsOf = (context, kind) => (kind === 'PullRequest' ? context.delivery.pullRequests : context.delivery.issues);
const listKey = kind => (kind === 'PullRequest' ? 'pullRequests' : 'issues');
const docLabel = kinds => kinds.join(' or ');

/** Runs `check(document, kind)` over the in-scope documents of the kinds; problems are prefixed with the path. */
function forDocuments(context, kinds, check, { passed, failed, hint }) {
  const documents = kinds.flatMap(kind => (context.inScope?.[kind] ?? []).map(document => [document, kind]));
  if (!documents.length) return skip(`No ${docLabel(kinds)} document changed in this pull request.`);
  const problems = documents.flatMap(([document, kind]) => check(document, kind).map(problem => `${document.path}: ${problem}`));
  return problems.length ? fail(failed(problems), hint, problems) : pass(passed(documents.length));
}
const incrementOf = (context, document, kind) => incrementAt(context.delivery, context.files, context.readText, document.data[settingsOf(context, kind).incrementKey]);
const criteriaOf = model => acceptanceCriteria(model.section('Acceptance criteria')).filter(item => item.valid).map(item => item.id);

function documentFrontmatter(context, document, kind, params) {
  const settings = settingsOf(context, kind); const data = document.data; const handoff = context.delivery.handoff;
  const problems = frontmatterProblems(document.model.frontmatter, document.path, settings, { allowUnknownKeys: params.allowUnknownKeys, slugPattern: handoff.slugPattern, maxSlugLength: handoff.maxSlugLength });
  if (kind === 'PullRequest' && typeof data.kind === 'string' && data.kind && !settings.kinds.includes(data.kind)) problems.push(`kind must be one of ${settings.kinds.join(', ')}`);
  const pattern = new RegExp(params.criterionPattern, 'u');
  for (const id of entries(data.delivers)) if (!pattern.test(id)) problems.push(`delivers: "${id}" is not an acceptance criterion id`);
  return problems;
}

function branchProblems(context, document) {
  const owner = incrementOf(context, document, 'PullRequest');
  if (!owner.exists) return [];
  const { branch, base } = incrementBranches(context.delivery, owner.model, owner.id);
  const { head, base: target } = document.data; const kind = kindOf(document); const problems = [];
  if (kind === 'kickoff' && head !== branch) problems.push(`a kick-off pull request has head ${branch} (the increment branch), not ${head}`);
  if (kind === 'kickoff' && target !== base) problems.push(`a kick-off pull request has base ${base}, not ${target}`);
  if (kind === 'change' && target !== branch) problems.push(`a change pull request has base ${branch} (the increment branch), not ${target}`);
  if (kind === 'change' && [branch, base].includes(head)) problems.push(`a change pull request needs its own head branch, such as ${branchName(context.delivery.branches.pullRequest, { increment: owner.id, pr: document.id })}`);
  const refs = context.refs ?? {};
  if (refs.head && refs.base && head === refs.head && target !== refs.base) problems.push(`this pull request targets ${refs.base}, but the document says base ${target}`);
  return problems;
}

function taskProblems(document, min) {
  const tasks = document.model.section('Tasks');
  if (!tasks) return ['## Tasks is missing'];
  const items = taskItems(tasks); const ids = items.filter(item => item.valid).map(item => item.id);
  return [...items.filter(item => !item.valid).map(item => `line ${item.line}: "${item.text}" is not "[ ] T-n: text"`),
    ...ids.filter((id, index) => ids.indexOf(id) !== index).map(id => `duplicate ${id}`),
    ...(ids.length < min ? [`${ids.length} task(s); at least ${min} required`] : [])];
}

function linkProblems(context, document, kind, external) {
  const body = wikilinks(document.model.lines.slice(document.model.frontmatter.end).join('\n'));
  const problems = body.filter(target => !resolveWikilink(context.files, target)).map(target => `[[${target}]] does not resolve`);
  const other = kind === 'PullRequest' ? 'Issue' : 'PullRequest'; const settings = settingsOf(context, other);
  for (const entry of entries(document.data[listKey(other)])) {
    if (external.test(entry)) continue;
    const path = referencePath(settings.glob, entry);
    if (!context.files.includes(path)) problems.push(`${listKey(other)}: ${entry} has no ${other} document ${path}`);
  }
  return problems;
}

function driftProblems(context, external) {
  const handoff = context.handoff; const data = handoff.model.frontmatter.data; const problems = [];
  const sources = [['pullRequests', context.delivery.pullRequests, context.documents?.pullRequests ?? []], ['issues', context.delivery.issues, context.documents?.issues ?? []]];
  for (const [key, settings, documents] of sources) {
    const listed = entries(data[key]).filter(entry => !external.test(entry)).map(entry => [entry, referencePath(settings.glob, entry)]);
    for (const [entry, path] of listed) {
      const document = documents.find(item => item.path === path);
      if (!document) problems.push(`${key}: ${entry} has no ${settings.type} document ${path}`);
      else if (!belongsTo(context.delivery, settings, document, handoff.path)) problems.push(`${key}: ${path} is not a ${settings.type} of this increment (type ${document.data.type ?? 'missing'}, increment ${document.data[settings.incrementKey] ?? 'missing'})`);
    }
    for (const document of documents.filter(item => belongsTo(context.delivery, settings, item, handoff.path) && !listed.some(([, path]) => path === item.path)))
      problems.push(`${document.path} names this increment but is not listed in ${key}`);
  }
  const kickoffs = (context.documents?.pullRequests ?? []).filter(item => kindOf(item) === 'kickoff' && belongsTo(context.delivery, context.delivery.pullRequests, item, handoff.path));
  if (kickoffs.length > 1) problems.push(`${kickoffs.length} kick-off pull requests: ${kickoffs.map(item => item.path).join(', ')}`);
  return problems;
}

export const documentReadyRules = {
  'DOR-16': { title: 'Document frontmatter valid', appliesTo: changeDocuments, params: { allowUnknownKeys: 'boolean', criterionPattern: 'regex' },
    questions: ['Which increment does each PullRequest or Issue document belong to, and what is its status?', 'Is the pull request the kick-off or a change, and which branches does it join?'],
    run: (context, params) => forDocuments(context, changeDocuments, (document, kind) => documentFrontmatter(context, document, kind, params), {
      passed: count => `${count} document frontmatter block(s) valid.`, failed: problems => `Document frontmatter has ${problems.length} problem(s).`,
      hint: `Fix the keys of each document: PullRequest needs ${list(context.delivery.pullRequests.requiredKeys, 8)}; Issue needs ${list(context.delivery.issues.requiredKeys, 8)}.` }) },
  'DOR-17': { title: 'Document listed by its increment', appliesTo: changeDocuments, params: {},
    questions: ['Does the Increment list every pull request and issue that delivers it?'],
    run: context => forDocuments(context, changeDocuments, (document, kind) => {
      const raw = document.data[settingsOf(context, kind).incrementKey];
      if (!raw || Array.isArray(raw)) return [];
      const owner = incrementOf(context, document, kind);
      if (!owner.exists) return [`increment ${raw} does not exist (${owner.path ?? 'no path'})`];
      return entries(owner.model.frontmatter.data[listKey(kind)]).some(entry => referencePath(settingsOf(context, kind).glob, entry) === document.path) ? [] : [`${owner.path} does not list ${document.id} in ${listKey(kind)}`];
    }, { passed: count => `${count} document(s) belong to an increment that lists them.`, failed: () => 'Documents name a missing increment or one that does not list them.',
      hint: 'Name an existing increment id in `increment:` and add the document id to the Increment `pullRequests: [...]` or `issues: [...]` list.' }) },
  'DOR-18': { title: 'Branches follow the increment', appliesTo: pullRequest, params: {},
    questions: ['Does the kick-off merge the increment branch into the base, and does each change pull request target the increment branch?'],
    run: context => forDocuments(context, pullRequest, document => branchProblems(context, document), {
      passed: count => `${count} pull request document(s) join the increment branches.`, failed: () => 'Pull request branches do not follow the increment.',
      hint: `The kick-off has head ${context.delivery.branches.increment} and base ${context.delivery.branches.base}; a change pull request has base ${context.delivery.branches.increment} and its own head (${context.delivery.branches.pullRequest}).` }) },
  'DOR-19': { title: 'Pull request tasks listed', appliesTo: pullRequest, params: { min: 'number' },
    questions: ['Which tasks complete this pull request (for the kick-off: which refinement tasks)?'],
    run: (context, params) => forDocuments(context, pullRequest, document => taskProblems(document, params.min), {
      passed: count => `${count} pull request document(s) list their tasks.`, failed: () => 'Pull request tasks are missing or malformed.',
      hint: 'Write one "- [ ] T-n: task" per task under ## Tasks with unique ids.' }) },
  'DOR-20': { title: 'Pull request scope bounded', appliesTo: pullRequest, params: { inScope: 'string', outOfScope: 'string' },
    questions: ['What does this pull request include, and what is explicitly left to other pull requests?'],
    run: (context, params) => forDocuments(context, pullRequest, document => [params.inScope, params.outOfScope]
      .filter(name => words(bodyText(subsection(document.model.section('Scope'), name)?.lines ?? [])) === 0).map(name => `### ${name} is missing or empty`), {
      passed: count => `${count} pull request document(s) state in and out of scope.`, failed: () => 'Pull request scope is not bounded.',
      hint: `Add "### ${params.inScope}" and "### ${params.outOfScope}" lists under ## Scope of each pull request document.` }) },
  'DOR-21': { title: 'Criteria exist in the increment', appliesTo: changeDocuments, params: {},
    questions: ['Which acceptance criteria of the increment does this pull request deliver or this issue cover?'],
    run: context => forDocuments(context, changeDocuments, (document, kind) => {
      const owner = incrementOf(context, document, kind);
      if (!owner.exists) return [];
      const ids = criteriaOf(owner.model);
      // A PullRequest names them in `delivers`; an Issue lists `- [ ] AC-n` references (its own criteria are IC-n).
      const named = kind === 'PullRequest' ? entries(document.data.delivers) : criteriaOf(document.model);
      return named.filter(id => !ids.includes(id)).map(id => `${kind === 'PullRequest' ? 'delivers' : 'references'} ${id}, which is not an acceptance criterion of ${owner.path}`);
    }, { passed: count => `${count} document(s) name only criteria of their increment.`, failed: () => 'Documents name criteria the increment does not have.',
      hint: 'List in `delivers: [AC-n]` (or as `- [ ] AC-n` in an Issue) only ids from the Increment ## Acceptance criteria; an Issue\'s own criteria are IC-n.' }) },
  'DOR-22': { title: 'Document links resolve', appliesTo: changeDocuments, params: { externalPattern: 'regex' },
    questions: ['Which documents does each pull request or issue link to, and do they exist?'],
    run: (context, params) => forDocuments(context, changeDocuments, (document, kind) => linkProblems(context, document, kind, new RegExp(params.externalPattern, 'u')), {
      passed: count => `${count} document(s) link only to existing files.`, failed: problems => `${problems.length} link(s) do not resolve.`,
      hint: 'Use [[wikilinks]] to existing Markdown files and list only existing issue or pull request ids (or #123 / an https URL for remote ones).' }) },
  'DOR-23': { title: 'Increment documents in sync', appliesTo: increment, params: { externalPattern: 'regex' },
    questions: ['Do the Increment lists and the documents that name it agree?'],
    run: (context, params) => {
      if (!context.handoff) return skip('No handoff to check (see DOR-01).');
      const problems = driftProblems(context, new RegExp(params.externalPattern, 'u'));
      return problems.length ? fail('The Increment and its pull request or issue documents drifted.', 'List each document in the Increment `pullRequests`/`issues` and name the Increment in its `increment:` field (both directions); keep one kick-off per increment.', problems)
        : pass('Pull request and issue lists match their documents.');
    } },
};
