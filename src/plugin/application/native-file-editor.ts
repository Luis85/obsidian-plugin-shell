import type { NativeFileDefinition } from '../domain/native-integrations';

export interface NativeFileEditorFile {
  readonly path: string;
  readonly name: string;
  readonly basename: string;
}
export interface NativeFileEditorState {
  /** The exact current buffer; never reformatted by the host. */
  readonly content: string;
  readonly file: NativeFileEditorFile | null;
  /** Format/domain validation message, or null when the content is valid. */
  readonly validation: string | null;
  /** False after the plugin stopped the view; further updates are ignored. */
  readonly editable: boolean;
}
/**
 * Host-independent link between a dedicated file view and its custom editor UI.
 * The view owns file IO and the save lifecycle; `update` replaces the buffer and
 * requests a host save. Editors decide when to rewrite text: only on user edits.
 */
export interface NativeFileEditorSession {
  readonly definition: NativeFileDefinition;
  current(): NativeFileEditorState;
  subscribe(listener: () => void): () => void;
  update(content: string): void;
}
