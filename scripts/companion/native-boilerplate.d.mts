import type { NativeProjectIntegrations } from './native-contract.mjs';
type NativeDeclaration =
  NativeProjectIntegrations['fileTypes'][number] | NativeProjectIntegrations['contextMenus'][number];
export declare function nativeDeclarationSource(
  kind: 'file-extension' | 'context-menu',
  definition: NativeDeclaration,
  contractImport: string,
): string;
export declare function nativeDeclarationTest(
  kind: 'file-extension' | 'context-menu',
  definition: NativeDeclaration,
  sourceImport: string,
): string;
