import { symbol, title } from './arguments.mjs';

export const registryPath = 'src/bootstrap/authoring.ts';
const testPath = (owner, name, kind) => `tests/runtime/generated/${owner}-${name}-${kind}.test.ts`;
export const localName = (owner, name, kind) => symbol(`${owner}-${name}-${kind}`);
export async function locales(context, owner, name, labels = {}) {
  const local = localName(owner, name, 'messages'); const namespace = symbol(`${owner}-${name}`);
  const en = { title: title(name), description: `Local ${title(name)} capability.`, input: 'Title', action: 'Open', reset: 'Reset draft', preview: 'Preview', count: 'Characters', create: 'Create note', created: 'Note created', ...labels };
  const de = { ...en, description: `Lokale Funktion: ${title(name)}.`, input: 'Titel', action: 'Öffnen', reset: 'Entwurf zurücksetzen', preview: 'Vorschau', count: 'Zeichen', create: 'Notiz erstellen', created: 'Notiz erstellt' };
  const path = `src/features/${owner}/${name}.messages.ts`;
  await context.add(path, `export const ${local} = ${JSON.stringify({ en: { [namespace]: en }, de: { [namespace]: de } }, null, 2)};\n`);
  await context.editArray('src/bootstrap/authoring-locales.ts', 'authoringLocaleModules', local, [{ local, from: `../features/${owner}/${name}.messages` }]);
  return `authoring.${namespace}`;
}
export async function registerFactory(context, owner, name, kind, expression) {
  const local = localName(owner, name, kind);
  await context.editArray(registryPath, 'authoringFactories', expression ?? local, [{ local, from: `../features/${owner}/${name}.${kind}` }]);
  return local;
}
export async function generatedTest(context, owner, name, kind, source) {
  const path = testPath(owner, name, kind); await context.add(path, source); context.tests.add(path);
}
export async function action(context, { owner, name, kind, preference, event }) {
  const local = localName(owner, name, kind); const prefix = await locales(context, owner, `${name}-${kind}`);
  const id = `${owner}-${name}-${kind}`;
  const imports = [`import { defineCommand } from '../api';`, `import type { AuthoringServices } from '../../application/authoring';`];
  let setup = ''; let execute; let available = ''; let cleanup = `services.modals.closeOwner('${id}'); services.notices.dismissOwner('${id}');`;
  let assertion = `const result = command.execute();\n    expect(f.dialogs).toHaveLength(1);\n    f.dialogs[0]?.callbacks.cancel(); await result;\n    expect(f.closed()).toBe(1);`;
  if (kind === 'command') execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
  if (kind === 'modal') {
    imports.push(`import { fields } from '../api';`);
    execute = `async () => { await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: value => fields.text({ trim: true, min: 1, max: 120 }).read(value) }); }`;
    assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit(''); expect(f.closed()).toBe(0);\n    await f.dialogs[0]?.callbacks.submit('Valid'); await pending;\n    expect(f.closed()).toBe(1);`;
  }
  if (kind === 'usecase') {
    const functionName = localName(owner, name, 'normalize');
    imports.push(`import { ${functionName} } from './${name}.usecase-action';`);
    await context.add(`src/features/${owner}/${name}.usecase-action.ts`, `import { fields } from '../api';\n\n/** Normalizes a title for preview; deliberately does not claim persistence. */\nexport function ${functionName}(input: unknown) { return fields.text({ trim: true, min: 1, max: 120 }).read(input); }\n`);
    execute = `async () => { const result = await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: ${functionName} });\n      if (result.status === 'confirmed') await services.modals.info({ owner: '${id}', titleKey: '${prefix}.preview', message: result.value }); }`;
    assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit('  Valid  ');\n    await Promise.resolve();\n    expect(f.dialogs[1]?.spec.message).toBe('Valid');\n    f.dialogs[1]?.callbacks.cancel(); await pending;`;
  }
  if (kind === 'setting') {
    available = 'available: () => !services.preferences.readonly,';
    execute = preference === 'hideObsidianViewHeader' ? '() => services.preferences.toggleViewHeader()' : `() => services.preferences.update({ notifySuccess: !services.preferences.current.notifySuccess })`;
    assertion = `const before = f.services.preferences.current.${preference};\n    expect(command.available?.()).toBe(true);\n    expect(f.saved).toHaveLength(0);\n    await command.execute();\n    expect(f.services.preferences.current.${preference}).toBe(!before);\n    expect(f.saved).toHaveLength(1);`;
  }
  if (kind === 'event') {
    const eventName = `${owner}.${name}`; const descriptor = localName(owner, name, 'eventDefinition');
    imports.push(`import { ${descriptor} } from './${name}.event-definition';`);
    await context.add(`src/features/${owner}/${name}.event-definition.ts`, `declare module '../../application/events' {\n  interface ShellEvents { '${eventName}': { readonly sequence: number } }\n}\n\nexport const ${descriptor} = {\n  id: '${eventName}',\n  valid(payload: unknown): payload is { readonly sequence: number } {\n    return typeof payload === 'object' && payload !== null && 'sequence' in payload && typeof payload.sequence === 'number' && Number.isSafeInteger(payload.sequence) && payload.sequence > 0;\n  },\n} as const;\n`);
    setup = 'let sequence = 0;';
    execute = `() => { const payload = { sequence: ++sequence }; if (${descriptor}.valid(payload)) services.events.publish({ type: ${descriptor}.id, payload }); }`;
    assertion = `const received: number[] = [];\n    const off = f.services.events.on('${eventName}', payload => { received.push(payload.sequence); });\n    await command.execute(); await command.execute();\n    expect(received).toEqual([1, 2]); off();`;
  }
  if (kind === 'listener') {
    const descriptor = localName(owner, event, 'eventDefinition');
    await context.read(`src/features/${owner}/${event}.event-definition.ts`);
    imports.push(`import { ${descriptor} } from './${event}.event-definition';`);
    setup = `const off = services.events.on(${descriptor}.id, payload => {\n    if (${descriptor}.valid(payload)) services.notices.info({ owner: '${id}', operation: '${id}', key: '${prefix}.description' });\n  });`;
    cleanup = `off(); ${cleanup}`;
    execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
    assertion = `f.services.events.publish({ type: '${owner}.${event}', payload: { sequence: 1 } });\n    expect(f.notices()).toBe(1);\n    extension.dispose();\n    f.services.events.publish({ type: '${owner}.${event}', payload: { sequence: 2 } });\n    expect(f.notices()).toBe(1);`;
  }
  if (!execute) throw new Error(`Unsupported action primitive: ${kind}`);
  if (['command', 'modal', 'listener'].includes(kind)) {
    execute = execute.replace('await services.modals.', 'const result = await services.modals.').replace(/; }$/, "; if (result.status === 'failed') return { ok: false as const, error: result.error }; }");
    assertion += `\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed();\n    expect(await failed).toMatchObject({ ok: false, error: { effect: 'none' } });\n    const owned = command.execute(); extension.dispose(); await owned;`;
  }
  if (kind === 'usecase') {
    execute = execute.replace("if (result.status === 'confirmed') await services.modals.info", "if (result.status === 'failed') return { ok: false as const, error: result.error };\n      if (result.status === 'confirmed') { const preview = await services.modals.info").replace(/; }$/, "; if (preview.status === 'failed') return { ok: false as const, error: preview.error }; } }");
    assertion += `\n    const cancelled = command.execute(); f.dialogs.at(-1)?.callbacks.cancel(); await cancelled;\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failed).toMatchObject({ ok: false });\n    const failedPreview = command.execute(); await f.dialogs.at(-1)?.callbacks.submit('Valid');\n    await Promise.resolve(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failedPreview).toMatchObject({ ok: false });`;
  }
  if (kind === 'event') {
    const descriptor = localName(owner, name, 'eventDefinition');
    await generatedTest(context, owner, name, 'event-contract', `import { expect, it } from 'vitest';\nimport type { ShellEvents } from '../../../src/application/events';\nimport { ${descriptor} } from '../../../src/features/${owner}/${name}.event-definition';\n\nit('validates unknown event payloads and retains a literal typed contract', () => {\n  // @ts-expect-error This must remain a numeric payload; widening the contract breaks this negative check.\n  const invalid: ShellEvents['${owner}.${name}'] = { sequence: 'wrong' };\n  for (const value of [null, false, {}, invalid, { sequence: 0 }, { sequence: -1 }, { sequence: 1.5 }, { sequence: Infinity }]) expect(${descriptor}.valid(value)).toBe(false);\n  expect(${descriptor}.valid({ sequence: 1 })).toBe(true);\n});\n`);
  }
  await context.add(`src/features/${owner}/${name}.${kind}.ts`, `${imports.join('\n')}\n\nexport function ${local}(services: AuthoringServices) {\n  ${setup}\n  const command = defineCommand({ id: '${id}', titleKey: '${prefix}.title', ${available}\n    execute: ${execute},\n  });\n  return { commands: [command] as const, dispose() { ${cleanup} } };\n}\n`);
  await registerFactory(context, owner, name, kind);
  await generatedTest(context, owner, name, kind, `import { expect, it } from 'vitest';\nimport { ${local} } from '../../../src/features/${owner}/${name}.${kind}';\nimport { authoringFixture } from '../authoring-fixture';\n\nit('${id} runs its real action and releases ownership', async () => {\n  const f = await authoringFixture(); const extension = ${local}(f.services);\n  try {\n    const command = extension.commands[0];\n    ${assertion}\n  } finally { extension.dispose(); f.dispose(); }\n});\n`);
}
