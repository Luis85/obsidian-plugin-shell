import { inject, type InjectionKey } from 'vue';
import type { JourneyProjectStore } from '#shared/companion/journey/project-store.ts';
import type { EditorHost, EditorViewState } from '../contracts.ts';
export interface EditorMount {
  ready: Promise<void>; isBusy(): boolean; canLeave(): boolean; recovery(): unknown; restore(value: unknown): Promise<boolean>;
  viewState(): EditorViewState; invalidate(): void; unmount(): void;
}
export interface JourneyWorkspaceEnvironment {
  store: JourneyProjectStore;
  seed: string;
  mode: 'native' | 'preview';
  ownerId: string;
  mount(root: HTMLElement, host: EditorHost): EditorMount;
  guard(check: () => boolean): () => void;
  navigate(kind: 'page' | 'components' | 'sources', surface?: string): void;
  initialPath: string;
  rememberPath(path: string): void;
}
export const workspaceKey: InjectionKey<JourneyWorkspaceEnvironment> = Symbol('journey-workspace');
export function useWorkspaceEnvironment(): JourneyWorkspaceEnvironment {
  const environment = inject(workspaceKey);
  if (!environment) throw Error('JOURNEY_WORKSPACE_MISSING');
  return environment;
}
