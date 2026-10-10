// Increment: [[docs/increments/e2e-source-paths]]
// AC-2: Every generated-project path that the stylesheet, Airship, concept browser and Journey Lens qualification reads is a file the generator plans for the companion starter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(join(root, path), 'utf8');
const all = (source, pattern) => [...source.matchAll(pattern)].map(match => match[1]);

test('[AC-2] the qualification reads only paths the generator plans', { timeout: 180_000 }, async t => {
  const work = await mkdtemp(join(tmpdir(), 'e2e-source-paths-'));
  t.after(() => rm(work, { recursive: true, force: true }));
  const starter = JSON.parse(await text('configs/starters/companion-plugin.json')).generator.document;
  await writeFile(join(work, 'project.companion.json'), JSON.stringify(starter));
  const run = spawnSync(process.execPath, ['src/cli/app.ts', 'new', join(work, 'project'), '--from', join(work, 'project.companion.json'), '--json'],
    { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '' } });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const plan = JSON.parse(run.stdout);
  assert.equal(plan.status, 'planned');
  assert.deepEqual(await readdir(work), ['project.companion.json'], 'planning writes no project files');
  const planned = new Set(plan.data.changes.map(change => change.path.replace(/^project\//, '')));
  const isPlanned = path => planned.has(path) || [...planned].some(file => file.startsWith(path.replace(/\/$/, '') + '/'));

  const reads = {
    'stylesheet qualification': all(await text('tooling/companion-tools/qualify-styles.mjs'), /join\(target,'([^']+)'\)/g),
    'Airship preview': all(await text('tooling/airship/qualify.mjs'), /location\.filePath\.startsWith\('([^']+)'\)/g),
    'concept generator fixture': [
      ...all(await text('src/companion/tests/concepts/companion-generator-fixtures.browser.py'), /\(target \/ '([^']+)'\)\.(?:is_file|read_text)\(\)/g),
      ...all(await text('src/companion/tests/concepts/companion-generator-fixtures.browser.py'), /command\(\['([^']+)'/g),
    ],
    'Journey Lens job': all(await text('.github/workflows/companion-concept-verification.yml'), /test -f "\$target\/([^"]+)"/g),
  };
  for (const [check, paths] of Object.entries(reads)) {
    assert.ok(paths.length > 0, `${check} reads generated paths`);
    for (const path of paths) assert.ok(isPlanned(path), `${check} reads ${path}, which the generator does not plan`);
  }
});
