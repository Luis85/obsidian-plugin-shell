import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleKit, installedCompiler, kitScripts } from '../adapters/framework/kit.ts';
import { kitRootReadme } from '../adapters/framework/distribution.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { zip } from '../adapters/framework/zip.ts';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const exists = path => stat(path).then(() => true, () => false);
/** Relative Markdown link targets outside fenced code, the way a renderer resolves them. */
function relativeLinks(markdown) {
  const targets = []; let fence = null;
  for (const line of markdown.split('\n')) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) { fence = fence ? (marker[0] === fence[0] && marker.length >= fence.length ? null : fence) : marker; continue; }
    if (fence) continue;
    for (const match of line.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)\)/g)) if (!/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(match[1])) targets.push(match[1]);
  }
  return targets;
}
function cli(dir, args) {
  return spawnSync(process.execPath, [join(dir, 'bin/app'), ...args], { cwd: dir, encoding: 'utf8', timeout: 120000, maxBuffer: 8_000_000 });
}

test('kit root README rebases only relative links onto the shipped bin/template copy', () => {
  const source = '[CLI](docs/development/FRAMEWORK-CLI.md#top) [web](https://example.com) [here](#anchor)\n```sh\n[kept](docs/x.md)\n```\n';
  assert.equal(kitRootReadme(Buffer.from(source)).toString('utf8'),
    '[CLI](bin/template/docs/development/FRAMEWORK-CLI.md#top) [web](https://example.com) [here](#anchor)\n```sh\n[kept](docs/x.md)\n```\n');
});

test('a freshly extracted kit resolves every README link and every package script before generation', { timeout: 300000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Kit packing requires the reviewed framework sources, not an example-removed consumer.'); return; }
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'kit-bootstrap-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await extractArchive(zip(await assembleKit({ root, frameworkRoot: root }, await installedCompiler())), dir);

  const readme = await readFile(join(dir, 'README.md'), 'utf8');
  const links = relativeLinks(readme);
  assert.ok(links.length > 20, `expected the retained reference links, found ${links.length}`);
  const broken = [];
  for (const link of links) {
    const target = posix.normalize(decodeURIComponent(link.split(/[?#]/, 1)[0]));
    if (!await exists(join(dir, target))) broken.push(link);
  }
  assert.deepEqual(broken, []);
  assert.ok(links.every(link => link.startsWith('bin/template/')), 'every relative link points at the shipped documents');

  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  assert.deepEqual(pkg.scripts, { ...kitScripts });
  for (const [name, script] of Object.entries(pkg.scripts)) {
    const [command, entry, ...rest] = script.split(' ');
    assert.equal(command, 'node', name); assert.ok(await exists(join(dir, entry)), `${name}: ${entry}`);
    if (name === 'help') {
      const run = cli(dir, [...rest, '--json']);
      assert.equal(run.status, 0, run.stderr); assert.equal(JSON.parse(run.stdout).status, 'ok');
    }
  }
  const template = JSON.parse(await readFile(join(dir, 'bin/template/package.json'), 'utf8'));
  assert.equal(template.scripts.make, 'node bin/app make'); assert.ok(template.scripts['entities:check'], 'the generated project keeps its full scripts');

  // An upgrade source must be an extracted folder; a ZIP gets an explicit extraction step.
  await writeFile(join(dir, 'next-kit.zip'), 'not extracted');
  const archive = JSON.parse(cli(dir, ['framework', 'upgrade', '--from', 'next-kit.zip', '--dry-run', '--json']).stdout);
  assert.equal(archive.diagnostics[0].code, 'KIT_ARCHIVE_NOT_EXTRACTED');
  assert.match(archive.diagnostics[0].next, /Extract the kit ZIP into a new empty folder.*framework upgrade --from <extracted-folder>/);
});

test('framework status outside a kit names how to get one', async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'kit-missing-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = spawnSync(process.execPath, [join(root, 'bin/app'), 'framework', 'status', '--root', dir, '--json'], { cwd: dir, encoding: 'utf8', timeout: 60000 });
  const result = JSON.parse(run.stdout);
  assert.equal(run.status, 1); assert.equal(result.diagnostics[0].code, 'KIT_REQUIRED');
  assert.match(result.diagnostics[0].next, /framework pack --out .* --yes/);
});
