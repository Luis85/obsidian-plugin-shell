// Increment: [[docs/increments/release-kit-downloads]]
// AC-3: The kit root README is the short kit guide: it names the packed version and no `X.Y.Z`, both downloads, the framework boundaries and the two agent prompts (start a new plugin; migrate an existing plugin keeping its manifest id), carries none of the framework repository's README, and every relative link resolves inside the extracted kit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractArchive } from '../../../src/cli/tests/support/framework-archive-fixture.mjs';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const exists = path => access(path).then(() => true, () => false);
const framework = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')).id === 'plugin-shell'
  && !await exists(join(root, 'shell.config.json')) && !await exists(join(root, '.companion/generation.json'));
/** One fenced block's text after the given heading. */
const fencedAfter = (markdown, heading) => {
  const at = markdown.indexOf(heading); assert.ok(at >= 0, heading);
  return /```text\n([\s\S]*?)\n```/.exec(markdown.slice(at))[1];
};

test('[AC-3] the extracted kit README is the short kit guide with both agent prompts and working links', { skip: !framework && 'only the framework checkout packs kits' }, async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'kit-readme-'))); t.after(() => rm(folder, { recursive: true, force: true }));
  const kit = join(folder, 'kit');
  const packed = spawnSync(process.execPath, [join(root, 'bin/app'), 'framework', 'pack', '--with-starters', '--out', kit + '.zip', '--yes', '--json'],
    { cwd: root, encoding: 'utf8', timeout: 300_000, maxBuffer: 50_000_000 });
  assert.equal(packed.status, 0, packed.stdout + packed.stderr);
  await mkdir(kit); await extractArchive(await readFile(kit + '.zip'), kit);
  const readme = await readFile(join(kit, 'README.md'), 'utf8');

  assert.ok(readme.startsWith(`# Workbench ${version}: Obsidian plugin shell kit\n`));
  assert.doesNotMatch(readme, /X\.Y\.Z/);
  assert.ok(Buffer.byteLength(readme) < 16_000, `a short guide, not the repository README (${Buffer.byteLength(readme)} bytes)`);
  for (const retired of ['Retained framework reference', 'Framework developer kit', 'maintainer asset', 'workbench-starters-']) assert.ok(!readme.includes(retired), retired);
  for (const download of [`workbench-shell-${version}.zip`, `workbench-shell-with-starters-${version}.zip`, 'workbench-SHA256SUMS']) assert.ok(readme.includes(download), download);
  const boundaries = readme.slice(readme.indexOf('## Stay inside the framework'), readme.indexOf('## Prompts for an AI coding agent'));
  for (const rule of ['src/plugin/features/api.ts', 'services.modals', 'PluginDataStore', '`main.ts`', 'npm run check', 'npm run make -- --list']) assert.ok(boundaries.includes(rule), rule);

  const start = fencedAfter(readme, '### 1. Install Workbench and start a new plugin');
  for (const step of [`releases/tag/${version}`, `workbench-shell-with-starters-${version}.zip`, 'sha256sum --check --ignore-missing workbench-SHA256SUMS', 'node bin/app new --list', '`--yes`', 'npm run check', 'AGENTS.md'])
    assert.ok(start.includes(step), step);
  const migrate = fencedAfter(readme, '### 2. Migrate an existing plugin into a clean shell');
  for (const step of ['read-only', 'adopt analyze --target <old plugin folder>', '--id <old id>', 'data.json', 'loadData/saveData', 'services.modals', 'npm run examples:remove', 'personal vault'])
    assert.ok(migrate.includes(step), step);

  const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map(match => match[1]).filter(target => !/^(?:[a-z]+:|#)/i.test(target));
  assert.ok(links.length >= 7);
  for (const link of links) {
    assert.ok(link.startsWith('bin/template/docs/'), link);
    assert.ok(await exists(join(kit, posix.normalize(link.split('#')[0]))), link);
  }
});
