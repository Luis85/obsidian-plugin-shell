import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Real-Obsidian E2E only. Deliberately independent of vitest.config.mjs: no `obsidian`
// module boundary, no mocks, no coverage. Run through `npm run test:obsidian`.
// The runner provides the real-host harness (repository tooling) as `@test/obsidian-host`,
// so the plugin project's tests never import tooling/ themselves (project boundary rule).
const obsidianHost = fileURLToPath(new URL('../../tooling/testing/obsidian-harness.mjs', import.meta.url));
export default defineConfig({
  resolve: { alias: { '@test/obsidian-host': obsidianHost } },
  test: {
    name: 'real-obsidian', environment: 'node', globals: false,
    include: ['src/plugin/tests/obsidian/**/*.obsidian.ts'],
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
