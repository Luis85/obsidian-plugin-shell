import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractKit } from './support/framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './support/example-sources-fixture.mjs';
import { starterDocumentText } from '#shared/testing/starter-documents.mjs';

// A real extracted developer kit: bundled bin/app.js, editable sources only under bin/template and no
// project-level src/cli/adapters. Generated custom-maker and locale checks must pass there without path probing.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const run = (dir, args) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', timeout: 180000, maxBuffer: 50_000_000, env: isolated() });
function isolated() { const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; return env; }
function cli(dir, args) {
  const output = run(dir, [join(dir, 'bin/app'), ...args, '--json']);
  assert.equal(output.status, 0, output.stderr + output.stdout);
  return JSON.parse(output.stdout);
}

test('generated custom-maker and locale checks run in an extracted kit through injection and the bundled CLI', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'maker-kit-'))); t.after(() => rm(dir, { recursive: true, force: true }));
  await extractKit(root, dir);
  assert.equal(existsSync(join(dir, 'src/cli/adapters')), false, 'an extracted kit keeps editable template sources inside bin');
  // Packaging only: the kit's template tree carries the recipe catalog; no consumer code reads that copy.
  assert.ok(existsSync(join(dir, 'bin/app.js')) && existsSync(join(dir, 'bin/template', 'src/cli/adapters/makers/recipes.json')));
  const design = JSON.parse(starterDocumentText('companion-plugin'));
  design.project = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '0.1.0', description: '' };
  await writeFile(join(dir, 'input.json'), JSON.stringify(design));
  cli(dir, ['setup', '--input', 'input.json', '--yes']);
  cli(dir, ['generate', '--yes']);
  assert.ok(existsSync(join(dir, 'src/cli/adapters')), 'generation materializes CLI development sources under src');
  // The makers parse TypeScript through the project's installed toolchain, as after `npm ci`.
  await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // Apply runs the planned checks for real in the kit layout, including the CLI-owned entity catalog.
  const made = cli(dir, ['make', 'maker', 'nudge', '--yes']);
  assert.deepEqual(made.data.summary.checks.map(check => [check.id, check.status]),
    [['typecheck', 'passed'], ['tooling-test:custom-nudge', 'passed'], ['events-check', 'passed'], ['entities-check', 'passed']]);
  const entities = run(dir, ['tooling/makers/entities.mjs', '--check']);
  assert.equal(entities.status, 0, entities.stderr); assert.equal(JSON.parse(entities.stdout).status, 'passed');
  const recipe = await readFile(join(dir, 'tooling/makers/custom/nudge.mjs'), 'utf8');
  assert.doesNotMatch(recipe, /\bimport\b|existsSync|src\/cli\/adapters|bin\/template/);
  assert.equal(cli(dir, ['make', 'nudge', 'review', '--feature', 'tasks', '--trust-custom', '--yes']).status, 'applied');
  assert.match(await readFile(join(dir, 'src/plugin/features/tasks/review.command.ts'), 'utf8'), /export function tasksReviewCommand/);
  assert.match(await readFile(join(dir, 'src/plugin/bootstrap/authoring.ts'), 'utf8'), /tasksReviewCommand/);
  cli(dir, ['make', 'locale', 'fr', '--yes']);
  assert.doesNotMatch(await readFile(join(dir, 'src/plugin/tests/tooling/locale-fr.checks.mjs'), 'utf8'), /src\/cli\/adapters|bin\/template|existsSync/);
  assert.deepEqual(cli(dir, ['make', 'locale', 'fr', '--check']).data, { locale: 'fr', missing: [], extra: [], selectable: false });
  const checks = run(dir, ['--test', '--test-reporter=tap', 'tooling/tests/custom-nudge.checks.mjs', 'src/plugin/tests/tooling/locale-fr.checks.mjs']);
  assert.equal(checks.status, 0, checks.stdout + checks.stderr);
  assert.match(checks.stdout, /# pass 2\b/);
});
