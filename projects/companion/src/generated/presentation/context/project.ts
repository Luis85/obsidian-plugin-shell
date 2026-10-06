import { inject, type InjectionKey, type Component } from 'vue';
export interface Flow { id: string; card: string; label: string; trigger: string; direction: string; requiresInput: boolean; readonly pending: boolean; readonly error: string | null; run(): Promise<unknown> }
export interface ProjectContext { panels: Record<string,Component>; flows: Flow[]; initial?: string; isolated: boolean; designState?: () => 'default' | 'loading' | 'empty' | 'error' | 'disabled'; openModal(id: string): void }
export const projectKey: InjectionKey<ProjectContext> = Symbol('generated-project');
export function useProject(): ProjectContext { const context = inject(projectKey); if (!context) throw new Error('PROJECT_CONTEXT_MISSING'); return context; }
