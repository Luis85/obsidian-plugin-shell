import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

/** Framework entry points that must stay executable in a generated project. Generated artifacts carry content, not file modes,
 * so a copy writes them as 0644; without this a pushed project would track `bin/app` and the cloud setup script as plain files. */
const EXECUTABLE = ['bin/app', 'scripts/agent/cloud-setup.sh'] as const;
/** Best effort and silent: a missing file (a starter without the entry point) or a file system without modes is not an error. */
export async function restoreExecutableBits(directory: string): Promise<void> {
  for (const path of EXECUTABLE) await chmod(join(directory, path), 0o755).catch(() => undefined);
}
