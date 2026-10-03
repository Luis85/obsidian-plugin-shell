import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Real-Obsidian E2E only. Deliberately independent of vitest.config.mjs: no `obsidian`
// module boundary, no mocks, no coverage. Run through `npm run test:obsidian`.
export default defineConfig({
  test: {
    name: 'real-obsidian', environment: 'node', globals: false,
    include: ['tests/obsidian/**/*.obsidian.ts'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false, isolate: true,
    sequence: { concurrent: false }, retry: 0,
    testTimeout: 120_000, hookTimeout: 180_000, teardownTimeout: 60_000,
    expect: { poll: { timeout: 15_000, interval: 100 } },
    reporters: ['default', 'json', 'junit'],
    outputFile: { json: resolve('reports/obsidian/vitest-results.json'), junit: resolve('reports/obsidian/junit.xml') },
    coverage: { enabled: false },
    passWithNoTests: false,
  },
});
