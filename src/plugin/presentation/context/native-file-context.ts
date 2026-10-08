import { inject, shallowRef, type InjectionKey, type ShallowRef } from 'vue';
import type { NativeFileEditorSession, NativeFileEditorState } from '../../application/native-file-editor';
import type { NativeFileDefinition } from '../../domain/native-integrations';

/** What a custom file editor component sees: the file definition, live state and one write path. */
export interface NativeFileModel {
  readonly definition: NativeFileDefinition;
  readonly state: Readonly<ShallowRef<NativeFileEditorState>>;
  /** Replace the whole buffer; the host view saves it through Obsidian. */
  update(content: string): void;
}
export const nativeFileKey: InjectionKey<NativeFileModel> = Symbol('native-file');
/** Bridges the host session into Vue reactivity; release unsubscribes when the editor unmounts. */
export function createNativeFileModel(session: NativeFileEditorSession): { model: NativeFileModel; release: () => void } {
  const state = shallowRef(session.current());
  const release = session.subscribe(() => {
    state.value = session.current();
  });
  return { model: { definition: session.definition, state, update: (content) => session.update(content) }, release };
}
export function useNativeFile(): NativeFileModel {
  const model = inject(nativeFileKey);
  if (!model) throw new Error('NATIVE_FILE_CONTEXT_MISSING');
  return model;
}
