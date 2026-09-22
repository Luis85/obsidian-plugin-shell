import { createI18n } from 'vue-i18n';
import { PreferenceService } from '../application/preference-service';
import { DocumentCreationService } from '../application/document-service';
import { NotificationService } from '../application/notification-service';
import { taskDefinition, type EntityInputs } from '../application/task-document';
import type { ShellEvents } from '../application/events';
import type { ServiceAdapters } from '../application/ports';
import { TypedEventBus } from '../infrastructure/events/typed-event-bus';
import { Diagnostics } from '../infrastructure/diagnostics';
import { renderMarkdown } from '../infrastructure/markdown';
import en from '../locales/en.json';
import de from '../locales/de.json';
export async function createServices(adapters: ServiceAdapters) {
  const diagnostics = new Diagnostics(adapters.observeError);
  const events = new TypedEventBus<ShellEvents>(diagnostics);
  const preferences = new PreferenceService(adapters.settings, events, diagnostics);
  await preferences.load();
  const i18n = createI18n({ legacy: false, locale: preferences.current.locale, fallbackLocale: 'en', messages: { en, de } });
  const off = preferences.subscribe(value => { i18n.global.locale.value = value.locale; });
  const notifications = new NotificationService(adapters.host, key => i18n.global.t(key), diagnostics);
  const documents = new DocumentCreationService<EntityInputs>({ task: taskDefinition }, adapters.documents, events, renderMarkdown, adapters.newId, adapters.now);
  return { events, diagnostics, preferences, i18n, notifications, documents, host: adapters.host, local: adapters.local, newId: adapters.newId,
    dispose() { off(); documents.dispose(); notifications.dispose(); preferences.dispose(); events.dispose(); adapters.host.dispose?.(); diagnostics.dispose(); },
  };
}
export type Services = Awaited<ReturnType<typeof createServices>>;
