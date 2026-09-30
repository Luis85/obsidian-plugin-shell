/** Exercise the real source API and writer. Compiled-kit execution is qualified separately by framework-kit.checks.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
/** Source-only fixture, not a compiled distribution. Works with showcase and example-removed templates. */
async function sourceFixture(directory) {
  const snapshot = await loadTemplateSnapshot(root);
  const files = [...snapshot.frameworkFiles, ...snapshot.skillFiles].map(file => ({
    path: '.framework/template/' + file.path, bytes: Buffer.from(file.content, file.encoding ?? 'utf8'),
  }));
  // verifyKit checks both directories. This inert marker supplies no compiled executable.
  files.push({ path: '.framework/compiled/package.json', bytes: Buffer.from('{"private":true}\n') });
  for (const file of files) {
    await mkdir(dirname(join(directory, file.path)), { recursive: true });
    await writeFile(join(directory, file.path), file.bytes, { flag: 'wx' });
  }
  const bootstrap = [];
  for (const path of ['app.mjs', 'bin/app', 'shell.mjs', 'package.json', 'README.md', 'LICENSE']) {
    const bytes = Buffer.from(snapshot.text(path));
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), bytes, { flag: 'wx' });
    bootstrap.push({ path, hash: digest(bytes) });
  }
  await writeFile(join(directory, '.framework/kit.json'), JSON.stringify({
    schemaVersion: 1, version: JSON.parse(snapshot.text('package.json')).version,
    compilerVersion: 'source-fixture-no-compilation', sourceHash: snapshot.fingerprint, bootstrap,
    files: files.map(file => ({ path: file.path, hash: digest(file.bytes), bytes: file.bytes.length })),
  }));
}
test('reviewed in-place opt-ins update both receipts together and the first ordinary replay writes nothing', { timeout: 120000 }, async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'storybook-in-place-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // Test the receipt/writer on the current source profile without repackaging reviewed example preimages.
  // Real TypeScript 6 transpilation and dependency-free CLI execution remain in framework-kit.checks.mjs.
  await sourceFixture(dir);
  const context = { root: dir, frameworkRoot: root };
  const run = (command, options = {}) => executeOperation({ command, args: [], options }, context);
  const read = path => readFile(join(dir, path), 'utf8');
  const input = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8'));
  input.project.author = 'Example';
  await writeFile(join(dir, 'input.json'), JSON.stringify(input));
  const setup = await run('setup', { input: 'input.json', yes: true });
  assert.equal(setup.status, 'applied', JSON.stringify(setup));
  const initial = await run('generate', { yes: true });
  assert.equal(initial.status, 'applied', JSON.stringify(initial));
  const lock = await read('package-lock.json');
  for (const [enabled, stories] of [['on', 'on']]) {
    const options = { storybook: enabled, 'storybook-stories': stories };
    const before = await read('design/project.json');
    const preview = await run('generate', options);
    assert.equal(preview.status, 'planned', JSON.stringify(preview));
    assert.equal(await read('design/project.json'), before, 'preview must not write the option changes');
    const applied = await run('generate', { ...options, apply: preview.data.planHash });
    assert.equal(applied.status, 'applied', JSON.stringify(applied));
    const design = await read('design/project.json');
    assert.deepEqual(JSON.parse(design).tooling.storybook, { enabled: enabled === 'on', generateStories: stories === 'on' });
    const generation = JSON.parse(await read('.companion/generation.json'));
    const intake = JSON.parse(await read('.framework/intake.json'));
    assert.equal(generation.inputHash, digest(design), 'generation receipt must describe the accepted post-override design');
    assert.equal(intake.files['design/project.json'], digest(design));
    const replay = await run('generate', { yes: true });
    assert.equal(replay.status, 'unchanged', JSON.stringify(replay.data.applied));
    assert.deepEqual(replay.data.applied.written, []);
    assert.equal((await run('status')).data.designStale, false);
    assert.equal(await read('package-lock.json'), lock);
  }
});
