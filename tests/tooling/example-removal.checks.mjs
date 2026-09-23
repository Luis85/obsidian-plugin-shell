import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, rename, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { planExampleRemoval } from '../../scripts/examples/plan.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';

async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'remove-owned-examples-'));
  try {
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await mkdir(join(root, 'scripts/examples/templates'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), `import { createNoteFeatures } from '../application/note-feature';
import { taskFeature } from '../features/tasks/definition';
import { projectFeature } from '../features/projects/definition';
import { bookmarkFeature } from '../features/bookmarks/definition';
export function createFeatures(services) {
  return createNoteFeatures(services, register => ({
    task: register(taskFeature),
    project: register(projectFeature),
    bookmark: register(bookmarkFeature),
  }));
}
`);
    await writeFile(join(root, 'example.txt'), 'reviewed example\n');
    await writeFile(join(root, 'consumer.txt'), 'business source\n');
    await writeFile(join(root, 'scripts/examples/ownership.json'), JSON.stringify({ version: 1,
      registrations: [
        { key: 'task', local: 'taskFeature', from: '../features/tasks/definition', expression: 'register(taskFeature)' },
        { key: 'project', local: 'projectFeature', from: '../features/projects/definition', expression: 'register(projectFeature)' },
      ], files: [{ path: 'example.txt', sha256: createHash('sha256').update('reviewed example\n').digest('hex') }] }));
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
test('removal plan deletes only reviewed files, preserves consumer registration and reruns without changes', async () => {
  await fixture(async root => {
    const plan = await planExampleRemoval(root);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'reviewed example\n');
    await applyFilePlan(plan.plan);
    await assert.rejects(readFile(join(root, 'example.txt')), { code: 'ENOENT' });
    const registry = await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8');
    assert.match(registry, /bookmark: register\(bookmarkFeature\)/);
    assert.doesNotMatch(registry, /taskFeature|projectFeature/);
    assert.equal(await readFile(join(root, 'consumer.txt'), 'utf8'), 'business source\n');
    assert.deepEqual((await applyFilePlan((await planExampleRemoval(root)).plan)).written, []);
  });
});
test('typed preference binding and consumer override survive with one stable no-op on repeated apply', async () => {
  await fixture(async root => {
    const path = join(root, 'src/bootstrap/features.ts');
    const source = (await readFile(path, 'utf8')).replace('createFeatures(services)', 'createFeatures(services, preferences: PreferenceService)')
      .replace('bookmark: register(bookmarkFeature)', 'bookmark: register(bookmarkFeature, () => preferences.current.taskFolder)');
    await writeFile(path, source);
    await applyFilePlan((await planExampleRemoval(root)).plan);
    const first = await readFile(path, 'utf8');
    assert.match(first, /preferences: PreferenceService/); assert.doesNotMatch(first, /_preferences/);
    assert.match(first, /bookmark: register\(bookmarkFeature, \(\) => preferences.current.taskFolder\)/);
    assert.equal(first.match(/void preferences;/g)?.length, 1);
    assert.deepEqual((await applyFilePlan((await planExampleRemoval(root)).plan)).written, []);
    assert.equal(await readFile(path, 'utf8'), first);
  });
});
test('edited registration calls, swapped keys and imported aliases conflict without deleting source', async () => {
  for (const edit of [
    text => text.replace('register(taskFeature)', 'register(taskFeature, () => "Custom folder")'),
    text => text.replace('task: register(taskFeature)', 'changed: register(taskFeature)'),
    text => text.replace('{ taskFeature }', '{ renamed as taskFeature }'),
    text => text + '\nconst custom = { taskAlias: use(taskFeature) };\n',
  ]) await fixture(async root => {
    const path = join(root, 'src/bootstrap/features.ts'); const changed = edit(await readFile(path, 'utf8')); await writeFile(path, changed);
    await assert.rejects(planExampleRemoval(root), /EXAMPLES_(EDITED_REGISTRATION|EDITED_IMPORT|SURVIVING_REFERENCE)/);
    assert.equal(await readFile(path, 'utf8'), changed);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'reviewed example\n');
  });
});
test('fully empty foundation uses zero callback parameters and remains compatible with registry parsing', async () => {
  await fixture(async root => {
    const path = join(root, 'src/bootstrap/features.ts');
    const source = (await readFile(path, 'utf8')).replace("import { bookmarkFeature } from '../features/bookmarks/definition';\n", '').replace('    bookmark: register(bookmarkFeature),\n', '');
    await writeFile(path, source);
    await applyFilePlan((await planExampleRemoval(root)).plan);
    assert.match(await readFile(path, 'utf8'), /createNoteFeatures\(services, \(\) =>/);
    assert.deepEqual((await applyFilePlan((await planExampleRemoval(root)).plan)).written, []);
  });
});
test('template escapes, symlink redirects and changing template/manifest inputs fail before source writes', async () => {
  await fixture(async root => {
    const path = join(root, 'scripts/examples/ownership.json'); const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.files[0].template = '../outside.txt'; await writeFile(path, JSON.stringify(manifest));
    await assert.rejects(planExampleRemoval(root), /EXAMPLES_INVALID_MANIFEST/);
    manifest.files[0].template = 'replacement.txt'; await writeFile(path, JSON.stringify(manifest));
    const template = join(root, 'scripts/examples/templates/replacement.txt'); await writeFile(template, 'replacement\n');
    await assert.rejects(planExampleRemoval(root, { beforeFinalize: () => writeFile(template, 'concurrent replacement\n') }), /EXAMPLES_STALE_TEMPLATE_OR_MANIFEST/);
    await assert.rejects(planExampleRemoval(root, { beforeFinalize: () => writeFile(path, JSON.stringify(manifest) + '\n') }), /EXAMPLES_STALE_TEMPLATE_OR_MANIFEST/);
    await rename(join(root, 'scripts/examples/templates'), join(root, 'scripts/examples/redirected'));
    await symlink(join(root, 'scripts/examples/redirected'), join(root, 'scripts/examples/templates'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(planExampleRemoval(root), /PLAN_SYMLINK/);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'reviewed example\n');
  });
});
test('source changed after a reviewed deletion plan is preserved when apply refuses the stale plan', async () => {
  await fixture(async root => {
    const result = await planExampleRemoval(root);
    await writeFile(join(root, 'example.txt'), 'human edit after review\n');
    await assert.rejects(applyFilePlan(result.plan), /PLAN_STALE/);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'human edit after review\n');
    assert.match(await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8'), /taskFeature/);
  });
});
test('edited examples and concurrent registry changes fail before removal, with original data retained', async () => {
  await fixture(async root => {
    await writeFile(join(root, 'example.txt'), 'my edited example\n');
    await assert.rejects(planExampleRemoval(root), /EXAMPLES_EDITED_FILES: example.txt/);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'my edited example\n');
    await writeFile(join(root, 'example.txt'), 'reviewed example\n');
    await assert.rejects(planExampleRemoval(root, { beforeFinalize: async () => {
      await writeFile(join(root, 'src/bootstrap/features.ts'), '// preserved concurrent edit\n');
    } }), /EXAMPLES_STALE_INPUT/);
    assert.equal(await readFile(join(root, 'example.txt'), 'utf8'), 'reviewed example\n');
    assert.equal(await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8'), '// preserved concurrent edit\n');
  });
});
