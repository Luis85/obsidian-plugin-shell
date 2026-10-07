import { mkdtemp, mkdir, writeFile, readFile, cp, rm, symlink, realpath } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createFilePlan } from '#shared/platform/file-plan.ts';

export const makerSourceRoot = fileURLToPath(new URL('../../../../', import.meta.url));
// The fixture keeps the generated-project layout; its inputs come from where this repository keeps them.
const sourceLocations = [
  ['src/bootstrap/', 'src/plugin/bootstrap/'], ['src/application', 'src/plugin/application'], ['src/domain', 'src/plugin/domain'],
  ['src/infrastructure/', 'src/plugin/infrastructure/'], ['src/features/', 'src/plugin/features/'], ['tests/runtime/', 'src/plugin/tests/unit/'],
  ['scripts/makers', 'tooling/makers'], ['scripts/companion/', 'src/shared/companion/'], ['scripts/events', 'tooling/events'],
  ['scripts/examples/', 'tooling/examples/'], ['scripts/shared', 'src/shared/platform'],
  ['tests/tooling/makers.checks.mjs', 'tooling/tests/makers.checks.mjs'], ['tests/tooling/maker-fixture.mjs', 'src/cli/tests/support/maker-fixture.mjs'],
];
/** This repository's location of a file the fixture places at `path`. */
export function makerSource(path) {
  const entry = sourceLocations.find(([fixture]) => path === fixture || path.startsWith(fixture));
  return resolve(makerSourceRoot, entry ? entry[1] + path.slice(entry[0].length) : path);
}
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

// Default to the canonical temporary directory: on macOS tmpdir() lives under the /var symlink,
// which the file-plan root check correctly refuses. Callers may still pass an alias explicitly.
export async function makerFixture(work, { temporaryRoot } = {}) {
  const requested = await mkdtemp(join(temporaryRoot ?? await realpath(tmpdir()), 'template-maker-'));
  const root = await realpath(requested);
  try {
    // Keep root/link validation on the original spelling, then use one canonical
    // path for Vite config, module IDs and child cwd (Windows TEMP may be 8.3).
    await createFilePlan(requested, []);
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), registry);
    await writeFile(join(root, 'src/bootstrap/authoring.ts'), authoring);
    await cp(makerSource('src/bootstrap/native-integrations.ts'), join(root, 'src/bootstrap/native-integrations.ts'));
    for (const [file, source] of Object.entries(eventRegistries)) await writeFile(join(root, 'src/bootstrap', file), source);
    await cp(makerSource('src/bootstrap/core-event-catalog.ts'), join(root, 'src/bootstrap/core-event-catalog.ts'));
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
    await cp(makerSource(path), target, { recursive: true });
    // src/plugin/tests/unit reaches the runtime at ../../<layer>; the fixture's tests/runtime reaches it at ../../src/<layer>.
    if (path.startsWith('tests/runtime/')) await writeFile(target, (await readFile(target, 'utf8')).replaceAll("from '../../", "from '../../src/"));
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
  await mkdir(join(root, 'configs/testing'), { recursive: true });
  await writeFile(
    join(root, 'configs/testing/vitest.config.mjs'),
    "import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()], test: { include: ['tests/runtime/generated/**/*.test.ts'], environment: 'node', fileParallelism: false } };\n",
  );
}

export async function copyMakerSuite(root) {
  for (const path of [
    'scripts/makers',
    'scripts/companion/native-contract.mjs',
    'scripts/events',
    'scripts/examples/plan.mjs',
    'scripts/shared',
    'tests/tooling/makers.checks.mjs',
    'tests/tooling/maker-fixture.mjs',
  ]) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await cp(makerSource(path), target, { recursive: true });
  }
  // A source checkout carries the whole CLI: generated locale checks run the project's own bin/app.
  await symlink(resolve(makerSourceRoot, 'bin'), join(root, 'bin'), process.platform === 'win32' ? 'junction' : 'dir');
  await symlink(resolve(makerSourceRoot, 'src/cli'), join(root, 'src/cli'), process.platform === 'win32' ? 'junction' : 'dir');
}
