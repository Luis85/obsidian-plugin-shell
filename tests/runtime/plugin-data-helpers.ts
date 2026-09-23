import { vi } from 'vitest';
import { defineEntity, definePluginDataFeature, fields } from '../../src/features/api';
import { PluginDataStore } from '../../src/application/plugin-data-store';
import { PreferenceService } from '../../src/application/preference-service';
import { PluginDataRepository } from '../../src/application/plugin-data-repository';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import type { ShellEvents } from '../../src/application/events';
export { unwrap } from './repository-helpers';

export const bookmark = defineEntity('bookmark', 1, {
  label: fields.text({ trim: true, min: 1 }),
  pinned: fields.defaulted(fields.boolean(), false),
  count: fields.defaulted(fields.number({ min: 0 }), 0),
  tags: fields.defaulted(fields.textList(), []),
  due: fields.optional(fields.date()),
});
export const bookmarkFeature = definePluginDataFeature({ backend: 'plugin-data', entity: bookmark });
export function pluginDataFixture(initial: unknown = null) {
  let raw: unknown = initial;
  const storage = {
    load: vi.fn(async () => raw),
    save: vi.fn(async (value: unknown) => { raw = structuredClone(value); }),
  };
  const errors = { report: vi.fn() };
  const events = new TypedEventBus<ShellEvents>(errors);
  const data = new PluginDataStore(storage, errors);
  const preferences = new PreferenceService(data, events, errors);
  let id = 0;
  const newId = () => `bookmark-${++id}`;
  const now = () => '2026-09-23T12:00:00.000Z';
  const repository = new PluginDataRepository(bookmark, data, events, newId, now, errors);
  return { data, errors, events, storage, preferences, repository, newId, now, raw: () => raw };
}
