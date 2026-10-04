import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadDefinitions } from '../../bin/adapters/starters/repository.ts';
import { customizeStarter } from '../../bin/adapters/starters/customize.ts';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { planExampleRemoval } from '../../scripts/examples/plan.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';

const reviewed = '# Reviewed template\n';
const replacement = '# Independent foundation\n';
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'readme-ownership-'));
  try {
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await mkdir(join(root, 'templates/examples'), { recursive: true });
    await mkdir(join(root, 'scripts/examples'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), `import { createNoteFeatures } from '../application/note-feature';
export function createFeatures(services) { return createNoteFeatures(services, () => ({})); }
`);
    await writeFile(join(root, 'scripts/examples/ownership.json'), JSON.stringify({ version: 1, registrations: [],
      files: [{ path: 'README.md', sha256: createHash('sha256').update(reviewed).digest('hex'), template: 'README.md.txt', generated: 'retain' }] }));
    await writeFile(join(root, 'templates/examples/README.md.txt'), replacement);
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
test('[OWN-README-03] edits after preview block apply without changing other source', () => fixture(async root => {
  const registry = await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8');
  const planned = await planExampleRemoval(root);
  const custom = reviewed + '\nEdited after preview.\n';
  await writeFile(join(root, 'README.md'), custom);
  await assert.rejects(applyFilePlan(planned.plan), /PLAN_STALE/);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), custom);
  assert.equal(await readFile(join(root, 'consumer.txt'), 'utf8'), 'business source\n');
  assert.equal(await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8'), registry);
}));

const sha = text => createHash('sha256').update(text).digest('hex');
const generatedReadme = '# Generated product\n\nThis project\'s own README.\n';
async function receipt(root, files) {
  await mkdir(join(root, '.companion'), { recursive: true });
  await writeFile(join(root, '.companion/generation.json'), JSON.stringify({ version: 1, projectId: 'p', inputHash: sha('x'), files }));
}
test('[OWN-README-04] in a generated project the README recorded by the receipt is retained, not replaced', () => fixture(async root => {
  await writeFile(join(root, 'README.md'), generatedReadme);
  await receipt(root, [{ path: 'README.md', hash: sha(generatedReadme), ownership: 'extension' }]);
  const planned = await planExampleRemoval(root);
  assert.ok(!planned.plan.changes.some(change => change.path === 'README.md'), 'the README is not part of the write plan');
  assert.ok(planned.preserved.includes('README.md (generated project file, receipt hash verified)'));
  await applyFilePlan(planned.plan);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), generatedReadme);
  assert.deepEqual((await applyFilePlan((await planExampleRemoval(root)).plan)).written, []);
}));
test('[OWN-README-05] a generated README edited after generation conflicts; the framework preimage does not apply there', () => fixture(async root => {
  const edited = generatedReadme + 'Owner notes.\n';
  await writeFile(join(root, 'README.md'), edited);
  await receipt(root, [{ path: 'README.md', hash: sha(generatedReadme), ownership: 'extension' }]);
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_EDITED_FILES: README\.md/);
  // The reviewed framework README is not an accepted preimage once a receipt names the project's own README.
  await writeFile(join(root, 'README.md'), reviewed);
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_EDITED_FILES: README\.md/);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), reviewed);
}));
test('[OWN-README-06] unrecorded, invalid or changing receipts fail closed', () => fixture(async root => {
  await receipt(root, [{ path: 'other.md', hash: sha('o'), ownership: 'extension' }]);
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_UNRECORDED_GENERATED_FILE: README\.md/);
  for (const files of [[{ path: 'README.md', hash: 'short' }], [{ path: 'README.md', hash: sha('a') }, { path: 'README.md', hash: sha('b') }], 'none']) {
    await receipt(root, files);
    await assert.rejects(planExampleRemoval(root), /EXAMPLES_INVALID_RECEIPT/);
  }
  await writeFile(join(root, '.companion/generation.json'), '{not json');
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_INVALID_RECEIPT/);
  await writeFile(join(root, 'README.md'), generatedReadme);
  await receipt(root, [{ path: 'README.md', hash: sha(generatedReadme), ownership: 'extension' }]);
  await assert.rejects(planExampleRemoval(root, { beforeFinalize: () => receipt(root, [{ path: 'README.md', hash: sha(generatedReadme), ownership: 'managed' }]) }),
    /EXAMPLES_STALE_TEMPLATE_OR_MANIFEST: \.companion\/generation\.json/);
  const manifest = JSON.parse(await readFile(join(root, 'scripts/examples/ownership.json'), 'utf8'));
  manifest.files[0].generated = 'replace';
  await writeFile(join(root, 'scripts/examples/ownership.json'), JSON.stringify(manifest));
  await assert.rejects(planExampleRemoval(root), /EXAMPLES_INVALID_MANIFEST/);
}));
test('[OWN-README-07] a freshly generated blank project plans example removal without conflicts', async t => {
  const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
  if (await reviewedExamplesRemoved(frameworkRoot)) { t.skip('Generated projects carry examples only from a checkout that still has the reviewed example sources.'); return; }
  const vault = await mkdtemp(join(tmpdir(), 'readme-generated-'));
  try {
    const loaded = (await loadDefinitions(frameworkRoot)).find(entry => entry.definition.id === 'blank');
    const document = customizeStarter(loaded, { id: 'fresh-blank', name: 'Fresh Blank', author: 'Test', description: 'Blank', version: '0.1.0', codebaseFolder: 'src', testsFolder: 'tests' });
    const input = join(vault, 'project.json'); await writeFile(input, JSON.stringify(document));
    const plan = await planProject({ input, vault, target: 'plugin', templateRoot: frameworkRoot }); await applyProject(plan, plan.hash);
    const target = join(vault, 'plugin'), readme = await readFile(join(target, 'README.md'), 'utf8');
    const planned = await planExampleRemoval(target);
    assert.ok(planned.plan.changes.some(change => change.path === 'src/features/tasks/definition.ts' && change.status === 'delete'));
    assert.match(planned.plan.changes.find(change => change.path === 'src/bootstrap/features.ts').status, /^update$/);
    assert.ok(!planned.plan.changes.some(change => change.path === 'README.md'));
    await applyFilePlan(planned.plan);
    assert.equal(await readFile(join(target, 'README.md'), 'utf8'), readme);
    assert.doesNotMatch(await readFile(join(target, 'src/bootstrap/features.ts'), 'utf8'), /taskFeature|projectFeature|itemFeature/);
  } finally { await rm(vault, { recursive: true, force: true }); }
});
