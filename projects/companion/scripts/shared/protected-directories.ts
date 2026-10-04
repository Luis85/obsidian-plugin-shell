/**
 * The one framework-free source of protected project directory names. Every set is lower-case; callers compare a
 * case-folded path segment, so `.GIT` or `Node_Modules` on case-insensitive volumes are refused as well.
 * Purpose-specific sets are named compositions of the same base groups, never independent copies.
 */
const folded = (names: readonly string[]): readonly string[] => Object.freeze([...new Set(names.map(name => name.toLowerCase()))]);

/** Version control, installed dependencies and the CLI's own cross-process lock files. */
const repositoryInternals = folded(['.git', 'node_modules', '.codex-authoring.lock', '.shell-first-run.lock']);
/** Framework, companion-generation and starter ownership records. */
const ownershipDirectories = folded(['.framework', '.companion', '.workbench']);
/** Native and qualification scratch areas created by gates and runners. */
const qualificationDirectories = folded(['.worktrees', '.qualification', '.native-runner']);
/** The conventional host configuration folder (a configurable default, not a running vault's configDir). */
const hostConfigDirectory = '.obsidian';
const testVaultDirectory = '.test-vault';
const developmentVaultDirectory = '.dev-vault';

/** Names a configurable folder (the test vault or the host configuration directory) may never take. */
export const RESERVED_FOLDER_NAMES = folded([...repositoryInternals, ...ownershipDirectories, ...qualificationDirectories]);
/** Segments that CLI-authored project paths, saved plans, exports and archives never enter. */
export const PROTECTED_PROJECT_SEGMENTS = folded([...RESERVED_FOLDER_NAMES, hostConfigDirectory, testVaultDirectory, developmentVaultDirectory]);
/**
 * Roots the shared file-plan writer refuses. Ownership, host-configuration and test-vault folders are written through
 * reviewed file plans on purpose; the development vault is installed only by its dedicated local installer.
 */
export const FILE_PLAN_PROTECTED_ROOTS = folded([...repositoryInternals, ...qualificationDirectories, developmentVaultDirectory]);

/** True when a single path segment names a member of `names` (default: every protected project segment). */
export function isProtectedSegment(segment: string, names: readonly string[] = PROTECTED_PROJECT_SEGMENTS): boolean {
  return names.includes(segment.toLowerCase());
}
