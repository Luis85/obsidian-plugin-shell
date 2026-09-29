import type { NativeFileContext } from '../domain/native-file';
/** Safe example business handler, also usable through a palette command. No host types or writes. */
export async function inspectNativeFile(context: NativeFileContext): Promise<{ title: string; message: string }> {
  const text = await context.read();
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
  return { title: 'File summary', message: `${lines} lines · ${Array.from(text).length} characters · ${new TextEncoder().encode(text).length} UTF-8 bytes` };
}
