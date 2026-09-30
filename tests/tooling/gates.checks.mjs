import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, cp, rm, symlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { sourceInputs } from '../../scripts/testing/source-inputs.mjs';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

test('[ANALYZER-ARCHIVE] exact generated assets do not hide maintained or unapproved archived source', async () => {
  await archiveCommandFixture(async ({ scratch, command: execute }) => {
    const staging = join(scratch, 'staging'); const extracted = join(scratch, 'extracted');
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: scratch, FALLOW_TELEMETRY_DISABLED: '1' };
    const command = (file, args, cwd) => execute(file, args, cwd, env);
    await mkdir(staging); await mkdir(extracted);
    const source = await sourceInputs(process.cwd());
    for (const input of source.files) {
      const target = join(staging, input.path); await mkdir(dirname(target), { recursive: true });
      await cp(resolve(input.path), target);
    }
    // These execution policies are fingerprinted separately from sourceInputs;
    // the transport fixture still needs their real bytes for explicit consumers.
    const policies = await Promise.all(['docs/testing/native-evidence-checks.json', 'docs/testing/acceptance-crosswalk.json']
      .map(async path => ({ path, bytes: await readFile(resolve(path)) })));
    for (const policy of policies) {
      const target = join(staging, policy.path); await mkdir(dirname(target), { recursive: true });
      await writeFile(target, policy.bytes);
    }
    // A local index/tree forms a real transport archive even when this test's
    // parent is already a Git-free archive. No commit, author or remote is needed.
    // Repository-local autocrlf=false keeps both add and archive byte-exact even
    // when a Windows host enables autocrlf globally for LF-pinned checkouts.
    for (const args of [['init', '--quiet'], ['config', 'core.autocrlf', 'false'], ['add', '--all']]) {
      const run = command('git', args, staging); assert.equal(run.status, 0, run.stderr);
    }
    const tree = command('git', ['write-tree'], staging); assert.equal(tree.status, 0, tree.stderr);
    const archive = join(scratch, 'source.tar');
    const packed = command('git', ['archive', '--format=tar', `--output=${archive}`, tree.stdout.trim()], staging);
    assert.equal(packed.status, 0, packed.stderr);
    const unpacked = command('tar', ['-xf', archive, '-C', extracted], scratch); assert.equal(unpacked.status, 0, unpacked.stderr);
    assert.equal(command('git', ['rev-parse', '--show-toplevel'], extracted).status, 128);
    assert.deepEqual((await sourceInputs(extracted)).files, source.files);
    for (const policy of policies) assert.deepEqual(await readFile(join(extracted, policy.path)), policy.bytes);
    await cp(resolve('dist'), join(extracted, 'dist'), { recursive: true });
    await symlink(resolve('node_modules'), join(extracted, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const check = () => command(process.execPath, ['scripts/quality/check-analyzer.mjs'], extracted);
    const valid = check(); assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const diagnostic = async () => JSON.parse(await readFile(join(extracted, 'reports/analyzer/fallow.json'), 'utf8'));
    assert.deepEqual((await diagnostic()).workspace_diagnostics ?? [], []);
    // The browser verifier is an exact test entry, not a whole-directory exemption.
    const pluginPath = join(extracted, 'scripts/quality/fallow-node-tests.json');
    const pluginBytes = await readFile(pluginPath, 'utf8');
    const plugin = JSON.parse(pluginBytes), verifier = 'scripts/compiler/verify-preview-host.mjs';
    assert.equal(plugin.entryPointRole, 'test');
    assert.ok(plugin.entryPoints.includes(verifier));
    plugin.entryPoints = plugin.entryPoints.filter(path => path !== verifier);
    await writeFile(pluginPath, JSON.stringify(plugin));
    assert.notEqual(check().status, 0);
    assert.ok((await diagnostic()).unused_files.some(row => row.path === verifier));
    await writeFile(pluginPath, pluginBytes);
    const nearby = join(extracted, 'scripts/compiler/unreachable-preview-probe.mjs');
    await writeFile(nearby, 'export const unexpectedPreviewProbe = 1;\n');
    assert.notEqual(check().status, 0);
    assert.ok((await diagnostic()).unused_files.some(row => row.path === 'scripts/compiler/unreachable-preview-probe.mjs'));
    await rm(nearby);
    const maintained = join(extracted, 'src/unreachable-archive-probe.ts');
    await writeFile(maintained, 'export const unreachableArchiveProbe = 1;\n');
    assert.notEqual(check().status, 0);
    assert.ok((await diagnostic()).summary.unused_files > 0);
    await rm(maintained);
    const hidden = join(extracted, 'dist/unapproved-source.ts');
    await writeFile(hidden, 'export const hiddenMaintainedSource = 1;\n');
    assert.notEqual(check().status, 0);
    assert.ok((await diagnostic()).workspace_diagnostics.some(row => row.kind === 'excluded-by-default-ignore' && row.path === 'dist'));
    await rm(hidden);
    const restored = check(); assert.equal(restored.status, 0, restored.stdout + restored.stderr);
  });
});
test('[GATE-02-01] full analyzer fails for real unused files and exports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shell-analysis-'));
  try {
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify({ entry: ['entry.ts'], rules: { 'policy-violation': 'off' } }));
    await writeFile(join(root, 'package.json'), '{"name":"analyzer-probe","type":"module"}');
    await writeFile(join(root, 'entry.ts'), 'import { used } from "./module"; console.log(used);');
    await writeFile(join(root, 'module.ts'), 'export const used = 1; export const unused = 2;');
    await writeFile(join(root, 'dead.ts'), 'export const unreachable = 1;');
    const run = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code'], { cwd: root, encoding: 'utf8', timeout: 15000 });
    const report = JSON.parse(run.stdout); assert.equal(run.status, 1);
    assert.ok(report.summary.unused_files > 0); assert.ok(report.summary.unused_exports > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('[GATE-02-03] the repository analyzer ignores the docs working directory but not other unused code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shell-analysis-docs-'));
  try {
    const { ignorePatterns } = JSON.parse(await readFile('configs/quality/fallow.json', 'utf8'));
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify({ entry: ['entry.ts'], ignorePatterns, rules: { 'policy-violation': 'off' } }));
    await writeFile(join(root, 'package.json'), '{"name":"analyzer-docs-probe","type":"module"}');
    await writeFile(join(root, 'entry.ts'), 'console.log(1);');
    await mkdir(join(root, 'docs/concepts/draft'), { recursive: true });
    await writeFile(join(root, 'docs/concepts/draft/prototype.ts'), 'import missing from "unlisted-package"; export const draft = missing;');
    const analyze = () => { const run = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code'], { cwd: root, encoding: 'utf8', timeout: 15000 }); return { status: run.status, report: JSON.parse(run.stdout) }; };
    const clean = analyze(); assert.equal(clean.status, 0, JSON.stringify(clean.report.summary)); assert.equal(clean.report.summary.total_issues, 0);
    await writeFile(join(root, 'dead.ts'), 'export const unreachable = 1;');
    const dead = analyze(); assert.equal(dead.status, 1); assert.ok(dead.report.summary.unused_files > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('[GATE-02-02] ESLint 10 executes the real TypeScript, Obsidian and Vue rules/parsers', async () => {
  const root = await mkdtemp(resolve('src/infrastructure/ui/lint-probe-'));
  try {
    const ts = join(root, 'probe.ts'); const vue = join(root, 'LintProbe.vue');
    await writeFile(ts, "export function probe() { Promise.resolve(1); return '.obsidian/config'; }\n");
    await writeFile(vue, '<script setup lang="ts">const items: number[] = [1, 2];</script><template><div v-for="item in items">{{ item }}</div></template>');
    // Keep the real root ESLint configuration and project-service parser, while
    // limiting this negative fixture's TypeScript program to its two inputs.
    // Full production lint/type checks still run separately over the real app.
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: true, types: [] },
      include: ['probe.ts', 'LintProbe.vue'],
    }));
    // Measured Windows cold runs: 81.7s whole-project vs 59.1s isolated; config
    // loading alone took 50–51s in both. Isolation reduced parsing 24.9s -> 2.1s.
    // The finite 180s startup allowance is not a lint/performance threshold or retry.
    const started = performance.now();
    const run = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '-c', 'configs/lint/eslint.config.mjs', ts, vue, '--format', 'json'], { encoding: 'utf8', timeout: 180000, windowsHide: true });
    assert.equal(run.error, undefined, `ESLint probe process failed after ${Math.round(performance.now() - started)}ms: ${run.error?.code ?? run.signal ?? 'unknown'}; ${run.stderr}`);
    assert.equal(run.status, 1, run.stderr);
    const reports = JSON.parse(run.stdout); const rules = reports.flatMap(file => file.messages.map(message => message.ruleId));
    assert.ok(rules.includes('@typescript-eslint/no-floating-promises'), run.stdout);
    assert.ok(rules.includes('obsidianmd/hardcoded-config-path'), run.stdout);
    assert.ok(rules.includes('vue/require-v-for-key'), run.stdout);
    assert.ok(!reports.some(file => file.fatalErrorCount), 'Parsers must run, not fail before checking rules');
  } finally { await rm(root, { recursive: true, force: true }); }
});

// These cases execute the real orchestration with explicit command doubles.
// The archive case above separately executes the real analyzer and its controls.
async function verificationTrace(t, mode, failAt = 0) {
  const root = await mkdtemp(join(tmpdir(), 'verify-preflight-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['quality', 'shared', 'testing']) await mkdir(join(root, 'scripts', directory), { recursive: true });
  await cp(new URL('../../scripts/quality/verify.mjs', import.meta.url), join(root, 'scripts/quality/verify.mjs'));
  await writeFile(join(root, 'scripts/shared/process.mjs'), `let analyzers = 0;
export async function runNodeScript(path, args = []) {
  console.log(JSON.stringify({ executed: path, args }));
  if (path === 'scripts/quality/check-analyzer.mjs' && ++analyzers === Number(process.env.FAIL_ANALYZER_AT))
    throw new Error('fixture analyzer failed');
}
`);
  await writeFile(join(root, 'scripts/testing/suite-manifest.mjs'), `export async function toolingGroups() {
    return [{ name: 'fixture', files: ['tests/tooling/fixture.checks.mjs'] }];
  }`);
  const run = spawnSync(process.execPath, ['scripts/quality/verify.mjs'], { cwd: root, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SHELL_EVIDENCE_TOOLING: mode, FAIL_ANALYZER_AT: String(failAt) } });
  assert.equal(run.error, undefined);
  const trace = run.stdout.split('\n').filter(line => line.startsWith('{"executed":')).map(line => JSON.parse(line));
  return { ...run, trace };
}
for (const mode of ['0', '1']) {
  test(`[VERIFY-PREFLIGHT] analyzer runs after build and again after tooling in evidence mode ${mode}`, async t => {
    const run = await verificationTrace(t, mode), paths = run.trace.map(item => item.executed);
    assert.equal(run.status, 0, run.stderr);
    const first = paths.indexOf('scripts/quality/check-analyzer.mjs'), last = paths.lastIndexOf('scripts/quality/check-analyzer.mjs');
    assert.equal(first, paths.indexOf('scripts/bundling/build.mjs') + 1);
    const tooling = paths.indexOf(mode === '1' ? 'scripts/testing/evidence-cli.mjs' : '--test');
    assert.ok(first < tooling && tooling < last);
    assert.equal(paths.filter(path => path === 'scripts/quality/check-analyzer.mjs').length, 2);
    assert.ok(last < paths.indexOf('scripts/quality/check-maintainability.mjs'));
    assert.ok(paths.includes('node_modules/vitest/vitest.mjs'));
  });
}
test('[VERIFY-PREFLIGHT] early and late analyzer failures both retain nonzero outcomes without starting later stages', async t => {
  for (const failAt of [1, 2]) {
    const run = await verificationTrace(t, '0', failAt), paths = run.trace.map(item => item.executed);
    assert.equal(run.status, 1); assert.match(run.stderr, /fixture analyzer failed/);
    assert.equal(paths.at(-1), 'scripts/quality/check-analyzer.mjs');
    assert.equal(paths.filter(path => path === 'scripts/quality/check-analyzer.mjs').length, failAt);
    assert.equal(paths.includes('--test'), failAt === 2);
    assert.ok(!paths.includes('scripts/quality/check-maintainability.mjs'));
    assert.doesNotMatch(run.stdout, /verification passed/);
  }
});
