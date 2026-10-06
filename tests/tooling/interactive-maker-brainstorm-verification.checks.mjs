import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
const { test, after } = await (process.env.VITEST ? import('vitest').then(module => ({ test: module.test, after: module.afterAll })) : import('node:test'));
import { parseArguments, execute } from '../../src/cli/adapters/commands.ts';
import { brainstormFeaturePlan, brainstormVerifyPlan, executeBrainstormVerification } from '../../src/cli/adapters/brainstorm.ts';
import { applyPrepared } from '../../src/cli/adapters/storage.ts';
import { brainstormScratch, captureRequest, fakeNpm, pinGeneratedNode, resign, readScratchJson, writeJson } from './interactive-maker-brainstorm-fixture.mjs';
import { copyTree, pristineFixtures } from '../support/pristine-fixture.mjs';

const out = 'brainstorms/capture-inbox', source = out + '/source';
const copyFixture = pristineFixtures(after, 'maker-brainstorm-pristine-');
/**
 * Generated source is re-pinned to the running Node, so no row adds a Node blocker. Each distinct package is
 * generated once per file from a freshly seeded scratch root, then copied into this test's own root.
 */
async function generated(options, patch) {
  await copyFixture(JSON.stringify(patch), async root => {
    await copyTree(options.root, root);
    const seeded = { ...options, root };
    const plan = await brainstormFeaturePlan({ ...captureRequest, ...patch }, seeded);
    await applyPrepared(plan, plan.planHash);
    if (plan.data.generated) await pinGeneratedNode(root, out);
  }, options.root);
}
const verify = (options, extra = []) => execute(parseArguments(['brainstorm', 'verify', '--out', out, ...extra, '--json']),
  { ...options, input: Readable.from([]) });
const code = expected => error => error?.code === expected;
async function expectPlanFailure(options, expected, label) {
  await assert.rejects(() => brainstormVerifyPlan(options, out), code(expected), label);
}

test('execution approval is bound to the current plan hash, cancellation and the exact npm bytes', { timeout: 300000 }, async () =>
  brainstormScratch(async options => {
    await generated(options, { output: 'prototype', verification: 'test-build' });
    const npm = await fakeNpm(options.root);
    try {
      const plan = await brainstormVerifyPlan(options, out);
      assert.deepEqual(plan.expected, { node: process.versions.node, npm: '11.19.1' }, 'qualified toolchain pins');
      assert.deepEqual([plan.requested, plan.blockers, plan.source, plan.tool.entry], ['test-build', [], source, npm.entry]);
      assert.deepEqual(plan.steps, [{ label: 'install', args: ['ci', '--no-fund'] }, { label: 'test', args: ['run', 'test'] },
        { label: 'build', args: ['run', 'build'] }]);
      assert.ok(plan.inventory.some(file => file.path === source + '/.maker/receipt.json'));
      assert.match(plan.effects.join('\n'), /not rolled back/);
      const listed = await verify(options);
      assert.deepEqual([listed.status, listed.executed, listed.planHash], ['planned', false, plan.planHash]);
      await assert.rejects(() => verify(options, ['--apply', 'stale-hash']), code('BRAINSTORM_APPROVAL'));
      const aborted = new AbortController(); aborted.abort();
      await assert.rejects(() => executeBrainstormVerification(plan, plan.planHash, { ...options, signal: aborted.signal }),
        code('CANCELLED'));
      await npm.tamper();
      await assert.rejects(() => executeBrainstormVerification(plan, plan.planHash, options), code('BRAINSTORM_STALE'),
        'a changed npm executable invalidates the approval');
      assert.deepEqual(await npm.calls(), [], 'no process started before a valid approval');
    } finally { npm.restore(); }
  }));

test('an approved plan runs install, test and build in the generated source with the selected npm only', { timeout: 300000 }, async () =>
  brainstormScratch(async options => {
    await generated(options, { output: 'prototype', verification: 'test-build' });
    const npm = await fakeNpm(options.root);
    try {
      const fresh = await verify(options);
      let progress = '';
      const result = await execute(parseArguments(['brainstorm', 'verify', '--out', out, '--apply', fresh.planHash, '--json']),
        { ...options, input: Readable.from([]), progress: text => { progress += text; } });
      assert.deepEqual(result, { status: 'ok', executed: true, planHash: fresh.planHash,
        outcomes: [{ label: 'install', exitCode: 0 }, { label: 'test', exitCode: 0 }, { label: 'build', exitCode: 0 }],
        acceptance: 'not-inferred', publication: 'not-run', externalEffects: 'preserved-not-rolled-back' });
      const calls = await npm.calls();
      assert.deepEqual(calls.map(call => call.args.join(' ')), ['ci --no-fund', 'run test', 'run build']);
      assert.ok(calls.every(call => call.cwd === join(options.root, source) && call.ci === 'true'));
      assert.match(progress, /BRAINSTORM_STAGE install\n[\s\S]*FAKE_NPM ci --no-fund[\s\S]*BRAINSTORM_STAGE build/);
      assert.equal((await verify(options)).planHash, fresh.planHash,
        'dependency output under node_modules is not an owned input and does not change the plan');
    } finally { npm.restore(); }
  }));

test('a failing step stops before later steps and a mismatched toolchain starts nothing', { timeout: 300000 }, async () => brainstormScratch(async options => {
  await generated(options, { output: 'prototype', verification: 'test-build' });
  const failing = await fakeNpm(options.root, { fail: 'test' });
  try {
    const plan = await brainstormVerifyPlan(options, out);
    await assert.rejects(() => executeBrainstormVerification(plan, plan.planHash, options), code('PROCESS_FAILED'));
    assert.deepEqual((await failing.calls()).map(call => call.args[0] + ' ' + call.args[1]), ['ci --no-fund', 'run test']);
  } finally { failing.restore(); }
  await rm(join(options.root, 'fake-npm'), { recursive: true });
  const older = await fakeNpm(options.root, { version: '10.0.0' });
  try {
    const blocked = await verify(options);
    assert.deepEqual([blocked.status, blocked.blockers], ['blocked', ['Select npm 11.19.1; found 10.0.0']]);
    await assert.rejects(() => verify(options, ['--apply', blocked.planHash]),
      error => error?.code === 'BRAINSTORM_TOOLCHAIN' && error.message === 'Select npm 11.19.1; found 10.0.0');
    assert.deepEqual(await older.calls(), []);
  } finally { older.restore(); }
}));

test('verification binds to the reviewed definition, ownership receipt, scripts and pinned toolchain', { timeout: 600000 }, async () =>
  brainstormScratch(async options => {
    await generated(options, { output: 'prototype', verification: 'test' });
    const npm = await fakeNpm(options.root);
    const definitionPath = out + '/feature.definition.json', receiptPath = source + '/.maker/receipt.json';
    const original = {};
    for (const path of [definitionPath, receiptPath, source + '/package.json', source + '/.nvmrc']) {
      original[path] = await readFile(join(options.root, path));
    }
    const restore = async () => { for (const [path, bytes] of Object.entries(original)) await writeFile(join(options.root, path), bytes); };
    const definition = await readScratchJson(options.root, definitionPath);
    try {
      const baseline = await brainstormVerifyPlan(options, out);
      assert.deepEqual(baseline.steps.map(step => step.label), ['install', 'test']);
      await writeJson(options.root, definitionPath, { ...definition, status: 'accepted' });
      await expectPlanFailure(options, 'BRAINSTORM_DEFINITION', 'a definition not produced as a draft');
      await writeJson(options.root, definitionPath, { ...definition, generatedSource: { ...definition.generatedSource, path: 'elsewhere/source' } });
      await expectPlanFailure(options, 'BRAINSTORM_DEFINITION', 'generated source outside the package');
      await writeJson(options.root, definitionPath, { ...definition, feature: { ...definition.feature, verification: 'none' } });
      await expectPlanFailure(options, 'BRAINSTORM_VERIFICATION', 'no verification was requested');
      await restore();
      await resign(options.root, out, receipt => { receipt.schemaVersion = 2; });
      await expectPlanFailure(options, 'BRAINSTORM_RECEIPT', 'unknown receipt version');
      await restore();
      await resign(options.root, out, receipt => { receipt.files[0].sha256 = 'z'.repeat(64); });
      await expectPlanFailure(options, 'BRAINSTORM_RECEIPT', 'invalid ownership digest');
      await restore();
      await resign(options.root, out, receipt => { receipt.files.push({ ...receipt.files[0] }); });
      await expectPlanFailure(options, 'BRAINSTORM_SOURCE_CHANGED', 'duplicate ownership rows');
      await restore();
      await resign(options.root, out, receipt => { receipt.files = receipt.files.filter(item => item.path !== 'README.md'); });
      await expectPlanFailure(options, 'BRAINSTORM_SOURCE_CHANGED', 'an owned file dropped from the receipt becomes unowned');
      await restore();
      const pkg = await readScratchJson(options.root, source + '/package.json');
      await resign(options.root, out, async () => {
        await writeJson(options.root, source + '/package.json', { ...pkg, scripts: { ...pkg.scripts, test: undefined } });
        return ['package.json'];
      });
      await expectPlanFailure(options, 'BRAINSTORM_SCRIPTS', 'missing test script');
      await restore();
      await resign(options.root, out, async () => {
        await writeFile(join(options.root, source, '.nvmrc'), 'lts/*\n'); return ['.nvmrc'];
      });
      await expectPlanFailure(options, 'BRAINSTORM_TOOLCHAIN', 'unpinned Node version');
      await restore();
      await writeFile(join(options.root, source, '.nvmrc'), '22.0.0\n');
      await expectPlanFailure(options, 'BRAINSTORM_SOURCE_CHANGED', 'an unsigned edit of an owned file');
      await restore();
      assert.deepEqual(await brainstormVerifyPlan(options, out), baseline, 'restored bytes restore the identical plan');
      assert.deepEqual(await npm.calls(), [], 'planning never starts a process');
    } finally { npm.restore(); }
  }));

test('definition-only packages have nothing to verify', async () => brainstormScratch(async options => {
  await generated(options, {});
  await assert.rejects(() => verify(options), code('BRAINSTORM_VERIFICATION'));
  await assert.rejects(() => brainstormVerifyPlan(options, 'brainstorms/missing'), code('ENOENT'));
  await assert.rejects(() => brainstormVerifyPlan(options, '../outside'), code('SETTINGS_PATH'));
}));
