// Integration checks for the applied PR5 patch. Requires the repository's normal dependencies.
// These are intentionally separate from the dependency-free, locally executed source tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../scripts/framework/operations.ts';
const frameworkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
async function context(t) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-handout-framework-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs/prds'), { recursive: true });
  await writeFile(join(root, 'docs/prds/example.md'), '# Example PRD\nA prototype journey.\n');
  return { root, frameworkRoot };
}
const run = (context, command, options = {}, args = []) => executeOperation({ command, options, args }, context);
function expectStatus(result, status) { assert.equal(result.status, status, JSON.stringify(result)); }
test('handout commands are discoverable through the actual framework', async t => {
  const ctx = await context(t), discovered = await run(ctx, 'capabilities');
  expectStatus(discovered, 'ok');
  for (const id of ['handout generate', 'handout refresh', 'handout validate', 'handout inspect']) assert.ok(discovered.data.commands.some(command => command.id === id));
});
test('setup includes the root handout in its reviewed plan, fingerprints proposed settings, and preserves later edits', async t => {
  const ctx = await context(t);
  const input = { id: 'example-prototype', name: 'Example prototype', author: 'Product trio', blank: true };
  const preview = await run(ctx, 'setup', { ...input, 'dry-run': true });
  expectStatus(preview, 'planned');
  assert.ok(preview.data.changes.some(change => change.path === 'PROJECT-SETUP-HANDOUT.md'));
  await assert.rejects(readFile(join(ctx.root, 'PROJECT-SETUP-HANDOUT.md')), { code: 'ENOENT' });
  expectStatus(await run(ctx, 'setup', { ...input, yes: true, apply: preview.data.planHash }), 'applied');
  const readiness = await run(ctx, 'handout validate');
  expectStatus(readiness, 'blocked');
  assert.ok(!readiness.diagnostics.some(diagnostic => diagnostic.code === 'HANDOUT_SOURCES_STALE'));
  const path = join(ctx.root, 'PROJECT-SETUP-HANDOUT.md');
  const edited = await readFile(path, 'utf8') + '\nHuman meeting note: preserve this exactly.\n';
  await writeFile(path, edited);
  const again = await run(ctx, 'setup', { ...input, 'dry-run': true });
  assert.ok(!again.data.changes.some(change => change.path === 'PROJECT-SETUP-HANDOUT.md'));
  assert.equal(await readFile(path, 'utf8'), edited);
});
test('changed PRDs invalidate a reviewed generation plan before writing', async t => {
  const ctx = await context(t), plan = await run(ctx, 'handout generate', { 'dry-run': true });
  expectStatus(plan, 'planned');
  await writeFile(join(ctx.root, 'docs/prds/example.md'), '# Changed PRD');
  const applied = await run(ctx, 'handout generate', { apply: plan.data.planHash, yes: true });
  assert.ok(applied.diagnostics.some(diagnostic => diagnostic.code === 'PLAN_STALE'), JSON.stringify(applied));
  await assert.rejects(readFile(join(ctx.root, 'PROJECT-SETUP-HANDOUT.md')), { code: 'ENOENT' });
});
test('saved plans use the existing inspect/apply protocol without process authorization', async t => {
  const ctx = await context(t), plan = await run(ctx, 'handout generate', { 'plan-out': 'handout.plan.json' });
  expectStatus(plan, 'planned');
  expectStatus(await run(ctx, 'plan inspect', {}, ['handout.plan.json']), 'planned');
  expectStatus(await run(ctx, 'plan apply', { yes: true }, ['handout.plan.json']), 'applied');
  const inspect = await run(ctx, 'handout inspect');
  expectStatus(inspect, 'blocked');
  assert.equal(inspect.data.answers.length, 69);
  assert.equal(inspect.data.executionAuthorized, false);
});
test('explicit refresh preserves answers and notes while resetting review checkboxes', async t => {
  const ctx = await context(t);
  expectStatus(await run(ctx, 'handout generate', { yes: true }), 'applied');
  const path = join(ctx.root, 'PROJECT-SETUP-HANDOUT.md');
  const edited = (await readFile(path, 'utf8')).replace('- [ ] **REQUIRED** `meeting.owners`', '- [x] **REQUIRED** `meeting.owners`') + '\nRetain this meeting note.\n';
  await writeFile(path, edited);
  await writeFile(join(ctx.root, 'docs/prds/example.md'), '# Changed PRD');
  const preview = await run(ctx, 'handout refresh', { 'dry-run': true });
  expectStatus(preview, 'planned');
  expectStatus(await run(ctx, 'handout refresh', { yes: true, apply: preview.data.planHash }), 'applied');
  const fresh = await readFile(path, 'utf8');
  assert.ok(fresh.endsWith('Retain this meeting note.\n'));
  assert.ok(fresh.includes('- [ ] **REQUIRED** `meeting.owners`'));
});
