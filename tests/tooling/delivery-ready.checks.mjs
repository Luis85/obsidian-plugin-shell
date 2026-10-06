import test from 'node:test';
import assert from 'node:assert/strict';
import { baseContext, configs, handoffPath, readyHandoff, results } from './delivery-fixture.mjs';
import { evaluate, exemption, runReady, selectHandoff } from '../../scripts/delivery/run.mjs';
import { readyRules, resolveWikilink } from '../../scripts/delivery/rules-ready.mjs';
import { humanReport, jsonReport, refinementBrief, refinementMarkdown, summaryMarkdown } from '../../scripts/delivery/report.mjs';

const config = await configs();
const ready = (text, overrides) => results('ready', config, baseContext(config, text, overrides));
const failing = outcome => Object.values(outcome).filter(rule => rule.status === 'fail').map(rule => rule.id);
const replace = (from, to) => readyHandoff().replace(from, to);

test('a complete handoff passes every Definition of Ready rule; without PullRequest or Issue documents their rules skip', () => {
  const outcome = ready(readyHandoff());
  assert.deepEqual(Object.keys(outcome), Object.keys(readyRules));
  assert.deepEqual(Object.values(outcome).filter(rule => rule.status !== 'pass').map(rule => `${rule.id}:${rule.status}`), ['DOR-16', 'DOR-17', 'DOR-18', 'DOR-19', 'DOR-20', 'DOR-21', 'DOR-22'].map(id => `${id}:skip`));
});

test('negative: each defect fails exactly its own rule with a hint', () => {
  const cases = [
    ['DOR-02', replace('type: Increment', 'type: increment-handoff')], ['DOR-02', replace('status: In progress', 'status: in-progress')], ['DOR-02', replace('id: sample-increment', 'id: other-name')],
    ['DOR-02', replace('size: S', 'size: XL')], ['DOR-02', replace('e2e: optional', 'e2e: maybe')], ['DOR-02', replace('owner: "Maintainer"\n', 'owner: "Maintainer"\nreviewer: x\n')],
    ['DOR-02', replace('owner: "Maintainer"\n', '')],
    ['DOR-03', replace('## Risks and rollback\n\nLow risk; revert the single commit to roll it back.', '## Risks and rollback\n\nLow.')],
    ['DOR-04', replace('for new users', 'for <audience>')], ['DOR-04', replace('for new users', 'for TBD users')],
    ['DOR-05', replace('- [ ] AC-2:', '- [ ] AC-1:')], ['DOR-05', replace('- [ ] AC-2: A failing', '- AC-2 A failing')],
    ['DOR-06', replace('- Translations of the greeting text.', '')],
    ['DOR-07', replace('## Open questions\n\nNone.', '## Open questions\n\n- Which palette group?')],
    ['DOR-08', replace('`docs/guide.md`: the usage page.', '`nowhere/file.md`: typo root.')], ['DOR-08', replace('`docs/guide.md`: the usage page.', '`../outside.md`: escape.')],
    ['DOR-09', replace('Suite `release`', 'Suite `relaese`')], ['DOR-09', replace('Gate `npm run check`', 'Gate `npm run chekc`')],
    ['DOR-09', replace('Gate `node scripts/tool.mjs --flag`', 'Gate `node scripts/missing.mjs`')], ['DOR-09', replace('New test `tests/greeting.checks.mjs`', 'New test `src/greeting.ts`')],
    ['DOR-10', replace('(how-to)', '(guide)')], ['DOR-10', replace('- `docs/guide.md` (how-to): explains the command.', '- docs/guide.md explains it.')],
    ['DOR-11', replace('- Added: A greeting', '- Improved: A greeting')], ['DOR-11', replace('- Added: A greeting command in the palette.', 'None')],
    ['DOR-13', replace('refs: [docs/prds/MVP.md', 'refs: [docs/prds/GONE.md')], ['DOR-13', replace('WB-PBI-001]', 'WB-PBI-999]')]];
  for (const [id, text] of cases) {
    const outcome = ready(text);
    assert.deepEqual(failing(outcome), [id], id);
    assert.ok(outcome[id].hint && outcome[id].message, `${id} explains the fix`);
  }
});

test('size budgets, missing sections and the template placeholders are reported with details', () => {
  const big = replace('size: S', 'size: S').replace('- [ ] AC-2:', ['- [ ] AC-2: b.', '- [ ] AC-3: c.', '- [ ] AC-4: d.', '- [ ] AC-5: e.', '- [ ] AC-6: f.', '- [ ] AC-7:'].map(line => line.endsWith('.') ? `${line} Evidence: \`tests/greeting.checks.mjs\`` : line).join('\n'));
  const outcome = ready(big);
  assert.deepEqual(failing(outcome), ['DOR-12']); assert.match(outcome['DOR-12'].details[0], /7 acceptance criteria > 5/);
  const cut = readyHandoff().replace(/## Dependencies[\s\S]*?## Open questions/, '## Open questions');
  assert.deepEqual(ready(cut)['DOR-03'].details, ['missing: ## Dependencies']);
});

test('the e2e decision is a warning when UI areas are affected, and quiet otherwise', () => {
  const ui = replace('`docs/guide.md`: the usage page.', '`src/presentation/view.vue`: the view.');
  assert.equal(ready(ui)['DOR-14'].status, 'pass');
  const none = ready(ui.replace('e2e: optional', 'e2e: none'));
  assert.equal(none['DOR-14'].status, 'warn'); assert.equal(none['DOR-14'].severity, 'warning'); assert.match(none['DOR-14'].hint, /e2e: optional/);
  assert.equal(ready(ui.replace('- E2E: optional because no rendered view changes.\n', ''))['DOR-14'].status, 'warn');
  assert.equal(ready(readyHandoff().replace('e2e: optional', 'e2e: none'))['DOR-14'].status, 'pass', 'no UI area, none is fine');
  assert.equal(ready(replace('`docs/guide.md`: the usage page.', '`src/**`: everything.').replace('e2e: optional', 'e2e: none'))['DOR-14'].status, 'warn', 'a broad glob covering UI files counts');
});

test('handoff selection: explicit, pull-request body, one in the diff, none or several; exemptions by branch and author', () => {
  const snapshot = { files: [handoffPath, 'docs/increments/other.md'], body: '', diff: [{ path: handoffPath, status: 'A' }, { path: 'docs/increments/README.md', status: 'A' }] };
  assert.deepEqual(selectHandoff(config.delivery, snapshot), { path: handoffPath, source: 'diff' });
  assert.deepEqual(selectHandoff(config.delivery, { ...snapshot, body: 'Intro\nHandoff: `docs/increments/other.md`\n' }), { path: 'docs/increments/other.md', source: 'pull request body' });
  assert.deepEqual(selectHandoff(config.delivery, snapshot, 'docs/increments/other.md').source, '--handoff');
  assert.match(selectHandoff(config.delivery, snapshot, 'docs/increments/gone.md').problem.message, /does not exist/);
  assert.match(selectHandoff(config.delivery, snapshot, 'src/x.md').problem.message, /not a handoff path/);
  assert.match(selectHandoff(config.delivery, { ...snapshot, diff: [] }).problem.hint, /increment:new/);
  assert.match(selectHandoff(config.delivery, { ...snapshot, diff: [{ path: handoffPath, status: 'M' }, { path: 'docs/increments/other.md', status: 'A' }] }).problem.message, /2 handoffs/);
  assert.match(exemption(config.delivery, { headRef: 'release/1.2.3' }), /exempt \(release\/\*\)/);
  assert.match(exemption(config.delivery, { headRef: 'dependabot/npm/x', actor: 'someone' }), /dependabot/);
  assert.match(exemption(config.delivery, { headRef: 'feature', actor: 'dependabot[bot]' }), /dependabot\[bot\]/);
  assert.equal(exemption(config.delivery, { headRef: 'feature/release/x', actor: 'person' }), null);
});

test('a not-ready run carries a refinement brief naming the skills, and --write scaffolds missing sections only', () => {
  const text = readyHandoff().replace(/## Risks and rollback[\s\S]*?## Open questions\n\nNone\.\n/, '## Open questions\n\n- Who decides the palette group?\n');
  const context = baseContext(config, text);
  const snapshot = { ...context, base: { ref: 'origin/main', sha: 'a'.repeat(40) }, body: '' };
  const written = [];
  const template = '---\n---\n## Risks and rollback\n\n<what could go wrong>\n\n## Dependencies\n\n<other pull requests or decisions>\n';
  const result = runReady({ delivery: config.delivery, rules: config.ready }, snapshot, { write: true }, { template: () => template, write: (path, body) => written.push([path, body]) });
  assert.equal(result.status, 'not-ready'); assert.deepEqual(result.generated.scaffolded, ['Risks and rollback', 'Dependencies']);
  assert.equal(written.length, 1); assert.ok(written[0][1].startsWith(text.trimEnd()), 'authored text is kept byte for byte');
  assert.match(written[0][1], /## Dependencies\n\n<other pull requests or decisions>\n$/);
  assert.deepEqual(result.refinement.skills, ['increment-handoff', 'ideation-brainstorm', 'ideation-concept']);
  assert.deepEqual(result.refinement.questions.map(item => item.rule), ['DOR-04', 'DOR-07']);
  const summary = summaryMarkdown(result);
  assert.match(summary, /## Definition of Ready: not-ready/); assert.match(summary, /### Refinement brief[\s\S]*`increment-handoff` skill/);
  assert.match(summary, /\| DOR-07 Open questions resolved \| error \| fail \|/); assert.match(summary, /### How to fix[\s\S]*\*\*DOR-07\*\*/);
  assert.match(refinementMarkdown(result), /^# Refinement brief: docs\/increments\/sample-increment\.md[\s\S]*Who decides|Which open question/);
  assert.match(humanReport(result), /FAIL {2}DOR-07[\s\S]*fix: Resolve each question/);
  const json = jsonReport(result);
  assert.equal(json.protocolVersion, 1); assert.equal(json.status, 'not-ready'); assert.equal(json.rules.length, Object.keys(readyRules).length);
  assert.deepEqual(Object.keys(json.rules[0]), ['id', 'title', 'severity', 'status', 'message', 'hint']);
  assert.equal(refinementBrief({ rules: [{ id: 'DOR-14', status: 'warn', severity: 'warning' }] }, readyRules, config.delivery), null, 'warnings alone need no refinement');
});

test('wikilinks in refs and the body resolve by path or basename; an unresolved one fails DOR-13', () => {
  const files = ['docs/prds/MVP.md', 'docs/requirements/WB-PBI-001.md', 'docs/increments/other-one.md'];
  for (const target of ['docs/prds/MVP', 'docs/prds/MVP.md', 'MVP', 'mvp|the PRD', 'WB-PBI-001#AC-1', 'other-one']) assert.equal(resolveWikilink(files, target), true, target);
  for (const target of ['docs/MVP', 'Missing', '', 'docs/requirements/WB-PBI-001.mdx']) assert.equal(resolveWikilink(files, target), false, target);
  const linked = replace('refs: [docs/prds/MVP.md, "#12", WB-PBI-001]', 'refs: [[[docs/prds/MVP]], "[[WB-PBI-001|PBI]]"]').replace('## Dependencies\n\nNone.', '## Dependencies\n\nBuilds on [[MVP]] and [[docs/requirements/WB-PBI-001.md|the PBI]]; `[[in code]]` is ignored.');
  assert.deepEqual(failing(ready(linked)), []); assert.match(ready(linked)['DOR-13'].message, /4 reference/);
  const broken = ready(linked.replace('Builds on [[MVP]]', 'Builds on [[Nowhere]]'));
  assert.deepEqual(failing(broken), ['DOR-13']); assert.deepEqual(broken['DOR-13'].details, ['[[Nowhere]]']); assert.match(broken['DOR-13'].hint, /wikilink/);
});

test('status vocabulary: New and Refining warn under DOR-15; rules declare the document kinds they apply to', () => {
  for (const status of ['New', 'Refining', 'Cancelled']) assert.equal(ready(replace('status: In progress', `status: ${status}`))['DOR-15'].status, 'warn', status);
  assert.equal(ready(replace('status: In progress', 'status: Ready'))['DOR-15'].status, 'pass');
  assert.deepEqual(Object.entries(readyRules).filter(([, rule]) => !rule.appliesTo.includes('Increment')).map(([id]) => id), ['DOR-16', 'DOR-17', 'DOR-18', 'DOR-19', 'DOR-20', 'DOR-21', 'DOR-22']);
  const other = evaluate(readyRules, config.ready, { ...baseContext(config), kinds: ['Issue'] });
  assert.ok(other.filter(rule => !['DOR-16', 'DOR-17', 'DOR-21', 'DOR-22'].includes(rule.id)).every(rule => rule.status === 'skip' && /this run checks Issue/.test(rule.message)), 'rules for other kinds skip');
});

test('a changed PullRequest document names the Increment through its increment field', () => {
  const pr = (value, type = 'PullRequest') => `---\ntype: ${type}\nstatus: Draft\nincrement: ${value}\n---\n\n# PR\n`;
  const texts = { 'docs/pull-requests/pr-1.md': pr('sample-increment'), 'docs/pull-requests/pr-2.md': pr('"[[docs/increments/sample-increment|Sample]]"'), 'docs/pull-requests/pr-3.md': pr('gone'), 'docs/pull-requests/pr-4.md': pr('sample-increment', 'Note') };
  const snapshot = (paths, files = [handoffPath]) => ({ files, body: '', readText: path => texts[path] ?? null, diff: paths.map(path => ({ path, status: 'M' })) });
  assert.deepEqual(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-1.md'])), { path: handoffPath, source: 'PullRequest document' });
  assert.deepEqual(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-1.md', 'docs/pull-requests/pr-2.md'])).path, handoffPath, 'id and wikilink name the same Increment');
  assert.match(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-3.md'])).problem.message, /gone\.md \(PullRequest document\) does not exist/);
  assert.match(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-1.md', 'docs/pull-requests/pr-3.md'])).problem.message, /2 handoffs/);
  assert.match(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-4.md'])).problem.message, /No handoff/, 'only PullRequest documents count');
  assert.deepEqual(selectHandoff(config.delivery, snapshot(['docs/pull-requests/pr-1.md', handoffPath], [handoffPath, 'docs/increments/other.md'])).source, 'diff', 'a changed Increment wins');
});
