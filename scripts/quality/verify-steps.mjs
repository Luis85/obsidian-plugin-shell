/**
 * The explicit `npm run verify` step table. Order is execution order. `needs` lists only genuine
 * data dependencies (a build artifact or a report a later step reads); steps without a dependency
 * stay independent so `--keep-going` can still run them after an unrelated failure.
 */
const script = (id, entry, args = [], needs = []) => ({ id, entry, args, needs });
const vueTsc = 'node_modules/vue-tsc/bin/vue-tsc.js', eslint = 'node_modules/eslint/bin/eslint.js', vitest = 'node_modules/vitest/vitest.mjs';

/** tests/suites.json owns tooling classification; one step runs every tooling suite group. */
function toolingStep(env) {
  // Tooling suites launch real compilers/installers; they run one after another to avoid
  // oversubscribed cold-start processes and cross-suite source-probe races. Within a suite,
  // files run serially unless tests/suites.json opts it into a measured runner.concurrency.
  if (env.SHELL_EVIDENCE_TOOLING === '1') return script('tooling', 'scripts/testing/evidence-cli.mjs', ['run', 'tooling'], ['suites-check']);
  return { id: 'tooling', kind: 'tooling-suites', display: 'node --test --test-concurrency=<suite runner.concurrency, default 1> <tooling suites from tests/suites.json>', entry: '--test', args: [], needs: ['suites-check'] };
}

export function verifySteps(env = process.env) {
  return [
    // Fail closed before any suite runs: every test file belongs to exactly one suite.
    script('suites-check', 'scripts/testing/suites.mjs', ['--check']),
    script('dependency-policy', 'scripts/security/check-dependencies.mjs'),
    script('cli-build', 'scripts/bundling/build-cli.mjs'),
    // The qualified build creates Nuxt's generated type inputs before type-aware
    // lint probes inspect a fresh checkout. Verification never invents those types.
    script('build', 'scripts/bundling/build.mjs'),
    // Catch integration inventory defects before expensive compiler/install suites.
    // The later analyzer pass is retained to catch drift left by those suites.
    script('analyzer', 'scripts/quality/check-analyzer.mjs', [], ['build']),
    toolingStep(env),
    script('workbench-suite', 'scripts/testing/suites.mjs', ['workbench-plugins'], ['suites-check']),
    script('workbench-check', 'scripts/quality/check-workbench-plugins.mjs'),
    script('typecheck', vueTsc, ['--noEmit'], ['build']),
    script('lint-source', 'scripts/quality/lint-source.mjs'),
    script('eslint-source', eslint, ['-c', 'configs/lint/eslint.config.mjs', 'src', 'plugins', '--max-warnings', '0'], ['build']),
    script('maker-types', 'node_modules/typescript/bin/tsc', ['--noEmit', '--project', 'configs/types/tsconfig.maker.json']),
    script('maker-coverage-run', vitest, ['run', '--coverage', '--config', 'configs/testing/vitest.maker.config.mjs']),
    script('maker-coverage-gate', 'scripts/quality/maker-coverage.mjs', [], ['maker-coverage-run']),
    script('eslint-tests', eslint, ['-c', 'configs/lint/eslint.config.mjs', 'tests/runtime', 'tests/support', 'tests/e2e', 'tests/obsidian', 'harness/app', '--max-warnings', '0'], ['build']),
    script('test-quality', 'scripts/quality/check-test-quality.mjs'),
    script('repository', 'scripts/quality/check-repository.mjs'),
    script('projects', 'scripts/projects/projects.mjs', ['check']),
    script('source', 'scripts/quality/check-source.mjs'),
    script('presentation', 'scripts/quality/check-presentation.mjs'),
    script('architecture', 'scripts/quality/check-architecture.mjs'),
    script('analyzer-after-tooling', 'scripts/quality/check-analyzer.mjs', [], ['build']),
    script('maintainability', 'scripts/quality/check-maintainability.mjs'),
    script('entities', 'scripts/makers/entities.mjs', ['--check']),
    script('events', 'scripts/events/catalog.mjs', ['--check']),
    // One run gates both scopes: production coverage and, from the same per-file
    // counts, the selected-core thresholds and include list in configs/testing/vitest.config.mjs.
    script('production-coverage-run', vitest, ['run', '--coverage', '--config', 'configs/testing/vitest.production.config.mjs']),
    script('selected-core-coverage', 'scripts/quality/coverage-inventory.mjs', ['--selected-core'], ['production-coverage-run']),
    script('style-tokens', 'scripts/styles/check-tokens.mjs'),
    script('style-literals', 'scripts/styles/check-style-literals.mjs'),
    script('artifacts', 'scripts/quality/check-artifacts.mjs', [], ['build']),
    script('baseline', 'scripts/testing/verify-baseline.mjs', ['--repeat', '3']),
    script('harness-build', 'node_modules/vite/bin/vite.js', ['build', '--config', 'configs/bundling/vite.harness.config.mjs']),
  ].map(step => ({ ...step, display: step.display ?? [step.entry, ...step.args].join(' ') }));
}
