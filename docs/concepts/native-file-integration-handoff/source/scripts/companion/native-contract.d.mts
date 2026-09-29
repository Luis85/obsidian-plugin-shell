export interface NativeFileSpec { id: string; name: string; extension: string; icon: string; format: 'text' | 'json'; defaultContent: string }
export interface NativeMenuSpec { id: string; name: string; extensions: string[]; icon: string }
export interface NativeIntegrations { fileTypes: NativeFileSpec[]; contextMenus: NativeMenuSpec[] }
export function validateNativeIntegrations(value: unknown): NativeIntegrations;
export function validateNativeExtension(value: unknown, owned?: boolean): string;
