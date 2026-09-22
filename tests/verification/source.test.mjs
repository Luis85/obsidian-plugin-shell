import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceInputs, physicalLines, lineLimit } from '../../scripts/testing/source-inputs.mjs';
test('[SRC-01] physical source limits include comments and blanks', () => {
  assert.equal(physicalLines(''), 0); assert.equal(physicalLines('x\n'), 1);
  assert.equal(physicalLines('x\r\n\r\n'), 2);
  assert.equal(physicalLines('// comment\n\nvalue'), 3);
  assert.equal(lineLimit('src/main.ts'), 100);
  assert.equal(lineLimit('harness/style-fixture/fixture.js'), 400);
  assert.equal(lineLimit('tests/a.test.mjs'), 450);
});
test('[SRC-02] exact 400 and 450 thresholds pass while one excess fails', () => {
  for (const limit of [400, 450]) {
    assert.equal(physicalLines('line\r\n'.repeat(limit)), limit);
    assert.ok(physicalLines('line\n'.repeat(limit + 1)) > limit);
  }
  assert.equal(physicalLines('<template>\n</template>\n<script>\n</script>\n<style>\n</style>\n'), 6);
});
test('[SRC-03] hashing includes new and modified files but not clock or mtime', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shell-source-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'files')); await writeFile(join(dir, 'files/a.css'), 'a {}\n');
  const first = await sourceInputs(dir, ['files']);
  assert.equal((await sourceInputs(dir, ['files'])).digest, first.digest);
  await writeFile(join(dir, 'files/b.css'), 'b {}\n');
  const second = await sourceInputs(dir, ['files']); assert.notEqual(second.digest, first.digest);
  await writeFile(join(dir, 'files/a.css'), 'a { color: red; }\n');
  assert.notEqual((await sourceInputs(dir, ['files'])).digest, second.digest);
});
