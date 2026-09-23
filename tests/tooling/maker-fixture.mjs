import { mkdtemp, mkdir, writeFile, readFile, cp, rm, symlink, realpath } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { planExampleRemoval } from '../../scripts/examples/plan.mjs';

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
const authoring = `import { createAuthoringRuntime, type AuthoringServices, type AuthoringExtension } from '../application/authoring';
import type { EventDefinition, EventMapOf } from '../application/event-definition';
import type { EventPublisher, EventSubscriber } from '../application/events';
import type { Component } from 'vue';
import type { createFeatures } from './features';
type Capabilities = AuthoringServices & { readonly repositories: ReturnType<typeof createFeatures>['repositories'] };
type PublisherFactory = <D extends EventDefinition>(definition: D) => EventPublisher<EventMapOf<D>>;
type SubscriberFactory = <N extends string, P>(definition: EventDefinition<N, P>) => EventSubscriber<P>;
const authoringFactories: readonly ((services: Capabilities, publisher: PublisherFactory, subscriber: SubscriberFactory) => AuthoringExtension)[] = [];
export const authoringPanels: readonly { readonly id: string; readonly titleKey: string; readonly component: Component; readonly props: (services: Capabilities) => Record<string, unknown> }[] = [];
export function createAuthoring(services: Capabilities, publisher: PublisherFactory, subscriber: SubscriberFactory) {
  return createAuthoringRuntime(authoringFactories.map(factory => (capabilities: Capabilities) => factory(capabilities, publisher, subscriber)), services);
}
`;
const eventRegistries = {
  'events.ts': `import { composeEvents, type EventDefinition } from '../application/event-definition';
import { coreEvents } from '../application/event-definitions/core';
import { hostEvents } from '../application/event-definitions/host';
import { exampleEvents } from './example-events';
const featureEvents: readonly EventDefinition[] = [];
export const runtimeEventDefinitions = composeEvents(coreEvents, hostEvents, exampleEvents, featureEvents);
`,
  'event-catalog.ts': `import { coreEventCatalog, type EventCatalogEntry } from './core-event-catalog';
import { exampleEventCatalog } from './example-event-catalog';
export const featureEventCatalog: readonly EventCatalogEntry[] = [];
export const eventCatalog = [...coreEventCatalog, ...exampleEventCatalog, ...featureEventCatalog];
`,
  'example-events.ts': `import type { EventDefinition } from '../application/event-definition';
export const exampleEvents: readonly EventDefinition[] = [];
`,
  'example-event-catalog.ts': `import type { EventCatalogEntry } from './core-event-catalog';
export const exampleEventCatalog: readonly EventCatalogEntry[] = [];
`,
};

export async function makerFixture(work, { temporaryRoot = tmpdir() } = {}) {
  const requested = await mkdtemp(join(temporaryRoot, 'template-maker-'));
  const root = await realpath(requested);
  try {
    // Keep root/link validation on the original spelling, then use one canonical
    // path for Vite config, module IDs and child cwd (Windows TEMP may be 8.3).
    await createFilePlan(requested, []);
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), registry);
    await writeFile(join(root, 'src/bootstrap/authoring.ts'), authoring);
    for (const [file, source] of Object.entries(eventRegistries)) await writeFile(join(root, 'src/bootstrap', file), source);
    await cp(join(makerSourceRoot, 'src/bootstrap/core-event-catalog.ts'), join(root, 'src/bootstrap/core-event-catalog.ts'));
    await writeFile(join(root, 'src/bootstrap/authoring-locales.ts'), 'export const authoringLocaleModules = [\n];\n');
    await writeFile(join(root, 'src/bootstrap/authoring-domains.ts'), 'export const authoringDomains = [\n];\n');
    await work(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Exercise the real reusable implementation without inheriting any worked/user feature. */
export async function installMakerFoundation(root) {
  const paths = [
    'src/application',
    'src/domain',
    'src/infrastructure/events',
    'src/infrastructure/markdown.ts',
    'src/features/api.ts',
    'tests/runtime/entity-fixture.ts',
    'tests/runtime/memory-storage.ts',
    'tests/runtime/authoring-fixture.ts',
  ];
  for (const path of paths) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(makerSourceRoot, path), target, { recursive: true });
  }
  const files = []; const registrations = [];
  for (const [owner, name] of [
    ['tasks', 'task'],
    ['projects', 'project'],
  ]) {
    const folder = join(root, 'src/features', owner);
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, 'definition.ts'),
      `// Synthetic removable fixture; not the template's worked business example.
import { defineEntity, fields, defineDocument, defineNoteFeature, heading } from '../api';
const entity = defineEntity('fixture-${name}', 1, { title: fields.text({ min: 1 }) });
export const ${name}Feature = defineNoteFeature({ defaultFolder: 'Fixture', document: defineDocument(entity, {
  mappings: [{ field: 'title', property: 'title' }], title: value => value.title, body: value => heading(value.title),
}) });
`,
    );
    const path = `src/features/${owner}/definition.ts`;
    files.push({ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') });
    registrations.push({ key: name, local: `${name}Feature`, from: `../features/${owner}/definition`, expression: `register(${name}Feature)` });
  }
  await mkdir(join(root, 'scripts/examples'), { recursive: true });
  await writeFile(join(root, 'scripts/examples/ownership.json'), JSON.stringify({ version: 1, files, registrations }));
  await writeFile(join(root, 'package.json'), '{"name":"independent-author-fixture","type":"module"}');
  await symlink(
    resolve(makerSourceRoot, 'node_modules'),
    join(root, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await writeFile(
    join(root, 'vitest.config.mjs'),
    "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()], test: { include: ['tests/runtime/generated/**/*.test.ts'], environment: 'node', fileParallelism: false } };\n",
  );
}

export async function removeMakerExamples(root) {
  await applyFilePlan((await planExampleRemoval(root)).plan);
}

export async function copyMakerSuite(root) {
  for (const path of [
    'scripts/makers',
    'scripts/events',
    'scripts/examples/plan.mjs',
    'scripts/shared',
    'scripts/quality/format-generated.mjs',
    'tests/tooling/makers.checks.mjs',
    'tests/tooling/maker-fixture.mjs',
  ]) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(makerSourceRoot, path), target, { recursive: true });
  }
}
