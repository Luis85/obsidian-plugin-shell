/** Exercise the real source API and writer. Compiled-kit execution is qualified separately by framework-kit.checks.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { assembleKit } from '../../scripts/framework/kit.ts';
import { zip } from '../../scripts/framework/zip.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
import { executeOperation } from '../../scripts/framework/operations.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
test('reviewed in-place opt-ins update both receipts together and the first ordinary replay writes nothing', { timeout: 120000 }, async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'storybook-in-place-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  // This compiler double only builds a checksum-valid fixture inventory. No compiled output is executed.
  // Real TypeScript 6 transpilation and dependency-free CLI execution remain in framework-kit.checks.mjs.
  const files = await assembleKit({ root, frameworkRoot: root }, {
    version: 'test-double-not-a-compiler', compile: () => '// Inert fixture: never executed.\n',
  });
  await extractArchive(zip(files), dir);
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
