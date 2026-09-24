import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { planExampleRemoval } from '../../scripts/examples/plan.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';

const reviewed = '# Reviewed template\n';
const replacement = '# Independent foundation\n';
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'readme-ownership-'));
  try {
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await mkdir(join(root, 'scripts/examples/templates'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), `import { createNoteFeatures } from '../application/note-feature';
export function createFeatures(services) { return createNoteFeatures(services, () => ({})); }
`);
    await writeFile(join(root, 'scripts/examples/ownership.json'), JSON.stringify({ version: 1, registrations: [],
      files: [{ path: 'README.md', sha256: createHash('sha256').update(reviewed).digest('hex'), template: 'README.md.txt' }] }));
    await writeFile(join(root, 'scripts/examples/templates/README.md.txt'), replacement);
    await writeFile(join(root, 'README.md'), reviewed);
    await writeFile(join(root, 'consumer.txt'), 'business source\n');
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('[OWN-README-01] exact reviewed README replacement is preview-only until applied and reruns identically', () => fixture(async root => {
  const planned = await planExampleRemoval(root);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), reviewed);
  await applyFilePlan(planned.plan);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), replacement);
  assert.deepEqual((await applyFilePlan((await planExampleRemoval(root)).plan)).written, []);
  assert.equal(await readFile(join(root, 'consumer.txt'), 'utf8'), 'business source\n');
}));
test('[OWN-README-02] a modified README conflicts before any source is changed', () => fixture(async root => {
  const custom = reviewed + '\nUser-owned introduction.\n';
  await writeFile(join(root, 'README.md'), custom);
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_EDITED_FILES: README\.md/);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), custom);
  assert.equal(await readFile(join(root, 'consumer.txt'), 'utf8'), 'business source\n');
}));
