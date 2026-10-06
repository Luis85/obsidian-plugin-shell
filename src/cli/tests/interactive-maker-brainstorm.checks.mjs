import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument, documentText, openDocument } from '../domain/document.ts';
import { hash } from '../adapters/framework/files.ts';
import { readFeatureBrainstorm, featureConcept, brainstormSchema } from '../domain/brainstorm.ts';
import { brainstormFeaturePlan, brainstormVerifyPlan } from '../adapters/brainstorm.ts';
import { applyPrepared } from '../adapters/storage.ts';
import { parseArguments, execute } from '../adapters/commands.ts';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const request = { schemaVersion: 1, name: 'Capture inbox', purpose: 'Quickly capture and inspect ideas',
  actors: ['Member'], entities: ['Capture'], acceptance: ['A saved capture can be reopened'],
  pages: [
    { title: 'Inbox', kind: 'view', purpose: 'Review captured ideas',
      interactions: [{ kind: 'navigate', label: 'Open details', target: 'Details' },
        { kind: 'action', label: 'Save capture', outcome: 'Persist after validation' }] },
    { title: 'Details', kind: 'page', purpose: 'Inspect a selected capture', interactions: [] },
  ], output: 'definition', verification: 'none' };
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-brainstorm-'));
  try {
    await mkdir(join(root, 'design'));
    const document = newDocument('Capture project');
    await writeFile(join(root, 'design/project.json'), documentText(document));
    await fn({ root, frameworkRoot, project: 'design/project.json', input: Readable.from([]) }, document);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('strict feature contract supports planned actions without inventing executable handlers', () => {
  const baseline = newDocument('Capture project'), sha256 = hash(documentText(baseline));
  const parsed = readFeatureBrainstorm({ ...request, projectId: baseline.project.id, baseSha256: sha256 });
  const result = featureConcept(parsed, { document: baseline, sha256 });
  assert.equal(result.concept.mode, 'feature');
  assert.equal(result.candidate.design.features.items.length, 1);
  assert.equal(result.candidate.design.nodes.length, 2);
  assert.equal(result.candidate.design.links.length, 1, 'planned actions are not links or code');
  assert.match(result.candidate.design.visualDesigns.pages[0].notes, /Persist after validation/);
  assert.deepEqual(baseline.design.nodes, [], 'original project remains untouched');
  assert.ok(brainstormSchema().properties.pages);
  assert.throws(() => readFeatureBrainstorm({ ...request, output: 'definition', verification: 'test' }), error => error?.code === 'BRAINSTORM_VERIFICATION');
  assert.throws(() => readFeatureBrainstorm({ ...request, unexpected: 'execute me' }), error => error?.code === 'MAKER_UNKNOWN_FIELD');
  assert.throws(() => readFeatureBrainstorm({ ...request, pages: [
    { title: 'Inbox', purpose: 'Start', interactions: [{ label: 'Exit', target: 'Missing' }] },
  ] }), error => error?.code === 'BRAINSTORM_TARGET');
  assert.throws(() => featureConcept({ ...parsed, baseSha256: 'e'.repeat(64) },
    { document: baseline, sha256 }), error => error?.code === 'BRAINSTORM_STALE');
});
test('agent discovery, validation and saved definition require the same fresh file-plan approval', async () =>
  scratch(async (options, document) => {
    const before = await readFile(join(options.root, 'design/project.json'), 'utf8');
    const guide = await execute(parseArguments(['brainstorm', 'guide', '--json']), options);
    const schema = await execute(parseArguments(['brainstorm', 'schema', '--json']), options);
    assert.equal(guide.guide.useCases.feature, 'available');
    assert.equal(schema.schema.properties.pages.maxItems, 12);
    const context = await execute(parseArguments(['brainstorm', 'context', '--json']), options);
    const payload = { ...request, projectId: document.project.id, baseSha256: context.baseSha256 };
    const cli = (argv) => execute(parseArguments(argv),
      { ...options, input: Readable.from([JSON.stringify(payload)]) });
    const validated = await cli(['brainstorm', 'validate', '--input', '-', '--json']);
    assert.equal(validated.ready, true);
    assert.equal(validated.mapping.length, 2);
    const preview = await cli(['brainstorm', 'feature', '--input', '-', '--json']);
    assert.equal(preview.status, 'planned');
    await assert.rejects(() => readFile(join(options.root, 'brainstorms/capture-inbox/feature.definition.json')));
    await assert.rejects(() => cli(['brainstorm', 'feature', '--input', '-', '--apply', 'wrong', '--json']), error => error?.code === 'MAKER_APPROVAL');
    const applied = await cli(['brainstorm', 'feature', '--input', '-', '--apply', preview.planHash, '--json']);
    assert.equal(applied.status, 'applied');
    assert.equal(await readFile(join(options.root, 'design/project.json'), 'utf8'), before,
      'brainstorm must not implicitly import the concept');
    const candidate = openDocument(JSON.parse(await readFile(join(options.root,
      'brainstorms/capture-inbox/candidate.project.json'), 'utf8')));
    assert.equal(candidate.design.features.items[0].name, 'Capture inbox');
    const replay = await cli(['brainstorm', 'feature', '--input', '-', '--json']);
    assert.ok(replay.changes.every(change => change.status === 'unchanged'));
    await assert.rejects(() => brainstormVerifyPlan(options, 'brainstorms/capture-inbox'));
  }));
test('human definition and machine definition share the exact canonical plan', async () =>
  scratch(async (options, document) => {
    const payload = readFeatureBrainstorm({ ...request, projectId: document.project.id,
      baseSha256: hash(documentText(document)) });
    const first = await brainstormFeaturePlan(payload, options);
    const second = await brainstormFeaturePlan(payload, options);
    assert.equal(first.planHash, second.planHash);
    await applyPrepared(first, first.planHash);
    const definition = JSON.parse(await readFile(join(options.root,
      'brainstorms/capture-inbox/feature.definition.json'), 'utf8'));
    assert.deepEqual(definition.feature, payload);
    assert.equal((await brainstormFeaturePlan(definition.feature, options)).plan.changes
      .every(change => change.status === 'unchanged'), true);
  }));
test('verification refuses unowned source and ownership-receipt tampering before process planning', { timeout: 180000 }, async () =>
  scratch(async (options, document) => {
    const payload = readFeatureBrainstorm({ ...request, output: 'prototype', verification: 'test',
      projectId: document.project.id, baseSha256: hash(documentText(document)) });
    const plan = await brainstormFeaturePlan(payload, options);
    await applyPrepared(plan, plan.planHash);
    const out = 'brainstorms/capture-inbox', source = join(options.root, out, 'source');
    const definition = JSON.parse(await readFile(join(options.root, out, 'feature.definition.json'), 'utf8'));
    assert.match(definition.generatedSource.receiptSha256, /^[a-f0-9]{64}$/);
    const rogue = join(source, 'rogue.test.mjs');
    await writeFile(rogue, 'throw new Error("unowned test executed");\n');
    await assert.rejects(() => brainstormVerifyPlan(options, out), error => error?.code === 'BRAINSTORM_SOURCE_CHANGED');
    await rm(rogue, { force: true });
    const receipt = join(source, '.maker/receipt.json'), original = await readFile(receipt, 'utf8');
    await writeFile(receipt, original + ' ');
    await assert.rejects(() => brainstormVerifyPlan(options, out), error => error?.code === 'BRAINSTORM_SOURCE_CHANGED');
  }));
