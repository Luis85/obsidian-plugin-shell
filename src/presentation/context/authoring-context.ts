import { inject, type Component, type InjectionKey } from 'vue';
import type { AuthoringServices } from '../../application/authoring';

export interface AuthoringContext {
  readonly services: AuthoringServices;
  readonly panels: readonly { readonly id: string; readonly component: Component; readonly props: Record<string, unknown> }[];
}
export const authoringContextKey: InjectionKey<AuthoringContext> = Symbol('authoring');
export function useAuthoring() {
  const context = inject(authoringContextKey);
  if (!context) throw new Error('AUTHORING_CONTEXT_MISSING');
  return context;
}
