export interface NativeProjectIntegrations {
  schemaVersion: 1;
  fileTypes: { id: string; name: string; extension: string; format: 'json' | 'text'; initialContent: string }[];
  contextMenus: { id: string; name: string; extensions: string[] }[];
}
export declare const nativeReservedExtensions: readonly string[];
export declare function validateNativeIntegrations(value: unknown): NativeProjectIntegrations;
