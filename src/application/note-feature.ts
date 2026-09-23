import { validateFolder } from '../domain/paths';
import type { DocumentRecipe } from './document-definition';
import { validateDocumentCatalog } from './document-definition';
import type { DocumentCodec } from './document-codec';
import { NoteRepository } from './note-repository';
import { PluginDataRepository } from './plugin-data-repository';
import type { PluginDataFeature } from './plugin-data-feature';
import type { PluginDataStore } from './plugin-data-store';
import type { DocumentStorage, ErrorReporter } from './ports';
import type { EventPublisher, ShellEvents } from './events';

interface NoteFeature<I, V> {
  readonly document: DocumentRecipe<I, V>;
  readonly defaultFolder: string;
}
/** A feature owns its business schema, document and folder; shared services own CRUD. */
export function defineNoteFeature<I, V>(definition: NoteFeature<I, V>): NoteFeature<I, V> {
  if (!validateFolder(definition.defaultFolder).ok) throw new Error('Invalid feature default folder');
  return Object.freeze({ ...definition });
}
interface FeatureServices {
  readonly pluginData?: PluginDataStore;
  readonly storage: DocumentStorage;
  readonly codec: DocumentCodec;
  readonly events: EventPublisher<Pick<ShellEvents, 'documents.created' | 'documents.updated' | 'documents.deleted' | 'plugin-data.created' | 'plugin-data.updated' | 'plugin-data.deleted'>>;
  readonly newId: () => string;
  readonly now: () => string;
  readonly errors: ErrorReporter;
}
interface RegisterFeature {
  <I, V>(feature: NoteFeature<I, V>, folder?: () => string): NoteRepository<I, V>;
  <I, V>(feature: PluginDataFeature<I, V>): PluginDataRepository<I, V>;
}
function thenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value && typeof value.then === 'function';
}

/** Bootstrap supplies ports once; each explicitly registered feature gets a typed repository. */
export function createNoteFeatures<R extends Record<string, { dispose(): void }>>(services: FeatureServices, definitions: (register: RegisterFeature) => R) {
  const catalog: Parameters<typeof validateDocumentCatalog>[0][number][] = [];
  const owned: { dispose(): void }[] = [];
  const keys = new Set<string>();
  let sealed = false;
  function register<I, V>(feature: NoteFeature<I, V>, folder?: () => string): NoteRepository<I, V>;
  function register<I, V>(feature: PluginDataFeature<I, V>): PluginDataRepository<I, V>;
  function register<I, V>(feature: NoteFeature<I, V> | PluginDataFeature<I, V>, folder?: () => string): NoteRepository<I, V> | PluginDataRepository<I, V> {
    if (sealed) throw new Error('Feature registration is closed');
    const key = 'backend' in feature ? feature.entity.key : feature.document.entity.key;
    if (keys.has(key)) throw new Error('Duplicate document registration or entity backend');
    keys.add(key);
    if ('backend' in feature) {
      if (!services.pluginData) throw new Error('Plugin-data storage is not configured');
      const repository = new PluginDataRepository(feature.entity, services.pluginData, { publish: event => services.events.publish(event) }, services.newId, services.now, services.errors);
      owned.push(repository);
      return repository;
    }
    validateDocumentCatalog([...catalog, feature.document]);
    const repository = new NoteRepository(feature.document, services.storage, services.codec, { publish: event => services.events.publish(event) },
      folder ?? (() => feature.defaultFolder), services.newId, services.now, services.errors);
    catalog.push(feature.document); owned.push(repository);
    return repository;
  }
  function dispose(): void { sealed = true; for (const repository of owned) repository.dispose(); }
  try {
    const entries = definitions(register);
    if (thenable(entries)) {
      void Promise.resolve(entries).catch(() => services.errors.report('feature.registration', 'feature.compose'));
      throw new Error('Feature registration must be synchronous');
    }
    if (entries === null || typeof entries !== 'object' || Object.values(entries).some(repository => !owned.includes(repository))) throw new Error('Feature registry must contain its registered repositories');
    const repositories = Object.freeze(entries);
    sealed = true;
    return { repositories, dispose };
  } catch (error) { dispose(); throw error; }
}
