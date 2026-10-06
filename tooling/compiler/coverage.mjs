/** Compiler-core coverage gate. Floors come from configs/quality/thresholds.json (tighten-only). */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadThresholds } from '../quality/thresholds.mjs';

const tests = ['compiler-core', 'compiler-cli', 'compiler-golden', 'compiler-targets', 'compiler-properties', 'compiler-selection', 'interactive-maker-project-starters', 'interactive-maker-compiler-core']
  .map(name => `tests/tooling/${name}.checks.mjs`);
export function compilerCoverageArguments(thresholds = loadThresholds()) {
  const { lines, branches, functions } = thresholds.coverage.compiler;
  return ['--experimental-test-coverage', `--test-coverage-lines=${lines}`, `--test-coverage-branches=${branches}`, `--test-coverage-functions=${functions}`,
    '--test-coverage-include=src/cli/compiler/domain/**', '--test-coverage-include=src/cli/compiler/application/**', '--test', '--test-concurrency=1', ...tests];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const run = spawnSync(process.execPath, compilerCoverageArguments(), { stdio: 'inherit' });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
}
