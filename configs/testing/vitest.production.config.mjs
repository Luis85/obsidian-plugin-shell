import { defineConfig } from 'vitest/config';
import core from './vitest.config.mjs';
import { loadThresholds } from '../../tooling/quality/thresholds.mjs';
export default defineConfig({ ...core, test: { ...core.test,
  coverage: { provider: 'v8', thresholds: { ...loadThresholds().coverage.production }, include: ['src/plugin/main.ts', 'src/{application,bootstrap,domain,features,infrastructure,presentation}/**/*.{ts,vue}'], exclude: [],
    reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/production-coverage' },
} });
