import { defineConfig, mergeConfig } from 'vitest/config';
import core from './vitest.config.mjs';
import { sharedConfig } from './scripts/bundling/vite-shared.mjs';
export default mergeConfig(mergeConfig(sharedConfig(), core), defineConfig({ test: {
  coverage: { thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 }, include: ['src/**/*.ts', 'src/**/*.vue'], exclude: [],
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/production-coverage' },
} }));
