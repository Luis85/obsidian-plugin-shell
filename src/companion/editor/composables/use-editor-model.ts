import { storeToRefs } from 'pinia';
import type { EditorStore } from './use-editor.ts';

/** Writable view-state refs for template bindings. Components bind controls to these refs, so a
 * `store` prop is only read, called or passed on and never assigned to. */
export function useEditorModel(store: EditorStore) {
  const { form, query, lens, journeyId, tab, inspectorOpen, treeOpen, draftName, dirty } = storeToRefs(store);
  return { form, query, lens, journeyId, tab, inspectorOpen, treeOpen, draftName, dirty };
}
