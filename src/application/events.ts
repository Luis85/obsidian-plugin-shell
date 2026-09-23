import type { Unsubscribe } from './ports';
export interface ShellEvents {
  'plugin-data.created': {
    readonly entity: string;
    readonly id: string;
    readonly schemaVersion: number;
    readonly revision: number;
  };
  'plugin-data.updated': {
    readonly entity: string;
    readonly id: string;
    readonly schemaVersion: number;
    readonly revision: number;
  };
  'plugin-data.deleted': {
    readonly entity: string;
    readonly id: string;
    readonly schemaVersion: number;
    readonly revision: number;
  };
  'documents.created': {
    readonly entity: string;
    readonly id: string;
    readonly path: string;
    readonly schemaVersion: number;
  };
  'documents.updated': {
    readonly entity: string;
    readonly id: string;
    readonly path: string;
    readonly schemaVersion: number;
  };
  'documents.deleted': {
    readonly entity: string;
    readonly id: string;
    readonly path: string;
    readonly schemaVersion: number;
  };
  'preferences.changed': { readonly revision: number };
  'showcase.ping': { readonly sequence: number };
  'host.active-file-changed': { readonly available: boolean };
  'host.vault.entry-created': {
    readonly path: string;
    readonly kind: 'file' | 'folder';
  };
  'host.vault.entry-modified': {
    readonly path: string;
    readonly modifiedTime: number | null;
  };
  'host.vault.entry-renamed': {
    readonly path: string;
    readonly oldPath: string;
    readonly kind: 'file' | 'folder';
  };
  'host.vault.entry-deleted': {
    readonly path: string;
    readonly kind: 'file' | 'folder';
  };
  'host.workspace.file-opened': { readonly path: string | null };
  'host.workspace.active-view-changed': { readonly viewType: string | null };
  'host.workspace.layout-changed': { readonly revision: number };
  'host.metadata.changed': { readonly path: string };
}
export type EventInput<M> = {
  [K in keyof M]: { readonly type: K; readonly payload: M[K] };
}[keyof M];
export interface EventPublisher<M> {
  publish(event: EventInput<M>): void;
}
export interface EventObserver<M> {
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe;
  once<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe;
}
export interface EventSubscriber<P> {
  on(listener: (payload: P) => void | Promise<void>): Unsubscribe;
  once(listener: (payload: P) => void | Promise<void>): Unsubscribe;
}
export interface EventPort<M> extends EventPublisher<M>, EventObserver<M> {}
