/** Same production/core floors as src, independently measured so runtime coverage cannot mask the CLI. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertCoverageInventory, assertSelectedCoreGate } from './coverage-inventory.mjs';
import { loadThresholds } from './thresholds.mjs';
function sources(root) { return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
  const path = join(root, entry.name); return entry.isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
}); }
const files = sources('bin');
const report = JSON.parse(readFileSync('reports/maker-coverage/coverage-summary.json', 'utf8'));
assertCoverageInventory(report, files);
const { coverage } = loadThresholds();
const production = assertSelectedCoreGate(report, files, coverage.maker);
const core = assertSelectedCoreGate(report, [...sources('bin/domain'), ...sources('bin/application')], coverage.makerCore);
console.log(JSON.stringify({ production, core }, null, 2));
