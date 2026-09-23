import type { PreferenceService } from '../../application/preference-service';
import type { DocumentCreationService } from '../../application/document-service';
import type { NotificationService } from '../../application/notification-service';
import type { ModalService } from '../../application/modal-service';
import type { NoticeService } from '../../application/notice-service';
import type { StructuredLogger } from '../../application/logging';
import type { DebugService } from '../../application/debug-service';
import type { EntityInputs } from '../../features/tasks/form';
import type { NoteRepository } from '../../application/note-repository';
import type { TaskCreateInput, TaskValues } from '../../features/tasks/entity';
import type { EventPort, ShellEvents } from '../../application/events';
import type { HostActions, LocalPreferences, Diagnostic, Unsubscribe } from '../../application/ports';
export interface ShowcaseContext {
  identity: { readonly id: string; readonly name: string; readonly version: string };
  preferences: PreferenceService;
  documents: DocumentCreationService<EntityInputs>;
  repositories: { task: NoteRepository<TaskCreateInput, TaskValues> };
  events: EventPort<ShellEvents>;
  notifications: NotificationService;
  notices: NoticeService;
  modals: ModalService;
  logger: StructuredLogger;
  debugging: DebugService;
  diagnostics: { readonly current: readonly Diagnostic[]; report(code: string, operation: string): void; subscribe(listener: () => void): Unsubscribe };
  host: HostActions; local: LocalPreferences; newId(): string;
}
