import { join } from 'node:path';
import { exists } from './files.ts';

/** The shell repository runs its suites through tooling/testing; only the shell plans the maker and changed-path suite steps. */
export const shellSuiteRunner = 'tooling/testing/suites.mjs';

/** A test driver (`suites.mjs`, `check-native.mjs`, ...): tooling/testing in the shell repository, scripts/testing in a
 * generated project, which keeps that layout. */
export async function testingTool(root: string, name: string, existsPath: typeof exists = exists): Promise<string> {
  const shell = `tooling/testing/${name}`;
  return await existsPath(join(root, shell)) ? shell : `scripts/testing/${name}`;
}
