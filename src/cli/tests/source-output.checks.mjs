const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { main } from '../adapters/framework-cli.ts';
import { fixture, projects, read, repository, write } from './support/source-fixture.mjs';

/** Run the real noninteractive human CLI, including request parsing and terminal routing. */
async function human(root, ...args) {
  let output = '', error = '';
  const status = await main(['source', ...args, '--root', root], repository, {
    input: Readable.from([]),
    output: { isTTY: false, write(text) { output += text; return true; } },
    error: { isTTY: false, write(text) { error += text; return true; } },
    env: { ...process.env, NO_COLOR: '1' },
  });
  return { status, text: output + error };
}

test('human source discovery shows paths, aliases, platform and dependency order without writing', async t => {
  const declarations = projects(); declarations[0].platform = 'node';
  const root = await fixture(t, { manifest: { schemaVersion: 1, projects: declarations } });
  const before = await read(root, 'workbench.sources.json');
  const listed = await human(root, 'list');
  assert.equal(listed.status, 0, listed.text);
  assert.match(listed.text, /shared\s+library\/node\s+src\/shared\s+refs: none\s+alias: #shared\/\*/);
  assert.match(listed.text, /plugin\s+plugin\s+src\/plugin\s+refs: shared/);
  const graph = await human(root, 'graph');
  assert.equal(graph.status, 0, graph.text);
  assert.match(graph.text, /Build order\s+shared -> tui -> cli -> plugin/);
  assert.match(graph.text, /shared\s+-> none\s+<- tui, cli, plugin/);
  assert.match(graph.text, /Next: node bin\/app source check/);
  assert.equal(await read(root, 'workbench.sources.json'), before);
});

test('human source graph explains cycles and check names the concrete repair', async t => {
  const root = await fixture(t);
  const clean = await human(root, 'check');
  assert.equal(clean.status, 0, clean.text);
  assert.match(clean.text, /Manifest, graph, tsconfigs, aliases, imports and gate scopes agree/);
  await write(root, 'src/plugin/index.ts', "import { tuiName } from '#tui/index.ts';\nexport const pluginName = tuiName;\n");
  const before = await read(root, 'src/plugin/index.ts');
  const failed = await human(root, 'check');
  assert.equal(failed.status, 1, failed.text);
  assert.match(failed.text, /SOURCE_UNREFERENCED_IMPORT\s+\[plugin\]/);
  assert.match(failed.text, /fix: node bin\/app source link plugin tui/);
  assert.equal(await read(root, 'src/plugin/index.ts'), before);
  const declarations = projects(); declarations[0].references = ['cli'];
  await write(root, 'workbench.sources.json', JSON.stringify({ schemaVersion: 1, projects: declarations }));
  const graph = await human(root, 'graph');
  assert.equal(graph.status, 0, graph.text);
  assert.match(graph.text, /Build order\s+none \(cycle\)/);
  assert.match(graph.text, /cycle: shared -> cli -> shared/);
  assert.match(graph.text, /Next: node bin\/app source unlink <from> <to>/);
});

test('empty source discovery stays readable and library help explains platform selection', async t => {
  const root = await fixture(t, { manifest: { schemaVersion: 1, projects: [] } });
  const listed = await human(root, 'list');
  assert.equal(listed.status, 0, listed.text);
  assert.match(listed.text, /Projects\s+0/);
  assert.doesNotMatch(listed.text, /undefined|NaN/);
  const help = await human(root, 'add', '--help');
  assert.equal(help.status, 0, help.text);
  assert.match(help.text, /--platform/);
  assert.match(help.text, /TypeScript base of a library project/);
  assert.match(help.text, /<node\|browser>/);
});
