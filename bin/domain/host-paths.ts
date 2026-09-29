/** The CLI operates before a host API exists. This is the conventional default,
 * not an assertion about a running vault; callers accept a separately configured directory. */
// eslint-disable-next-line obsidianmd/hardcoded-config-path -- A configurable CLI default before any Obsidian host API exists; never used as a running Vault's configDir.
export const defaultVaultConfigDirectory = '.obsidian';
export const protectedProjectRoots = ['.git', defaultVaultConfigDirectory, '.framework', 'node_modules', '.codex-authoring.lock', '.shell-first-run.lock'];
