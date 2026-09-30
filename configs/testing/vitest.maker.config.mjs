import { defineConfig } from 'vitest/config';
import { loadThresholds } from '../../scripts/quality/thresholds.mjs';
export default defineConfig({ test: {
  include: ['tests/tooling/interactive-maker-*.checks.mjs'], environment: 'node', fileParallelism: false,
  testTimeout: 60000, hookTimeout: 60000,
  coverage: { provider: 'v8', include: ['bin/**/*.ts'], exclude: [],
    thresholds: { ...loadThresholds().coverage.maker },
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/maker-coverage' },
} });
