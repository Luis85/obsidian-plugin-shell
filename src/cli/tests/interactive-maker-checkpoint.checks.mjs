import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { readSetupDraft, setupCheckpointPath } from '../domain/setup-checkpoint.ts';
import { loadSetupCheckpoint, setupCheckpointPlan, resumeSetupCheckpoint, discardSetupCheckpointPlan } from '../adapters/setup-checkpoint.ts';
import { applyPrepared } from '../adapters/storage.ts';
import { execute, parseArguments } from '../adapters/commands.ts';
import { beginSetupDraft, pauseSetup } from '../presentation/setup-progress.ts';
const prd = '---\ntype: prd\nid: PRD-A\n---\nOriginal\n';
const draft = () => ({ schemaVersion: 1, project: { name: 'Checkpoint', description: 'Preserve answers.', product: 'Continue safely.' }, prds: { mode: 'scan' }, operations: [], boilerplate: true });
async function scratch(work) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-checkpoint-'));
  try { await mkdir(join(root, 'docs/prds'), { recursive: true }); await writeFile(join(root, 'docs/prds/one.md'), prd); await work(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
const save = async (root, input = draft()) => { const plan = await setupCheckpointPlan(root, input); return applyPrepared(plan, plan.planHash); };
const command = (root, args, input) => execute(parseArguments(['project-setup', ...args]), { root, frameworkRoot: root, input: Readable.from(input ? [JSON.stringify(input)] : []) });
test('draft validation permits incomplete steps but never retains design or execution approval', () => {
  assert.deepEqual(readSetupDraft({ schemaVersion: 1 }), { schemaVersion: 1, operations: [] });
  const value = { ...draft(), settings: { schemaVersion: 1 }, prototypeInterview: { schemaVersion: 1, guideId: 'prototype', guideVersion: 1, answers: { title: 'A', approved: true } } };
  const saved = readSetupDraft(value);
  assert.equal(saved.prototypeInterview.answers.approved, false); assert.equal(value.prototypeInterview.answers.approved, true);
  assert.equal(saved.settings.paths.prds, 'docs/prds');
  assert.equal(readSetupDraft({ ...draft(), prototypeInterview: null }).prototypeInterview, null);
  for (const input of [null, {}, { schemaVersion: 2 }, { schemaVersion: 1, apply: 'hash' }, { ...draft(), boilerplate: 'yes' }, { ...draft(), project: {} },
    { ...draft(), prototypeInterview: {} }, { ...draft(), prototypeInterview: { schemaVersion: 1, guideId: 'x', guideVersion: 0, answers: {} } },
    { ...draft(), operations: [null] }]) assert.throws(() => readSetupDraft(input));
});
test('checkpoint plans do not write until approved; resumed requests contain no reusable authorization', async () => scratch(async root => {
  assert.equal((await loadSetupCheckpoint(root)).checkpoint, null);
  await assert.rejects(() => resumeSetupCheckpoint(root), /No saved/);
  const plan = await setupCheckpointPlan(root, draft());
  assert.equal((await applyPrepared(plan)).status, 'planned');
  await assert.rejects(readFile(join(root, setupCheckpointPath)));
  await assert.rejects(() => applyPrepared(plan, 'wrong'), /plan changed/);
  await applyPrepared(plan, plan.planHash);
  const resumed = await resumeSetupCheckpoint(root); assert.deepEqual(resumed, draft());
  resumed.project.name = 'changed'; assert.equal((await resumeSetupCheckpoint(root)).project.name, 'Checkpoint');
  assert.equal(await readFile(join(root, 'docs/prds/one.md'), 'utf8'), prd);
  const repeated = await setupCheckpointPlan(root, draft()); assert.equal((await applyPrepared(repeated, repeated.planHash)).status, 'unchanged');
}));
test('checkpoint source fingerprints reject changed inventory, changed bytes and new settings', async () => scratch(async root => {
  const plan = await setupCheckpointPlan(root, draft());
  await writeFile(join(root, 'docs/prds/new.md'), '# note');
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /PRDs changed/);
  await rm(join(root, 'docs/prds/new.md')); await save(root);
  await writeFile(join(root, 'docs/prds/one.md'), prd + 'Changed');
  await assert.rejects(() => resumeSetupCheckpoint(root), /PRD inventory/);
  await writeFile(join(root, 'docs/prds/one.md'), prd);
  await writeFile(join(root, 'configs/user-settings.json'), '{"schemaVersion":1}');
  await assert.rejects(() => resumeSetupCheckpoint(root), /Settings changed/);
}));
test('custom PRD paths and inline add checkpoints preserve source content without importing early', async () => scratch(async root => {
  await mkdir(join(root, 'requirements')); await writeFile(join(root, 'requirements/a.md'), prd);
  await save(root, { ...draft(), settings: { schemaVersion: 1, paths: { prds: 'requirements' } } });
  assert.equal((await resumeSetupCheckpoint(root)).settings.paths.prds, 'requirements');
  await save(root, { ...draft(), prds: { mode: 'add', documents: [{ filename: 'inline.md', markdown: prd }] } });
  await assert.rejects(readFile(join(root, 'docs/prds/inline.md')));
  assert.equal((await resumeSetupCheckpoint(root)).prds.documents[0].markdown, prd);
}));
test('corrupt, foreign and approval-bearing checkpoint files are preserved, not reset', async () => scratch(async root => {
  await save(root); const path = join(root, setupCheckpointPath), original = await readFile(path, 'utf8');
  const mutations = [x => x.schemaVersion = 2, x => x.producer = 'other', x => x.extra = true, x => x.rootHash = 'bad', x => x.settingsHash = false, x => x.sourceHash = 'bad',
    x => x.request.prototypeInterview = { schemaVersion: 1, guideId: 'x', guideVersion: 1, answers: { approved: true } }];
  for (const mutate of mutations) {
    const value = JSON.parse(original); mutate(value); const bytes = JSON.stringify(value); await writeFile(path, bytes);
    await assert.rejects(() => loadSetupCheckpoint(root)); await assert.rejects(() => setupCheckpointPlan(root, draft()));
    assert.equal(await readFile(path, 'utf8'), bytes);
  }
  await writeFile(path, '{broken'); await assert.rejects(() => loadSetupCheckpoint(root));
  const foreign = JSON.parse(original); foreign.rootHash = '0'.repeat(64); await writeFile(path, JSON.stringify(foreign));
  await assert.rejects(() => resumeSetupCheckpoint(root), /different project/);
}));
test('completed setup and races invalidate checkpoint writes, resume and deletion', async () => scratch(async root => {
  const plan = await setupCheckpointPlan(root, draft());
  await mkdir(join(root, 'configs'), { recursive: true }); await writeFile(join(root, 'configs/project-setup.json'), '{}');
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /Project setup changed/);
  await assert.rejects(() => setupCheckpointPlan(root, draft()), /initialized/);
  await rm(join(root, 'configs/project-setup.json')); await save(root);
  await writeFile(join(root, 'configs/project-setup.json'), '{}'); await assert.rejects(() => resumeSetupCheckpoint(root), /already initialized/);
  await rm(join(root, 'configs/project-setup.json'));
  const remove = await discardSetupCheckpointPlan(root); await save(root, { ...draft(), boilerplate: false });
  await assert.rejects(() => applyPrepared(remove, remove.planHash), /PLAN_STALE/);
  const latest = await discardSetupCheckpointPlan(root); await applyPrepared(latest, latest.planHash);
  assert.equal((await loadSetupCheckpoint(root)).checkpoint, null); await assert.rejects(() => discardSetupCheckpointPlan(root), /No saved/);
  assert.equal(await readFile(join(root, 'docs/prds/one.md'), 'utf8'), prd);
}));
test('agents can discover, checkpoint, inspect, resume and discard through the normal JSON command path', async () => scratch(async root => {
  const planned = await command(root, ['checkpoint', '--input', '-'], { schemaVersion: 1 });
  await command(root, ['checkpoint', '--input', '-', '--apply', planned.planHash], { schemaVersion: 1 });
  assert.equal((await command(root, ['checkpoint-status'])).checkpoint.producer, 'shell-setup-checkpoint');
  assert.equal((await command(root, ['resume'])).approved, false);
  for (const args of [['resume', '--apply', 'old'], ['resume', '--input', 'x'], ['discard-checkpoint', '--input', 'x']]) await assert.rejects(() => command(root, args));
  const remove = await command(root, ['discard-checkpoint']); await command(root, ['discard-checkpoint', '--apply', remove.planHash]);
  assert.equal((await command(root, ['checkpoint-status'])).checkpoint, null);
}));
test('human checkpoint choices default to continuing and need an explicit reviewed save', async () => scratch(async root => {
  const answers = [], seen = []; const ui = { write: () => {}, ask: async () => { throw new Error('plain prompt'); }, rich: {
    select: async (label, choices, initial) => { seen.push(label); return answers.shift() ?? initial ?? choices[0].id; }, review: async () => {}, busy: () => {} } };
  assert.deepEqual(await beginSetupDraft(ui, root), { schemaVersion: 1, operations: [] });
  assert.equal(await pauseSetup(ui, root, draft()), false);
  answers.push('yes', 'no'); assert.equal(await pauseSetup(ui, root, draft()), false);
  answers.push('yes', 'yes'); assert.equal(await pauseSetup(ui, root, draft()), true);
  answers.push('exit'); assert.equal(await beginSetupDraft(ui, root), undefined);
  answers.push('new'); assert.deepEqual(await beginSetupDraft(ui, root), { schemaVersion: 1, operations: [] });
  answers.push('resume'); assert.deepEqual(await beginSetupDraft(ui, root), draft());
  assert.ok(seen.includes('Apply this reviewed plan?'));
}));
