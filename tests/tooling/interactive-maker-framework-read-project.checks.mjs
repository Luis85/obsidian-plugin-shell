const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCompanionInput, readCompanionProject } from '../../bin/adapters/framework/read-project.ts';

// Bounded companion-project reads (read-project.ts): contained vault targets, regular files only, 4 MB, UTF-8, no writes.
const windows = process.platform === 'win32';
const linkType = windows ? 'junction' : 'dir';
/** A recording parser keeps the checks independent of the full companion contract. */
function recordingReader(settings = { codebaseFolder: 'src', testsFolder: 'tests' }) {
  const calls = [];
  return { calls, reader: text => { calls.push(['parse', text]); return { settings }; } };
}
async function workspace(run) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'read-project-')));
  try {
    const vault = join(base, 'vault'), input = join(base, 'project.json');
    await mkdir(join(vault, 'plugin', 'src'), { recursive: true });
    await writeFile(input, '{"x":1}');
    await run({ base, vault, input });
  } finally { await rm(base, { recursive: true, force: true }); }
}

test('a project read returns the exact bytes, the parsed document and the contained target', () => workspace(async ({ vault, input }) => {
  const { calls, reader } = recordingReader();
  const read = await readCompanionProject({ input, target: 'plugin', vault }, reader);
  assert.deepEqual(read, { content: Buffer.from('{"x":1}'), document: { settings: { codebaseFolder: 'src', testsFolder: 'tests' } },
    vault, target: join(vault, 'plugin') });
  assert.deepEqual(calls, [['parse', '{"x":1}']]);
  const root = await readCompanionProject({ input, target: '.', vault }, recordingReader({ codebaseFolder: 'plugin/src', testsFolder: 'later/tests' }).reader);
  assert.equal(root.target, vault);
}));

test('the default reader parses the full schema 6 contract, refuses invalid JSON and never migrates earlier schemas', () => workspace(async ({ vault, input }) => {
  await assert.rejects(readCompanionProject({ input, target: 'plugin', vault }), { message: /^COMPANION_INVALID: / });
  await writeFile(input, 'not json');
  await assert.rejects(readCompanionProject({ input, target: 'plugin', vault }), { message: 'COMPANION_INVALID: Expected valid JSON.' });
  for (const schemaVersion of [1, 5]) {
    await writeFile(input, JSON.stringify({ kind: 'obsidian-companion-project', schemaVersion }));
    await assert.rejects(readCompanionProject({ input, target: 'plugin', vault }), { message: new RegExp(`^COMPANION_VERSION: Unsupported project schemaVersion ${schemaVersion}; only schema 6 is supported`) });
  }
}));

test('requests need an input file and a portable target inside an existing vault directory', () => workspace(async ({ base, vault, input }) => {
  const { reader } = recordingReader();
  for (const value of [undefined, '', '   ']) {
    await assert.rejects(readCompanionProject({ input: value, target: 'plugin', vault }, reader), { message: 'COMPANION_INPUT: Supply --input <project.json>.' });
    await assert.rejects(readCompanionInput({ input: value, target: 'plugin', vault }), { message: 'COMPANION_INPUT: Supply --input <project.json>.' });
  }
  for (const target of ['../outside', '/abs', 'a\\b']) {
    await assert.rejects(readCompanionProject({ input, target, vault }, reader),
      { message: 'COMPANION_TARGET: Use a portable vault-relative --target path, or dot for the vault root.' });
    await assert.rejects(readCompanionInput({ input, target, vault }), { message: 'COMPANION_TARGET: Use a portable vault-relative --target path.' });
  }
  await assert.rejects(readCompanionProject({ input, target: 'plugin', vault: input }, reader),
    { message: 'COMPANION_TARGET: The vault root must be an existing directory.' });
  await assert.rejects(readCompanionInput({ input, target: 'plugin', vault: input }), { message: 'COMPANION_TARGET: Expected an existing directory.' });
  await assert.rejects(readCompanionInput({ input, target: 'plugin', vault: join(base, 'missing') }), { code: 'ENOENT' });
}));

test('targets and configured folders may not pass through links or files; missing folders are future output', () => workspace(async ({ base, vault, input }) => {
  const { reader } = recordingReader();
  await writeFile(join(vault, 'file'), 'x');
  await symlink(join(base, 'vault', 'plugin'), join(vault, 'linked'), linkType);
  const refused = { message: 'COMPANION_TARGET: Target contains a link or non-directory.' };
  for (const target of ['file', 'linked', 'file/child']) {
    await assert.rejects(readCompanionProject({ input, target, vault }, reader), refused);
    await assert.rejects(readCompanionInput({ input, target, vault }), refused);
  }
  assert.equal((await readCompanionInput({ input, target: 'future/project', vault })).target, join(vault, 'future/project'));
  await writeFile(join(vault, 'plugin', 'tests'), 'x');
  await assert.rejects(readCompanionProject({ input, target: 'plugin', vault }, reader), refused);
}));

test('the input must be one regular, bounded UTF-8 file', () => workspace(async ({ base, vault, input }) => {
  const { reader } = recordingReader();
  await assert.rejects(readCompanionInput({ input: base, target: 'plugin', vault }), { message: 'COMPANION_INPUT: Expected a regular JSON file, not a link.' });
  if (!windows) {
    await symlink(input, join(base, 'link.json'));
    await assert.rejects(readCompanionInput({ input: join(base, 'link.json'), target: 'plugin', vault }), { message: 'COMPANION_INPUT: Expected a regular JSON file, not a link.' });
  }
  await writeFile(input, Buffer.alloc(4_000_001, 0x20));
  await assert.rejects(readCompanionInput({ input, target: 'plugin', vault }), { message: 'COMPANION_INPUT: File exceeds 4 MB.' });
  await writeFile(input, Buffer.alloc(4_000_000, 0x20));
  assert.equal((await readCompanionInput({ input, target: 'plugin', vault })).content.length, 4_000_000);
  await writeFile(input, Buffer.from([0x7b, 0xff]));
  await assert.rejects(readCompanionInput({ input, target: 'plugin', vault }), { code: 'ERR_ENCODING_INVALID_ENCODED_DATA' });
  await assert.rejects(readCompanionProject({ input, target: 'plugin', vault }, reader), { code: 'ERR_ENCODING_INVALID_ENCODED_DATA' });
}));

test('the compiler input read returns bytes without parsing and defaults the vault to the working directory', () => workspace(async ({ vault, input }) => {
  await writeFile(input, 'not json at all');
  assert.deepEqual(await readCompanionInput({ input, target: 'plugin', vault }), { content: Buffer.from('not json at all'), vault, target: join(vault, 'plugin') });
  const cwd = await realpath(process.cwd());
  assert.equal((await readCompanionInput({ input, target: '.' })).vault, cwd);
  assert.equal((await readCompanionProject({ input, target: '.' }, recordingReader({}).reader)).vault, cwd);
}));
