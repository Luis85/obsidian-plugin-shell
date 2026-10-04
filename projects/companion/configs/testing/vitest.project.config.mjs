import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import { sharedConfig } from '../../scripts/bundling/vite-shared.mjs';
const shared = sharedConfig();
// Product tests. A bare `obsidian` import throws on purpose: each test file opts in to the
// in-memory host with `vi.mock('obsidian', () => import('@test/obsidian'))` (docs/framework/testing/OBSIDIAN-TEST-KIT.md).
const hostBoundary = { name: 'vitest-obsidian-boundary',
  resolveId(id) { if (id === 'obsidian') return '\0obsidian-host-boundary'; },
  load(id) { if (id === '\0obsidian-host-boundary') return 'throw new Error("OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE")'; },
};
const testKit = { '@test/obsidian': fileURLToPath(new URL('../../tests/support/obsidian/index.ts', import.meta.url)) };
// DOM tests (views, settings, Vue components) start with `// @vitest-environment happy-dom`.
// Reporters are left at Vitest's defaults so coding agents automatically get the concise `agent` reporter.
// `npm run make` writes the tests of the features it creates to tests/runtime/generated.
export default defineConfig({ ...shared, resolve: { ...shared.resolve, alias: { ...shared.resolve?.alias, ...testKit } }, plugins: [...shared.plugins, hostBoundary], test: {
  include: ["tests/project/**/*.test.{ts,mjs}", "tests/runtime/generated/**/*.test.ts"], environment: 'node', fileParallelism: false,
  // Playwright specs (npm run test:e2e) run in a browser, never in Vitest.
  exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  setupFiles: ["tests/project/ui-bootstrap.mjs"],
} });
