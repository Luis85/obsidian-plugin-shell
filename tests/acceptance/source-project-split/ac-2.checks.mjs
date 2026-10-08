// source-project-split AC-2: selected source targeting and ambiguity preserve unrelated sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makerFixture } from '../../../src/cli/tests/support/maker-fixture.mjs';
import { parseArguments } from '../../../src/cli/adapters/makers/arguments.ts';
import { planMaker } from '../../../src/cli/adapters/makers/plan.ts';
import { applyFilePlan } from '../../../src/shared/platform/file-plan.ts';

test('source-project-split AC-2: named makers write only the selected project and ambiguity writes nothing', () => makerFixture(async root => {
  await rename(join(root, 'src'), join(root, 'original'));
  await mkdir(join(root, 'src'));
  await rename(join(root, 'original'), join(root, 'src/second'));
  await mkdir(join(root, 'src/first'), { recursive: true });
  await writeFile(join(root, 'src/first/keep.txt'), 'Unrelated source');
  await writeFile(join(root, 'workbench.sources.json'), JSON.stringify({ schemaVersion: 1, projects: ['first', 'second'].map(name => ({ name, kind: 'plugin', path: `src/${name}`, references: [] })) }));
  const before = await readdir(root, { recursive: true });
  const args = ['feature', 'notes', '--backend', 'domain'];
  await assert.rejects(planMaker(root, parseArguments(args)), /first, second/);
  assert.deepEqual(await readdir(root, { recursive: true }), before);
  const planned = await planMaker(root, parseArguments([...args, '--source', 'second']));
  assert.ok(planned.plan.changes.filter(change => change.status === 'create').every(change => change.path.startsWith('src/second/')));
  assert.deepEqual(await readdir(root, { recursive: true }), before, 'preview must not write');
  await applyFilePlan(planned.plan);
  assert.match(await readFile(join(root, 'src/second/features/notes/notes.entity.ts'), 'utf8'), /defineEntity/);
  assert.equal(await readFile(join(root, 'src/first/keep.txt'), 'utf8'), 'Unrelated source');
  assert.deepEqual(await readdir(join(root, 'src/first')), ['keep.txt']);
}));
