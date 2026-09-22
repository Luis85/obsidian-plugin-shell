import type { Unsubscribe } from './ports';
export interface ShellEvents {
  'documents.created': { readonly entity: string; readonly id: string; readonly path: string };
  'preferences.changed': { readonly revision: number };
  'showcase.ping': { readonly sequence: number };
  'host.active-file-changed': { readonly available: boolean };
}
export type EventInput<M> = { [K in keyof M]: { readonly type: K; readonly payload: M[K] } }[keyof M];
export interface EventPort<M> {
  publish(event: EventInput<M>): void;
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe;
}
