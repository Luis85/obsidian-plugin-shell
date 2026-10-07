import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport, parseArguments, runSelfReview } from '../quality/self-review.mjs';

const cli = fileURLToPath(new URL('../quality/self-review.mjs', import.meta.url));
// Directive text is assembled from fragments so reviewing this very file stays clean.
const directive = {
  lint: `// ${['eslint', 'disable-next-line'].join('-')} no-console`,
  tsIgnore: `// ${'@ts'}-${'ignore'}`, tsExpect: `// ${'@ts'}-${'expect-error'}`, fallow: `// ${'fallow'}-${'ignore'}-next-line unused-export`,
  anyCast: `const a = value ${'as'} ${'any'};`, unknownCast: `const b = value ${'as'} ${'unknown'} ${'as'} Thing;`,
  shot: `await expect(page).${'toHave'}${'Screenshot'}('home.png');`, snap: `expect(value).${'toMatch'}${'Snapshot'}();`,
  only: `test${'.'}only('focused', () => {});`, skip: `it${'.'}skip('later', () => {});`, todo: `it${'.'}${'todo'}('later');`,
  launcher: `node ${'shell'}.mjs memory status`, appLauncher: `node ./${'app'}.mjs check`,
};
const suites = JSON.stringify({ schemaVersion: 1, roots: [{ path: 'tests/tooling' }, { path: 'tests/e2e' }], helperRoots: ['tests/support'],
  suites: [{ name: 'quality', purpose: 'Fixture suite.', include: ['tests/tooling/known-*.checks.mjs', 'tests/e2e/*.spec.ts'], runner: { type: 'node-test' }, verify: 'tooling' }] });
const baseFiles = {
  'tests/suites.json': suites, 'tests/tooling/known-a.checks.mjs': "import { test } from 'node:test';\ntest('a', () => {});\n", 'tests/support/.keep': '',
  'tests/e2e/ui.spec.ts': "import { test } from '@playwright/test';\ntest('ui', async () => {});\n",
  'configs/quality/thresholds.json': '{\n  "coverage": { "lines": 95 }\n}\n', 'configs/testing/vitest.config.mjs': 'export default { test: { coverage: { reporter: [] } } };\n',
  'configs/lint/eslint.config.mjs': "export default [{ rules: { 'no-console': 'error' } }];\n",
  'src/a.ts': `export const a = 1;\n${directive.lint}\nexport const b = 2;\n`, 'src/plugin/main.ts': 'export {};\n', 'docs/guide.md': 'Guide\n', 'CHANGELOG.md': 'Changes\n',
};
const git = (root, ...args) => execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' });
async function put(root, files) {
  for (const [path, text] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); }
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'self review ü-')); t.after(() => rm(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'trunk'); await put(root, baseFiles); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'base');
  return root;
}
/** Applies working-tree edits to the fixture repository and returns the guard's findings as "RULE file:line". */
async function review(t, edits) {
  const root = await fixture(t); await put(root, edits);
  const { report } = await runSelfReview(['--base', 'HEAD'], root);
  return report.violations.map(item => `${item.rule} ${item.file}:${item.line}`);
}
const lines = count => Array.from({ length: count }, (_, index) => `export const value${index} = ${index};`).join('\n') + '\n';

test('[SELF-REVIEW-01] a change that only adds classified tests and ordinary code is clean and exits zero', async t => {
  const root = await fixture(t);
  await put(root, { 'src/a.ts': `export const a = 1;\n${directive.lint}\nexport const b = 3;\nexport const c = 4;\n`, 'tests/tooling/known-b.checks.mjs': "test('b', () => {});\n", 'docs/guide.md': 'Guide\nMore\n' });
  const { report, failed } = await runSelfReview(['--base', 'HEAD'], root);
  assert.deepEqual([report.status, report.violations, failed], ['clean', [], false]);
  assert.match(formatReport(report, false), /no findings in 3 changed file\(s\) against HEAD/);
  const run = spawnSync(process.execPath, [cli, '--base', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.deepEqual([run.status, run.stderr], [0, '']);
});

test('[SELF-REVIEW-02] suppression and unsafe-cast additions fail with file:line while removed, context and comment-only lines do not', async t => {
  const added = ['export const a = 1;', directive.lint, 'export const b = 2;', directive.tsIgnore, directive.tsExpect, directive.fallow, directive.anyCast, directive.unknownCast, `// note: ${directive.anyCast}`, ''].join('\n');
  assert.deepEqual(await review(t, { 'src/a.ts': added }), [
    'SR-TS-SUPPRESSION src/a.ts:4', 'SR-TS-SUPPRESSION src/a.ts:5', 'SR-ANALYZER-IGNORE src/a.ts:6', 'SR-UNSAFE-CAST src/a.ts:7', 'SR-UNSAFE-CAST src/a.ts:8',
  ]);
  // The baseline already contains a lint directive; editing a neighbour or deleting it adds nothing.
  assert.deepEqual(await review(t, { 'src/a.ts': 'export const a = 1;\nexport const b = 2;\n' }), []);
  const lintAdded = await review(t, { 'src/a.ts': `export const a = 1;\n${directive.lint}\nexport const b = 2;\n${directive.lint}\n` });
  assert.deepEqual(lintAdded, ['SR-LINT-DISABLE src/a.ts:4']);
});

test('[SELF-REVIEW-03] quality configuration, Vitest thresholds and lint rule severity changes are flagged', async t => {
  const found = await review(t, {
    'configs/quality/thresholds.json': '{\n  "coverage": { "lines": 80 }\n}\n',
    'configs/testing/vitest.config.mjs': 'export default { test: { coverage: {\n  thresholds: { lines: 10 },\n  exclude: ["src/**"],\n} } };\n',
    'configs/lint/eslint.config.mjs': "export default [{ rules: { 'no-console': 'off' } }];\n",
  });
  // The lint change is both an added 'off' and a removed 'error'; the Vitest literal and the exclusion are separate lines.
  assert.deepEqual(found, ['SR-LINT-CONFIG configs/lint/eslint.config.mjs:1', 'SR-LINT-CONFIG configs/lint/eslint.config.mjs:1', 'SR-QUALITY-CONFIG configs/quality/thresholds.json:2',
    'SR-COVERAGE-THRESHOLD configs/testing/vitest.config.mjs:2', 'SR-COVERAGE-THRESHOLD configs/testing/vitest.config.mjs:3']);
  const removed = await review(t, { 'configs/lint/eslint.config.mjs': 'export default [{ rules: {} }];\n' });
  assert.deepEqual(removed, ['SR-LINT-CONFIG configs/lint/eslint.config.mjs:1']);
});

test('[SELF-REVIEW-03b] owner approvals accept only exactly listed quality-config lines and fail closed on a malformed record', async t => {
  const record = 'configs/quality/self-review-approvals.json', file = 'configs/quality/thresholds.json';
  const approval = (added, removed, extra = {}) => JSON.stringify({ schemaVersion: 1, approvals: [{ rule: 'SR-QUALITY-CONFIG', file, approvedBy: '@owner', reason: 'Owner tightened lines.', added, removed, ...extra }] });
  const tighten = '{\n  "coverage": { "lines": 96 }\n}\n';
  const root = await fixture(t);
  await put(root, { [file]: tighten, [record]: approval(['  "coverage": { "lines": 96 }'], ['  "coverage": { "lines": 95 }']) });
  const { report, failed } = await runSelfReview(['--base', 'HEAD'], root);
  // The record itself is not a threshold change; the approved line is reported, not hidden.
  assert.deepEqual([report.violations, failed, report.approved.map(item => `${item.rule} ${item.file}:${item.line} ${item.approvedBy}`)], [[], false, [`SR-QUALITY-CONFIG ${file}:2 @owner`]]);
  assert.match(formatReport(report, false), /approved \[SR-QUALITY-CONFIG\] configs\/quality\/thresholds\.json:2 by @owner/);
  // One unlisted line, a different file or a different rule keeps the finding.
  const unlisted = '{\n  "coverage": { "lines": 96 },\n  "ignore": ["src/**"]\n}\n';
  assert.deepEqual(await review(t, { [file]: unlisted, [record]: approval(['  "coverage": { "lines": 96 }'], ['  "coverage": { "lines": 95 }']) }), [`SR-QUALITY-CONFIG ${file}:2`]);
  assert.deepEqual(await review(t, { [file]: tighten, [record]: approval(['  "coverage": { "lines": 96 }'], ['  "coverage": { "lines": 95 }'], { file: 'configs/quality/other.json' }) }), [`SR-QUALITY-CONFIG ${file}:2`]);
  // Unknown or non-approvable rules, a line rule that lists no line, a bare approver and an empty reason all fail closed.
  for (const broken of ['{', approval([], [], { rule: 'SR-FOCUSED-TEST' }), approval([], [], { rule: 'SR-NOT-A-RULE' }), approval([], [], { rule: 'SR-LINT-DISABLE', file: 'src/a.ts' }),
    approval([], [], { approvedBy: 'owner' }), approval([], [], { reason: ' ' }), approval([], [], { rule: 'toString' })]) {
    const broke = await fixture(t); await put(broke, { [file]: tighten, [record]: broken });
    await assert.rejects(runSelfReview(['--base', 'HEAD'], broke), /SELF_REVIEW_APPROVALS|JSON/);
  }
});

test('[SELF-REVIEW-03c] a line-rule approval moves only the listed flagged line to approved; editing that line flags it again', async t => {
  const record = 'configs/quality/self-review-approvals.json';
  const approval = lines => JSON.stringify({ schemaVersion: 1, approvals: [{ rule: 'SR-UNSAFE-CAST', file: 'src/a.ts', approvedBy: '@owner', pullRequest: 1, reason: 'Host type has no guard.', added: lines, removed: [] }] });
  const source = `export const a = 1;\n${directive.lint}\nexport const b = 2;\n${directive.anyCast}\n${directive.unknownCast}\nexport const c = 3;\n`;
  const root = await fixture(t);
  await put(root, { 'src/a.ts': source, [record]: approval([directive.anyCast]) });
  const { report } = await runSelfReview(['--base', 'HEAD'], root);
  // Unlisted added lines of the same file (c = 3) do not matter for a line rule; the second cast is not listed.
  assert.deepEqual([report.violations.map(item => `${item.rule} ${item.line}`), report.approved.map(item => `${item.rule} ${item.line} ${item.approvedBy}`)],
    [['SR-UNSAFE-CAST 5'], ['SR-UNSAFE-CAST 4 @owner']]);
  assert.deepEqual(await review(t, { 'src/a.ts': source.replace(directive.anyCast, `${directive.anyCast} `), [record]: approval([directive.anyCast, directive.unknownCast]) }), ['SR-UNSAFE-CAST src/a.ts:4']);
});

test('[SELF-REVIEW-04] screenshot and snapshot baselines are rejected, including added baseline files', async t => {
  const found = await review(t, {
    'tests/e2e/ui.spec.ts': `import { test, expect } from '@playwright/test';\ntest('ui', async ({ page }) => {\n${directive.shot}\n${directive.snap}\n});\n`,
    'tests/e2e/ui.spec.ts-snapshots/home.png': 'png', 'tests/e2e/__snapshots__/ui.snap': 'snap',
  });
  // Baseline files are also unclassified test inputs in the fixture suite, which is a second, independent reason to reject them.
  assert.deepEqual(found, ['SR-SCREENSHOT-BASELINE tests/e2e/__snapshots__/ui.snap:1', 'SR-UNCLASSIFIED-TEST tests/e2e/__snapshots__/ui.snap:1',
    'SR-SCREENSHOT-BASELINE tests/e2e/ui.spec.ts:3', 'SR-SCREENSHOT-BASELINE tests/e2e/ui.spec.ts:4',
    'SR-SCREENSHOT-BASELINE tests/e2e/ui.spec.ts-snapshots/home.png:1', 'SR-UNCLASSIFIED-TEST tests/e2e/ui.spec.ts-snapshots/home.png:1']);
});

test('[SELF-REVIEW-05] new test files must be classified in exactly one suite; classified and moved-in-place files pass', async t => {
  const found = await review(t, { 'tests/tooling/orphan-new.checks.mjs': "test('x', () => {});\n", 'tests/tooling/known-c.checks.mjs': "test('c', () => {});\n" });
  assert.deepEqual(found, ['SR-UNCLASSIFIED-TEST tests/tooling/orphan-new.checks.mjs:1']);
  const root = await fixture(t);
  await put(root, { 'tests/tooling/known-d.checks.mjs': "test('d', () => {});\n", 'tests/tooling/orphan-old.checks.mjs': 'x\n' });
  git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'pre-existing unclassified file');
  await put(root, { 'tests/tooling/known-d.checks.mjs': "test('d2', () => {});\n" });
  const { report } = await runSelfReview(['--base', 'HEAD'], root);
  assert.deepEqual(report.violations, [], 'unclassified files that this change did not add are not this guard\'s concern');
});

test('[SELF-REVIEW-06] focused, skipped and todo tests fail in tests but not in fixture directories, quoted fixture text or non-test source', async t => {
  const body = ["import { test, it } from 'node:test';", directive.only, directive.skip, directive.todo, "test('ok', (t) => t.diagnostic('fine'));",
    `const fixtureText = "${directive.skip}";`, ''].join('\n');
  const found = await review(t, { 'tests/tooling/known-a.checks.mjs': body, 'tests/fixtures/sample.checks.mjs': body, 'src/not-a-test.ts': `${directive.only}\n` });
  assert.deepEqual(found, ['SR-FOCUSED-TEST tests/tooling/known-a.checks.mjs:2', 'SR-FOCUSED-TEST tests/tooling/known-a.checks.mjs:3', 'SR-FOCUSED-TEST tests/tooling/known-a.checks.mjs:4']);
});

test('[SELF-REVIEW-07] files over the code-line limit fail; comments, blanks and exact-limit files do not', async t => {
  const comments = Array.from({ length: 1000 }, (_, index) => `// note ${index}`).join('\n');
  const found = await review(t, {
    'src/over.ts': lines(401), 'src/exact.ts': lines(400), 'src/commented.ts': `${comments}\n\n${lines(10)}`, 'src/plugin/main.ts': lines(101),
    'tests/tooling/known-big.checks.mjs': lines(451), 'tests/tooling/known-fits.checks.mjs': lines(450), 'docs/long.md': lines(2000),
  });
  assert.deepEqual(found, ['SR-LINE-LIMIT src/over.ts:1', 'SR-LINE-LIMIT src/plugin/main.ts:1', 'SR-LINE-LIMIT tests/tooling/known-big.checks.mjs:1']);
});

test('[SELF-REVIEW-08] retired launcher references fail in added lines, with a changelog and path-qualified exemption', async t => {
  const found = await review(t, {
    'docs/guide.md': `Guide\n${directive.launcher}\n${directive.appLauncher}\nsee scripts/dev/${'app'}.mjs and bin/app\n`, 'CHANGELOG.md': `Changes\n${directive.launcher} was removed\n`,
  });
  assert.deepEqual(found, ['SR-RETIRED-LAUNCHER docs/guide.md:2', 'SR-RETIRED-LAUNCHER docs/guide.md:3']);
});

test('[SELF-REVIEW-08b] the reviewed docs-launchers allowlist exempts its historical records, and only for retired launchers', async t => {
  const allowlist = JSON.stringify({ entries: [{ glob: 'docs/history/**', rules: ['retired-launcher'], reason: 'dated record' }, { glob: 'docs/kit.md', rules: ['kit-layout-path'], reason: 'kit layout' }] });
  const found = await review(t, {
    'tooling/quality/docs-launchers-allowlist.json': allowlist,
    'docs/history/stage-a.md': `Stage A\n${directive.launcher}\n`, 'docs/kit.md': `Kit\n${directive.launcher}\n`, 'docs/guide.md': `Guide\n${directive.launcher}\n`,
  });
  assert.deepEqual(found.filter(item => item.startsWith('SR-RETIRED-LAUNCHER')), ['SR-RETIRED-LAUNCHER docs/guide.md:2', 'SR-RETIRED-LAUNCHER docs/kit.md:2']);
});

test('[SELF-REVIEW-09] the CLI exits non-zero on findings, honours --warn-only and --json, and rejects bad usage', async t => {
  const root = await fixture(t); await put(root, { 'src/a.ts': `${directive.anyCast}\n` });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  const failing = run('--base', 'HEAD');
  assert.equal(failing.status, 1); assert.match(failing.stdout, /error \[SR-UNSAFE-CAST\] src\/a\.ts:1 .*\n.*1 finding\(s\)/);
  const warning = run('--base', 'HEAD', '--warn-only');
  assert.equal(warning.status, 0); assert.match(warning.stdout, /warning \[SR-UNSAFE-CAST\] src\/a\.ts:1/); assert.match(warning.stdout, /--warn-only: not failing/);
  const json = JSON.parse(run('--base', 'HEAD', '--json').stdout);
  assert.deepEqual([json.status, json.base.ref, json.violations.map(item => [item.rule, item.file, item.line])], ['findings', 'HEAD', [['SR-UNSAFE-CAST', 'src/a.ts', 1]]]);
  for (const bad of [['--bogus'], ['--base'], ['--base', '--json']]) { const result = run(...bad); assert.equal(result.status, 2, bad.join(' ')); assert.match(result.stderr, /SELF_REVIEW_USAGE/); }
  const missing = run('--base', 'no-such-ref'); assert.equal(missing.status, 2); assert.match(missing.stderr, /SELF_REVIEW_BASE/);
  assert.deepEqual(parseArguments(['--json', '--warn-only', '--base', 'x']), { base: 'x', json: true, warnOnly: true });
});
