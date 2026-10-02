import type { Plugin } from 'obsidian';
import type { NativeFileType, NativeFileAction } from '../domain/native-file';
import { registerNativeIntegrations } from '../infrastructure/obsidian/native-integrations';
import type { NativeFailure } from '../infrastructure/obsidian/native-file-view';
/** Explicit composition point shared by the template, generated projects and shell makers. */
const nativeFileTypes: NativeFileType[] = [];
const nativeFileActions: NativeFileAction[] = [];
export function installNativeIntegrations(plugin: Plugin, report: NativeFailure, generatedTypes: readonly NativeFileType[] = [], generatedActions: readonly NativeFileAction[] = []): () => void {
  const types = [...generatedTypes,...nativeFileTypes], actions = [...generatedActions,...nativeFileActions];
  if (!types.length && !actions.length) return () => {};
  return registerNativeIntegrations(plugin,types,actions,report);
}
