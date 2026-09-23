import type { Result } from '../domain/outcome';
import type { ModalSink } from './modal-port';
export interface SettingsStorage { load(): Promise<unknown>; save(value: unknown): Promise<void> }
export interface LocalPreferences { get(key: string): unknown; set(key: string, value: unknown): void }
export interface DocumentWriter { create(path: string, markdown: string): Promise<Result<void>> }
/** Storage keeps raw Markdown canonical. Replace/trash require the exact last-read bytes. */
export interface DocumentStorage extends DocumentWriter {
  list(folder: string): Promise<Result<readonly string[]>>;
  read(path: string): Promise<Result<string>>;
  replace(path: string, expectedMarkdown: string, markdown: string): Promise<Result<void>>;
  trash(path: string, expectedMarkdown: string): Promise<Result<void>>;
}
export interface HostActions {
  readonly kind: 'obsidian' | 'browser';
  openDocument(path: string): Promise<Result<void>>;
  showModal(title: string, text: string): void;
  notice(text: string, duration?: number): () => void;
  notification?(text: string, actions: readonly NoticeAction[]): NoticeHandle;
  dispose?(): void;
}
export interface NoticeAction { readonly label: string; readonly disabled: boolean; invoke(): void }
export interface NoticeHandle { update(text: string, actions: readonly NoticeAction[]): void; dismiss(): void }
export interface Diagnostic { readonly sequence: number; readonly code: string; readonly operation: string }
export interface ErrorReporter { report(code: string, operation: string): void }
export type Unsubscribe = () => void;
export interface TimerScheduler { after(milliseconds: number, callback: () => void): Unsubscribe }

export interface ServiceAdapters {
  settings: SettingsStorage; local: LocalPreferences; documents: DocumentStorage; host: HostActions;
  newId: () => string; now: () => string; observeError?: (entry: Diagnostic) => void;
  scheduler?: TimerScheduler;
  modals?: ModalSink;
}
