import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  inspectDesign as relocatedInspect,
  configurationPlan as relocatedConfigurationPlan,
  vaultPlan as relocatedVaultPlan,
  releaseVersionPlan as relocatedReleaseVersionPlan,
} from '../../bin/adapters/framework/changes.ts';
import * as legacy from '../../scripts/framework/changes.ts';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-changes-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}

test('relocated change planner preserves compatibility identity and stdin inspection', async t => {
  assert.equal(legacy.inspectDesign, relocatedInspect);
  assert.equal(legacy.configurationPlan, relocatedConfigurationPlan);
  assert.equal(legacy.vaultPlan, relocatedVaultPlan);
  assert.equal(legacy.releaseVersionPlan, relocatedReleaseVersionPlan);
  const context = { ...await fixture(t), inputText: projectText };
  const inspected = await relocatedInspect(context, '-');
  assert.ok(inspected.model.project.id);
  assert.ok(inspected.source.document);
});

test('relocated configuration planner creates and applies a blank setup plan', async t => {
  const context = await fixture(t);
  const request = { command: 'setup', args: [], options: { id: 'changes-test', name: 'Changes Test', author: 'Test', blank: true } };
  const planned = await relocatedConfigurationPlan(request, context);
  assert.ok(planned.plan.changes.some(change => change.path === 'shell.config.json'));
  assert.ok(planned.plan.changes.some(change => change.path === 'design/project.json'));
  await applyFilePlan(planned.plan);
  const vault = await relocatedVaultPlan(context);
  assert.ok(vault.plan.changes.some(change => change.path.includes('.framework-vault.json')));
});

test('relocated change planner keeps configuration and release prerequisites explicit', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedVaultPlan(context), /CONFIG_REQUIRED/);
  await assert.rejects(relocatedReleaseVersionPlan({ command: 'release prepare', args: [], options: {} }, context), /RELEASE_INPUT_REQUIRED/);
});
