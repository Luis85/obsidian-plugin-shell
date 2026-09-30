/** Fresh installs, exact consumer checks, real bundles and failure-preservation evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256 } from '../shared/hash.mjs';
import { spawnSync } from 'node:child_process';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { assertCssOwnership } from '../bundling/css-identity.mjs';
import { verifyPresetBrowser } from './verify-preset-browser.mjs';
const root = resolve(import.meta.dirname, '../..'), npm = process.env.QUALIFIED_NPM;
assert.equal(process.version, 'v24.21.0', 'Qualification requires the pinned Node version.');
assert.ok(npm, 'Set QUALIFIED_NPM to the explicit npm 11.19.1 entrypoint.');
assert.equal(spawnSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).stdout.trim(), '11.19.1');
const fixtures = JSON.parse(await readFile(new URL('./presets/qualification.json', import.meta.url), 'utf8'));
const selected = fixtures.filter(item => !process.argv[2] || item.frontend === process.argv[2]);
assert.ok(selected.length > 0, 'Choose a registered frontend qualification group.');
const catalog = JSON.parse(await readFile(new URL('../../bin/guides/legacy-project-presets.json', import.meta.url), 'utf8'));
const guide = JSON.parse(await readFile(new URL('../../bin/guides/legacy-project-prototype.json', import.meta.url), 'utf8'));
const results = [];
const childEnv = { ...process.env }; delete childEnv.NODE_TEST_CONTEXT; delete childEnv.VITEST;
const reports = join(root, 'reports/project-presets'); await mkdir(reports, { recursive: true });
function command(cwd, args, log, failure = false) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 32 * 1024 * 1024,
    env: childEnv });
  log.push(`\n$ node ${args.join(' ')}\n${result.stdout ?? ''}${result.stderr ?? ''}\nexit=${result.status}\n`);
  assert.ifError(result.error);
  if (failure) assert.notEqual(result.status, 0, 'The deliberately invalid build must fail.');
  else assert.equal(result.status, 0, 'Command failed; inspect the retained case log.');
  return result;
}
async function treeDigest(path) {
  const hashes = [];
  for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    assert.ok(!item.isSymbolicLink());
    hashes.push([item.name, item.isDirectory() ? await treeDigest(join(path, item.name)) : sha256(await readFile(join(path, item.name)))]);
  }
  return sha256(JSON.stringify(hashes));
}
async function verifyArtifacts(source, selection, log) {
  if (selection.targets.includes('cli')) {
    const run = command(source, ['dist/cli/main.mjs', 'show', 'issues', '--json'], log);
    assert.equal(run.stdout.trim().split('\n').length, 1); assert.equal(JSON.parse(run.stdout).data.surface.label, 'Issues');
    const bad = command(source, ['dist/cli/main.mjs', 'unknown', '--json'], log, true);
    assert.equal(bad.status, 1); assert.equal(JSON.parse(bad.stdout).status, 'failed'); assert.equal(bad.stderr, '');
  }
  if (selection.targets.includes('plugin')) {
    const manifest = JSON.parse(await readFile(join(source, 'dist/plugin/manifest.json'), 'utf8'));
    assert.equal(manifest.id, selection.id);
    const css = await readFile(join(source, 'dist/plugin/styles.css'), 'utf8');
    assertCssOwnership(postcss.parse(css), selection.id, selectorParser);
    assert.ok(!css.includes('--background-primary:#ffffff'), 'Do not bundle browser host-token overrides into Obsidian.');
  }
  return verifyPresetBrowser(source, selection);
}
async function verifyFailure(source, selection, log) {
  // Static websites do not import the runtime core; corrupt an actual build input.
  const websiteOnly = selection.targets.length === 1 && selection.targets[0] === 'website';
  const input = websiteOnly ? 'src/targets/website/index.html' : 'src/core/project.ts';
  const invalid = websiteOnly ? '\n<script type="module" src="./missing-qualification-entry.ts"></script>\n' : '\nthis is deliberately invalid syntax [\n';
  const before = await treeDigest(join(source, 'dist')), path = join(source, input), original = await readFile(path, 'utf8');
  try {
    await writeFile(path, original + invalid);
    command(source, [npm, 'run', 'build'], log, true);
    assert.equal(await treeDigest(join(source, 'dist')), before, 'A failed build must preserve the entire last-good output.');
  } finally { await writeFile(path, original); }
  assert.ok(!(await readdir(source)).includes('.project-build-lock'), 'Release only the owned build lock.');
  return before;
}
for (const fixture of selected) {
  const scratch = await mkdtemp(join(tmpdir(), 'preset-qualification-')), log = [], result = { id: fixture.id, status: 'failed', native: 'not-run' };
  try {
    const selection = { preset: fixture.preset, frontend: fixture.frontend, ...(fixture.targets ? { targets: fixture.targets } : {}) };
    const request = { schemaVersion: 1, catalogVersion: catalog.version, ...selection,
      prototypeRequest: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
        answers: { title: 'Issue desk', pages: ['Overview', 'Issues'], components: ['Card'], approved: true } } };
    await writeFile(join(scratch, 'project-create.json'), JSON.stringify(request));
    const create = [join(root, 'bin/app'), 'new', '--input', 'project-create.json', '--out', 'prepared', '--root', scratch];
    const preview = JSON.parse(command(scratch, [...create, '--json'], log).stdout);
    assert.equal(preview.status, 'planned'); assert.match(preview.data.planHash, /^[a-f0-9]{64}$/);
    const applied = JSON.parse(command(scratch, [...create, '--apply', preview.data.planHash, '--json'], log).stdout);
    assert.ok(['applied', 'unchanged'].includes(applied.status), JSON.stringify(applied));
    const source = join(scratch, 'prepared/source');
    command(source, [npm, 'install', '--ignore-scripts', '--no-fund', '--no-audit'], log);
    await cp(join(source, 'package-lock.json'), join(reports, fixture.id + '-package-lock.json'));
    command(source, [npm, 'ci', '--ignore-scripts', '--no-fund', '--no-audit'], log);
    for (const script of ['typecheck', 'test', 'build']) command(source, [npm, 'run', script], log);
    const descriptor = JSON.parse(await readFile(join(source, 'shell.project.json'), 'utf8'));
    result.browser = await verifyArtifacts(source, descriptor, log);
    result.outputSha256 = await verifyFailure(source, descriptor, log);
    result.status = 'passed';
  } catch (error) { result.error = error instanceof Error ? error.message : String(error); }
  finally {
    await writeFile(join(reports, fixture.id + '.log'), log.join(''));
    await rm(scratch, { recursive: true, force: true });
  }
  results.push(result); console.log(JSON.stringify(result));
  await writeFile(join(reports, 'qualification.json'), JSON.stringify({ node: process.version, npm: '11.19.1', results }, null, 2) + '\n');
}
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
