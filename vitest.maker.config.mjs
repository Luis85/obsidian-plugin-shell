import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/tooling/interactive-maker-*.checks.mjs'], environment: 'node', fileParallelism: false,
  testTimeout: 60000, hookTimeout: 60000,
  coverage: { provider: 'v8', include: ['bin/**/*.ts'], exclude: [],
    thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/maker-coverage' },
} });
