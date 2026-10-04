/** Compact runtime contract. Explanatory catalog metadata is tooling-only. */
export interface EventDefinition<N extends string = string, P = unknown> {
  readonly id: N;
  readonly valid: (payload: unknown) => payload is P;
}
export type EventPayload<D> = D extends EventDefinition<string, infer P> ? P : never;
export type EventMapOf<D extends EventDefinition> = {
  [E in D as string extends D['id'] ? never : E['id']]: EventPayload<E>;
};
export function defineEvent<const N extends string, P>(
  id: string extends N ? never : N,
  valid: (payload: unknown) => payload is P,
): EventDefinition<N, P> {
  return Object.freeze({ id, valid });
}
export function composeEvents(...groups: readonly (readonly EventDefinition[])[]): readonly EventDefinition[] {
  const definitions = groups.flat();
  const names = new Set<string>();
  for (const definition of definitions) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(definition.id) || typeof definition.valid !== 'function')
      throw new Error('EVENT_INVALID_DEFINITION');
    if (names.has(definition.id)) throw new Error(`EVENT_DUPLICATE: ${definition.id}`);
    names.add(definition.id);
  }
  return Object.freeze(definitions);
}
