import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isShellRepository } from '../../src/shared/platform/repository-kind.mjs';

/**
 * Lint scope of the Workbench shell repository. Before the src project split the shell's tests, browser harness,
 * companion concept and scripts/ code sat outside `src`, so neither oxlint (tooling/quality/lint-source.mjs) nor ESLint
 * (configs/lint/eslint.config.mjs) ever reached them. They now live under `src`, and these exclusions keep the scope the
 * same. Generated projects retain these boundaries only for exact files recorded by the compiler receipt;
 * new consumer files under the same folders remain linted.
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

function historicallyExcluded(path) {
  let excluded = false;
  for (const rule of rules) if (rule.pattern.test(path)) excluded = !rule.negated;
  return excluded;
}

/** Exact compiler-owned support files keep their previous scope; arbitrary consumer files never inherit exclusions. */
function generatedExclusions(root) {
  let receipt;
  try { receipt = JSON.parse(readFileSync(join(root, '.companion/generation.json'), 'utf8')); } catch { return []; }
  if (receipt?.version !== 1 || !Array.isArray(receipt.files)) return [];
  return receipt.files.filter(file => typeof file?.path === 'string' && /^src\/(?:[\w.-]+\/)*[\w.-]+$/.test(file.path)
    && !file.path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(file.hash)
    && ['framework', 'managed', 'extension'].includes(file.ownership) && historicallyExcluded(file.path))
    .map(file => file.path);
}

/** The shell's historical globs, or exact compiler-receipted support files in a generated project. */
export function lintExclusionGlobs(root) {
  return isShellRepository(root) ? [...shellLintExclusions] : generatedExclusions(root);
}

/** Whether a repository-relative path is outside the source lint of this root. */
export function lintExcluded(root, path, exclusions = lintExclusionGlobs(root)) {
  return isShellRepository(root) ? historicallyExcluded(path) : exclusions.includes(path);
}
