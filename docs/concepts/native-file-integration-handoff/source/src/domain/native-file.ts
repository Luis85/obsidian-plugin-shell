/** Framework-free file type and action contracts. File contents never enter diagnostics. */
export interface NativeFileType {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly icon: string;
  readonly format: 'text' | 'json';
  readonly defaultContent: string;
  /** Optional domain validation. Return a user-facing explanation; do not mutate text. */
  readonly validate?: (text: string) => string | null;
}
export interface NativeFileContext {
  readonly name: string;
  readonly extension: string;
  /** Bounded fresh read, revoked on unload. No write capability is granted by default. */
  read(): Promise<string>;
}
export interface NativeFileAction {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly extensions: readonly string[];
  run(context: NativeFileContext): Promise<{ title: string; message: string }>;
}
export const NATIVE_TEXT_LIMIT = 2_000_000;
export function nativeTextIssue(text: string, type: NativeFileType): string | null {
  if (text.length > NATIVE_TEXT_LIMIT || new TextEncoder().encode(text).length > NATIVE_TEXT_LIMIT) return 'This starter supports files up to 2 MB.';
  if (text.includes('\0')) return 'Binary content is not supported by this text editor.';
  if (type.format === 'json') {
    try { JSON.parse(text); } catch { return 'Enter valid JSON before saving. The original file is preserved.'; }
  }
  try { return type.validate?.(text) ?? null; } catch { return 'Document validation failed. The original file is preserved.'; }
}
