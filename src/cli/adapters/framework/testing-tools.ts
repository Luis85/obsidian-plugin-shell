import { join } from 'node:path';
import { exists } from './files.ts';

/** A test driver (`check-native.mjs`, `run-obsidian-tests.mjs`, ...): tooling/testing in the shell repository, scripts/testing in a
 * generated project, which keeps that layout. */
export async function testingTool(root: string, name: string, existsPath: typeof exists = exists): Promise<string> {
  const shell = `tooling/testing/${name}`;
  return await existsPath(join(root, shell)) ? shell : `scripts/testing/${name}`;
}
