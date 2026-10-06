import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { lintOwnedSource } from '../quality/lint-source.mjs';

/** Negative fixtures must fail without emitting GitHub annotations: oxlint selects its github reporter from GITHUB_ACTIONS. */
async function rejectsWithoutAnnotations(pending) {
  const saved = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  try {
    await assert.rejects(pending(), error => error.name === 'NodeProcessFailure' && error.kind === 'exit' && error.exitCode === 1);
  } finally { if (saved !== undefined) process.env.GITHUB_ACTIONS = saved; }
}

test('explicit source inventory runs real Oxlint inside ignored archive parents and rejects defects/empty inputs', async () => {
  const parent = resolve('.qualification'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'lint-archive-'));
  try {
    await mkdir(join(root, 'src'));
    const tool = resolve('node_modules/oxlint/bin/oxlint');
    await assert.rejects(lintOwnedSource(root, tool), /LINT_SOURCE_EMPTY/);
    const path = join(root, 'src/probe.ts');
    await writeFile(path, 'export const value = 1;\n');
    assert.equal((await lintOwnedSource(root, tool)).files, 1);
    await writeFile(path, 'export function invalid(value: boolean) { if (value) return 1; else if (value) return 2; return 0; }\n');
    await rejectsWithoutAnnotations(() => lintOwnedSource(root, tool));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('explicit changed-file arguments narrow Oxlint to those owned inputs and still fail on a defect', async () => {
  const parent = resolve('.qualification'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'lint-only-'));
  try {
    await mkdir(join(root, 'src'));
    const tool = resolve('node_modules/oxlint/bin/oxlint');
    await writeFile(join(root, 'src/good.ts'), 'export const value = 1;\n');
    await writeFile(join(root, 'src/bad.ts'), 'export function invalid(value: boolean) { if (value) return 1; else if (value) return 2; return 0; }\n');
    assert.equal((await lintOwnedSource(root, tool, ['src/good.ts'])).files, 1, 'the defective file is not linted when it is not requested');
    await rejectsWithoutAnnotations(() => lintOwnedSource(root, tool, ['src/bad.ts']));
    assert.deepEqual(await lintOwnedSource(root, tool, ['docs/other.ts']), { status: 'passed', files: 0, scope: 'none of the requested files is an owned src/plugins/templates/companion/runtime input' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the bundled framework distribution under a kit bin/ is not linted as project source', async () => {
  const parent = resolve('.qualification'); await mkdir(parent, { recursive: true });
  const root = await mkdtemp(join(parent, 'lint-kit-'));
  try {
    await mkdir(join(root, 'src')); await mkdir(join(root, 'bin'));
    const tool = resolve('node_modules/oxlint/bin/oxlint');
    await writeFile(join(root, 'src/probe.ts'), 'export const value = 1;\n');
    await writeFile(join(root, 'bin/app.js'), 'export function bundled(value) { if (value) return 1; else if (value) return 2; return 0; }\n');
    assert.equal((await lintOwnedSource(root, tool)).files, 1, 'bin is compiled output');
    await mkdir(join(root, 'src/cli'));
    await writeFile(join(root, 'src/cli/probe.ts'), 'export function bad(value: boolean) { if (value) return 1; else if (value) return 2; return 0; }\n');
    await rejectsWithoutAnnotations(() => lintOwnedSource(root, tool));
  } finally { await rm(root, { recursive: true, force: true }); }
});
