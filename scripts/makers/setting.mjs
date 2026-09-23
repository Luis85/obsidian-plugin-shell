import { localName, locales, registerFactory, generatedTest } from './primitives.mjs';
import { registerEntity } from './entities-recipe.mjs';
import { title } from './arguments.mjs';

/** A new setting is explicit plugin-data storage, sharing the preference writer. */
export async function settingRecipe(context, owner, name) {
  const local = localName(owner, name, 'setting'); const definition = `${local}Feature`;
  const prefix = await locales(context, owner, `${name}-setting`, { title: `${title(owner)}: Toggle ${title(name)}`,
    settingTitle: `${title(owner)}: ${title(name)}`, description: 'Boolean feature preference; disabled by default.' });
  await context.add(`src/features/${owner}/${name}.setting-definition.ts`, `import { defineEntity, fields, definePluginDataFeature } from '../api';\n\nexport const ${definition} = definePluginDataFeature({\n  backend: 'plugin-data',\n  entity: defineEntity('${owner}-${name}-setting', 1, { enabled: fields.defaulted(fields.boolean(), false) }),\n});\n`);
  await registerEntity(context, { key: local, local: definition, from: `../features/${owner}/${name}.setting-definition` });
  await context.add(`src/features/${owner}/${name}.setting.ts`, `import { BooleanSetting, defineCommand } from '../api';
import type { PluginDataRepository } from '../../application/plugin-data-repository';
import type { AuthoringServices } from '../../application/authoring';
import { ${definition} } from './${name}.setting-definition';

export function ${local}(repository: PluginDataRepository<{ enabled?: boolean }, { readonly enabled: boolean }>, services: Pick<AuthoringServices, 'events' | 'diagnostics' | 'preferences'>) {
  const defaults = ${definition}.entity.parse({});
  if (!defaults.ok) throw new Error('INVALID_SETTING_DEFAULT');
  const setting = new BooleanSetting({ id: '${owner}-${name}-setting', entity: ${definition}.entity.key,
    titleKey: '${prefix}.settingTitle', descriptionKey: '${prefix}.description', defaultValue: defaults.value.enabled }, repository,
    { events: services.events, diagnostics: services.diagnostics, readonly: () => services.preferences.readonly });
  const command = defineCommand({ id: '${owner}-${name}-setting', titleKey: '${prefix}.title',
    available: () => !setting.readonly, execute: () => setting.toggle(),
  });
  return { commands: [command] as const, settings: [setting] as const, dispose() { setting.dispose(); } };
}
`);
  await registerFactory(context, owner, name, 'setting', `services => ${local}(services.repositories.${local}, services)`);
  await generatedTest(context, owner, name, 'setting', `import { expect, it } from 'vitest';
import { PluginDataRepository } from '../../../src/application/plugin-data-repository';
import { ${definition} } from '../../../src/features/${owner}/${name}.setting-definition';
import { ${local} } from '../../../src/features/${owner}/${name}.setting';
import { authoringFixture } from '../authoring-fixture';

it('registers a native boolean descriptor with read-only initialization and one canonical command/control writer', async () => {
  const f = await authoringFixture(); let next = 0;
  const repository = new PluginDataRepository(${definition}.entity, f.data, f.services.events, () => 'setting-' + ++next, () => '2026-09-23', f.services.diagnostics);
  const extension = ${local}(repository, f.services); const command = extension.commands[0]; const setting = extension.settings[0];
  try {
    expect(${definition}.entity.parse({})).toEqual({ ok: true, value: { enabled: false } });
    expect(${definition}.entity.decode({ enabled: 'true' }).ok).toBe(false);
    expect(command.available?.()).toBe(false); await setting.initialize();
    expect(command.available?.()).toBe(true); expect(setting.value).toBe(false); expect(f.saved).toHaveLength(0);
    await command.execute(); await f.services.preferences.update({ notifySuccess: false });
    expect(setting.value).toBe(true);
    const first = await repository.list(); if (!first.ok) throw new Error('list failed');
    expect(first.value[0]?.values.enabled).toBe(true);
    expect((await setting.set(false)).ok).toBe(true);
    const second = await repository.list(); if (!second.ok) throw new Error('list failed');
    expect(second.value[0]?.values.enabled).toBe(false); expect(setting.value).toBe(false);
    expect((await setting.set('invalid')).ok).toBe(false);
    expect(f.services.preferences.current.notifySuccess).toBe(false);
    extension.dispose(); expect(command.available?.()).toBe(false);
    const count = f.saved.length; await command.execute(); expect(f.saved).toHaveLength(count);
  } finally { extension.dispose(); repository.dispose(); f.dispose(); }
});
`);
}
