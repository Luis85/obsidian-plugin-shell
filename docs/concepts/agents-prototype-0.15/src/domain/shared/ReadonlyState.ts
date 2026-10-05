import type { PluginState } from './PluginState'
export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T
export type ReadonlyState = DeepReadonly<PluginState>
