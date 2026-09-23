import { vi } from 'vitest';
import { BooleanSetting, defineEntity, fields } from '../../src/features/api';
import { PluginDataStore } from '../../src/application/plugin-data-store';
import { PluginDataRepository } from '../../src/application/plugin-data-repository';
import { PreferenceService } from '../../src/application/preference-service';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';

export function booleanSettingFixture(initial: unknown = null) {
  let raw = initial; let sequence = 0;
  const storage = { load: vi.fn(async (): Promise<unknown> => raw), save: vi.fn(async (value: unknown) => { raw = value; }) };
  const diagnostics = { report: vi.fn() }; const events = new TypedEventBus<ShellEvents>(diagnostics);
  const data = new PluginDataStore(storage, diagnostics); const preferences = new PreferenceService(data, events, diagnostics);
  const entity = defineEntity('fixture-setting', 1, { enabled: fields.defaulted(fields.boolean(), false) });
  const repository = new PluginDataRepository(entity, data, events, () => `setting-${++sequence}`, () => '2026-09-23', diagnostics);
  const capabilities = { events, diagnostics, readonly: () => preferences.readonly };
  const definition = { id: 'fixture-setting', entity: entity.key, titleKey: 'fixture.title', descriptionKey: 'fixture.description', defaultValue: false };
  const setting = new BooleanSetting(definition, repository, capabilities);
  return { setting, definition, repository, capabilities, events, diagnostics, storage, preferences, raw: () => raw,
    persist(value: unknown) { raw = value; },
    dispose() { setting.dispose(); repository.dispose(); preferences.dispose(); data.dispose(); events.dispose(); },
  };
}
