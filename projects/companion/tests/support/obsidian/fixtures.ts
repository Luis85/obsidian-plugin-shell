/** Load a directory of vault fixture files for `createTestApp({ files })`. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Recursively read every file below `directory` as UTF-8, keyed by its vault-relative
 * POSIX path. Symbolic links and hidden entries are rejected so a fixture cannot reach
 * outside its folder or smuggle config files into the vault index.
 */
export function loadVaultFixtures(directory: string | URL): Record<string, string> {
  const root = directory instanceof URL ? fileURLToPath(directory) : directory;
  const files: Record<string, string> = {};
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) throw new Error(`OBSIDIAN_TEST_KIT_FIXTURE_REJECTED: ${relative(root, path)}`);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files[relative(root, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  visit(root);
  return files;
}
