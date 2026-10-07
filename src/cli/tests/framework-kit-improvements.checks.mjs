import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleKit, installedCompiler } from '../adapters/framework/kit.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { zip } from '../adapters/framework/zip.ts';
import { assembleStarterPack } from '../adapters/starters/operations.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
function cli(dir, args, expected = 0) {
  const result = spawnSync(process.execPath, [join(dir, 'bin/app'), ...args, '--json'], {
    cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 8_000_000,
  });
  assert.equal(result.error, undefined); assert.equal(result.status, expected, result.stderr + result.stdout);
  assert.ok(!result.stderr.includes('ExperimentalWarning'));
  return JSON.parse(result.stdout);
}
test('extracted kit discovers v6 schema, sets up a starter, resumes generation and safely regenerates a page selection', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Reviewed examples are removed; clean-source kit qualification runs separately.'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'kit-improvements-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const files = await assembleKit({ root, frameworkRoot: root }, await installedCompiler());
  await extractArchive(zip(files), dir);
  const args = ['setup', '--starter', 'quick-capture', '--id', 'folio', '--name', 'Folio', '--author', 'Example'];
  const bare = await readdir(dir);
  // The shell ZIP bundles no starters; the separate pack is extracted into the same package root as the kit README instructs.
  assert.equal(cli(dir, args, 1).diagnostics[0].code, 'STARTER_UNKNOWN'); assert.deepEqual(await readdir(dir), bare);
  await extractArchive(zip(await assembleStarterPack({ root, frameworkRoot: root })), dir);
  const initial = await readdir(dir);
  assert.equal(cli(dir, ['project', 'schema']).data.$id, 'urn:obsidian-plugin-shell:companion-project:6');
  assert.deepEqual(await readdir(dir), initial);
  const preview = cli(dir, args); assert.equal(preview.status, 'planned');
  assert.deepEqual(await readdir(dir), initial);
  assert.equal(cli(dir, [...args, '--apply', preview.data.planHash]).status, 'applied');
  const validated = cli(dir, ['project', 'validate', '--input', 'design/project.json']);
  assert.equal(validated.data.schemaVersion, 6); assert.deepEqual(validated.data.written, []);
  const generation = cli(dir, ['generate']); assert.equal(generation.status, 'planned');
  const before = cli(dir, ['setup', 'status']); assert.equal(before.data.generated, false);
  const generated = cli(dir, ['setup', 'resume', '--stage', 'generate', '--resume-hash', before.data.resumeHash, '--apply', generation.data.planHash, '--yes']);
  assert.equal(generated.status, 'applied');
  assert.equal(cli(dir, ['setup', 'status']).data.generated, true);
  assert.ok(!(await readdir(dir)).includes('node_modules')); assert.ok(!(await readdir(dir)).includes('.git'));
  const draft = JSON.parse(await readFile(join(dir, 'design/project.json'), 'utf8'));
  const page = draft.design.visualDesigns.pages[0]; page.notes = 'Reviewed page-level improvement';
  await writeFile(join(dir, 'next.json'), JSON.stringify(draft));
  assert.equal(cli(dir, ['project', 'import', '--input', 'next.json', '--yes']).status, 'applied');
  const selected = cli(dir, ['generate', '--scope', 'page:' + page.id]);
  assert.equal(selected.status, 'planned'); assert.deepEqual(selected.data.conflicts, []);
  const selection = selected.data.summary.selection; assert.equal(selection.root, 'page:' + page.ownerId);
  assert.ok(selection.retainedPaths.length > 0);
  const protectedPath = selection.retainedPaths.find(path => path.endsWith('.vue'));
  assert.ok(protectedPath);
  const original = await readFile(join(dir, protectedPath), 'utf8');
  await writeFile(join(dir, protectedPath), original + '\n<!-- independent developer edit -->\n');
  const stale = cli(dir, ['generate', '--scope', 'page:' + page.id, '--apply', selected.data.planHash], 1);
  assert.match(JSON.stringify(stale.diagnostics), /stale|hash/i);
  const reviewed = cli(dir, ['generate', '--scope', 'page:' + page.id]);
  assert.deepEqual(reviewed.data.conflicts, []);
  assert.equal(cli(dir, ['generate', '--scope', 'page:' + page.id, '--apply', reviewed.data.planHash]).status, 'applied');
  assert.match(await readFile(join(dir, protectedPath), 'utf8'), /independent developer edit/);
  assert.equal(cli(dir, ['generate', '--scope', 'page:' + page.id, '--yes']).status, 'unchanged');
  const state = cli(dir, ['setup', 'status']);
  const installPreview = cli(dir, ['setup', 'resume', '--stage', 'install', '--resume-hash', state.data.resumeHash, '--dry-run']);
  assert.equal(installPreview.status, 'planned'); assert.equal(installPreview.data.execution, 'not-run');
  assert.ok(!(await readdir(dir)).includes('node_modules'));
});
