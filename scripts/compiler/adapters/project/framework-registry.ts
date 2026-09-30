import { defineFrameworkAdapter, type FrameworkAdapter } from './framework-adapter.ts';

const builtins: readonly FrameworkAdapter[] = Object.freeze([
  defineFrameworkAdapter({ id: 'nuxtui', engine: 'nuxtui', label: 'Vue 3 + Nuxt UI — Vue single-file components, Pinia and Nuxt UI; not the Nuxt application framework.' }),
  defineFrameworkAdapter({ id: 'vanilla', engine: 'vanilla', label: 'Vanilla, no frontend framework — TypeScript and DOM APIs; native Obsidian integration for plugin targets.' }),
  defineFrameworkAdapter({ id: 'angular', engine: 'angular', label: 'Angular — standalone Angular components, AOT compilation and zoneless, per-view lifecycle.' }),
  defineFrameworkAdapter({ id: 'none', engine: 'none', label: 'No frontend, command-line application — Node.js commands, structured output and explicit exit codes.' }),
]);
export function frameworkAdapters(contributed: readonly FrameworkAdapter[] = []): readonly FrameworkAdapter[] {
  const result = [...builtins, ...contributed.map(defineFrameworkAdapter)];
  const ids = new Set<string>();
  for (const adapter of result) {
    if (ids.has(adapter.id)) throw new Error('FRAMEWORK_ADAPTER_DUPLICATE:' + adapter.id);
    ids.add(adapter.id);
  }
  return Object.freeze(result);
}
export function frameworkAdapter(id: string, contributed: readonly FrameworkAdapter[] = []): FrameworkAdapter | undefined {
  return frameworkAdapters(contributed).find(adapter => adapter.id === id);
}
export function requireFrameworkAdapter(id: string, contributed: readonly FrameworkAdapter[] = []): FrameworkAdapter {
  const adapter = frameworkAdapter(id, contributed);
  if (!adapter) throw new Error('FRAMEWORK_ADAPTER_MISSING:' + id);
  return adapter;
}
