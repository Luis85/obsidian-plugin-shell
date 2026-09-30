import { defineConfig } from 'vitest/config';
import core from './vitest.config.mjs';
import { loadThresholds } from '../../scripts/quality/thresholds.mjs';
export default defineConfig({ ...core, test: { ...core.test,
  coverage: { provider: 'v8', thresholds: { ...loadThresholds().coverage.production }, include: ['src/**/*.ts', 'src/**/*.vue'], exclude: [],
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/production-coverage' },
} });
