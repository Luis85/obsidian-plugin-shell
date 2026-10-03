import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { status } from '../../bin/adapters/framework/inspection.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const staleCodes = diagnostics => diagnostics.filter(item => item.code === 'DESIGN_GENERATION_STALE');

test('doctor is clean right after generation from a differently formatted input, and still detects a real design change', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'doctor-generation-'));
  try {
    const starter = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8'));
    // Four-space indentation and no trailing newline: the generator writes its own normalized design/project.json.
    const raw = JSON.stringify(starter.document ?? starter, null, 4);
    const input = join(vault, 'project.json'); await writeFile(input, raw);
    const plan = await planProject({ input, vault, target: 'plugin' }); await applyProject(plan, plan.hash);
    const project = join(vault, 'plugin'), designPath = join(project, 'design/project.json');
    const design = await readFile(designPath);
    assert.notEqual(sha256(design), sha256(raw), 'the written design is normalized, so it differs from the raw input bytes');
    const receipt = JSON.parse(await readFile(join(project, '.companion/generation.json'), 'utf8'));
    assert.equal(receipt.inputHash, sha256(design), 'the receipt records the accepted design bytes that doctor re-hashes');

    const context = { root: project, frameworkRoot: root };
    const fresh = await status(context, 'doctor');
    assert.equal(fresh.data.generated, true); assert.equal(fresh.data.imported, true);
    assert.equal(fresh.data.designStale, false); assert.deepEqual(staleCodes(fresh.diagnostics), []);

    // A real later design change is still reported, and restoring the bytes clears it.
    const edited = JSON.parse(design.toString('utf8')); edited.project.name = 'Renamed after generation';
    await writeFile(designPath, JSON.stringify(edited, null, 2) + '\n');
    const changed = await status(context, 'doctor');
    assert.equal(changed.data.designStale, true); assert.equal(staleCodes(changed.diagnostics).length, 1);
    await writeFile(designPath, design);
    assert.equal((await status(context, 'doctor')).data.designStale, false);
  } finally { await rm(vault, { recursive: true, force: true }); }
});
