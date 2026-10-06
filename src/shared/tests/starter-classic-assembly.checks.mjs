/** The shared PRD contract must remain executable in the retained classic-script host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PRD_LIMITS } from '../companion/prd-limits.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function classicPrograms(html) {
  return [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(match => !/^<script[^>]*type="application\/json"/.test(match[0]))
    .map(match => match[1]);
}
test('reassembled classic artifact embeds the canonical PRD limits and has no unresolved imports', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'starter-classic-'));
  try {
    const output = join(scratch, 'index.html');
    const run = spawnSync(process.env.PYTHON || 'python3', ['scripts/concepts/build-companion.py', '--output', output], {
      cwd: root, encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const html = await readFile(output, 'utf8');
    assert.equal(html, await readFile(join(root, 'docs/concepts/companion/index.html'), 'utf8'));
    const programs = classicPrograms(html);
    assert.ok(programs.length >= 4);
    for (const program of programs) assert.doesNotThrow(() => new Script(program));
    const program = programs.find(value => value.includes('function validateCompanionDocument('));
    assert.ok(program);
    assert.equal((program.match(/const PRD_LIMITS\s*=/g) || []).length, 1);
    const shared = await readFile(join(root, 'scripts/companion/prd-limits.mjs'), 'utf8');
    assert.ok(program.includes(shared.trim().replace('export const ', 'const ')));
    assert.ok(Object.values(PRD_LIMITS).every(value => Number.isInteger(value) && value > 0));
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
test('classic-script compilation rejects an accidentally retained module import', () => {
  assert.throws(() => new Script("import { PRD_LIMITS } from './prd-limits.mjs';"), SyntaxError);
});
