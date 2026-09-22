import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/runtime/**/*.test.ts'], environment: 'node',
  fileParallelism: false, testTimeout: 5000, hookTimeout: 5000,
  coverage: { provider: 'v8', include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/infrastructure/events/*.ts', 'src/infrastructure/diagnostics.ts', 'src/infrastructure/markdown.ts'], reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/runtime-coverage' },
} });
