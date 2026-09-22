import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import core from './vitest.config.mjs';
export default mergeConfig(core, defineConfig({ plugins: [vue()], test: {
  coverage: { thresholds: { lines: 0, statements: 0, functions: 0, branches: 0 }, include: ['src/**/*.ts', 'src/**/*.vue'], exclude: [],
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/production-coverage' },
} }));
