import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
// TypeScript forces pretty (ANSI) diagnostics for any non-empty FORCE_COLOR, including the evidence
// runner's FORCE_COLOR=0, so request plain output to keep the asserted text independent of the runner.
const build = project => spawnSync(process.execPath, ['node_modules/vue-tsc/bin/vue-tsc.js', '-b', project, '--pretty', 'false'],
  { cwd: root, encoding: 'utf8', timeout: 900_000, maxBuffer: 512 * 1024 * 1024 });

test('[TYPES-01] importing a source project that is not referenced fails the TypeScript build with TS6307', () => {
  const run = build('tests/fixtures/types/boundary-violation');
  const output = run.stdout + run.stderr;
  assert.equal(run.error, undefined, String(run.error));
  assert.notEqual(run.status, 0, output);
  // A failing project never writes declarations next to the sources it could not own (noEmitOnError).
  assert.equal(existsSync(resolve(root, 'src/cli/app.d.ts')), false);
  assert.match(output, /error TS6307: File '[^']*src\/cli\/app\.ts' is not listed within the file list of project '[^']*boundary-violation\/tsconfig\.json'/);
});
