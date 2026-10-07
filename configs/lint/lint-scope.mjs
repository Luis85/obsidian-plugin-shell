import { isShellRepository } from '../../src/shared/platform/repository-kind.mjs';

/**
 * Lint scope of the Workbench shell repository. Before the src project split the shell's tests, browser harness,
 * companion concept and scripts/ code sat outside `src`, so neither oxlint (tooling/quality/lint-source.mjs) nor ESLint
 * (configs/lint/eslint.config.mjs) ever reached them. They now live under `src`, and these exclusions keep the scope the
 * same. They apply ONLY to the shell repository: this folder is copied into generated projects, whose `src/shared`,
 * `src/companion`, `src/cli/tooling` and `src/<x>/tests` are ordinary product code that must be linted.
 * Both linters read this one list; a `!` entry re-includes a path, the last matching entry wins.
 */
export const shellLintExclusions = Object.freeze([
  'src/*/tests/**', 'src/plugin/harness/**', 'src/companion/**', 'src/cli/tooling/**',
  // The former scripts/ code. Two modules were linted before under another name (src/cli/domain/errors.ts and
  // templates/companion/runtime/contract.ts). The pattern ends in `.*` so it matches files, never directories.
  'src/shared/**/*.*', '!src/shared/contracts/sketch-errors.ts', '!src/shared/companion/runtime-contract.ts',
  // The starter rules the companion editor shares with the CLI were linted as src/cli/adapters/starters before they moved.
  '!src/shared/companion/starters/*.ts',
]);

function globToRegExp(glob) {
  let source = '';
  for (let index = 0; index < glob.length; index++) {
    if (glob.startsWith('**/', index)) { source += '(?:.*/)?'; index += 2; }
    else if (glob.startsWith('**', index)) { source += '.*'; index += 1; }
    else if (glob[index] === '*') source += '[^/]*';
    else source += glob[index].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}
const rules = shellLintExclusions.map(entry => ({ negated: entry.startsWith('!'), pattern: globToRegExp(entry.replace(/^!/, '')) }));

/** The ignore globs for a root: the shell exclusions in the shell repository, none anywhere else. */
export function lintExclusionGlobs(root) {
  return isShellRepository(root) ? [...shellLintExclusions] : [];
}

/** Whether a repository-relative path is outside the source lint of this root. */
export function lintExcluded(root, path) {
  if (!isShellRepository(root)) return false;
  let excluded = false;
  for (const rule of rules) if (rule.pattern.test(path)) excluded = !rule.negated;
  return excluded;
}
