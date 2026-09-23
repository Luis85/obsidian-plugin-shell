import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { lintOwnedSource } from '../../scripts/quality/lint-source.mjs';

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
    await assert.rejects(lintOwnedSource(root, tool), /Command failed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
