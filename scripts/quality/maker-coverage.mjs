/** Same production/core floors as src, independently measured so runtime coverage cannot mask the CLI. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertCoverageInventory, assertSelectedCoreGate } from './coverage-inventory.mjs';
import { loadThresholds } from './thresholds.mjs';
function sources(root) { return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const path = join(root, entry.name); return entry.isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
}); }
const typedCore = ['scripts/contracts/json-data.ts', 'scripts/contracts/serialization.ts', 'scripts/contracts/result.ts', 'scripts/contracts/errors.ts', 'scripts/contracts/result-runtime.mjs', 'scripts/shared/process.ts', 'scripts/shared/file-plan.ts', 'scripts/shared/file-plan-runtime.ts', 'scripts/shared/bounded-map.ts', 'scripts/shared/confirmation.ts', 'scripts/shared/input.ts', 'scripts/shared/hash.ts', 'scripts/shared/fs-presence.ts', 'scripts/shared/project-path.ts', 'scripts/shared/protected-directories.ts'];
const files = [...sources('src/cli'), ...typedCore];
const report = JSON.parse(readFileSync('reports/maker-coverage/coverage-summary.json', 'utf8'));
assertCoverageInventory(report, files);
const { coverage } = loadThresholds();
const production = assertSelectedCoreGate(report, files, coverage.maker);
const core = assertSelectedCoreGate(report, [...sources('src/cli/domain'), ...sources('src/cli/application'), ...sources('src/cli/compiler/domain'), ...sources('src/cli/compiler/application'), ...sources('src/cli/documentation/domain'), ...sources('src/cli/documentation/application')], coverage.makerCore);
console.log(JSON.stringify({ production, core }, null, 2));
