import { runNode } from '../shared/process.mjs';
import { readdirSync } from 'node:fs';
const toolingTests = readdirSync('tests/tooling').filter(name => /\.(checks|test)\.mjs$/.test(name)).sort().map(name => `tests/tooling/${name}`);
const commands = [
  ['scripts/security/check-dependencies.mjs'],
  // The qualified build creates Nuxt's generated type inputs before type-aware
  // lint probes inspect a fresh checkout. Verification never invents those types.
  ['scripts/bundling/build.mjs'],
  // Tooling suites launch real compilers/installers; serialize them to avoid
  // oversubscribed cold-start processes and cross-suite source-probe races.
  ['--test', '--test-concurrency=1', ...toolingTests],
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'],
  ['scripts/quality/lint-source.mjs'],
  ['node_modules/eslint/bin/eslint.js', 'src', '--max-warnings', '0'],
  ['node_modules/eslint/bin/eslint.js', 'tests/runtime', 'tests/e2e', 'harness/app', '--max-warnings', '0'],
  ['scripts/quality/check-test-quality.mjs'],
  ['scripts/quality/check-repository.mjs'],
  ['scripts/quality/check-source.mjs'],
  ['scripts/quality/check-presentation.mjs'],
  ['scripts/quality/check-architecture.mjs'],
  ['scripts/quality/check-analyzer.mjs'],
  ['scripts/makers/entities.mjs', '--check'],
  ['scripts/events/catalog.mjs', '--check'],
  ['node_modules/vitest/vitest.mjs', 'run', '--coverage'],
  ['node_modules/vitest/vitest.mjs', 'run', '--coverage', '--config', 'vitest.production.config.mjs'],
  ['scripts/quality/coverage-inventory.mjs'],
  ['scripts/styles/check-tokens.mjs'],
  ['scripts/quality/check-artifacts.mjs'],
  ['scripts/testing/verify-baseline.mjs', '--repeat', '3'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.harness.config.mjs'],
];
try { for (const [path, ...args] of commands) { console.log(`\n▶ ${path} ${args.join(' ')}`); await runNode(path, args); } console.log('Static/service/production-coverage/artifact/analyzer/baseline verification passed. Run test:e2e for served-browser evidence and test:mutation for targeted guard qualification. Native/device/release qualification is NOT implied.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
