import { makerSymbol as symbol, slug, title } from './arguments.ts';
import type { RecipeContext } from './contracts.ts';

export const registryPath = 'src/bootstrap/authoring.ts';
export interface ActionRequest { readonly owner: string; readonly name: string; readonly kind: string; readonly preference?: string; readonly event?: string }
interface KindInput { readonly owner: string; readonly name: string; readonly prefix: string; readonly id: string; readonly local: string; readonly preference: string | undefined; readonly event: string }
/** The generated command, its factory registration and its real-action test, filled in per primitive kind. */
interface ActionSpec {
  readonly imports: string[]; setup: string; execute: string | undefined; available: string; parameters: string;
  factoryExpression: string | undefined; testImports: string; testPublisher: string; cleanup: string; assertion: string;
}
type Configure = (context: RecipeContext, spec: ActionSpec, input: KindInput) => void | Promise<void>;
const testPath = (owner: string, name: string, kind: string): string => `tests/runtime/generated/${owner}-${name}-${kind}.test.ts`;
export const localName = (owner: string, name: string, kind: string): string => symbol(`${owner}-${name}-${kind}`);
export async function locales(context: RecipeContext, owner: string, name: string, labels: Readonly<Record<string, string>> = {}): Promise<string> {
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
export async function registerFactory(context: RecipeContext, owner: string, name: string, kind: string, expression?: string): Promise<string> {
  const local = localName(owner, name, kind);
  await context.editArray(registryPath, 'authoringFactories', expression ?? local, [
    { local, from: `../features/${owner}/${name}.${kind}` },
  ]);
  return local;
}
export async function generatedTest(context: RecipeContext, owner: string, name: string, kind: string, source: string): Promise<void> {
  const path = testPath(owner, name, kind);
  await context.add(path, source);
  context.tests.add(path);
}
function commandAction(_context: RecipeContext, spec: ActionSpec, { prefix, id }: KindInput): void {
  spec.execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
}
function modalAction(_context: RecipeContext, spec: ActionSpec, { prefix, id }: KindInput): void {
  spec.imports.push(`import { fields } from '../api';`);
  spec.execute = `async () => { await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: value => fields.text({ trim: true, min: 1, max: 120 }).read(value) }); }`;
  spec.assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit(''); expect(f.closed()).toBe(0);\n    await f.dialogs[0]?.callbacks.submit('Valid'); await pending;\n    expect(f.closed()).toBe(1);`;
}
async function usecaseAction(context: RecipeContext, spec: ActionSpec, { owner, name, prefix, id }: KindInput): Promise<void> {
  const functionName = localName(owner, name, 'normalize');
  spec.imports.push(`import { ${functionName} } from './${name}.usecase-action';`);
  await context.add(
    `src/features/${owner}/${name}.usecase-action.ts`,
    `import { fields } from '../api';\n\n/** Normalizes a title for preview; deliberately does not claim persistence. */\nexport function ${functionName}(input: unknown) { return fields.text({ trim: true, min: 1, max: 120 }).read(input); }\n`,
  );
  spec.execute = `async () => { const result = await services.modals.prompt({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description', labelKey: '${prefix}.input', maxLength: 120, validate: ${functionName} });\n      if (result.status === 'confirmed') await services.modals.info({ owner: '${id}', titleKey: '${prefix}.preview', message: result.value }); }`;
  spec.assertion = `const pending = command.execute();\n    await f.dialogs[0]?.callbacks.submit('  Valid  ');\n    await Promise.resolve();\n    expect(f.dialogs[1]?.spec.message).toBe('Valid');\n    f.dialogs[1]?.callbacks.cancel(); await pending;`;
}
function settingAction(_context: RecipeContext, spec: ActionSpec, { preference }: KindInput): void {
  spec.available = 'available: () => !services.preferences.readonly,';
  spec.execute =
    preference === 'hideObsidianViewHeader'
      ? '() => services.preferences.toggleViewHeader()'
      : `() => services.preferences.update({ notifySuccess: !services.preferences.current.notifySuccess })`;
  spec.assertion = `const before = f.services.preferences.current.${preference};\n    expect(command.available?.()).toBe(true);\n    expect(f.saved).toHaveLength(0);\n    await command.execute();\n    expect(f.services.preferences.current.${preference}).toBe(!before);\n    expect(f.saved).toHaveLength(1);`;
}
async function eventAction(context: RecipeContext, spec: ActionSpec, { owner, name, local }: KindInput): Promise<void> {
  const eventName = `${owner}.${name}`;
  const descriptor = localName(owner, name, 'eventDefinition');
  spec.imports.push(`import { ${descriptor} } from './${name}.event-definition';`);
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
  spec.imports.push(`import type { EventPublisher, EventMapOf } from '../api';`);
  spec.parameters = `, publisher: EventPublisher<EventMapOf<typeof ${descriptor}>>`;
  spec.factoryExpression = `(services, publisher) => ${local}(services, publisher(${descriptor}))`;
  await context.editArray(registryPath, 'authoringFactories', spec.factoryExpression, [
    {
      local: descriptor,
      from: `../features/${owner}/${name}.event-definition`,
    },
    { local, from: `../features/${owner}/${name}.event` },
  ]);
  spec.setup = 'let sequence = 0;';
  spec.execute = `() => { publisher.publish({ type: ${descriptor}.id, payload: { sequence: ++sequence } }); }`;
  spec.testImports = `import { ${descriptor} } from '../../../src/features/${owner}/${name}.event-definition';`;
  spec.testPublisher = `, f.services.events.publisher(${descriptor})`;
  spec.assertion = `const received: number[] = [];\n    const off = f.services.events.subscriber(${descriptor}).on(payload => { received.push(payload.sequence); });\n    await command.execute(); await command.execute();\n    expect(received).toEqual([1, 2]); off();`;
}
async function listenerAction(context: RecipeContext, spec: ActionSpec, { owner, name, prefix, id, local, event }: KindInput): Promise<void> {
  const descriptor = localName(owner, event, 'eventDefinition');
  await context.read(`src/features/${owner}/${event}.event-definition.ts`);
  spec.imports.push(`import { ${descriptor} } from './${event}.event-definition';`);
  spec.imports.push(`import type { EventSubscriber, EventPayload } from '../api';`);
  spec.parameters = `, subscriber: EventSubscriber<EventPayload<typeof ${descriptor}>>`;
  spec.factoryExpression = `(services, publisher, subscriber) => ${local}(services, subscriber(${descriptor}))`;
  await context.editArray(registryPath, 'authoringFactories', spec.factoryExpression, [
    {
      local: descriptor,
      from: `../features/${owner}/${event}.event-definition`,
    },
    { local, from: `../features/${owner}/${name}.listener` },
  ]);
  spec.testPublisher = `, f.services.events.subscriber(${descriptor})`;
  spec.setup = `const off = subscriber.on(payload => {\n    if (${descriptor}.valid(payload)) services.notices.info({ owner: '${id}', operation: '${id}', key: '${prefix}.description' });\n  });`;
  spec.cleanup = `off(); ${spec.cleanup}`;
  spec.execute = `async () => { await services.modals.info({ owner: '${id}', titleKey: '${prefix}.title', messageKey: '${prefix}.description' }); }`;
  spec.testImports = `import { ${descriptor} } from '../../../src/features/${owner}/${event}.event-definition';`;
  spec.assertion = `const publisher = f.services.events.publisher(${descriptor}); publisher.publish({ type: '${owner}.${event}', payload: { sequence: 1 } });\n    expect(f.notices()).toBe(1);\n    extension.dispose();\n    publisher.publish({ type: '${owner}.${event}', payload: { sequence: 2 } });\n    expect(f.notices()).toBe(1);`;
}
const actionKinds: Readonly<Record<string, Configure>> = { command: commandAction, modal: modalAction, usecase: usecaseAction, setting: settingAction, event: eventAction, listener: listenerAction };
/** The one shared-preference allowlist: built-in dispatch and the injected local-recipe primitive resolve through it. */
const actionPreferences: readonly string[] = Object.freeze(['notifySuccess', 'hideObsidianViewHeader']);
function actionPreference(value: unknown): string {
  if (value === undefined) throw new Error('MAKER_PREFERENCE_REQUIRED: select notifySuccess|hideObsidianViewHeader');
  if (typeof value !== 'string' || !actionPreferences.includes(value)) throw new Error('Unknown --preference; select notifySuccess|hideObsidianViewHeader');
  return value;
}
/** Every request, built-in or local recipe, is revalidated before any path or source text is composed from it. */
function validatedAction({ owner, name, kind, preference, event }: ActionRequest): ActionRequest {
  if (!Object.hasOwn(actionKinds, kind)) throw new Error(`Unsupported action primitive: ${kind}`);
  if (kind !== 'setting' && preference !== undefined) throw new Error(`MAKER_OPTION_UNSUPPORTED: preference is only valid for setting, not ${kind}`);
  if (kind !== 'listener' && event !== undefined) throw new Error(`MAKER_OPTION_UNSUPPORTED: event is only valid for listener, not ${kind}`);
  return {
    owner: slug(owner, 'action owner'), name: slug(name, 'action name'), kind,
    ...(kind === 'setting' ? { preference: actionPreference(preference) } : {}),
    ...(kind === 'listener' ? { event: slug(event, 'existing event name (--event)') } : {}),
  };
}
/** Hosted dialogs report failures; the generated action returns them instead of claiming success. */
function reportFailures(kind: string, spec: ActionSpec & { execute: string }): void {
  if (['command', 'modal', 'listener'].includes(kind)) {
    spec.execute = spec.execute
      .replace('await services.modals.', 'const result = await services.modals.')
      .replace(/; }$/, "; if (result.status === 'failed') return { ok: false as const, error: result.error }; }");
    spec.assertion += `\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed();\n    expect(await failed).toMatchObject({ ok: false, error: { effect: 'none' } });\n    const owned = command.execute(); extension.dispose(); await owned;`;
  }
  if (kind === 'usecase') {
    spec.execute = spec.execute
      .replace(
        "if (result.status === 'confirmed') await services.modals.info",
        "if (result.status === 'failed') return { ok: false as const, error: result.error };\n      if (result.status === 'confirmed') { const preview = await services.modals.info",
      )
      .replace(/; }$/, "; if (preview.status === 'failed') return { ok: false as const, error: preview.error }; } }");
    spec.assertion += `\n    const cancelled = command.execute(); f.dialogs.at(-1)?.callbacks.cancel(); await cancelled;\n    const failed = command.execute(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failed).toMatchObject({ ok: false });\n    const failedPreview = command.execute(); await f.dialogs.at(-1)?.callbacks.submit('Valid');\n    await Promise.resolve(); f.dialogs.at(-1)?.callbacks.failed(); expect(await failedPreview).toMatchObject({ ok: false });`;
  }
}
async function eventContractTest(context: RecipeContext, owner: string, name: string): Promise<void> {
  const descriptor = localName(owner, name, 'eventDefinition');
  await generatedTest(
    context,
    owner,
    name,
    'event-contract',
    `import { expect, it } from 'vitest';\nimport type { EventPayload } from '../../../src/features/api';\nimport { ${descriptor} } from '../../../src/features/${owner}/${name}.event-definition';\n\nit('validates unknown event payloads and retains a literal typed contract', () => {\n  // @ts-expect-error This must remain a numeric payload; widening the contract breaks this negative check.\n  const invalid: EventPayload<typeof ${descriptor}> = { sequence: 'wrong' };\n  for (const value of [null, false, {}, invalid, { sequence: 0 }, { sequence: -1 }, { sequence: 1.5 }, { sequence: Infinity }, { sequence: 1, extra: true }]) expect(${descriptor}.valid(value)).toBe(false);\n  expect(${descriptor}.valid({ sequence: 1 })).toBe(true);\n});\n`,
  );
}
export async function action(context: RecipeContext, request: ActionRequest): Promise<void> {
  const { owner, name, kind, preference, event } = validatedAction(request);
  const local = localName(owner, name, kind);
  const prefix = await locales(context, owner, `${name}-${kind}`);
  const id = `${owner}-${name}-${kind}`;
  const imports = [
    `import { defineCommand } from '../api';`,
    `import type { AuthoringServices } from '../api';`,
  ];
  const spec: ActionSpec = {
    imports, setup: '', execute: undefined, available: '', parameters: '', factoryExpression: undefined, testImports: '', testPublisher: '',
    cleanup: `services.modals.closeOwner('${id}'); services.notices.dismissOwner('${id}');`,
    assertion: `const result = command.execute();\n    expect(f.dialogs).toHaveLength(1);\n    f.dialogs[0]?.callbacks.cancel(); await result;\n    expect(f.closed()).toBe(1);`,
  };
  await actionKinds[kind]?.(context, spec, { owner, name, prefix, id, local, preference, event: event ?? '' });
  const { execute: configured } = spec;
  if (!configured) throw new Error(`Unsupported action primitive: ${kind}`);
  const ready = { ...spec, execute: configured };
  reportFailures(kind, ready);
  if (kind === 'event') await eventContractTest(context, owner, name);
  const { setup, execute, available, parameters, factoryExpression, testImports, testPublisher, cleanup, assertion } = ready;
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
