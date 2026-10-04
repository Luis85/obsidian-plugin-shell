import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptanceCriteria, affectedAreas, changelogEntries, docsImpact, parseFrontmatter, parseHandoff, prose, testPlan, words } from '../../scripts/delivery/handoff.mjs';
import { globRegExp, matchesAny, matchesPath, safeRelative, staticPrefix } from '../../scripts/delivery/paths.mjs';
import { configFiles, loadConfig, validateDeliveryConfig, validateRulesConfig } from '../../scripts/delivery/config.mjs';
import { readyRules } from '../../scripts/delivery/rules-ready.mjs';
import { doneRules } from '../../scripts/delivery/rules-done.mjs';
import { categories } from '../../scripts/release/changelog.mjs';
import { read, readyHandoff, repositoryRoot } from './delivery-fixture.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

test('frontmatter accepts key: value, quoted strings and [lists] and reports every malformed line', () => {
  const parsed = parseFrontmatter(['---', 'id: a-b', 'title: "Quoted \\"x\\", y"', "owner: 'Single'", 'refs: [a.md, "#1", \'b\']', 'empty: []', '---', 'body']);
  assert.deepEqual(parsed.data, { id: 'a-b', title: 'Quoted "x", y', owner: 'Single', refs: ['a.md', '#1', 'b'], empty: [] });
  assert.equal(parsed.end, 7); assert.deepEqual(parsed.errors, []);
  const broken = parseFrontmatter(['---', 'id: a', 'id: b', 'no colon here', 'title: "open', '---']);
  assert.deepEqual(broken.errors.map(error => error.line), [3, 4, 5]);
  assert.equal(parseFrontmatter(['# no frontmatter']).present, false);
  assert.match(parseFrontmatter(['---', 'id: a']).errors[0].message, /no closing/);
});

test('sections, subsections and structured lists are read outside fences and comments', () => {
  const model = parseHandoff(readyHandoff({ checked: true }) + '\n```md\n## Not a section\n```\n');
  assert.equal(model.title, 'Sample increment');
  assert.deepEqual(model.sections.map(section => section.name).slice(0, 3), ['Summary', 'Outcome', 'Scope']);
  assert.equal(model.section('open questions').name, 'Open questions');
  assert.equal(model.section('Not a section'), null);
  const criteria = acceptanceCriteria(model.section('Acceptance criteria'));
  assert.deepEqual(criteria.map(item => [item.id, item.checked, item.evidence]), [['AC-1', true, ['tests/greeting.checks.mjs']], ['AC-2', true, ['tests/greeting.checks.mjs', 'docs/guide.md#usage']]]);
  assert.deepEqual(affectedAreas(model.section('Affected areas')).map(area => area.pattern), ['src/features/greeting/**', 'tests/greeting.checks.mjs', 'docs/guide.md']);
  const plan = testPlan(model.section('Test plan'));
  assert.deepEqual([plan.suites.map(item => item.value), plan.gates.length, plan.newTests.length, plan.noTestChange, Boolean(plan.e2eReason)], [['release'], 2, 1, false, true]);
  assert.deepEqual(docsImpact(model.section('Docs impact')).items.map(item => [item.target, item.type]), [['docs/guide.md', 'how-to']]);
  assert.deepEqual(changelogEntries(model.section('Changelog'), categories).entries.map(entry => entry.category), ['Added']);
});

test('None with a reason, invalid list lines and prose stripping are recognized', () => {
  const lines = text => parseHandoff(`## X\n\n${text}\n`).section('X');
  assert.equal(docsImpact(lines('None — internal tooling only.')).none, true);
  assert.equal(changelogEntries(lines('- None: maintainer-only change.'), categories).none, true);
  assert.equal(changelogEntries(lines('None'), categories).none, false, 'None needs a reason');
  assert.equal(changelogEntries(lines('- Improved: wording'), categories).invalid.length, 1);
  assert.equal(docsImpact(lines('- docs/a.md is better')).invalid.length, 1);
  assert.equal(testPlan(lines('- No test change — documentation only.')).noTestChange, true);
  assert.equal(acceptanceCriteria(lines('- [ ] AC1 missing dash')).at(0).valid, false);
  assert.equal(prose('a `TODO` b\n<!-- TBD -->\n```\nTODO\n```\nc').split('\n').length, 6);
  assert.doesNotMatch(prose('a `TODO` b\n<!-- TBD -->\n```\nTODO\n```'), /TODO|TBD/);
  assert.equal(words('<!-- hidden words here --> two words'), 2);
});

test('globs match folders, segments and recursive paths; unsafe paths are rejected', () => {
  assert.ok(matchesPath('src/**', 'src/a/b.ts')); assert.ok(matchesPath('**/*.checks.mjs', 'tests/x.checks.mjs')); assert.ok(matchesPath('**/*.checks.mjs', 'a.checks.mjs'));
  assert.ok(matchesPath('src', 'src/a.ts')); assert.ok(matchesPath('./src/', 'src/a.ts')); assert.ok(!matchesPath('src', 'srcx/a.ts'));
  assert.ok(matchesPath('tests/tooling/delivery-*', 'tests/tooling/delivery-cli.checks.mjs')); assert.ok(!matchesPath('docs/*.md', 'docs/a/b.md'));
  assert.ok(matchesAny(['x/**', 'docs/?.md'], 'docs/a.md')); assert.equal(globRegExp('a.b').test('aXb'), false);
  assert.deepEqual(['src/a/**', 'src/a.ts', '**/x'].map(staticPrefix), ['src/a/', 'src/a.ts', '']);
  for (const path of ['/etc/x', 'C:/x', 'a\\b', '../x', 'a/../b', '']) assert.equal(safeRelative(path), false, path);
  assert.equal(safeRelative('docs/increments/x.md'), true);
});

test('the shipped delivery configuration and template load strictly', async () => {
  const ready = await loadConfig(repositoryRoot, 'ready', readyRules);
  const done = await loadConfig(repositoryRoot, 'done', doneRules);
  assert.deepEqual(Object.keys(ready.rules), Object.keys(readyRules)); assert.deepEqual(Object.keys(done.rules), Object.keys(doneRules));
  assert.deepEqual(ready.delivery.exemptions, { branches: ['release/', 'dependabot/'], actors: ['dependabot[bot]'] });
  const template = parseHandoff(await read(ready.delivery.handoff.template));
  for (const name of ready.delivery.handoff.sections) assert.ok(template.section(name), `template has ## ${name}`);
  assert.equal(template.frontmatter.data.e2e, 'optional');
});

test('negative: unknown keys, missing rules, bad severities, params and regular expressions fail as DELIVERY_CONFIG_INVALID', async () => {
  const delivery = JSON.parse(await read(configFiles.delivery));
  const rules = JSON.parse(await read(configFiles.ready));
  const invalid = /DELIVERY_CONFIG_INVALID/;
  const mutations = [
    value => { value.extra = 1; }, value => { delete value.rules['DOR-05']; }, value => { value.rules['DOR-99'] = value.rules['DOR-01']; },
    value => { value.rules['DOR-01'].severity = 'fatal'; }, value => { value.rules['DOR-01'].enabled = 'yes'; },
    value => { value.rules['DOR-05'].params.min = '1'; }, value => { value.rules['DOR-05'].params.extra = 1; }, value => { delete value.rules['DOR-05'].params.max; },
    value => { value.rules['DOR-04'].params.patterns.push('('); }, value => { value.rules['DOR-07'].params.resolved = '['; }, value => { value.schemaVersion = 2; }];
  for (const mutate of mutations) { const copy = clone(rules); mutate(copy); assert.throws(() => validateRulesConfig(copy, readyRules, 'r.json'), invalid, mutate.toString()); }
  const deliveryMutations = [value => { value.handoff.unknown = true; }, value => { value.pullRequests.incrementKey = ''; }, value => { value.sizes.S.maxAffectedAreas = 0; },
    value => { value.exemptions.branches = 'release/'; }, value => { delete value.refinement; }, value => { value.handoff.slugPattern = '('; }];
  for (const mutate of deliveryMutations) { const copy = clone(delivery); mutate(copy); assert.throws(() => validateDeliveryConfig(copy), invalid, mutate.toString()); }
  const done = JSON.parse(await read(configFiles.done));
  done.rules['DOD-07'].params.patterns[0].flags = 'i';
  assert.throws(() => validateRulesConfig(done, doneRules, 'd.json'), /unknown key "flags"/);
  const lowercase = path => path.endsWith('delivery.json') ? read(configFiles.delivery).then(text => text.replace('"Done"', '"done"')) : read(path.slice(repositoryRoot.length + 1));
  await assert.rejects(loadConfig(repositoryRoot, 'done', doneRules, { read: lowercase }), /DOD-09\.params\.status: "Done" is not one of handoff\.statuses/);
  await assert.rejects(loadConfig(repositoryRoot, 'ready', readyRules, { files: { ready: 'configs/delivery/missing.json' } }), /cannot be read/);
  await assert.rejects(loadConfig(repositoryRoot, 'ready', readyRules, { files: { ready: 'package.json' } }), /unknown key/);
});
