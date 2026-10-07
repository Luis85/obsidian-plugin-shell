import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makerFixture, makerSourceRoot, installMakerFoundation, copyMakerSuite } from './support/maker-fixture.mjs';
import { parseArguments } from '../adapters/makers/arguments.ts';
import { planMaker } from '../adapters/makers/plan.ts';
import { applyFilePlan } from '#shared/platform/file-plan.ts';
import { executeOperation } from '../adapters/framework/operations.ts';
import { makerApplied } from '../adapters/framework/maker-checks.ts';
import { OperationError } from '../adapters/framework/contracts.ts';

const make = (root, args, options = {}) => executeOperation({ command: 'make', args, options }, { root, frameworkRoot: makerSourceRoot });
async function prepare(root) {
  await installMakerFoundation(root); await copyMakerSuite(root);
  await cp(join(makerSourceRoot, 'tsconfig.json'), join(root, 'tsconfig.json'));
  await cp(join(makerSourceRoot, 'configs/types/tsconfig.base.json'), join(root, 'configs/types/tsconfig.base.json'));
  await mkdir(join(root, 'src/locales'), { recursive: true });
  await cp(join(makerSourceRoot, 'src/locales/en.json'), join(root, 'src/locales/en.json'));
  await applyFilePlan((await planMaker(root, parseArguments(['feature', 'bookmarks', '--entity', 'bookmark']))).plan);
}

test('[MAKER-CHECKS] apply runs the planned checks for real, records outcomes and keeps source on failure', { timeout: 600000 }, () => makerFixture(async root => {
  await prepare(root);
  const preview = await make(root, ['command', 'refresh'], { feature: 'bookmarks', 'dry-run': true });
  assert.equal(preview.status, 'planned');
  assert.deepEqual(preview.data.summary.checks.map(check => [check.id, check.status]),
    [['typecheck', 'not-run'], ['generated-tests', 'not-run'], ['events-check', 'not-run'], ['entities-check', 'not-run']]);
  assert.equal(preview.data.summary.next, 'npm run verify');
  await assert.rejects(readFile(join(root, 'src/features/bookmarks/refresh.command.ts')), { code: 'ENOENT' });

  const applied = await make(root, ['command', 'refresh'], { feature: 'bookmarks', yes: true });
  assert.equal(applied.status, 'applied', JSON.stringify(applied.data.summary.checks.filter(check => check.status !== 'passed')));
  assert.deepEqual(applied.data.summary.checks.map(check => check.status), ['passed', 'passed', 'passed', 'passed']);
  assert.ok(applied.data.summary.checks.every(check => Number.isInteger(check.durationMs) && check.exitCode === 0));
  assert.deepEqual(applied.diagnostics, []);

  const rerun = await make(root, ['command', 'refresh'], { feature: 'bookmarks', yes: true });
  assert.equal(rerun.status, 'unchanged');
  assert.ok(rerun.data.summary.checks.every(check => check.status === 'skipped' && check.reason === 'no source changed'));

  // An unrelated type error makes the type check fail; every other check still runs and the new source is kept.
  await writeFile(join(root, 'src/features/bookmarks/broken.ts'), 'export const broken: number = "text";\n');
  const failed = await make(root, ['command', 'notify'], { feature: 'bookmarks', yes: true });
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.data.summary.checks.map(check => [check.id, check.status]),
    [['typecheck', 'failed'], ['generated-tests', 'passed'], ['events-check', 'passed'], ['entities-check', 'passed']]);
  assert.match(failed.data.summary.checks[0].outputTail, /broken\.ts/);
  assert.equal(failed.diagnostics[0].code, 'MAKER_CHECKS_FAILED');
  assert.match(failed.diagnostics[0].message, /kept for inspection.*1 of 4.*typecheck/);
  assert.match(failed.diagnostics[0].next, /^Fix the reported failures, then rerun: node node_modules\/vue-tsc/);
  assert.ok(failed.data.applied.written.includes('src/features/bookmarks/notify.command.ts'));
  assert.match(await readFile(join(root, 'src/features/bookmarks/notify.command.ts'), 'utf8'), /notify/i);
}));

test('[MAKER-CHECKS] missing tools point at npm ci and nothing is reported as passed', async () => {
  const checks = [{ id: 'typecheck', command: 'node', args: ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'] }];
  const missing = async () => { throw new OperationError('TOOL_MISSING', 'Required tool is not installed.'); };
  const review = { planHash: 'a'.repeat(64), summary: { maker: 'command', next: 'npm run verify' } };
  const outcome = await makerApplied('make', review, { written: ['x.ts'] }, checks, { root: '.', frameworkRoot: '.' }, missing);
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.data.summary.checks[0].code, 'TOOL_MISSING');
  assert.equal(outcome.diagnostics[0].next, 'npm ci');
  assert.equal(outcome.data.summary.next, 'npm run verify');
});

test('[MAKER-TRUST] recipes resolve before trust: unknown names suggest, only registered custom recipes need --trust-custom', () => makerFixture(async root => {
  await prepare(root);
  const typo = await make(root, ['featur', 'x']);
  assert.equal(typo.status, 'failed'); assert.equal(typo.diagnostics[0].code, 'MAKER_UNKNOWN');
  assert.match(typo.diagnostics[0].message, /Unknown recipe: featur\. Did you mean "feature"\?/);
  assert.equal(typo.diagnostics[0].next, 'node bin/app make list');
  const custom = await make(root, ['maker', 'reminder'], { 'dry-run': true });
  await applyFilePlan((await planMaker(root, parseArguments(['maker', 'reminder']))).plan);
  assert.equal(custom.status, 'planned');
  const untrusted = await make(root, ['reminder', 'review'], { feature: 'bookmarks', 'dry-run': true });
  assert.equal(untrusted.diagnostics[0].code, 'CUSTOM_TRUST_REQUIRED');
  assert.match(untrusted.diagnostics[0].message, /scripts\/makers\/custom\/reminder\.mjs/);
  const near = await make(root, ['remindr', 'review'], { feature: 'bookmarks', 'dry-run': true });
  assert.equal(near.diagnostics[0].code, 'MAKER_UNKNOWN'); assert.match(near.diagnostics[0].message, /"reminder"/);
  const trusted = await make(root, ['reminder', 'review'], { feature: 'bookmarks', 'dry-run': true, 'trust-custom': true });
  assert.equal(trusted.status, 'planned', JSON.stringify(trusted.diagnostics));
}));

test('[MAKER-LOCALE-REFRESH] a drifted pending draft explains its missing and obsolete keys and refreshes without losing surviving translations', () => makerFixture(async root => {
  await prepare(root);
  await applyFilePlan((await planMaker(root, parseArguments(['locale', 'fr']))).plan);
  const draftPath = join(root, 'src/locales/pending/fr.json');
  const draft = JSON.parse(await readFile(draftPath, 'utf8'));
  const [namespace] = Object.keys(draft.authoring);
  const [key] = Object.keys(draft.authoring[namespace]);
  draft.authoring[namespace][key] = 'Traduction relue';
  await writeFile(draftPath, JSON.stringify(draft, null, 2) + '\n');
  assert.ok((await planMaker(root, parseArguments(['locale', 'fr']))).plan.changes.every(change => change.status === 'unchanged'));
  await applyFilePlan((await planMaker(root, parseArguments(['command', 'refresh', '--feature', 'bookmarks']))).plan);

  const drift = await make(root, ['locale', 'fr'], { 'dry-run': true });
  assert.equal(drift.diagnostics[0].code, 'LOCALE_DRAFT_DRIFT');
  assert.doesNotMatch(drift.diagnostics[0].message, /LOCALE_DRAFT_DRIFT/);
  assert.match(drift.diagnostics[0].message, /lacks \d+ current base key\(s\): authoring\.bookmarksRefreshCommand\./);
  assert.match(drift.diagnostics[0].message, /make locale fr --refresh --dry-run/);
  const refresh = await planMaker(root, parseArguments(['locale', 'fr', '--refresh']));
  assert.deepEqual(refresh.plan.changes.filter(change => change.status !== 'unchanged').map(change => change.path).sort(),
    ['src/locales/pending/fr.json', 'src/locales/pending/fr.status.json']);
  await applyFilePlan(refresh.plan);
  const refreshed = JSON.parse(await readFile(draftPath, 'utf8'));
  assert.equal(refreshed.authoring[namespace][key], 'Traduction relue');
  assert.ok(refreshed.authoring.bookmarksRefreshCommand);
  const status = JSON.parse(await readFile(join(root, 'src/locales/pending/fr.status.json'), 'utf8'));
  assert.equal(status.selectable, false); assert.equal(status.status, 'pending-translation-review');
  const check = await make(root, ['locale', 'fr'], { check: true });
  assert.equal(check.status, 'ok'); assert.deepEqual([check.data.missing, check.data.extra], [[], []]);

  // Keys the base locale no longer has (for example example keys after examples:remove) are listed, then dropped by --refresh.
  const stale = { ...refreshed, retired: { notice: 'Ancien avis' }, authoring: { ...refreshed.authoring, [namespace]: { ...refreshed.authoring[namespace], gone: 'Supprimé' } } };
  await writeFile(draftPath, JSON.stringify(stale, null, 2) + '\n');
  const obsolete = await make(root, ['locale', 'fr'], { 'dry-run': true });
  assert.equal(obsolete.diagnostics[0].code, 'LOCALE_DRAFT_DRIFT');
  assert.match(obsolete.diagnostics[0].message, new RegExp(`keeps 2 key\\(s\\) no longer in the base locale: authoring\\.${namespace}\\.gone, retired\\.notice\\.`));
  assert.doesNotMatch(obsolete.diagnostics[0].message, /lacks/);
  await applyFilePlan((await planMaker(root, parseArguments(['locale', 'fr', '--refresh']))).plan);
  const pruned = JSON.parse(await readFile(draftPath, 'utf8'));
  assert.deepEqual(pruned, refreshed); assert.equal(pruned.authoring[namespace][key], 'Traduction relue');
  const prunedStatus = JSON.parse(await readFile(join(root, 'src/locales/pending/fr.status.json'), 'utf8'));
  assert.deepEqual(prunedStatus, status);
  const clean = await make(root, ['locale', 'fr'], { check: true });
  assert.equal(clean.status, 'ok'); assert.deepEqual([clean.data.missing, clean.data.extra], [[], []]);
  await assert.rejects(planMaker(root, parseArguments(['locale', 'de', '--refresh'])), /LOCALE_DRAFT_MISSING/);
}));
