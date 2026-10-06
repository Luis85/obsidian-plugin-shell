import test from 'node:test';
import assert from 'node:assert/strict';
import { baseContext, changelog, configs, docsIndex, handoffPath, readyHandoff, results } from './delivery-fixture.mjs';
import { changelogWithEntries, completionRecord, indexWithRows, setFrontmatterValue, upsertSection } from '../tooling/delivery/generate.mjs';
import { missingChangelogEntries } from '../tooling/delivery/rules-done.mjs';
import { runDone } from '../tooling/delivery/run.mjs';
import { parseHandoff } from '../tooling/delivery/handoff.mjs';
import { validateChangelog } from '../tooling/release/changelog.mjs';

const config = await configs();
const finished = readyHandoff({ checked: true, status: 'Done' }) + '\n## Completion record\n\nGenerated.\n';
const done = (text = finished, overrides) => results('done', config, baseContext(config, text, overrides));
const failing = outcome => Object.values(outcome).filter(rule => rule.status === 'fail').map(rule => rule.id);
const without = path => baseContext(config).diff.filter(file => file.path !== path);

test('a finished increment passes every Definition of Done rule; the change pull request rules skip', () => {
  assert.deepEqual(Object.values(done()).filter(rule => rule.status !== 'pass').map(rule => `${rule.id}:${rule.status}`), ['DOD-12', 'DOD-13', 'DOD-14', 'DOD-15', 'DOD-16'].map(id => `${id}:skip`));
});

test('negative: each unfinished part fails exactly its own rule with a hint', () => {
  const cases = [
    ['DOD-01', done(finished, { readyFailures: ['DOR-07'] })],
    ['DOD-02', done(finished.replace('- [x] AC-2', '- [ ] AC-2'))], ['DOD-02', done(finished.replace(', `docs/guide.md#usage`', ', `docs/missing.md`'))],
    ['DOD-02', done(finished.replace(' Evidence: `tests/greeting.checks.mjs`\n', '\n'))],
    ['DOD-03', done(finished, { diff: without('tests/greeting.checks.mjs') })],
    ['DOD-04', done(finished, { diff: without('CHANGELOG.md') })], ['DOD-04', done(finished, { texts: { 'CHANGELOG.md': changelog.replace('- A greeting command in the palette.\n', '- Something else.\n') } })],
    ['DOD-04', done(finished, { texts: { 'CHANGELOG.md': changelog.replace('## [Unreleased]', '## Unreleased') } })],
    ['DOD-05', done(finished, { diff: without('docs/guide.md') })], ['DOD-05', done(finished, { texts: { 'docs/guide.md': '# Guide\n\n> Type: reference\n' } })],
    ['DOD-06', done(finished, { texts: { 'docs/README.md': docsIndex.replace('[Guide](guide.md)', 'Guide') } })],
    ['DOD-07', done(finished, { diff: [...without('src/features/greeting/command.ts'), { path: 'src/features/greeting/command.ts', status: 'A', added: [{ line: 3, text: '  console.log(state); // TODO remove' }] }] })],
    ['DOD-09', done(finished.replace('status: Done', 'status: In progress'))],
    ['DOD-10', done(finished.replace('e2e: optional', 'e2e: required'), { labels: ['docs'] })]];
  for (const [id, outcome] of cases) {
    assert.deepEqual(failing(outcome), [id], id);
    assert.ok(outcome[id].hint, `${id} names the fix`);
  }
  const forbidden = done(finished, { diff: [...without('src/features/greeting/command.ts'), { path: 'src/features/greeting/command.ts', status: 'A', added: [{ line: 3, text: 'console.log(1); // TODO' }] }, { path: 'tests/greeting.checks.mjs', status: 'M', added: [{ line: 2, text: 'test.only("x")' }] }] });
  assert.deepEqual(forbidden['DOD-07'].details, ['src/features/greeting/command.ts:3 todo-marker', 'src/features/greeting/command.ts:3 console-log', 'tests/greeting.checks.mjs:2 focused-test']);
  assert.equal(done(finished, { diff: [...without('src/features/greeting/command.ts'), { path: 'docs/notes.md', status: 'A', added: [{ line: 1, text: 'TODO list for console.log(' }] }] })['DOD-07'].status, 'pass', 'Markdown and other roots are not scanned');
});

test('DOD-07 reads code, not text: markers inside string literals and prose are not follow-ups', () => {
  const added = (path, lines) => ({ path, status: 'M', added: lines.map((text, index) => ({ line: index + 1, text })) });
  const scan = files => done(finished, { diff: [...without('src/features/greeting/command.ts'), ...files] })['DOD-07'];
  const quoted = scan([
    added('bin/emit.ts', ["const section = lines => [`- TODO(owner): ${empty}`];", "out.push('// TODO keep the generated hook');", '/** A title-only interaction is an explicit implementation TODO, never an outcome. */',
      ' * gets an executable navigation test (otherwise a business-interaction TODO). */', "  `  PRD TODOs  ${count} acceptance obligations remain TODO`,", 'const placeholder = /<(?:TBD|TODO)>|\\b(?:TBD|TODO)\\b/i;']),
    added('tests/scan.checks.mjs', ["const spec = scanSpec({ text: \"test.describe('g', () => { test.only(\\\"one\\\", () => {}); });\" });"]),
    added('src/log.ts', ["const hint = 'call console.log(value) to debug';"])]);
  assert.equal(quoted.status, 'pass', JSON.stringify(quoted.details));
  const real = scan([added('bin/emit.ts', ['run(); // TODO remove', '/* FIXME: retry */', ' * TODO: split this module', "const label = 'x'; // FIXME it's wrong"]),
    added('scripts/build.sh', ['# TODO pin the version']), added('tests/scan.checks.mjs', ["test.only('one', () => {});"]), added('src/log.ts', ["console.log('state', state);"])]);
  assert.deepEqual(real.details, ['bin/emit.ts:1 todo-marker', 'bin/emit.ts:2 todo-marker', 'bin/emit.ts:3 todo-marker', 'bin/emit.ts:4 todo-marker', 'scripts/build.sh:1 todo-marker', 'tests/scan.checks.mjs:1 focused-test', 'src/log.ts:1 console-log']);
});

test('warnings: the diff escaping the affected areas, a missing Completion record and an unverifiable e2e label', () => {
  const escaped = done(finished, { diff: [...baseContext(config).diff, { path: 'bin/other.ts', status: 'M', added: [] }] });
  assert.equal(escaped['DOD-08'].status, 'warn'); assert.deepEqual(escaped['DOD-08'].details, ['bin/other.ts']); assert.deepEqual(failing(escaped), []);
  assert.equal(done(finished.replace(/\n## Completion record[\s\S]*$/, '\n'))['DOD-11'].status, 'warn');
  const required = finished.replace('e2e: optional', 'e2e: required');
  const local = done(required, { labels: null });
  assert.equal(local['DOD-10'].status, 'warn', 'a local run cannot see labels: never a silent pass'); assert.match(local['DOD-10'].hint, /Add the `e2e` label/);
  assert.equal(done(required, { labels: ['e2e', 'docs'] })['DOD-10'].status, 'pass');
  assert.equal(done(finished.replace('- New test `tests/greeting.checks.mjs`: command behavior.', '- No test change — wiring only.'), { diff: without('tests/greeting.checks.mjs') })['DOD-03'].status, 'pass');
  assert.equal(done(finished.replace('- Added: A greeting command in the palette.', 'None — internal only.'), { diff: without('CHANGELOG.md') })['DOD-04'].status, 'pass');
});

test('the changelog generator merges missing entries into Unreleased, deduplicates and stays valid', () => {
  const entries = [{ category: 'Added', text: 'A greeting command in the palette.' }, { category: 'Fixed', text: 'The notice wording.' }];
  assert.deepEqual(missingChangelogEntries(changelog, entries), [entries[1]]);
  const output = changelogWithEntries(changelog, missingChangelogEntries(changelog, entries));
  assert.ok(validateChangelog(output).ok);
  assert.match(output, /## \[Unreleased\]\n\n### Added\n\n- A greeting command in the palette\.\n\n### Fixed\n\n- The notice wording\.\n\n## \[0\.1\.0\]/);
  assert.equal(changelogWithEntries(output, missingChangelogEntries(output, entries)), output, 'a second run changes nothing');
  assert.throws(() => changelogWithEntries('# Changelog\n\n## [0.1.0] - 2026-09-01\n\nx\n', entries), /CHANGELOG_UNRELEASED_REQUIRED/);
});

test('index rows, the Completion record and the status are generated without touching authored text', () => {
  const indexed = indexWithRows(docsIndex, [{ type: 'reference', target: 'docs/api.md', title: 'API | facts', note: '' }, { type: 'explanation', target: 'docs/why.md', title: 'Why', note: 'Reasons.' }],
    config.done['DOD-06'].params.headings);
  assert.match(indexed.text, /\| Page \| Facts \|\n\| --- \| --- \|\n\| \[API \\\| facts\]\(api\.md\) \| API \\\| facts \|\n/);
  assert.deepEqual(indexed.skipped, ['docs/why.md'], 'a heading without a table is reported, not invented');
  const model = parseHandoff(finished.replace('e2e: optional', 'e2e: required'));
  const record = completionRecord({ model, path: handoffPath, diff: baseContext(config).diff, base: { ref: 'origin/main', sha: 'b'.repeat(40) }, labels: ['e2e'], gates: [{ id: 'check', command: 'node bin/app check', required: true }] });
  assert.match(record, /^## Completion record\n/); assert.match(record, /Changed files: 6 \(4 added, 2 modified, 0 renamed, 0 deleted\)/);
  assert.match(record, /E2E decision: required; `e2e` label present/); assert.match(record, /\| `src\/features\/greeting\/\*\*` \| 1 \|/);
  assert.match(record, /\| AC-2 \| yes \| `tests\/greeting\.checks\.mjs`, `docs\/guide\.md#usage` \|/); assert.match(record, /\| check \| `node bin\/app check` \| yes \|/);
  assert.match(completionRecord({ model, path: handoffPath, diff: [], base: { ref: 'main', sha: 'c'.repeat(40) }, labels: null, gates: null }), /label not verifiable locally[\s\S]*was not available here/);
  const replaced = upsertSection(finished, 'Completion record', '## Completion record\n\nNew.');
  assert.ok(replaced.startsWith(finished.replace(/## Completion record[\s\S]*$/, '')), 'everything before the record is kept');
  assert.match(replaced, /## Completion record\n\nNew\.\n$/);
  assert.match(upsertSection('# T\n\n## A\n\nx\n', 'Completion record', '## Completion record\n\ny'), /x\n\n## Completion record\n\ny\n$/);
  assert.equal(upsertSection('## R\n\nold\n\n## Z\n\nz\n', 'R', '## R\n\nnew'), '## R\n\nnew\n\n## Z\n\nz\n');
  assert.match(setFrontmatterValue(finished, 'status', 'In progress'), /\nstatus: In progress\n/);
  assert.match(setFrontmatterValue('---\nid: a\n---\n', 'status', 'Done'), /^---\nid: a\nstatus: Done\n---/);
});

test('runDone with --write applies the generated docs once and sets status done only when nothing else fails', () => {
  const start = readyHandoff({ checked: true, status: 'In progress' });
  let texts = { [handoffPath]: start, 'CHANGELOG.md': changelog.replace('- A greeting command in the palette.\n', '- Older entry.\n'), 'docs/README.md': docsIndex.replace('| [Guide](guide.md) | Use it. |\n', '') };
  const snapshot = () => ({ ...baseContext(config, texts[handoffPath], { texts }), base: { ref: 'origin/main', sha: 'd'.repeat(40) }, body: '' });
  const writes = [];
  const io = { write: (path, text) => { writes.push(path); texts = { ...texts, [path]: text }; }, refresh: snapshot, gates: () => null };
  const result = runDone({ delivery: config.delivery, rules: config.done, ready: config.ready }, snapshot(), { write: true }, io);
  assert.equal(result.status, 'done', JSON.stringify(result.rules.filter(rule => rule.status === 'fail')));
  assert.deepEqual(result.generated.changelog.map(entry => entry.text), ['A greeting command in the palette.']);
  assert.deepEqual(result.generated.docsIndex, ['docs/guide.md']); assert.equal(result.generated.status, 'Done');
  assert.deepEqual([...new Set(writes)].sort(), ['CHANGELOG.md', 'docs/README.md', handoffPath]);
  assert.match(texts[handoffPath], /\nstatus: Done\n/); assert.match(texts[handoffPath], /## Completion record\n/); assert.match(texts['docs/README.md'], /\| \[Guide\]\(guide\.md\) \| explains the command\. \|/);
  const again = runDone({ delivery: config.delivery, rules: config.done, ready: config.ready }, snapshot(), { write: true }, { ...io, write: path => assert.fail(`rewrote ${path}`) });
  assert.equal(again.status, 'done'); assert.deepEqual(again.generated.written, []);
  const blocked = readyHandoff({ checked: false, status: 'In progress' });
  texts = { ...texts, [handoffPath]: blocked };
  const notDone = runDone({ delivery: config.delivery, rules: config.done, ready: config.ready }, snapshot(), { write: true }, io);
  assert.equal(notDone.status, 'not-done'); assert.match(texts[handoffPath], /\nstatus: In progress\n/, 'unchecked criteria never get status done');
  texts = { ...texts, [handoffPath]: blocked };
  const readOnly = runDone({ delivery: config.delivery, rules: config.done, ready: config.ready }, snapshot(), {}, { ...io, write: path => assert.fail(`wrote ${path}`) });
  assert.ok(readOnly.generated.files[handoffPath], 'without --write the files are only returned');
});
