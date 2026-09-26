import { symlink } from 'node:fs/promises';
/** Windows denies file symlinks without Developer Mode or SeCreateSymbolicLinkPrivilege; directory junctions need neither.
 * Report that capability gap as an explicit skip instead of a false failure. Every other platform/error still throws. */
export async function fileSymlink(t, target, path) {
  try { await symlink(target, path, 'file'); return true; }
  catch (error) {
    if (process.platform !== 'win32' || error?.code !== 'EPERM') throw error;
    t.skip('Windows refused to create a file symlink (needs Developer Mode or SeCreateSymbolicLinkPrivilege)');
    return false;
  }
}
