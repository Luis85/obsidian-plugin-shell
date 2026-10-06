import type { EntityDefinition } from '../domain/entity';

export interface PluginDataFeature<I, V> {
  readonly backend: 'plugin-data';
  readonly entity: EntityDefinition<I, V>;
}
/** Explicit backend selection: this definition creates no Markdown document. */
export function definePluginDataFeature<I, V>(definition: PluginDataFeature<I, V>): PluginDataFeature<I, V> {
  if (definition.backend !== 'plugin-data') throw new Error('Invalid plugin-data backend');
  return Object.freeze({ ...definition });
}
