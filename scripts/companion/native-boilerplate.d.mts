import type { NativeProjectIntegrations } from './native-contract.mjs';
type NativeDeclaration =
  NativeProjectIntegrations['fileTypes'][number] | NativeProjectIntegrations['contextMenus'][number];
export function nativeDeclarationSource(
  kind: 'file-extension' | 'context-menu',
  definition: NativeDeclaration,
  contractImport: string,
): string;
export function nativeDeclarationTest(
  kind: 'file-extension' | 'context-menu',
  definition: NativeDeclaration,
  sourceImport: string,
): string;
