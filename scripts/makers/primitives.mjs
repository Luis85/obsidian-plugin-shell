import { symbol, title } from './arguments.mjs';

export const registryPath = 'src/bootstrap/authoring.ts';
const testPath = (owner, name, kind) => `tests/runtime/generated/${owner}-${name}-${kind}.test.ts`;
export const localName = (owner, name, kind) => symbol(`${owner}-${name}-${kind}`);
export async function locales(context, owner, name, labels = {}) {
  const local = localName(owner, name, 'messages');
  const namespace = symbol(`${owner}-${name}`);
  const scope = `${title(owner)}: ${title(name)}`;
  const en = {
    title: scope,
    description: `Local ${title(name)} capability.`,
    input: `${scope} title`,
    action: 'Open',
    reset: 'Reset draft',
    preview: 'Preview',
    count: 'Characters',
    create: 'Create note',
    created: 'Note created',
    destination: 'Note path',
    ...labels,
  };
  const de = {
    ...en,
    description: `Lokale Funktion: ${title(name)}.`,
    input: labels.input ?? `${scope} – Titel`,
    action: 'Öffnen',
    reset: 'Entwurf zurücksetzen',
    preview: 'Vorschau',
    count: 'Zeichen',
    create: 'Notiz erstellen',
    created: 'Notiz erstellt',
    destination: 'Notizpfad',
  };
  const path = `src/features/${owner}/${name}.messages.ts`;
  await context.add(
    path,
    `export const ${local} = ${JSON.stringify({ en: { [namespace]: en }, de: { [namespace]: de } }, null, 2)};\n`,
  );
  await context.editArray('src/bootstrap/authoring-locales.ts', 'authoringLocaleModules', local, [
    { local, from: `../features/${owner}/${name}.messages` },
  ]);
  return `authoring.${namespace}`;
}
export async function registerFactory(context, owner, name, kind, expression) {
  const local = localName(owner, name, kind);
  await context.editArray(registryPath, 'authoringFactories', expression ?? local, [
    { local, from: `../features/${owner}/${name}.${kind}` },
  ]);
  return local;
}
export async function generatedTest(context, owner, name, kind, source) {
  const path = testPath(owner, name, kind);
  await context.add(path, source);
  context.tests.add(path);
}
export async function action(context, { owner, name, kind, preference, event }) {
  const local = localName(owner, name, kind);
  const prefix = await locales(context, owner, `${name}-${kind}`);
  const id = `${owner}-${name}-${kind}`;
  const imports = [
    `import { defineCommand } from '../api';`,
    `import type { AuthoringServices } from '../api';`,
  ];
  let setup = '';
  let execute;
  let available = '';
  let parameters = '';
  let factoryExpression;
  let testImports = '';
  let testPublisher = '';
  let cleanup = `services.modals.closeOwner('${id}'); services.notices.dismissOwner('${id}');`;
  let assertion = `const result = command.execute();\n    expect(f.dialogs).toHaveLength(1);\n    f.dialogs[0]?.callbacks.cancel(); await result;\n    expect(f.closed()).toBe(1);`;
  if (kind === 'command')
    execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
  if (kind === 'modal') {
    imports.push(`import { fields } from '../api';`);
    execute = `async () => { await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: value => fields.text({ trim: true, min: 1, max: 120 }).read(value) }); }`;
    assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit(''); expect(f.closed()).toBe(0);\n    await f.dialogs[0]?.callbacks.submit('Valid'); await pending;\n    expect(f.closed()).toBe(1);`;
  }
  if (kind === 'usecase') {
    const functionName = localName(owner, name, 'normalize');
    imports.push(`import { ${functionName} } from './${name}.usecase-action';`);
    await context.add(
      `src/features/${owner}/${name}.usecase-action.ts`,
      `import { fields } from '../api';\n\n/** Normalizes a title for preview; deliberately does not claim persistence. */\nexport function ${functionName}(input: unknown) { return fields.text({ trim: true, min: 1, max: 120 }).read(input); }\n`,
    );
    execute = `async () => { const result = await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: ${functionName} });\n      if (result.status === 'confirmed') await services.modals.info({ owner: '${id}', titleKey: '${prefix}.preview', message: result.value }); }`;
    assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit('  Valid  ');\n    await Promise.resolve();\n    expect(f.dialogs[1]?.spec.message).toBe('Valid');\n    f.dialogs[1]?.callbacks.cancel(); await pending;`;
  }
  if (kind === 'setting') {
    available = 'available: () => !services.preferences.readonly,';
    execute =
      preference === 'hideObsidianViewHeader'
        ? '() => services.preferences.toggleViewHeader()'
        : `() => services.preferences.update({ notifySuccess: !services.preferences.current.notifySuccess })`;
    assertion = `const before = f.services.preferences.current.${preference};\n    expect(command.available?.()).toBe(true);\n    expect(f.saved).toHaveLength(0);\n    await command.execute();\n    expect(f.services.preferences.current.${preference}).toBe(!before);\n    expect(f.saved).toHaveLength(1);`;
  }
  if (kind === 'event') {
    const eventName = `${owner}.${name}`;
    const descriptor = localName(owner, name, 'eventDefinition');
    imports.push(`import { ${descriptor} } from './${name}.event-definition';`);
    await context.add(
      `src/features/${owner}/${name}.event-definition.ts`,
      `import { defineEvent } from '../api';\n\nexport const ${descriptor} = defineEvent('${eventName}', (payload: unknown): payload is { readonly sequence: number } => {\n  return typeof payload === 'object' && payload !== null && Object.keys(payload).length === 1 && 'sequence' in payload && typeof payload.sequence === 'number' && Number.isSafeInteger(payload.sequence) && payload.sequence > 0;\n});\n`,
    );
    await context.editArray('src/bootstrap/events.ts', 'featureEvents', descriptor, [
      {
        local: descriptor,
        from: `../features/${owner}/${name}.event-definition`,
      },
    ]);
    const catalog = localName(owner, name, 'eventCatalog');
    await context.add(
      `src/features/${owner}/${name}.event-catalog.ts`,
      `import { ${descriptor} } from './${name}.event-definition';\nexport const ${catalog} = { definition: ${descriptor}, owner: '${owner}', meaning: 'Completed ${name} demonstration command; sequence is runtime-local.', version: 1, publisher: '${local}', subscribers: ['${owner} projections'], origin: 'application', sensitivity: 'none', delivery: 'Synchronous start; no replay; owned subscriptions.' } as const;\n`,
    );
    await context.editArray('src/bootstrap/event-catalog.ts', 'featureEventCatalog', catalog, [
      { local: catalog, from: `../features/${owner}/${name}.event-catalog` },
    ]);
    imports.push(`import type { EventPublisher, EventMapOf } from '../api';`);
    parameters = `, publisher: EventPublisher<EventMapOf<typeof ${descriptor}>>`;
    factoryExpression = `(services, publisher) => ${local}(services, publisher(${descriptor}))`;
    await context.editArray(registryPath, 'authoringFactories', factoryExpression, [
      {
        local: descriptor,
        from: `../features/${owner}/${name}.event-definition`,
      },
      { local, from: `../features/${owner}/${name}.event` },
    ]);
    setup = 'let sequence = 0;';
    execute = `() => { publisher.publish({ type: ${descriptor}.id, payload: { sequence: ++sequence } }); }`;
    testImports = `import { ${descriptor} } from '../../../src/features/${owner}/${name}.event-definition';`;
    testPublisher = `, f.services.events.publisher(${descriptor})`;
    assertion = `const received: number[] = [];\n    const off = f.services.events.subscriber(${descriptor}).on(payload => { received.push(payload.sequence); });\n    await command.execute(); await command.execute();\n    expect(received).toEqual([1, 2]); off();`;
  }
  if (kind === 'listener') {
    const descriptor = localName(owner, event, 'eventDefinition');
    await context.read(`src/features/${owner}/${event}.event-definition.ts`);
    imports.push(`import { ${descriptor} } from './${event}.event-definition';`);
    imports.push(`import type { EventSubscriber, EventPayload } from '../api';`);
    parameters = `, subscriber: EventSubscriber<EventPayload<typeof ${descriptor}>>`;
    factoryExpression = `(services, publisher, subscriber) => ${local}(services, subscriber(${descriptor}))`;
    await context.editArray(registryPath, 'authoringFactories', factoryExpression, [
      {
        local: descriptor,
        from: `../features/${owner}/${event}.event-definition`,
      },
      { local, from: `../features/${owner}/${name}.listener` },
    ]);
    testPublisher = `, f.services.events.subscriber(${descriptor})`;
    setup = `const off = subscriber.on(payload => {\n    if (${descriptor}.valid(payload)) services.notices.info({ owner: '${id}', operation: '${id}', key: '${prefix}.description' });\n  });`;
    cleanup = `off(); ${cleanup}`;
    execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
    testImports = `import { ${descriptor} } from '../../../src/features/${owner}/${event}.event-definition';`;
    assertion = `const publisher = f.services.events.publisher(${descriptor}); publisher.publish({ type: '${owner}.${event}', payload: { sequence: 1 } });\n    expect(f.notices()).toBe(1);\n    extension.dispose();\n    publisher.publish({ type: '${owner}.${event}', payload: { sequence: 2 } });\n    expect(f.notices()).toBe(1);`;
  }
  if (!execute) throw new Error(`Unsupported action primitive: ${kind}`);
  if (['command', 'modal', 'listener'].includes(kind)) {
    execute = execute
      .replace('await services.modals.', 'const result = await services.modals.')
      .replace(/; }$/, "; if (result.status === 'failed') return { ok: false as const, error: result.error }; }");
    assertion += `\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed();\n    expect(await failed).toMatchObject({ ok: false, error: { effect: 'none' } });\n    const owned = command.execute(); extension.dispose(); await owned;`;
  }
  if (kind === 'usecase') {
    execute = execute
      .replace(
        "if (result.status === 'confirmed') await services.modals.info",
        "if (result.status === 'failed') return { ok: false as const, error: result.error };\n      if (result.status === 'confirmed') { const preview = await services.modals.info",
      )
      .replace(/; }$/, "; if (preview.status === 'failed') return { ok: false as const, error: preview.error }; } }");
    assertion += `\n    const cancelled = command.execute(); f.dialogs.at(-1)?.callbacks.cancel(); await cancelled;\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failed).toMatchObject({ ok: false });\n    const failedPreview = command.execute(); await f.dialogs.at(-1)?.callbacks.submit('Valid');\n    await Promise.resolve(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failedPreview).toMatchObject({ ok: false });`;
  }
  if (kind === 'event') {
    const descriptor = localName(owner, name, 'eventDefinition');
    await generatedTest(
      context,
      owner,
      name,
      'event-contract',
      `import { expect, it } from 'vitest';\nimport type { EventPayload } from '../../../src/features/api';\nimport { ${descriptor} } from '../../../src/features/${owner}/${name}.event-definition';\n\nit('validates unknown event payloads and retains a literal typed contract', () => {\n  // @ts-expect-error This must remain a numeric payload; widening the contract breaks this negative check.\n  const invalid: EventPayload<typeof ${descriptor}> = { sequence: 'wrong' };\n  for (const value of [null, false, {}, invalid, { sequence: 0 }, { sequence: -1 }, { sequence: 1.5 }, { sequence: Infinity }, { sequence: 1, extra: true }]) expect(${descriptor}.valid(value)).toBe(false);\n  expect(${descriptor}.valid({ sequence: 1 })).toBe(true);\n});\n`,
    );
  }
  await context.add(
    `src/features/${owner}/${name}.${kind}.ts`,
    `${imports.join('\n')}\n\nexport function ${local}(services: AuthoringServices${parameters}) {\n  ${setup}\n  const command = defineCommand({ id: '${id}', titleKey: '${prefix}.title', ${available}\n    execute: ${execute},\n  });\n  return { commands: [command] as const, dispose() { ${cleanup} } };\n}\n`,
  );
  if (!factoryExpression) await registerFactory(context, owner, name, kind);
  await generatedTest(
    context,
    owner,
    name,
    kind,
    `import { expect, it } from 'vitest';\nimport { ${local} } from '../../../src/features/${owner}/${name}.${kind}';\nimport { authoringFixture } from '../authoring-fixture';\n${testImports}\n\nit('${id} runs its real action and releases ownership', async () => {\n  const f = await authoringFixture(); const extension = ${local}(f.services${testPublisher});\n  try {\n    const command = extension.commands[0];\n    ${assertion}\n  } finally { extension.dispose(); f.dispose(); }\n});\n`,
  );
}
