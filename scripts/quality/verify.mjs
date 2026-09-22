import { runNode } from '../shared/process.mjs';
const commands = [
  ['--test', 'tests/tooling/npm-install.checks.mjs', 'tests/tooling/build.checks.mjs', 'tests/tooling/security.checks.mjs', 'tests/tooling/gates.checks.mjs', 'tests/tooling/coverage.checks.mjs'],
  ['scripts/security/check-dependencies.mjs'],
  ['scripts/bundling/build.mjs'],
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit'],
  ['node_modules/oxlint/bin/oxlint', 'src', '--deny-warnings'],
  ['node_modules/eslint/bin/eslint.js', 'src', '--max-warnings', '0'],
  ['scripts/quality/check-source.mjs'],
  ['scripts/quality/check-architecture.mjs'],
  ['scripts/quality/check-analyzer.mjs'],
  ['node_modules/vitest/vitest.mjs', 'run'],
  ['scripts/styles/check-tokens.mjs'],
  ['scripts/quality/check-artifacts.mjs'],
  ['scripts/testing/verify-baseline.mjs', '--repeat', '3'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.harness.config.mjs'],
];
try { for (const [path, ...args] of commands) { console.log(`\n▶ ${path} ${args.join(' ')}`); await runNode(path, args); } console.log('Iteration-02 static/service/artifact/analyzer/baseline verification passed. Run test:e2e for served-browser evidence. Native/device/release qualification is NOT implied.'); }
catch (error) { console.error(error.message); process.exitCode = 1; }
