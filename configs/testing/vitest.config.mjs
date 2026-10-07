import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { sharedConfig } from '../../tooling/bundling/vite-shared.mjs';
import { loadThresholds } from '../../tooling/quality/thresholds.mjs';
const shared = sharedConfig();
// The host publishes declarations only. This test-only virtual boundary requires
// an explicit per-suite mock and never resolves production imports into test files.
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\0obsidian-host-boundary'; },
  load(id) { if (id === '\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
// Opt-in in-memory host double: `vi.mock('obsidian', () => import('@test/obsidian'))`.
const testKit = { '@test/obsidian': fileURLToPath(new URL('../../src/plugin/tests/support/obsidian/index.ts', import.meta.url)) };
export default defineConfig({ ...shared, resolve: { ...shared.resolve, alias: { ...shared.resolve?.alias, ...testKit } }, plugins: [...shared.plugins, hostBoundary], test: {
  include: ['src/plugin/tests/unit/**/*.test.ts', 'tooling/tests/tooling.test.ts'], environment: 'node',
  fileParallelism: false, testTimeout: 5000, hookTimeout: 5000,
  coverage: { provider: 'v8', thresholds: { ...loadThresholds().coverage.selectedCore }, include: ['src/plugin/domain/**/*.ts', 'src/plugin/application/**/*.ts', 'src/plugin/features/**/*.ts', 'src/plugin/infrastructure/events/*.ts', 'src/plugin/infrastructure/diagnostics.ts', 'src/plugin/infrastructure/markdown.ts'], reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/runtime-coverage' },
} });
