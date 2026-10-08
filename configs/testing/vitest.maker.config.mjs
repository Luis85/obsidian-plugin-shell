import { defineConfig } from 'vitest/config';
import { loadThresholds } from '../../tooling/quality/thresholds.mjs';
export default defineConfig({ test: {
  // Each file runs in its own worker with its own scratch roots; 4 workers matches hosted CI runners and was
  // measured at 15 min against 47-57 min serial on Windows, with identical results and an unchanged checkout.
  include: ['src/{cli,shared,tui}/tests/interactive-maker-*.checks.mjs', 'tooling/tests/interactive-maker-*.checks.mjs', 'src/cli/tests/source-*.checks.mjs', 'src/cli/tests/maker-source-target.checks.mjs'], environment: 'node', fileParallelism: true, maxWorkers: 4,
  testTimeout: 60000, hookTimeout: 60000,
  coverage: { provider: 'v8', include: ['src/cli/**/*.ts', 'src/tui/**/*.ts', 'src/shared/companion/starters/*.ts', 'src/shared/contracts/sketch-errors.ts', 'src/shared/contracts/json-data.ts', 'src/shared/contracts/serialization.ts', 'src/shared/contracts/result.ts', 'src/shared/contracts/errors.ts', 'src/shared/contracts/result-runtime.mjs', 'src/shared/platform/process.ts', 'src/shared/platform/file-plan.ts', 'src/shared/platform/file-plan-runtime.ts', 'src/shared/platform/bounded-map.ts', 'src/shared/platform/confirmation.ts', 'src/shared/platform/input.ts', 'src/shared/platform/hash.ts', 'src/shared/platform/fs-presence.ts', 'src/shared/platform/project-path.ts', 'src/shared/platform/protected-directories.ts'],
    // The CLI project also holds its own SDK, bundled tooling modules and tests; the measured set stays the maker source.
    exclude: ['src/cli/sdk/**', 'src/cli/tooling/**', 'src/cli/tests/**', 'src/tui/tests/**'],
    thresholds: { ...loadThresholds().coverage.maker },
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/maker-coverage' },
} });
