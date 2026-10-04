/**
 * Definition of Ready rules. Each rule is pure: run(context, params) reads only the injected context
 * (parsed handoff, delivery config, repository file list, suites and npm scripts) and returns
 * { status: pass|fail|skip, message, hint?, details? }. `questions` feed the refinement brief.
 * The Increment rules live here; the PullRequest and Issue rules in rules-ready-documents.mjs and the
 * acceptance stub rules in rules-acceptance.mjs.
 */
import { acceptanceCriteria, affectedAreas, bodyText, changelogEntries, docsImpact, listItems, prose, subsection, testPlan, wikilinks, words } from './handoff.mjs';
import { isGlob, matchesAny, matchesPath, safeRelative, staticPrefix } from './paths.mjs';
import { fail, frontmatterProblems, increment, known, list, pass, resolveWikilink, skip } from './rules-common.mjs';
import { documentReadyRules } from './rules-ready-documents.mjs';
import { acceptanceReadyRules } from './rules-acceptance.mjs';

export { resolveWikilink } from './rules-common.mjs';
const noHandoff = () => skip('No handoff to check (see DOR-01).');
const section = (context, name) => context.handoff.model.section(name);
const underRoot = (roots, path) => roots.some(root => path.startsWith(root));

function handoffProblems(context, params) {
  const settings = context.delivery.handoff; const data = context.handoff.model.frontmatter.data;
  const problems = frontmatterProblems(context.handoff.model.frontmatter, context.handoff.path, settings, { ...params, slugPattern: settings.slugPattern, maxSlugLength: settings.maxSlugLength });
  const enums = [['size', Object.keys(context.delivery.sizes)], ['e2e', settings.e2e]];
  for (const [key, allowed] of enums) if (data[key] && !allowed.includes(data[key])) problems.push(`${key} must be one of ${allowed.join(', ')}`);
  return problems;
}

function gateCommand(context, command, prefixes) {
  const npm = /^npm run ([\w:.-]+)/.exec(command);
  if (npm) return Object.hasOwn(context.scripts, npm[1]);
  const node = /^node\s+((?:--[\w-]+(?:=\S+)?\s+)*)(\S+)/.exec(command);
  if (node && !node[2].startsWith('-')) return known(context.files, node[2]);
  return prefixes.some(prefix => command.startsWith(prefix));
}
function areaProblem(context, pattern, roots) {
  if (!pattern) return 'is not a backticked path or glob';
  if (!safeRelative(pattern)) return 'is not a repository-relative path';
  if (isGlob(pattern)) return context.files.some(file => matchesPath(pattern, file)) || underRoot(roots, staticPrefix(pattern)) ? null : 'matches no file and is outside the roots allowed for new files';
  return known(context.files, pattern) || underRoot(roots, pattern) ? null : 'does not exist and is outside the roots allowed for new files';
}

const incrementReadyRules = {
  'DOR-01': { title: 'Handoff present and unique', appliesTo: increment, params: {},
    questions: ['Which increment does this pull request deliver?', 'Where is its handoff document (docs/increments/<slug>.md), and is it the only one in this pull request?'],
    run: context => context.handoff ? pass(`Handoff ${context.handoff.path} (${context.handoff.source}).`) : fail(context.handoffProblem.message, context.handoffProblem.hint) },
  'DOR-02': { title: 'Frontmatter valid', appliesTo: increment, params: { allowUnknownKeys: 'boolean' },
    questions: ['Who owns the increment and which slug names it?', 'Is it small (S), medium (M) or large (L)?', 'Do the browser end-to-end tests need to run for it (e2e: none, optional or required)?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const problems = handoffProblems(context, params);
      return problems.length ? fail(`Frontmatter has ${problems.length} problem(s).`, `Fix the frontmatter keys: ${list(problems, 3)}. The template is ${context.delivery.handoff.template}.`, problems) : pass('Frontmatter is valid.');
    } },
  'DOR-03': { title: 'Required sections present and non-empty', appliesTo: increment, params: { minWords: 'number' },
    questions: ['What is the outcome for a user or maintainer?', 'What are the risks, how is the change rolled back, and what does it depend on?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const missing = [], empty = [];
      for (const name of context.delivery.handoff.sections) {
        const found = section(context, name);
        if (!found) { missing.push(name); continue; }
        const text = prose(bodyText(found.lines)).trim().replace(/^[-*]\s+/, '');
        if (!/^None\b/.test(text) && words(text) < params.minWords) empty.push(name);
      }
      const details = [...missing.map(name => `missing: ## ${name}`), ...empty.map(name => `empty: ## ${name}`)];
      return details.length ? fail(`${missing.length} section(s) missing, ${empty.length} empty.`, `Add the sections with at least ${params.minWords} words each (or "None" with a reason); \`--write\` scaffolds missing sections from the template.`, details) : pass('Every required section has content.');
    } },
  'DOR-04': { title: 'No placeholders', appliesTo: increment, params: { patterns: 'regex[]' },
    questions: ['Which template placeholders still need real content?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const patterns = params.patterns.map(source => new RegExp(source, 'u'));
      const found = prose(context.handoff.model.lines.join('\n')).split('\n').flatMap((text, index) => patterns.filter(pattern => pattern.test(text)).map(pattern => `line ${index + 1}: ${pattern.exec(text)[0]}`));
      return found.length ? fail(`${found.length} placeholder(s) left.`, 'Replace every <placeholder> or to-be-decided marker with the decided content, or move the question to ## Open questions.', found) : pass('No placeholders left.');
    } },
  'DOR-05': { title: 'Acceptance criteria', appliesTo: increment, params: { min: 'number', max: 'number' },
    questions: ['How will a reviewer observe that the increment works?', 'Which rejection, failure or recovery case must hold?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const items = acceptanceCriteria(section(context, 'Acceptance criteria'));
      const ids = items.filter(item => item.valid).map(item => item.id);
      const problems = [...items.filter(item => !item.valid).map(item => `line ${item.line}: "${item.text}" is not "[ ] AC-n: text"`),
        ...ids.filter((id, index) => ids.indexOf(id) !== index).map(id => `duplicate ${id}`)];
      if (ids.length < params.min || ids.length > params.max) problems.push(`${ids.length} criteria; between ${params.min} and ${params.max} are allowed`);
      return problems.length ? fail('Acceptance criteria are malformed or out of range.', 'Write one "- [ ] AC-n: observable behavior" per criterion with unique ids.', problems) : pass(`${ids.length} acceptance criteria with unique ids.`);
    } },
  'DOR-06': { title: 'Scope bounded', appliesTo: increment, params: { inScope: 'string', outOfScope: 'string' },
    questions: ['What is explicitly included?', 'What is explicitly not part of this increment?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const scope = section(context, 'Scope');
      const empty = [params.inScope, params.outOfScope].filter(name => words(bodyText(subsection(scope, name)?.lines ?? [])) === 0);
      return empty.length ? fail(`Scope lacks ${empty.map(name => `### ${name}`).join(' and ')}.`, `Add "### ${params.inScope}" and "### ${params.outOfScope}" lists under ## Scope; an explicit non-goal keeps reviews short.`, empty) : pass('In scope and out of scope are both stated.');
    } },
  'DOR-07': { title: 'Open questions resolved', appliesTo: increment, params: { resolved: 'regex' },
    questions: ['Which open question blocks implementation, and who decides it?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const text = prose(bodyText(section(context, 'Open questions')?.lines ?? [])).trim().replace(/^[-*]\s+/, '');
      return new RegExp(params.resolved, 'u').test(text) ? pass('No open questions.') : fail('Open questions remain.', 'Resolve each question (record the decision in the relevant section) and write "None" under ## Open questions.', listItems(section(context, 'Open questions')?.lines ?? []).map(item => item.text));
    } },
  'DOR-08': { title: 'Affected areas exist', appliesTo: increment, params: { newFileRoots: 'string[]' },
    questions: ['Which folders and files will change?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const areas = affectedAreas(section(context, 'Affected areas'));
      const problems = areas.map(area => [area, areaProblem(context, area.pattern, params.newFileRoots)]).filter(([, problem]) => problem).map(([area, problem]) => `line ${area.line}: ${area.pattern ?? area.text} ${problem}`);
      if (!areas.length) problems.push('no affected areas listed');
      return problems.length ? fail('Affected areas are missing or unknown.', `List each changing path or glob in backticks; new files must sit under ${list(params.newFileRoots, 4)}.`, problems) : pass(`${areas.length} affected area(s) resolve.`);
    } },
  'DOR-09': { title: 'Test plan names real suites and gates', appliesTo: increment, params: { minEntries: 'number', commandPrefixes: 'string[]' },
    questions: ['Which test suites and gates prove the acceptance criteria?', 'Which new test files will be written?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const plan = testPlan(section(context, 'Test plan'));
      const problems = [...plan.suites.filter(item => !context.suites.includes(item.value)).map(item => `line ${item.line}: unknown suite ${item.value}`),
        ...plan.gates.filter(item => !gateCommand(context, item.value, params.commandPrefixes)).map(item => `line ${item.line}: unknown gate ${item.value}`),
        ...plan.newTests.filter(item => !safeRelative(item.value) || !/(?:^tests\/|\.(?:test|spec)\.ts$|\.checks\.mjs$)/.test(item.value)).map(item => `line ${item.line}: ${item.value} is not a test path`)];
      if (plan.entries < params.minEntries) problems.push(`${plan.entries} entries; at least ${params.minEntries} required`);
      return problems.length ? fail('The test plan does not name real suites or gates.', 'Use "- Suite `name`: why" (names from tests/suites.json), "- Gate `npm run …` or `node …`: why", "- New test `tests/…`: why" or "- No test change — reason".', problems) : pass(`${plan.suites.length} suite(s), ${plan.gates.length} gate(s), ${plan.newTests.length} new test(s).`);
    } },
  'DOR-10': { title: 'Docs impact typed', appliesTo: increment, params: { types: 'string[]' },
    questions: ['Which documentation page changes, and is it a tutorial, how-to, reference or explanation?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const impact = docsImpact(section(context, 'Docs impact'));
      if (impact.none) return pass('No docs impact (reason given).');
      const problems = [...impact.invalid.map(item => `line ${item.line}: "${item.text}" is not "\`path\` (type): note"`),
        ...impact.items.filter(item => !params.types.includes(item.type)).map(item => `line ${item.line}: type ${item.type} is not ${params.types.join('|')}`),
        ...impact.items.filter(item => !safeRelative(item.target)).map(item => `line ${item.line}: ${item.target} is not a repository path`)];
      if (!impact.items.length) problems.push('no target listed');
      return problems.length ? fail('Docs impact lacks a typed target.', 'Write "- `docs/path.md` (how-to): what changes" per page, or "None — reason".', problems) : pass(`${impact.items.length} docs target(s) typed.`);
    } },
  'DOR-11': { title: 'Changelog entry valid', appliesTo: increment, params: {},
    questions: ['How would a user describe this change in one sentence, and is it Added, Changed, Fixed, Deprecated, Removed or Security?'],
    run: context => {
      if (!context.handoff) return noHandoff();
      const entries = changelogEntries(section(context, 'Changelog'), context.categories);
      if (entries.none) return pass('No changelog entry (reason given).');
      const problems = entries.invalid.map(item => `line ${item.line}: "${item.text}" is not "Category: text"`);
      if (!entries.entries.length) problems.push('no entry');
      return problems.length ? fail('The changelog entry is not valid.', `Write "- Added: one user-facing sentence" (categories ${context.categories.join(', ')}) or "None — reason".`, problems) : pass(`${entries.entries.length} changelog entr${entries.entries.length === 1 ? 'y' : 'ies'}.`);
    } },
  'DOR-12': { title: 'Size budget', appliesTo: increment, params: {},
    questions: ['Can the increment be split into smaller pull requests, or is a larger size justified?'],
    run: context => {
      if (!context.handoff) return noHandoff();
      const budget = context.delivery.sizes[context.handoff.model.frontmatter.data.size];
      if (!budget) return skip('No valid size (see DOR-02).');
      const criteria = acceptanceCriteria(section(context, 'Acceptance criteria')).filter(item => item.valid).length;
      const areas = affectedAreas(section(context, 'Affected areas')).length;
      const problems = [...(criteria > budget.maxAcceptanceCriteria ? [`${criteria} acceptance criteria > ${budget.maxAcceptanceCriteria}`] : []), ...(areas > budget.maxAffectedAreas ? [`${areas} affected areas > ${budget.maxAffectedAreas}`] : [])];
      return problems.length ? fail('The increment exceeds its size budget.', 'Split the increment into smaller handoffs, or raise `size` when a larger review unit is deliberate.', problems) : pass(`Within the ${context.handoff.model.frontmatter.data.size} budget.`);
    } },
  'DOR-13': { title: 'References resolve', appliesTo: increment, params: { idPattern: 'regex', idRoots: 'string[]', externalPattern: 'regex' },
    questions: ['Which PRD, PBI, task or issue does this increment come from?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const refs = Array.isArray(context.handoff.model.frontmatter.data.refs) ? context.handoff.model.frontmatter.data.refs : [];
      const id = new RegExp(params.idPattern, 'u'), external = new RegExp(params.externalPattern, 'u');
      const link = /^\[\[([^\]]+)\]\]$/;
      const resolves = ref => link.test(ref) ? resolveWikilink(context.files, link.exec(ref)[1]) : external.test(ref) || (id.test(ref) ? context.files.some(file => underRoot(params.idRoots, file) && file.endsWith(`/${ref}.md`)) : safeRelative(ref) && known(context.files, ref.split('#')[0]));
      const body = wikilinks(context.handoff.model.lines.slice(context.handoff.model.frontmatter.end).join('\n'));
      const missing = [...refs.filter(ref => !resolves(ref)), ...body.filter(target => !resolveWikilink(context.files, target)).map(target => `[[${target}]]`)];
      return missing.length ? fail(`${missing.length} reference(s) do not resolve.`, 'Use an existing repository path, a [[wikilink]] to a Markdown file (path or basename), a requirement/task id with a file under docs/requirements, docs/tasks or docs/prds, an https URL or #123.', missing) : pass(`${refs.length + body.length} reference(s) resolve.`);
    } },
  'DOR-14': { title: 'E2E decision for UI areas', appliesTo: increment, params: { uiRoots: 'string[]', reasonPattern: 'regex' },
    questions: ['Does the change alter rendered UI, and must the browser end-to-end tests (the `e2e` label) run for it?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const areas = affectedAreas(section(context, 'Affected areas')).map(area => area.pattern).filter(Boolean);
      const ui = areas.filter(area => matchesAny(params.uiRoots, area) || context.files.some(file => matchesPath(area, file) && matchesAny(params.uiRoots, file)));
      if (!ui.length) return pass('No UI area affected.');
      const decision = context.handoff.model.frontmatter.data.e2e;
      const reason = testPlan(section(context, 'Test plan'), { e2e: new RegExp(params.reasonPattern, 'u') }).e2eReason;
      if (decision === 'none') return fail(`UI areas (${list(ui, 3)}) are affected but e2e is none.`, 'Set `e2e: optional` or `e2e: required` and explain it with "- E2E: reason" in ## Test plan.', ui);
      return reason ? pass(`UI areas affected; e2e ${decision} with a reason.`) : fail(`UI areas are affected but the test plan gives no E2E reason.`, 'Add "- E2E: why the browser tests are optional or required" to ## Test plan.', ui);
    } },
  'DOR-15': { title: 'Status reflects readiness', appliesTo: increment, params: { notReady: 'string[]' }, statusParams: { notReady: 'handoff' },
    questions: ['Has refinement finished, so that the Increment can move to Ready?'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const status = context.handoff.model.frontmatter.data.status;
      return params.notReady.includes(status) ? fail(`Status is ${status}.`, 'Set `status: Ready` once refinement is finished; the status is informational and these checks decide readiness.') : pass(`Status is ${status ?? 'unset'}.`);
    } },
};

/** Every Definition of Ready rule: the Increment rules, the PullRequest, Issue and link rules, then the acceptance stubs. */
export const readyRules = { ...incrementReadyRules, ...documentReadyRules, ...acceptanceReadyRules };
