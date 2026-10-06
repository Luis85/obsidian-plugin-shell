import { defineConfig } from 'vitest/config';
import { loadThresholds } from '../../tooling/quality/thresholds.mjs';
export default defineConfig({ test: {
  // Each file runs in its own worker with its own scratch roots; 4 workers matches hosted CI runners and was
  // measured at 15 min against 47-57 min serial on Windows, with identical results and an unchanged checkout.
  include: ['tests/tooling/interactive-maker-*.checks.mjs'], environment: 'node', fileParallelism: true, maxWorkers: 4,
  testTimeout: 60000, hookTimeout: 60000,
  coverage: { provider: 'v8', include: ['src/cli/**/*.ts', 'src/shared/contracts/json-data.ts', 'src/shared/contracts/serialization.ts', 'src/shared/contracts/result.ts', 'src/shared/contracts/errors.ts', 'src/shared/contracts/result-runtime.mjs', 'src/shared/platform/process.ts', 'src/shared/platform/file-plan.ts', 'src/shared/platform/file-plan-runtime.ts', 'src/shared/platform/bounded-map.ts', 'src/shared/platform/confirmation.ts', 'src/shared/platform/input.ts', 'src/shared/platform/hash.ts', 'src/shared/platform/fs-presence.ts', 'src/shared/platform/project-path.ts', 'src/shared/platform/protected-directories.ts'], exclude: [],
    thresholds: { ...loadThresholds().coverage.maker },
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/maker-coverage' },
} });
