import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadGuide, prototypePlan } from '../../bin/adapters/prototype.ts';
import { applyPrepared, readData } from '../../bin/adapters/storage.ts';
import { openDocument } from '../../bin/domain/document.ts';
import { checkSteps } from '../../bin/adapters/framework/check.ts';
import { compile } from '../../bin/adapters/compiler.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
test('prototype maker creates real compiler boilerplate, docs and a fully expanded prompt', { timeout: 180000 }, async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-prototype-'));
  try {
    const guide = await loadGuide();
    const input = { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { title: 'Issue desk', pages: ['Issues', 'Details'], components: ['Issue card'], approved: true } };
    const plan = await prototypePlan({ root, frameworkRoot, out: 'prepared', guide, input, baseline: null });
    await assert.rejects(() => readFile(join(root, 'prepared/companion.project.json')));
    const again = await prototypePlan({ root, frameworkRoot, out: 'prepared', guide, input, baseline: null });
    assert.equal(again.planHash, plan.planHash);
    const prompt = plan.data.prompt; assert.match(prompt, /Issue desk/); assert.ok(!/\{\{[a-zA-Z]/.test(prompt));
    assert.match(prompt, /not.*completed prototype/i);
    const paths = plan.plan.changes.map(item => item.path);
    for (const path of ['source/harness/prototype/main.ts', 'source/package-lock.json', 'source/bin/app.ts', 'design-brief.md', 'prototype-answers.json', 'integration-map.json', 'README.md']) assert.ok(paths.includes('prepared/' + path), path);
    await applyPrepared(plan, plan.planHash);
    const document = openDocument(await readData(join(root, 'prepared/companion.project.json')));
    assert.equal(document.design.nodes.length, 2);
    const receipt = await readData(join(root, 'prepared/source/.companion/generation.json'));
    assert.equal(receipt.projectId, document.project.id);
    assert.ok(receipt.files.some(file => file.path === 'bin/app.ts' && file.ownership === 'framework'));
    const gate = await checkSteps(join(root, 'prepared/source'), false);
    assert.equal(gate.scope, 'generated-project');
    // Generated source type-checks its shipped maker CLI; the shell's own maker qualification needs shell-only fixtures.
    assert.ok(gate.steps.some(step => step.id === 'maker-types'));
    assert.ok(!gate.steps.some(step => step.id === 'maker-tests'));
    assert.equal(document.design.visualDesigns.components.length, 1);
    assert.equal((await readData(join(root, 'prepared/prototype.manifest.json'))).artifact.sha256, null);
    assert.equal((await readData(join(root, 'prepared/prototype.manifest.json'))).status, 'incomplete');
    assert.equal((await compile(document, frameworkRoot, 'clickdummy')).compilation.status, 'ok');
    const refused = { ...input, answers: { ...input.answers, approved: false } };
    await assert.rejects(() => prototypePlan({ root, frameworkRoot, out: 'refused', guide, input: refused, baseline: null }), /agree/);
    const missing = { ...input, answers: { ...input.answers, mode: 'improvement', baselineRevision: 'a'.repeat(40) } };
    await assert.rejects(() => prototypePlan({ root, frameworkRoot, out: 'missing', guide, input: missing, baseline: null }), /baseline/);
    const feature = await prototypePlan({ root, frameworkRoot, out: 'feature', guide, input: missing, baseline: document });
    assert.ok(feature.plan.changes.some(item => item.path === 'feature/baseline.project.json'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
