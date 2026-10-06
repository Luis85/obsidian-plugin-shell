import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineViolations } from '../../scripts/quality/self-review-rules.mjs';
import { approvedFindings } from '../../scripts/quality/self-review-approvals.mjs';

// Each sample is a whole added line; the guard reads it as code, so these quoted samples never flag this file.
const added = (path, lines) => ({ path, status: 'M', added: lines.map((text, index) => ({ line: index + 1, text })), removed: [] });
const flagged = (path, lines) => lineViolations([added(path, lines)]).sort((a, b) => a.line - b.line).map(item => `${item.rule}:${item.line}`);
const focus = lines => flagged('tests/tooling/sample.checks.mjs', lines).filter(item => item.startsWith('SR-FOCUSED-TEST')).map(item => Number(item.split(':')[1]));

test('[SELF-REVIEW-RULES-01] a runtime skip that states its reason is not a focused test; declarations, bare skips and todo still are', () => {
  const kept = [
    "  if (await examplesRemoved(root)) { t.skip('Examples were removed from this checkout'); return; }",
    "  catch (error) { if (error.code === 'EPERM') return t.skip(`Symlinks need ${'privilege'}`); throw error; }",
    "test('windows only', { skip: process.platform !== 'win32' && 'Windows path aliases only' }, async t => {});",
    "test('posix only', { skip: process.platform === 'win32' ? 'file modes need POSIX' : false }, () => {});",
    "  skip: !available && 'Install the lockfile first', timeout: 120000,",
    "  { id: 'skipped', display: 'skipped', entry: 'missing.mjs', args: [], skip: 'No changed source files since HEAD.' },",
    "  const samples = { only: `focused`, skip: `later`, todo: `later` };",
    "  assert.equal(clip('ab', 2), 'ab'); assert.equal(fit('ab', 4), 'ab  ');",
    "  for (const r of trace.requirements) assert.match(await readFile(r.test, 'utf8'), /it.todo/);",
  ];
  const reported = [
    "test.only('focused', () => {});", "it.skip('later', () => {});", "describe.skip('later', () => {});", "test.describe.skip('later', () => {});",
    '  t.skip();', "  t.skip('');", "  t.skip('   ');", '  t.skip(reason);',
    "test('x', { skip: true }, () => {});", "test('x', { skip: 'flaky' }, () => {});", "  skip: 'always',", "test('x', { todo: 'later' }, () => {});", '  todo: true,',
    "it.todo('later');", "  t.todo('later');", "fit('focused', () => {});", "xit('later', async () => {});", 'fdescribe(', "test.skipIf(windows)('x', () => {});",
  ];
  assert.deepEqual(focus(kept), []);
  assert.deepEqual(focus(reported), reported.map((_, index) => index + 1));
});

test('[SELF-REVIEW-RULES-02] code-pattern rules ignore string and template literal contents but still read real comments', () => {
  const directive = { lint: '// eslint-disable-next-line no-console', ts: '// @ts-expect-error The payload stays numeric.' };
  const quoted = [
    `    \`it('rejects', () => {\\n  ${directive.ts}\\n  const invalid = 1;\\n});\\n\`,`,
    `    "  const root = { dataset: {} } as unknown as HTMLElement;",`,
    `  const fixture = '${directive.lint}';`,
    "  const sample = \"test.only('focused', () => {});\";",
  ];
  assert.deepEqual(flagged('tests/tooling/sample.checks.mjs', quoted), []);
  assert.deepEqual(flagged('src/cli/adapters/sample.ts', quoted), []);
  const real = [`  ${directive.lint}`, `  ${directive.ts}`, '  const root = node as unknown as HTMLElement;', `  call('text'); ${directive.lint}`];
  assert.deepEqual(flagged('src/cli/adapters/sample.ts', real), ['SR-LINT-DISABLE:1', 'SR-TS-SUPPRESSION:2', 'SR-UNSAFE-CAST:3', 'SR-LINT-DISABLE:4']);
});

test('[SELF-REVIEW-RULES-03] the docs/concepts design workspace is outside the code-pattern rules, but not outside config rules', () => {
  const lines = ['(window as any).Engine = engine;', '// eslint-disable-next-line no-console', "test.only('x', () => {});"];
  assert.deepEqual(flagged('docs/concepts/planner/source/app.ts', lines), []);
  assert.deepEqual(flagged('docs/concepts/planner/tests/app.test.ts', lines), []);
  assert.deepEqual(flagged('docs/development/sample.ts', lines), ['SR-UNSAFE-CAST:1', 'SR-LINT-DISABLE:2']);
  const removedConfig = { path: 'docs/concepts/planner/.fallowrc.json', status: 'D', added: [], removed: [{ line: 1, text: '{' }] };
  assert.deepEqual(lineViolations([removedConfig]).map(item => item.rule), ['SR-QUALITY-CONFIG']);
});

test('[SELF-REVIEW-RULES-04] a line-rule approval covers exactly the listed flagged lines, with multiplicity and per side', () => {
  const disable = '  // oxlint-disable-next-line no-control-regex';
  const file = added('bin/sample.ts', [disable, '  const a = /\\x1b/;', disable, '  const b = /\\x07/;', '  const c = value as unknown as Thing;']);
  const found = lineViolations([file]);
  const approval = (rule, lines, extra = {}) => ({ rule, file: 'bin/sample.ts', approvedBy: '@owner', reason: 'Matches terminal control bytes.', added: lines, removed: [], ...extra });
  const accepted = approvals => [...approvedFindings(found, [file], approvals).keys()].map(item => `${item.rule}:${item.line}`);
  assert.deepEqual(accepted([approval('SR-LINT-DISABLE', [disable])]), ['SR-LINT-DISABLE:1'], 'one listed text covers one flagged line');
  assert.deepEqual(accepted([approval('SR-LINT-DISABLE', [disable, disable])]), ['SR-LINT-DISABLE:1', 'SR-LINT-DISABLE:3']);
  assert.deepEqual(accepted([approval('SR-LINT-DISABLE', [`${disable} `]), approval('SR-UNSAFE-CAST', ['const c = value as unknown as Thing;'])]), [], 'an edited line is not covered');
  assert.deepEqual(accepted([approval('SR-LINT-DISABLE', [disable], { file: 'bin/other.ts' }), approval('SR-TS-SUPPRESSION', [disable])]), []);
  const vitest = { path: 'configs/testing/vitest.config.mjs', status: 'M', added: [{ line: 4, text: '    thresholds: floors,' }], removed: [{ line: 4, text: '    thresholds: floors.core,' }] };
  const wiring = lineViolations([vitest]);
  assert.deepEqual(wiring.map(item => `${item.rule}:${item.line}:${item.side ?? 'added'}`), ['SR-COVERAGE-THRESHOLD:4:added', 'SR-COVERAGE-THRESHOLD:4:removed']);
  const both = { rule: 'SR-COVERAGE-THRESHOLD', file: vitest.path, approvedBy: '@owner', reason: 'Renamed floors.', added: ['    thresholds: floors,'], removed: [] };
  assert.equal(approvedFindings(wiring, [vitest], [both]).size, 1, 'the removed line needs its own listed text');
  assert.equal(approvedFindings(wiring, [vitest], [{ ...both, removed: ['    thresholds: floors.core,'] }]).size, 2);
});
