import { createI18n } from 'vue-i18n';
import { PreferenceService } from '../application/preference-service';
import { DocumentCreationService } from '../application/document-service';
import { NoticeService } from '../application/notice-service';
import { ModalService } from '../application/modal-service';
import { StructuredLogger } from '../application/logging';
import { DebugService } from '../application/debug-service';
import { taskDefinition, type EntityInputs } from '../features/tasks/form';
import { createFeatures } from './features';
import type { ShellEvents } from '../application/events';
import type { ServiceAdapters } from '../application/ports';
import { TypedEventBus } from '../infrastructure/events/typed-event-bus';
import { Diagnostics } from '../infrastructure/diagnostics';
import { createTimerScheduler } from '../infrastructure/timers';
import { pluginIdentity } from '../infrastructure/plugin-identity';
import { renderMarkdown, markdownCodec } from '../infrastructure/markdown';
import en from '../locales/en.json';
import de from '../locales/de.json';
export async function createServices(adapters: ServiceAdapters) {
  const diagnostics = new Diagnostics(adapters.observeError);
  const logger = new StructuredLogger(diagnostics, adapters.now);
  const debugging = new DebugService(logger, () => diagnostics.current, { id: pluginIdentity.id, version: pluginIdentity.version, host: adapters.host.kind });
  const scheduler = adapters.scheduler ?? createTimerScheduler();
  const events = new TypedEventBus<ShellEvents>(diagnostics);
  const preferences = new PreferenceService(adapters.settings, events, diagnostics);
  await preferences.load();
  const messages = { en: { ...en, app: { ...en.app, title: () => pluginIdentity.name } }, de: { ...de, app: { ...de.app, title: () => pluginIdentity.name } } };
  const i18n = createI18n({ legacy: false, locale: preferences.current.locale, fallbackLocale: 'en', messages });
  const notifications = new NoticeService(adapters.host, key => i18n.global.t(key), diagnostics, { scheduler, validKey: key => i18n.global.te(key) });
  const modals = new ModalService(adapters.modals, key => i18n.global.t(key), diagnostics, key => i18n.global.te(key));
  const off = preferences.subscribe(value => { i18n.global.locale.value = value.locale; notifications.refreshLocale(); });
  const documents = new DocumentCreationService<EntityInputs>({ task: taskDefinition }, adapters.documents, events, renderMarkdown, adapters.newId, adapters.now, diagnostics);
  const features = createFeatures({ storage: adapters.documents, codec: markdownCodec, events, newId: adapters.newId, now: adapters.now, errors: diagnostics }, preferences);
  const { repositories } = features;
  logger.info('runtime.started', 'runtime.initialize');
  return { identity: pluginIdentity, events, diagnostics, logger, debugging, scheduler, preferences, i18n, modals, notices: notifications, notifications, documents, repositories, host: adapters.host, local: adapters.local, newId: adapters.newId,
    dispose() { off(); documents.dispose(); features.dispose(); modals.dispose(); notifications.dispose(); preferences.dispose(); events.dispose(); adapters.host.dispose?.(); logger.dispose(); diagnostics.dispose(); },
  };
}
export type Services = Awaited<ReturnType<typeof createServices>>;
