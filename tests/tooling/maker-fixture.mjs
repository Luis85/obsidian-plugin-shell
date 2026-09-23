import { mkdtemp, mkdir, writeFile, readFile, cp, rm, symlink } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const makerSourceRoot = fileURLToPath(new URL('../../', import.meta.url));
// Representative syntax belongs to the tooling test, never to a consumer's live registry.
const registry = `import { createNoteFeatures } from '../application/note-feature';
import { taskFeature } from '../features/tasks/definition';
import { projectFeature } from '../features/projects/definition';

export function createFeatures(services: Parameters<typeof createNoteFeatures>[0]) {
  return createNoteFeatures(services, register => ({
    task: register(taskFeature),
    project: register(projectFeature),
  }));
}
`;

export async function makerFixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'template-maker-'));
  try {
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), registry);
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

/** Exercise the real reusable implementation without inheriting any worked/user feature. */
export async function installMakerFoundation(root) {
  const paths = ['src/application', 'src/domain', 'src/infrastructure/events', 'src/infrastructure/markdown.ts',
    'src/features/api.ts', 'tests/runtime/entity-fixture.ts', 'tests/runtime/memory-storage.ts'];
  for (const path of paths) {
    const target = join(root, path); await mkdir(dirname(target), { recursive: true });
    await cp(resolve(makerSourceRoot, path), target, { recursive: true });
  }
  for (const [owner, name] of [['tasks', 'task'], ['projects', 'project']]) {
    const folder = join(root, 'src/features', owner); await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'definition.ts'), `// Synthetic removable fixture; not the template's worked business example.
import { defineEntity, fields, defineDocument, defineNoteFeature, heading } from '../api';
const entity = defineEntity('fixture-${name}', 1, { title: fields.text({ min: 1 }) });
export const ${name}Feature = defineNoteFeature({ defaultFolder: 'Fixture', document: defineDocument(entity, {
  mappings: [{ field: 'title', property: 'title' }], title: value => value.title, body: value => heading(value.title),
}) });
`);
  }
  await writeFile(join(root, 'package.json'), '{"name":"independent-author-fixture","type":"module"}');
  await symlink(resolve(makerSourceRoot, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(root, 'vitest.config.mjs'), "export default { test: { include: ['tests/runtime/generated/**/*.test.ts'], environment: 'node', fileParallelism: false } };\n");
}

export async function removeMakerExamples(root) {
  await rm(join(root, 'src/features/tasks'), { recursive: true });
  await rm(join(root, 'src/features/projects'), { recursive: true });
  const path = join(root, 'src/bootstrap/features.ts');
  const source = (await readFile(path, 'utf8')).split('\n').filter(line => !line.includes("../features/tasks/definition") && !line.includes("../features/projects/definition") && !/^\s*(task|project):/.test(line)).join('\n');
  await writeFile(path, source);
}

export async function copyMakerSuite(root) {
  for (const path of ['scripts/makers', 'scripts/shared', 'tests/tooling/makers.checks.mjs', 'tests/tooling/maker-fixture.mjs']) {
    const target = join(root, path); await mkdir(dirname(target), { recursive: true });
    await cp(resolve(makerSourceRoot, path), target, { recursive: true });
  }
}
