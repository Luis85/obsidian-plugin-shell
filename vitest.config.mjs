import { defineConfig } from 'vitest/config';
import { sharedConfig } from './scripts/bundling/vite-shared.mjs';
const shared = sharedConfig();
// The host publishes declarations only. This test-only virtual boundary requires
// an explicit per-suite mock and never resolves production imports into test files.
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\0obsidian-host-boundary'; },
  load(id) { if (id === '\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
export default defineConfig({ ...shared, plugins: [...shared.plugins, hostBoundary], test: {
  include: ['tests/runtime/**/*.test.ts'], environment: 'node',
  fileParallelism: false, testTimeout: 5000, hookTimeout: 5000,
  coverage: { provider: 'v8', thresholds: { lines: 95, statements: 90, functions: 90, branches: 90 }, include: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/features/**/*.ts', 'src/infrastructure/events/*.ts', 'src/infrastructure/diagnostics.ts', 'src/infrastructure/markdown.ts'], reporter: ['text', 'json-summary', 'html'], reportsDirectory: 'reports/runtime-coverage' },
} });
