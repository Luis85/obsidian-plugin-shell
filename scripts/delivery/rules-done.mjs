/**
 * Definition of Done rules. Pure like the ready rules; the context adds the diff (files with status and added
 * lines), a text reader for changed files, the pull-request labels (null when unknown) and the ids of the
 * Definition of Ready rules that still fail.
 */
import { posix } from 'node:path';
import { acceptanceCriteria, affectedAreas, changelogEntries, docsImpact, testPlan } from './handoff.mjs';
import { matchesAny } from './paths.mjs';
import { fail, increment, known, pass, skip } from './rules-ready.mjs';
import { parseChangelog, validateChangelog } from '../release/changelog.mjs';

const noHandoff = () => skip('No handoff to check (see DOD-01).');
const changed = context => context.diff.filter(file => file.status !== 'D');
const changedPaths = context => new Set(changed(context).map(file => file.path));
const section = (context, name) => context.handoff.model.section(name);
const normalize = text => text.replace(/\s+/g, ' ').trim();
const evidencePath = value => value.replace(/#.*$/, '').replace(/:\d+(?::\d+)?$/, '');

/** Unreleased bullets by category: Map("Added" -> Set(normalized text)). */
function unreleasedEntries(text) {
  const model = parseChangelog(text); const unreleased = model.sections.find(item => item.unreleased);
  const entries = new Map(); let category = null;
  for (const line of unreleased ? model.lines.slice(unreleased.start + 1, unreleased.end) : []) {
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) { category = heading[1].trim(); entries.set(category, entries.get(category) ?? new Set()); continue; }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet && category) entries.get(category).add(normalize(bullet[1]));
  }
  return entries;
}
/** Handoff changelog entries missing from the Unreleased section. */
export function missingChangelogEntries(changelogText, entries) {
  const present = unreleasedEntries(changelogText ?? '');
  return entries.filter(entry => !present.get(entry.category)?.has(normalize(entry.text)));
}
const typeMarker = (text, marker) => text.split('\n').map(line => new RegExp(marker, 'u').exec(line)).find(Boolean)?.[1] ?? null;

export const doneRules = {
  'DOD-01': { title: 'Definition of Ready still passes', appliesTo: increment, params: {},
    run: context => context.handoff ? (context.readyFailures.length ? fail(`Definition of Ready fails: ${context.readyFailures.join(', ')}.`, 'Run `npm run dor` and fix the handoff first.', context.readyFailures) : pass('Every Definition of Ready error rule passes.'))
      : fail(context.handoffProblem.message, context.handoffProblem.hint) },
  'DOD-02': { title: 'Acceptance criteria checked with evidence', appliesTo: increment, params: { label: 'string' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const items = acceptanceCriteria(section(context, 'Acceptance criteria'), params.label).filter(item => item.valid);
      const problems = items.flatMap(item => [
        ...(item.checked ? [] : [`${item.id} is not checked`]),
        ...(item.evidence.length ? [] : [`${item.id} names no ${params.label} \`path\``]),
        ...item.evidence.filter(path => !known(context.files, evidencePath(path))).map(path => `${item.id}: evidence ${path} does not exist`)]);
      return problems.length ? fail('Acceptance criteria lack checks or evidence.', `Tick each criterion ("- [x] AC-n: …") and append "${params.label} \`tests/…\`" naming an existing test, doc or report.`, problems) : pass(`${items.length} acceptance criteria checked with existing evidence.`);
    } },
  'DOD-03': { title: 'Code changes come with tests', appliesTo: increment, params: { sourceRoots: 'string[]', testRoots: 'string[]', ignore: 'string[]', noTestChange: 'regex' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const files = changed(context).map(file => file.path);
      const tests = files.filter(path => matchesAny(params.testRoots, path));
      const sources = files.filter(path => matchesAny(params.sourceRoots, path) && !matchesAny(params.ignore, path) && !tests.includes(path));
      if (!sources.length) return pass('No source change needs a test.');
      if (tests.length) return pass(`${sources.length} source and ${tests.length} test file(s) changed.`);
      return testPlan(section(context, 'Test plan'), { noTestChange: new RegExp(params.noTestChange, 'u') }).noTestChange ? pass('Source changed without tests; the test plan gives the reason.')
        : fail(`${sources.length} source file(s) changed without a test change.`, 'Add or update a test that proves the change, or state "- No test change — reason" in ## Test plan.', sources.slice(0, 10));
    } },
  'DOD-04': { title: 'Changelog updated', appliesTo: increment, params: { file: 'string', userFacingRoots: 'string[]' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const userFacing = changed(context).filter(file => matchesAny(params.userFacingRoots, file.path)).length;
      const entries = changelogEntries(section(context, 'Changelog'), context.categories);
      if (entries.none) return pass(`No changelog entry by decision (${userFacing} user-facing file(s) changed).`);
      const text = context.readText(params.file);
      const problems = [];
      if (!changedPaths(context).has(params.file)) problems.push(`${params.file} is not changed in this diff`);
      const validation = validateChangelog(text ?? '');
      if (!validation.ok) problems.push(...validation.diagnostics.map(item => `${params.file}:${item.line} ${item.code}`));
      problems.push(...missingChangelogEntries(text, entries.entries).map(entry => `missing under ### ${entry.category}: ${entry.text}`));
      return problems.length ? fail('The changelog does not carry the handoff entries.', 'Run `npm run dod -- --write` to add the entries to ## [Unreleased], then `node scripts/release/changelog.mjs check`.', problems) : pass(`${entries.entries.length} entr${entries.entries.length === 1 ? 'y' : 'ies'} in ## [Unreleased].`);
    } },
  'DOD-05': { title: 'Docs impact delivered and typed', appliesTo: increment, params: { marker: 'regex' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const impact = docsImpact(section(context, 'Docs impact'));
      if (impact.none) return pass('No docs impact by decision.');
      const paths = changedPaths(context);
      const problems = impact.items.flatMap(item => {
        if (!paths.has(item.target)) return [`${item.target} is not changed in this diff`];
        if (!item.target.startsWith('docs/') || !item.target.endsWith('.md')) return [];
        const found = typeMarker(context.readText(item.target) ?? '', params.marker);
        return found === item.type ? [] : [`${item.target} needs a "> Type: ${item.type}" line (found ${found ?? 'none'})`];
      });
      return problems.length ? fail('Documentation targets are not delivered.', 'Change each page listed under ## Docs impact and put "> Type: <type> · Part of the [docs index](…)" under its title.', problems) : pass(`${impact.items.length} docs target(s) changed and typed.`);
    } },
  'DOD-06': { title: 'New docs pages indexed', appliesTo: increment, params: { index: 'string', headings: 'map' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const added = new Set(context.diff.filter(file => file.status === 'A').map(file => file.path));
      const impact = docsImpact(section(context, 'Docs impact'));
      const pages = impact.items.filter(item => added.has(item.target) && item.target.startsWith('docs/') && item.target.endsWith('.md') && item.target !== params.index);
      const index = context.readText(params.index) ?? '';
      const missing = pages.filter(item => !index.includes(`](${posix.relative(posix.dirname(params.index), item.target)})`));
      return missing.length ? fail(`${missing.length} new page(s) are not in ${params.index}.`, `Run \`npm run dod -- --write\` to add rows under the matching Diataxis heading of ${params.index}.`, missing.map(item => `${item.target} (${item.type})`)) : pass(pages.length ? `${pages.length} new page(s) indexed.` : 'No new docs page.');
    } },
  'DOD-07': { title: 'No forbidden additions', appliesTo: increment, params: { patterns: 'patterns' },
    run: (context, params) => {
      const found = [];
      for (const file of changed(context)) for (const rule of params.patterns) {
        if (!matchesAny(rule.include, file.path) || matchesAny(rule.exclude, file.path)) continue;
        const pattern = new RegExp(rule.regex, 'u');
        for (const line of file.added ?? []) if (pattern.test(line.text)) found.push(`${file.path}:${line.line} ${rule.id}`);
      }
      return found.length ? fail(`${found.length} forbidden addition(s).`, 'Remove the debugging output, focused tests and follow-up markers the patterns name; track follow-ups in a task instead.', found.slice(0, 20)) : pass('No forbidden pattern in added lines.');
    } },
  'DOD-08': { title: 'Affected areas cover the diff', appliesTo: increment, params: { alwaysCovered: 'string[]', maxListed: 'number' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const areas = affectedAreas(section(context, 'Affected areas')).map(area => area.pattern).filter(Boolean);
      const outside = changed(context).map(file => file.path).filter(path => path !== context.handoff.path && !params.alwaysCovered.includes(path) && !matchesAny(areas, path));
      return outside.length ? fail(`${outside.length} changed file(s) are outside the affected areas.`, 'Add the paths or globs to ## Affected areas, or move the unrelated change to its own pull request.', outside.slice(0, params.maxListed)) : pass('Every changed file is inside an affected area.');
    } },
  'DOD-09': { title: 'Increment status done', appliesTo: increment, params: { status: 'string' }, statusParams: ['status'],
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const status = context.handoff.model.frontmatter.data.status;
      return status === params.status ? pass(`Status is ${params.status}.`) : fail(`Status is ${status ?? 'missing'}, not ${params.status}.`, `Run \`npm run dod -- --write\`: it sets \`status: ${params.status}\` once every other error rule passes.`);
    } },
  'DOD-10': { title: 'E2E label matches the decision', appliesTo: increment, params: { label: 'string', env: 'string' },
    run: (context, params) => {
      if (!context.handoff) return noHandoff();
      const decision = context.handoff.model.frontmatter.data.e2e;
      if (decision !== 'required') return pass(`e2e is ${decision ?? 'unset'}; the \`${params.label}\` label is not required.`);
      if (context.labels === null) return { status: 'warn', message: `Cannot verify the \`${params.label}\` label locally (${params.env} is not set).`, hint: `Add the \`${params.label}\` label to the pull request so the Integration tier runs the e2e steps.` };
      return context.labels.includes(params.label) ? pass(`e2e is required and the \`${params.label}\` label is set.`)
        : fail(`e2e is required but the pull request has no \`${params.label}\` label.`, `Add the \`${params.label}\` label to the pull request; the Integration tier then runs the e2e steps.`);
    } },
  'DOD-11': { title: 'Completion record present', appliesTo: increment, params: {},
    run: context => {
      if (!context.handoff) return noHandoff();
      const name = context.delivery.handoff.generatedSection;
      return section(context, name) ? pass(`## ${name} is present.`) : fail(`## ${name} is missing.`, `Run \`npm run dod -- --write\` to generate it (CI shows the same content in the job summary).`);
    } },
};
