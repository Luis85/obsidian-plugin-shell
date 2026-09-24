import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { nativeScratch } from '../../scripts/testing/native-isolation.mjs';
import { createNativeForeignNotice, foreignNoticeCommands } from '../../scripts/testing/native-foreign-notice.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'native-foreign-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scratch = await nativeScratch(root);
  const plugin = await createNativeForeignNotice(scratch, 'candidate-plugin', root);
  return { root, scratch, plugin };
}
test('foreign owner is a separately hashed contained plugin and rejects target identity collision before writing', async t => {
  const { root, scratch, plugin } = await fixture(t);
  assert.deepEqual((await readdir(plugin.directory)).sort(), ['main.js', 'manifest.json']);
  for (const asset of plugin.assets) {
    const bytes = await readFile(join(plugin.directory, asset.file));
    assert.equal(asset.bytes, bytes.length); assert.equal(asset.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const manifest = JSON.parse(await readFile(join(plugin.directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.id, 'qualification-foreign-notice'); assert.equal(manifest.id, plugin.id);
  const before = await readdir(scratch);
  await assert.rejects(createNativeForeignNotice(scratch, plugin.id, root), /NATIVE_FOREIGN_ID_COLLISION/);
  assert.deepEqual(await readdir(scratch), before);
});
test('actual fixture module uses public Obsidian imports, creates only on command, survives other owners and cleans only its own notice', async t => {
  const { plugin } = await fixture(t); const notices = [];
  class Plugin { commands = []; addCommand(command) { this.commands.push(command); } }
  class Notice {
    hides = 0;
    constructor(text, duration) { this.text = text; this.duration = duration; notices.push(this); }
    setMessage(text) { this.text = text; }
    hide() { this.hides++; }
  }
  const foreign = new Notice('Other independent plugin', 0); const module = { exports: {} };
  runInNewContext(await readFile(join(plugin.directory, 'main.js'), 'utf8'), {
    exports: module.exports, require(name) { assert.equal(name, 'obsidian'); return { Plugin, Notice }; },
  });
  const witness = new module.exports.default(); witness.onload();
  assert.equal(notices.length, 1, 'loading or cold restarting must not display a notice');
  assert.deepEqual(witness.commands.map(command => command.name), Object.values(foreignNoticeCommands));
  const command = id => witness.commands.find(entry => entry.id === id).callback;
  command('create')(); command('create')(); assert.equal(notices.length, 2); assert.equal(notices[1].duration, 0);
  command('update')(); assert.equal(notices[1].text, 'Independent qualification owner remains usable');
  assert.equal(foreign.text, 'Other independent plugin'); assert.equal(foreign.hides, 0);
  command('dismiss')(); assert.equal(notices[1].hides, 1);
  command('create')(); assert.equal(notices.length, 3);
  const retained = command('create'); witness.onunload(); witness.onunload(); retained(); command('update')();
  assert.equal(notices.length, 3); assert.equal(notices[2].hides, 1); assert.equal(foreign.hides, 0);
  const restarted = new module.exports.default(); restarted.onload(); assert.equal(notices.length, 3);
});
