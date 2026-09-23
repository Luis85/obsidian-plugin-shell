import { defineConfig } from 'vitest/config';
import core from './vitest.config.mjs';
export default defineConfig({ ...core, test: { ...core.test,
  coverage: { provider: 'v8', thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 }, include: ['src/**/*.ts', 'src/**/*.vue'], exclude: [],
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/production-coverage' },
} });
