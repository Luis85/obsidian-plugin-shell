// Increment: [[docs/increments/agent-plugin-scaffold-journey]]
// AC-1: `make batch` plans a bare feature, a custom file type with a Vue editor and a context-menu action as one reviewed plan; applying it writes every file once and a replay is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makerFixture, makerSourceRoot, installMakerFoundation } from '../../../src/cli/tests/support/maker-fixture.mjs';
import { applyFilePlan } from '../../../src/shared/platform/file-plan.ts';
import { planMakerBatch } from '../../../src/cli/adapters/makers/batch.ts';

const skeleton = {
  schemaVersion: 1,
  description: 'A kanban board file type with its own editor and an inspect action.',
  steps: [
    { recipe: 'feature', name: 'documents', bare: true },
    { recipe: 'file-extension', name: 'board', feature: 'documents', extension: 'board', format: 'json', editor: 'vue' },
    { recipe: 'context-menu', name: 'inspect', feature: 'documents', extensions: ['md', 'board'] },
  ],
};

test('[AC-1] make batch plans a whole plugin skeleton as one reviewed plan, applies it once and replays unchanged', { timeout: 180000 }, () => makerFixture(async root => {
  await installMakerFoundation(root);
  await mkdir(join(root, 'src/locales'), { recursive: true });
  await cp(join(makerSourceRoot, 'src/plugin/locales/en.json'), join(root, 'src/locales/en.json'));
  const planned = await planMakerBatch(root, skeleton);
  assert.equal(planned.maker, 'batch');
  assert.deepEqual(planned.steps, skeleton.steps.map(({ recipe, name }) => ({ recipe, name })));
  const created = planned.plan.changes.filter(change => change.status === 'create').map(change => change.path);
  assert.equal(new Set(created).size, created.length, 'every file is planned once');
  assert.ok(created.includes('src/features/documents/README.md'), 'the bare feature owns only its folder');
  assert.ok(!created.some(path => path.startsWith('src/features/documents/') && /entity|workspace|about/.test(path)), 'no example entity, workspace or command');
  assert.ok(created.includes('src/features/documents/board.file-extension.ts'));
  assert.ok(created.includes('src/features/documents/inspect.context-menu.ts'));
  for (const path of ['src/presentation/components/generated/documents-board-editor.vue', 'src/presentation/composables/documents-board-editor.ts', 'tests/runtime/generated/documents-board-file-editor.test.ts'])
    assert.ok(created.includes(path), `the Vue editor: ${path}`);
  assert.ok(planned.checks.length > 0, 'one targeted check run for the whole batch');
  assert.deepEqual(await readdir(join(root, 'src/features')).then(names => names.includes('documents')), false, 'planning writes nothing');

  await applyFilePlan(planned.plan);
  const registry = await readFile(join(root, 'src/bootstrap/native-integrations.ts'), 'utf8');
  assert.match(registry, /documentsBoard/);
  assert.match(registry, /documentsInspectContextMenu/);
  const replay = await planMakerBatch(root, skeleton).catch(error => error);
  assert.ok(replay instanceof Error && /already exists/.test(replay.message), 'replaying the same skeleton refuses to recreate the feature');
  const children = await planMakerBatch(root, { schemaVersion: 1, steps: skeleton.steps.slice(1) });
  assert.ok(children.plan.changes.every(change => change.status === 'unchanged'), 'the applied child steps replay unchanged');
}));
