import { inject, type InjectionKey } from 'vue';
import type { ShowcaseContext } from './showcase-context';
export const contextKey: InjectionKey<ShowcaseContext> = Symbol('plugin-shell');
export function useServices(): ShowcaseContext {
  const services = inject(contextKey);
  if (!services) throw new Error('SHOWCASE_CONTEXT_MISSING');
  return services;
}
