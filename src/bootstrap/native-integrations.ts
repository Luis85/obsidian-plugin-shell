import type { NativeFileDefinition, NativeMenuDefinition } from '../domain/native-integrations';
import type { NativeFileEditorRegistration } from './mount-file-editor';

/** Explicit authoring registries. The maker appends declarations here; no discovery or evaluation. */
export const nativeFileTypes: NativeFileDefinition[] = [];
export const nativeContextMenus: NativeMenuDefinition[] = [];
/** Custom Vue editors by file type id; a file type without one keeps the raw text editor. */
export const nativeFileEditors: NativeFileEditorRegistration[] = [];
