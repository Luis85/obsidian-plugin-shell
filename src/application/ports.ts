import type { Result } from '../domain/outcome';
export interface SettingsStorage { load(): Promise<unknown>; save(value: unknown): Promise<void> }
export interface LocalPreferences { get(key: string): unknown; set(key: string, value: unknown): void }
export interface DocumentWriter { create(path: string, markdown: string): Promise<Result<void>> }
export interface HostActions {
  readonly kind: 'obsidian' | 'browser';
  openDocument(path: string): Promise<Result<void>>;
  showModal(title: string, text: string): void;
  notice(text: string, duration?: number): () => void;
  dispose?(): void;
}
export interface Diagnostic { readonly sequence: number; readonly code: string; readonly operation: string }
export interface ErrorReporter { report(code: string, operation: string): void }
export type Unsubscribe = () => void;

export interface ServiceAdapters {
  settings: SettingsStorage; local: LocalPreferences; documents: DocumentWriter; host: HostActions;
  newId: () => string; now: () => string; observeError?: (entry: Diagnostic) => void;
}
