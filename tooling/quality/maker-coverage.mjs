/** Same production/core floors as src, independently measured so runtime coverage cannot mask the CLI. */
import { readFileSync } from 'node:fs';
import { assertCoverageInventory, assertSelectedCoreGate, makerCoverageSources as sources } from './coverage-inventory.mjs';
import { loadThresholds } from './thresholds.mjs';
const typedCore = ['src/shared/contracts/json-data.ts', 'src/shared/contracts/serialization.ts', 'src/shared/contracts/result.ts', 'src/shared/contracts/errors.ts', 'src/shared/contracts/result-runtime.mjs', 'src/shared/platform/process.ts', 'src/shared/platform/file-plan.ts', 'src/shared/platform/file-plan-runtime.ts', 'src/shared/platform/bounded-map.ts', 'src/shared/platform/confirmation.ts', 'src/shared/platform/input.ts', 'src/shared/platform/hash.ts', 'src/shared/platform/fs-presence.ts', 'src/shared/platform/project-path.ts', 'src/shared/platform/protected-directories.ts'];
const movedDomain = ['src/shared/contracts/sketch-errors.ts', 'src/shared/companion/starters/project-generator.ts'];
const files = [...sources('src/cli', new Set(['src/cli/sdk', 'src/cli/tooling', 'src/cli/tests'])),
  ...sources('src/tui', new Set(['src/tui/tests'])), ...sources('src/shared/companion/starters'), 'src/shared/contracts/sketch-errors.ts', ...typedCore];
const report = JSON.parse(readFileSync('reports/maker-coverage/coverage-summary.json', 'utf8'));
assertCoverageInventory(report, files);
const { coverage } = loadThresholds();
const production = assertSelectedCoreGate(report, files, coverage.maker);
const core = assertSelectedCoreGate(report, [...sources('src/cli/domain'), ...sources('src/cli/application'), ...sources('src/cli/compiler/domain'), ...sources('src/cli/compiler/application'), ...sources('src/cli/documentation/domain'), ...sources('src/cli/documentation/application'), ...movedDomain], coverage.makerCore);
console.log(JSON.stringify({ production, core }, null, 2));
