import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as ts from 'typescript';

const sourceRoot = resolve(import.meta.dirname, '../..');
test('actual compiler rejects publication and observation rights and widened mismatched unions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'event-types-'));
  try {
    const source = join(root, 'types.ts');
    const from = (path) => JSON.stringify(resolve(sourceRoot, path).replaceAll('\\', '/'));
    const prefix = `import { defineEvent, type EventDefinition } from ${from('src/application/event-definition')};
import type { EventInput, EventObserver, EventPublisher, EventSubscriber } from ${from('src/application/events')};
import { TypedEventBus } from ${from('src/infrastructure/events/typed-event-bus')};
type Facts = { 'one.count': { readonly count: number }; 'two.label': { readonly label: string } };
declare const observer: EventObserver<Pick<Facts, 'one.count'>>;
declare const allObservers: EventObserver<Facts>;
declare const publisher: EventPublisher<Pick<Facts, 'one.count'>>;
declare const subscriber: EventSubscriber<{ readonly count: number }>;
declare const name: keyof Facts;
declare const payload: Facts[keyof Facts];
declare const unknownName: string;
const one = defineEvent('one.count', (v: unknown): v is { readonly count: number } => typeof v === 'object' && v !== null && 'count' in v && typeof v.count === 'number');
const two = defineEvent('two.label', (v: unknown): v is { readonly label: string } => typeof v === 'object' && v !== null && 'label' in v && typeof v.label === 'string');
declare const descriptor: typeof one | typeof two;
declare const erased: EventDefinition;
const bus = new TypedEventBus<Facts>({ report() {} }, [one, two]);
const scoped = bus.publisher(descriptor);
`;
    const compile = async (body) => {
      await writeFile(source, prefix + body);
      const program = ts.createProgram([source], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        types: [],
      });
      return ts.getPreEmitDiagnostics(program).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
    };
    assert.deepEqual(
      await compile(
        `observer.on('one.count', value => { void value.count; }); publisher.publish({ type: 'one.count', payload: { count: 1 } }); scoped.publish({ type: 'two.label', payload: { label: 'ok' } }); subscriber.on(value => { void value.count; });`,
      ),
      [],
    );
    for (const body of [
      `observer.publish({ type: 'one.count', payload: { count: 1 } });`,
      `observer.on('two.label', () => undefined);`,
      `observer.observe(two, () => undefined);`,
      `subscriber.publish({ type: 'one.count', payload: { count: 1 } });`,
      `publisher.publish({ type: 'two.label', payload: { label: 'wrong right' } });`,
      `publisher.publish({ type: 'one.count', payload: { label: 'wrong payload' } });`,
      `const invalid: EventInput<Facts> = { type: name, payload };`,
      `scoped.publish({ type: name, payload });`,
      `scoped.publish({ type: 'one.count', payload: { label: 'union mismatch' } });`,
      `observer.on('one.count', (value: { label: string }) => { void value; });`,
      `allObservers.on(name, (value: { count: number }) => { void value; });`,
      `defineEvent(unknownName, one.valid);`,
      `bus.publisher(erased).publish({ type: 'arbitrary.name', payload: {} });`,
    ])
      assert.notEqual((await compile(body)).length, 0, `Compiler accepted ${body}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual event checker rejects duplicate descriptors, invalid references and catalog drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'event-catalog-'));
  try {
    await cp(join(sourceRoot, 'src'), join(root, 'src'), { recursive: true });
    const runtimePath = join(root, 'src/bootstrap/events.ts');
    const catalogPath = join(root, 'src/bootstrap/event-catalog.ts');
    const runtime = await readFile(runtimePath, 'utf8');
    const catalog = await readFile(catalogPath, 'utf8');
    const mutate = (source, pattern, replacement) => {
      const changed = source.replace(pattern, replacement);
      assert.notEqual(changed, source, 'Negative fixture mutation must change actual source');
      return changed;
    };
    const run = () =>
      spawnSync(process.execPath, [join(sourceRoot, 'scripts/events/catalog.mjs'), '--check'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
      });
    let result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /readonly revision: number/);
    await writeFile(
      runtimePath,
      mutate(runtime, /composeEvents\(\s*coreEvents,/, 'composeEvents(coreEvents, coreEvents,'),
    );
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_DUPLICATE/);
    await writeFile(runtimePath, runtime);
    await writeFile(catalogPath, mutate(catalog, '...coreEventCatalog,', '...coreEventCatalog, ...coreEventCatalog,'));
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_DUPLICATE/);
    await writeFile(catalogPath, mutate(catalog, '...coreEventCatalog,', '...coreEventCatalog.slice(1),'));
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_DRIFT/);
    await writeFile(
      catalogPath,
      mutate(
        catalog,
        '...coreEventCatalog,',
        '...coreEventCatalog.map(entry => ({ ...entry, definition: { ...entry.definition } })), ',
      ),
    );
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_INVALID_REFERENCE/);
    await writeFile(
      catalogPath,
      mutate(catalog, '...coreEventCatalog,', '...coreEventCatalog.map(entry => ({ ...entry, version: 0 })), '),
    );
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_METADATA/);
    await writeFile(catalogPath, mutate(catalog, '...coreEventCatalog,', 'unknownDescriptor,'));
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_SOURCE/);
    await writeFile(
      catalogPath,
      `import { defineEvent } from '../application/event-definition';\nconst decoy = defineEvent('plugin-data.created', (value: unknown): value is number => typeof value === 'number');\nvoid decoy;\n` +
        catalog,
    );
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_AMBIGUOUS_CONTRACT/);
    await writeFile(catalogPath, catalog);
    const corePath = join(root, 'src/application/event-definitions/core.ts');
    const core = await readFile(corePath, 'utf8');
    await writeFile(
      corePath,
      mutate(
        core,
        /defineEvent\(\s*['"]preferences\.changed['"],\s*revisionFact\s*,?\s*\)/,
        "defineEvent('preferences.changed', dataFact)",
      ),
    );
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EVENT_CATALOG_CONTRACT_DRIFT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
