import { mkdtemp, mkdir, cp, writeFile, rm, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function evidenceFixture(t, body = 'test("actual child assertion", () => assert.equal(2 + 2, 4));') {
  const root = await mkdtemp(join(tmpdir(), 'evidence-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['src', 'harness', 'tests/tooling', 'docs/design', 'docs/testing', '.github/workflows']) await mkdir(join(root, directory), { recursive: true });
  await cp(resolve('scripts'), join(root, 'scripts'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', 'eslint.config.mjs', '.fallowrc.json', '.oxlintrc.json', 'vite.config.mjs', 'vite.harness.config.mjs', 'vitest.config.mjs', 'vitest.production.config.mjs', 'playwright.config.ts', 'docs/design/obsidian-tokens.json', 'docs/testing/test-plan.json', 'docs/testing/acceptance-crosswalk.json', 'docs/testing/native-evidence-checks.json']) await cp(resolve(file), join(root, file));
  await writeFile(join(root, 'src/input.ts'), 'export const input = 1;\n');
  await writeFile(join(root, 'tests/tooling/probe.checks.mjs'), `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${body}\n`);
  return root;
}
export function evidenceCli(root, ...args) {
  // Reporter-only fixtures never launch Chromium; this exact executable is only
  // a hashable stand-in for testing identity validation, never native/UI evidence.
  const env = { ...process.env, NODE_OPTIONS: '', SHELL_CHROMIUM: process.execPath }; delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [join(root, 'scripts/testing/evidence-cli.mjs'), ...args], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
}
export async function producedPacket(root) {
  const run = evidenceCli(root, 'run', 'tooling');
  const output = JSON.parse(run.stdout);
  const packet = JSON.parse(await readFile(output.path, 'utf8'));
  return { run, output, packet, path: output.path, session: dirname(dirname(output.path)) };
}
export async function runtimeEvidenceFixture(t, body) {
  const root = await evidenceFixture(t);
  await mkdir(join(root, 'tests/runtime'));
  await symlink(resolve('node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(root, 'vitest.config.mjs'), 'export default { test: { include: ["tests/runtime/*.test.ts"], environment: "node", fileParallelism: false } };');
  await writeFile(join(root, 'tests/runtime/probe.test.ts'), `import { test, expect } from 'vitest';\n${body}`);
  return root;
}
export async function browserEvidenceFixture(t, body) {
  const root = await evidenceFixture(t);
  await mkdir(join(root, 'tests/e2e')); await mkdir(join(root, 'dist'));
  await symlink(resolve('node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const file of ['main.js', 'styles.css', 'manifest.json']) await writeFile(join(root, 'dist', file), 'fixture bytes, not a qualified plugin');
  await writeFile(join(root, 'playwright.config.ts'), 'export default { testDir: "./tests/e2e", workers: 1, retries: 0 };');
  await writeFile(join(root, 'tests/e2e/probe.spec.ts'), `import { test, expect } from '@playwright/test';\n${body}`);
  return root;
}
