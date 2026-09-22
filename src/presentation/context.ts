import { inject, type InjectionKey } from 'vue';
import type { PreferenceService } from '../application/preference-service';
import type { DocumentCreationService } from '../application/document-service';
import type { NotificationService } from '../application/notification-service';
import type { EntityInputs } from '../application/task-document';
import type { EventPort, ShellEvents } from '../application/events';
import type { HostActions, LocalPreferences, Diagnostic, Unsubscribe } from '../application/ports';
export interface ShowcaseContext {
  preferences: PreferenceService;
  documents: DocumentCreationService<EntityInputs>;
  events: EventPort<ShellEvents>;
  notifications: NotificationService;
  diagnostics: { readonly current: readonly Diagnostic[]; report(code: string, operation: string): void; subscribe(listener: () => void): Unsubscribe };
  host: HostActions; local: LocalPreferences; newId(): string;
}
export const contextKey: InjectionKey<ShowcaseContext> = Symbol('plugin-shell');
export function useServices(): ShowcaseContext {
  const services = inject(contextKey);
  if (!services) throw new Error('SHOWCASE_CONTEXT_MISSING');
  return services;
}
