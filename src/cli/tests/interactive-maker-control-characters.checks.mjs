const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { portableFile } from '../adapters/framework/archive-path.ts';
import { identity } from '../adapters/framework/configuration.ts';
import { handoutPath } from '../adapters/framework/handout-workspace.ts';
import { obsidianRead } from '../adapters/framework/obsidian-cli.ts';
import { parseArguments } from '../adapters/makers/arguments.ts';
import { planMaker } from '../adapters/makers/plan.ts';
import { portable } from '../documentation/adapters/filesystem.ts';
import { text } from '../documentation/domain/contracts.ts';
import { makerFixture } from './maker-fixture.mjs';

// The CLI's single-line identity and path boundaries share hasControls(): C0 controls, DEL and the C1 range
// (U+0080-U+009F) are refused, while printable Unicode beyond them still passes.
const controls = { nul: '\u0000', unitSeparator: '\u001f', del: '\u007f', c1Start: '\u0080', nextLine: '\u0085', c1End: '\u009f' };
const tainted = clean => Object.entries(controls).map(([name, control]) => [name, clean.replace('|', control)]);
const project = { id: 'notes', name: 'Notes', author: 'Ada', version: '1.0.0', description: 'Keeps notes.' };
const request = (command, options) => ({ command, args: [], options });
const port = responses => ({ async run(args) { const key = args.join('|'); if (!(key in responses)) throw Error(`unexpected ${key}`); return responses[key]; } });

test('archive, handout and documentation paths refuse C0, DEL and C1 controls but keep Unicode names', () => {
  for (const [name, path] of tainted('notes/da|y.md')) {
    assert.equal(portableFile(path), false, name);
    assert.throws(() => handoutPath(path), { code: 'HANDOUT_PATH' }, name);
    assert.throws(() => portable(path), { code: 'DOCS_PATH' }, name);
  }
  for (const path of ['notes/day.md', 'Notizen/Über ½ – ÿ.md']) {
    assert.equal(portableFile(path), true, path);
    assert.equal(handoutPath(path), path);
    assert.equal(portable(path), path);
  }
});

test('project identity and managed documentation text refuse C0, DEL and C1 controls but keep Unicode text', () => {
  for (const [name, value] of tainted('No|tes')) {
    assert.throws(() => identity({ ...project, name: value }), { code: 'INVALID_IDENTITY' }, name);
    assert.throws(() => identity({ ...project, description: value }), { code: 'INVALID_IDENTITY' }, name);
    assert.throws(() => text(value, 'label'), { code: 'DOCS_FIELD' }, name);
  }
  assert.deepEqual(identity({ ...project, name: 'Nötes ½', author: 'Åda Ÿ' }), { ...project, name: 'Nötes ½', author: 'Åda Ÿ' });
  assert.equal(text('Überblick – ÿ', 'label'), 'Überblick – ÿ');
});

test('maker document folders refuse C0, DEL and C1 controls and other unportable segments but keep Unicode segments', () => makerFixture(async root => {
  const folders = [...tainted('Work/Boo|ks'), ['backslash', 'Work\\Books'], ['reserved', 'Work/LPT1.md'], ['hidden', 'Work/..']];
  for (const [name, folder] of folders)
    await assert.rejects(planMaker(root, parseArguments(['entity', 'x', '--feature', 'tasks', '--folder', folder])), { message: 'Unsafe document folder' }, name);
  const planned = await planMaker(root, parseArguments(['feature', 'bookmarks', '--entity', 'bookmark', '--folder', 'Arbeit/Lesezeichen ½']));
  assert.equal(planned.folder, 'Arbeit/Lesezeichen ½');
}));

test('Obsidian CLI vault selectors, note paths and reported vault paths refuse C0, DEL and C1 controls', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'shell-obsidian-controls-')));
  try {
    const context = { root, frameworkRoot: root };
    for (const [name, vault] of tainted('Wo|rk'))
      await assert.rejects(obsidianRead(request('obsidian status', { 'obsidian-vault': vault }), context, port({ version: '1.12.7' })), { code: 'OBSIDIAN_VAULT_REQUIRED' }, name);
    for (const [name, path] of tainted('notes/da|y.md'))
      await assert.rejects(obsidianRead(request('obsidian read', { 'obsidian-vault': 'Work', 'obsidian-path': path }), context, port({ version: '1.12.7' })), { code: 'OBSIDIAN_PATH_INVALID' }, name);
    const status = location => obsidianRead(request('obsidian status', { 'obsidian-vault': 'Wörk' }), context, port({
      version: '1.12.7', 'vault=Wörk|vault|info=name': 'Wörk\n', 'vault=Wörk|vault|info=path': `${location}\n`,
      'vault=Wörk|files|total': '0\n', 'vault=Wörk|folders|total': '0\n',
    }));
    for (const [name, location] of tainted(join(root, 'va|ult'))) await assert.rejects(status(location), { code: 'OBSIDIAN_OUTPUT_INVALID' }, name);
    assert.equal((await status(join(root, 'Tresor ½'))).data.vault.path, join(root, 'Tresor ½'));
    const read = await obsidianRead(request('obsidian read', { 'obsidian-vault': 'Wörk', 'obsidian-path': 'Notizen/Über.md' }), context,
      port({ version: '1.12.7', 'vault=Wörk|read|path=Notizen/Über.md': '# Über\n' }));
    assert.equal(read.data.path, 'Notizen/Über.md');
  } finally { await rm(root, { recursive: true, force: true }); }
});
