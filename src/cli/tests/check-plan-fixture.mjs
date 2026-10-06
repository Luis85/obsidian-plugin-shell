/** A real git repository with a miniature suite manifest, the shipped gate rules and sample workflows. */
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const suite = (name, include, extra = {}) => ({ name, purpose: name, include, verify: 'tooling', runner: { type: 'node-test' }, ...extra });
const manifest = {
  schemaVersion: 1, roots: [{ path: 'tests/tooling' }, { path: 'tests/e2e', optional: true }, { path: 'tests/runtime', optional: true }],
  prerequisites: { chromium: { probe: ['{node}', '-e', '0'], hint: 'Provision Chromium.' }, python3: { probe: ['{node}', '-e', '0'], hint: 'Install Python.' }, 'native-runner': { probe: ['{node}', '-e', '0'], hint: 'Provision the native runner.' } },
  suites: [
    // As in tests/suites.json: verify runs the maker files once, in its own coverage step, never in the tooling step.
    suite('maker', ['tests/tooling/interactive-maker-*.checks.mjs'], { workflows: ['interactive-maker'], runner: { type: 'vitest', config: 'configs/testing/vitest.maker.config.mjs' }, verify: 'own-step', verifyStepId: 'maker-coverage-run' }),
    suite('runtime', ['tests/runtime/**/*.test.ts'], { runner: { type: 'vitest', config: 'configs/testing/vitest.config.mjs' }, verify: 'own-step', optional: true }),
    suite('generator', ['tests/tooling/project-generator*.checks.mjs'], { workflows: ['ci', 'starter-flow'], level: 'integration', levels: { unit: ['tests/tooling/project-generator-http.checks.mjs'] } }),
    suite('quality', ['tests/tooling/gates.checks.mjs'], { workflows: ['ci'] }),
    suite('native', ['tests/tooling/native-*.checks.mjs'], { prerequisites: ['native-runner'] }),
    suite('memory', ['tests/tooling/memory-*.checks.mjs'], { prerequisites: ['python3'] }),
    suite('e2e', ['tests/e2e/*.spec.ts'], { level: 'e2e', verify: 'opt-in', runner: { type: 'playwright' }, prerequisites: ['chromium'], workflows: ['ci', 'starter-flow'] }),
  ],
};
const workflows = {
  'ci.yml': 'name: CI\non:\n  pull_request:\n  push:\n    branches: [main]\njobs: {}\n',
  'interactive-maker.yml': 'name: Interactive maker\non:\n  pull_request:\njobs: {}\n',
  'starter-flow.yml': 'name: Starter flow\non:\n  pull_request:\n    paths: &inputs\n      - templates/**\n      - "!templates/docs/**"\n      - scripts/starters/**\n  push:\n    paths: *inputs\njobs: {}\n',
};
const durations = '| Suite | Purpose | Command | Runner | Prerequisites | In `verify` | Measured |\n| --- | --- | --- | --- | --- | --- | --- |\n| `generator` | g | `npm run test:generator` | `node --test` | none | tooling | 187 s |\n| `maker` | m | `npm run test:maker` | Vitest `configs/testing/vitest.maker.config.mjs` | none | own step | not measured |\n';
const baseline = { 'src/a.ts': 'export const a = 1;\n', 'README.md': 'readme\n', 'src/cli/app.ts': 'export {};\n', 'configs/types/tsconfig.maker.json': '{}\n', 'docs/testing/TEST-SUITES.md': durations,
  'package.json': JSON.stringify({ scripts: { verify: 'node verify.mjs' } }), 'tests/suites.json': JSON.stringify(manifest) };

export function git(cwd, ...args) {
  const out = spawnSync('git', ['-c', 'user.email=check@example.invalid', '-c', 'user.name=Check', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git ${args.join(' ')}: ${out.stderr}`);
  return out.stdout.trim();
}
export async function write(dir, files) {
  for (const [path, content] of Object.entries(files)) { await mkdir(dirname(join(dir, path)), { recursive: true }); await writeFile(join(dir, path), content); }
}
/** Runs `body(dir)` in a fresh repository with the baseline committed on `main`; `overrides` replace or add baseline files. */
export async function withRepo(overrides, body) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'check-plan-')));
  try {
    const rules = await readFile(join(repoRoot, 'configs/quality/gate-rules.json'), 'utf8');
    await write(dir, { ...baseline, 'configs/quality/gate-rules.json': rules, ...Object.fromEntries(Object.entries(workflows).map(([name, text]) => [`.github/workflows/${name}`, text])), ...overrides });
    git(dir, 'init', '-q', '-b', 'main'); git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'baseline');
    return await body(dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
