import type { NativeFileDefinition, NativeMenuDefinition } from '../domain/native-integrations';
import type { Component } from 'vue';

/** Explicit authoring registries. The maker appends declarations here; no discovery or evaluation. */
export const nativeFileTypes: NativeFileDefinition[] = [];
export const nativeContextMenus: NativeMenuDefinition[] = [];
/** A Vue editor for one registered file type (`id` is the file type's id). */
export interface NativeFileEditorRegistration {
  readonly id: string;
  readonly component: Component;
}
/** Custom Vue editors by file type id; a file type without one keeps the raw text editor. */
export const nativeFileEditors: NativeFileEditorRegistration[] = [];
