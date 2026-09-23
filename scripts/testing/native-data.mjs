import { readFile } from 'node:fs/promises';
/** Native saveData can expose a partial file during an in-flight write. Poll callers
 * keep their original deadline; permanent corruption never reaches the expected value. */
export async function pendingNativeData(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError || error.code === 'ENOENT') return undefined;
    throw error;
  }
}
