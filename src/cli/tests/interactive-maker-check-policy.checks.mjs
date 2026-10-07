import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { checkSteps, checkOperation, runCheckSteps } from '../adapters/framework/check.ts';
import { manifestRules, versionsRule, lintRule, submissionCheck } from '../adapters/framework/submission.ts';
import { OperationError } from '../adapters/framework/contracts.ts';

const frameworkRoot = resolve(import.meta.dirname, '../../..');
async function withRoot(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'check-policy-')));
  try { await check(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Fake git: `diff` returns NUL-separated name-status pairs, `ls-files` the untracked list. */
const git = (tracked, untracked = []) => async (_root, args) => args[0] === 'diff' ? tracked.flat().join('\0') + '\0' : untracked.join('\0');
const testStep = plan => plan.steps.find(step => step.id === 'test');

test('fast mode selects related tests only for traceable, bounded code changes', () => withRoot(async root => {
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), 'export const a = 1;');
  const one = await checkSteps(root, true, git([['M', 'src/a.ts']], ['node_modules/x/index.js']));
  assert.match(testStep(one).display, /\(1 changed file\)/); assert.deepEqual(one.changes.files, ['src/a.ts']);
  const removed = await checkSteps(root, true, git([['D', 'src/gone.ts'], ['M', 'src/a.ts']]));
  assert.deepEqual(removed.changes.untraceable, ['src/gone.ts']); assert.equal(testStep(removed).args[0], 'run');
  const configs = await checkSteps(root, true, git(['package.json', 'configs/x.json', 'tsconfig.app.json', 'vite.config.ts', 'tests/suites.json', 'src/data.json'].map(path => ['M', path])));
  assert.match(configs.changes.reason, /, …\); running the full suite$/); assert.equal(configs.changes.untraceable.length, 6);
  const none = await checkSteps(root, true, git([['M', 'README.md']]));
  assert.equal(testStep(none).skip, 'No changed source files since HEAD.');
  const many = Array.from({ length: 201 }, (_, index) => `src/f${index}.ts`);
  for (const path of many) await writeFile(join(root, path), '');
  const large = await checkSteps(root, true, git(many.map(path => ['M', path])));
  assert.match(large.changes.reason, /more than 200 changed files/); assert.equal(testStep(large).args[0], 'run');
  const untraced = await checkSteps(root, true, git([], ['src/new.ts']));
  assert.deepEqual(untraced.changes.files, []);
}));

test('a generated project typechecks its own config and lints its configured roots', () => withRoot(async root => {
  await mkdir(join(root, '.companion'), { recursive: true }); await mkdir(join(root, 'configs/types'), { recursive: true });
  await writeFile(join(root, '.companion/generation.json'), '{}');
  await writeFile(join(root, 'configs/types/tsconfig.project.json'), '{}');
  const full = await checkSteps(root, false);
  assert.equal(full.scope, 'generated-project');
  assert.match(full.steps[0].display, /--project configs\/types\/tsconfig\.project\.json/);
  assert.ok(!full.steps.some(step => step.id === 'lint'));
  assert.ok(testStep(full).args.includes('--config'));
  await mkdir(join(root, 'src/cli'), { recursive: true }); await writeFile(join(root, 'src/cli/app.ts'), 'export {};');
  await writeFile(join(root, 'configs/types/tsconfig.maker.json'), '{}');
  for (const plan of [await checkSteps(root, false), await checkSteps(root, true, async () => null)]) {
    assert.ok(plan.steps.some(step => step.id === 'maker-types'));
    assert.ok(!plan.steps.some(step => step.id === 'maker-tests'), 'the shell maker qualification needs shell-only fixtures');
  }
  assert.ok((await checkSteps(root, false)).steps.find(step => step.id === 'eslint').args.includes('src'));
}));

test('check outcomes report cancellation, missing tools and failures with their next step', () => withRoot(async root => {
  const steps = [{ id: 'a', display: 'a', entry: 'a.mjs', args: [] }, { id: 'b', display: 'b', entry: 'b.mjs', args: [] }];
  const missing = async () => { throw new OperationError('TOOL_MISSING', 'missing'); };
  const outcome = await checkOperation({ command: 'check', args: [], options: {} }, { root, frameworkRoot: root }, missing, async () => null);
  assert.equal(outcome.status, 'failed'); assert.equal(outcome.diagnostics[0].next, 'node bin/app install --yes');
  const failing = async () => { throw new Error('boom'); };
  const failed = await checkOperation({ command: 'check', args: [], options: { fast: true } }, { root, frameworkRoot: root }, failing, async () => null);
  assert.match(failed.diagnostics[0].next, /check --fast$/);
  const controller = new AbortController(); controller.abort();
  const cancelled = await checkOperation({ command: 'check', args: [], options: {} }, { root, frameworkRoot: root, signal: controller.signal }, missing, async () => null);
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.diagnostics[0].code, 'CANCELLED');
  const skipped = await runCheckSteps(steps, { root, frameworkRoot: root, signal: controller.signal }, 1000, missing);
  assert.deepEqual(skipped.map(step => step.reason), ['cancelled', 'cancelled']);
  const passed = await checkOperation({ command: 'check', args: [], options: { timeout: '1000' } }, { root, frameworkRoot: root }, async () => ({ exitCode: 0 }), async () => null);
  assert.equal(passed.status, 'ok'); assert.equal(passed.diagnostics.length, 0);
}));

test('node suite steps get the long suite budget by default; an explicit --timeout bounds every step', async () => {
  const budgets = async options => {
    const seen = {};
    await checkOperation({ command: 'check', args: [], options }, { root: frameworkRoot, frameworkRoot }, async (_context, entry, args, timeout) => {
      seen[[entry, ...args].join(' ')] = timeout; return { exitCode: 0 };
    }, async () => null);
    return seen;
  };
  const defaults = await budgets({});
  assert.equal(defaults['tooling/testing/suites.mjs maker'], 3_600_000, 'the maker suite outlives the 10-minute step default');
  assert.equal(defaults['node_modules/vue-tsc/bin/vue-tsc.js -b'], 600_000);
  assert.ok(Object.values(await budgets({ timeout: '1000' })).every(timeout => timeout === 1000));
  const fast = await checkSteps(frameworkRoot, true, git([['M', 'tests/tooling/interactive-maker-guide.checks.mjs']]));
  assert.equal(fast.steps.find(step => step.id === 'suites').timeoutMs, 3_600_000);
});

test('manifest rules explain every missing, extra, malformed and forbidden field', () => {
  assert.equal(manifestRules(null)[0].status, 'fail');
  assert.match(manifestRules('[1]')[0].message, /not a single JSON object/);
  assert.match(manifestRules('{').at(0).message, /not a single JSON object/);
  const bad = manifestRules(JSON.stringify({ id: 'obsidian-tool2', name: 'Obsidian Plugin', version: '1', minAppVersion: '1.5', description: 'bad', author: '', isDesktopOnly: 'no', extra: 1, fundingUrl: { a: '' } }));
  const byId = Object.fromEntries(bad.map(rule => [rule.id, rule]));
  assert.match(byId['manifest-required-fields'].message, /author \(non-empty string\), isDesktopOnly \(boolean\)/);
  assert.match(byId['manifest-allowed-fields'].message, /extra/);
  assert.equal(byId['id-format'].status, 'warn'); assert.equal(byId['id-forbidden-words'].status, 'fail');
  assert.match(byId['name-forbidden-words'].message, /"obsidian" or "plugin"/);
  assert.equal(byId['version-semver'].status, 'fail'); assert.equal(byId['min-app-version'].status, 'warn');
  assert.match(byId['description-format'].message, /must end with a period/); assert.equal(byId['funding-url'].status, 'fail');
  const sparse = Object.fromEntries(manifestRules(JSON.stringify({ id: 'Bad_ID', fundingUrl: 3, description: 'lower case text with @ symbols.' })).map(rule => [rule.id, rule]));
  assert.equal(sparse['id-format'].status, 'fail'); assert.match(sparse['min-app-version'].message, /missing/);
  assert.match(sparse['description-format'].message, /capital letter.*characters outside/); assert.match(sparse['funding-url'].message, /string or an object/);
  assert.match(manifestRules(JSON.stringify({ fundingUrl: '' })).find(rule => rule.id === 'funding-url').message, /must not be empty/);
  assert.match(manifestRules(JSON.stringify({})).find(rule => rule.id === 'description-format').message, /missing/);
});

test('versions, lint and build rules map each failure to its remediation', () => withRoot(async root => {
  const manifest = JSON.stringify({ version: '1.0.0', minAppVersion: '1.5.0' });
  assert.equal(versionsRule(manifest, JSON.stringify({ '1.0.0': '1.5.0' })).status, 'pass');
  assert.match(versionsRule(manifest, null).message, /missing/);
  assert.match(versionsRule(manifest, '[]').message, /must map versions/);
  assert.match(versionsRule(manifest, JSON.stringify({ '1.0.0': '1.4.0' })).message, /does not map 1.0.0 to 1.5.0/);
  assert.match(versionsRule('{', '{}').message, /not valid JSON/);
  assert.match(lintRule(null, root, 'ESLint is not installed.').remediation, /install --yes/);
  assert.equal(lintRule(null, root).message, 'ESLint did not produce a report.');
  const report = [{ filePath: join(root, 'src/a.ts'), messages: [{ ruleId: 'obsidianmd/x', severity: 2, line: 3 }, { ruleId: null, severity: 2 }] }, { filePath: '/elsewhere/b.ts', messages: [{ ruleId: 'obsidianmd/x', severity: 1 }] }];
  const linted = lintRule(report, root);
  assert.match(linted.message, /^3 ESLint problems \(2 from obsidianmd rules\): obsidianmd\/x x2 \(first src\/a\.ts:3\); parse-error x1/);
  assert.equal(lintRule([], root).status, 'pass');
  const dry = await submissionCheck({ root, frameworkRoot: root }, true);
  assert.equal(dry.status, 'planned');
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'demo', version: '1.0.0' }));
  await mkdir(join(root, 'dist'), { recursive: true });
  await writeFile(join(root, 'dist/main.js'), 'x'); await writeFile(join(root, 'dist/manifest.json'), '{');
  const blocked = await submissionCheck({ root, frameworkRoot: root });
  const byId = Object.fromEntries(blocked.data.rules.map(rule => [rule.id, rule]));
  assert.equal(blocked.status, 'blocked'); assert.match(byId['build-artifacts'].message, /not valid JSON/);
  assert.match(byId.license.message, /No LICENSE/); assert.match(byId.readme.message, /No README/);
  assert.match(byId['eslint-obsidianmd'].remediation, /install --yes/); assert.equal(byId['build-styles'].status, 'warn');
  await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'other', version: '1.0.0' }));
  const drift = Object.fromEntries((await submissionCheck({ root, frameworkRoot: root })).data.rules.map(rule => [rule.id, rule]));
  assert.match(drift['build-artifacts'].message, /differ from manifest.json/);
}));
