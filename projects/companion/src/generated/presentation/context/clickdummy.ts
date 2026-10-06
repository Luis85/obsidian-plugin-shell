import { inject, type InjectionKey, type Ref } from 'vue';
import type { VisualState } from '../../domain/visual-runtime.ts';
export interface ClickdummyContext {
  name: string; state: Ref<VisualState>; error: Ref<string>; current: () => string;
  surfaces: ReadonlyArray<{ id: string; label: string }>; route: () => string;
  scenarios(): ReadonlyArray<{ id: string; name: string; state: VisualState; width: string }>; scenario(): string;
  selectScenario(id: string): void;
  editorSurface(): boolean;
  open(id: string): void; reset(): void; exportProject(): void;
}
export const clickdummyKey: InjectionKey<ClickdummyContext> = Symbol('clickdummy');
export function useClickdummy(): ClickdummyContext {
  const context = inject(clickdummyKey); if (!context) throw new Error('CLICKDUMMY_CONTEXT'); return context;
}
