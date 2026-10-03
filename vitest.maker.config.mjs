import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/tooling/interactive-maker-*.checks.mjs'], environment: 'node', fileParallelism: false,
  testTimeout: 60000, hookTimeout: 60000,
  coverage: { provider: 'v8', include: ['bin/**/*.ts', 'scripts/contracts/json-data.ts', 'scripts/contracts/result.ts', 'scripts/contracts/errors.ts', 'scripts/contracts/result-runtime.mjs', 'scripts/shared/process.ts', 'scripts/shared/file-plan.ts', 'scripts/shared/file-plan-runtime.ts', 'scripts/shared/bounded-map.ts', 'scripts/shared/confirmation.ts', 'scripts/shared/input.ts', 'scripts/shared/hash.ts', 'scripts/shared/fs-presence.ts', 'scripts/shared/project-path.ts'], exclude: [],
    thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/maker-coverage' },
} });
