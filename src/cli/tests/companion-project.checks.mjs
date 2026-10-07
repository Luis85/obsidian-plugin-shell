import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, realpath, rm } from 'node:fs/promises';
import { fileSymlink } from './file-symlink.mjs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
// The read-only reader and CLI use the one current (schema 6) contract; retired formats are refused, never migrated.
import { parseAuthoringDocument as parseCompanionDocument, validateCompanionFolders, companionRelativeFolder, COMPANION_MAX_BYTES, authoringDesignKey } from '#shared/companion/authoring-contract.ts';
import { starterDocumentText } from '../../../tests/support/starter-documents.mjs';
import { retiredProjectText } from '../../../tests/support/retired-projects.mjs';
import { readCompanionProject } from '../adapters/framework/read-project.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = join(root, 'tooling/companion-tools/generate.mjs');
const seed = starterDocumentText('companion-plugin');
const document = JSON.parse(seed);
// Build an own JSON property, not an object-literal prototype or a newline-dependent splice.
function unsafeRootDocument(text, key = '__proto__') {
  return JSON.stringify({ ...JSON.parse(text), [key]: {} }, null, 2);
}
function run(args, cwd = root) { return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 5_000_000 }); }
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'companion-project-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const vault = join(dir, 'vault'), input = join(dir, 'export.json');
  await mkdir(vault); await mkdir(join(vault, '.obsidian'));
  await writeFile(join(vault, '.obsidian', 'workspace.json'), '{"preserve":true}');
  await writeFile(join(vault, 'note.md'), '# Keep my note\n');
  await writeFile(input, seed);
  return { dir, vault, input };
}
async function snapshot(dir) {
  const result = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    result[entry.name] = entry.isDirectory() ? await snapshot(join(dir, entry.name)) :
      entry.isSymbolicLink() ? 'symlink' : (await readFile(join(dir, entry.name))).toString('base64');
  }
  return result;
}

test('[COMPANION-SEED] full companion definition has authored coverage, not execution authority', () => {
  assert.equal(parseCompanionDocument(seed).kind, 'obsidian-companion-project');
  assert.equal(document.project.id, 'workbench-companion');
  assert.equal(document.design.nodes.length, 28);
  assert.equal(document.design.prds.flatMap(p => p.requirements).length, 31);
  assert.equal(document.design.library.length, 54);
  assert.equal(document.design.semantic.entities.length, 11);
  assert.equal(document.design.dataSources.testing.recipes.length, 3);
  assert.deepEqual(document.settings, { codebaseFolder: 'src', testsFolder: 'tests' });
  assert.equal(Object.hasOwn(document, 'trusted'), false);
  assert.equal(Object.hasOwn(document.design, 'emitted'), false);
});
test('[COMPANION-VISUAL] the self-project carries its reviewed schema 6 visual designs and no retired detail store', () => {
  const v = document.design.visualDesigns;
  assert.equal(document.schemaVersion, 6); assert.equal(document.design.schema, 6);
  assert.equal(Object.hasOwn(document.design, 'detailDesigns'), false);
  assert.deepEqual([v.pages.length, v.components.length, v.revisions.length, v.layouts.length], [27, 54, 54, 0]);
});
test('[COMPANION-KEYS] design keys are an explicit allow-list; the retired detail store, kind, executable and prototype names are not design keys', () => {
  for (const key of ['schema', 'blueprint', 'nodes', 'library', 'storymaps', 'visualDesigns', 'sitemap', 'features', 'editors']) assert.equal(authoringDesignKey(key), true, key);
  for (const key of ['detailDesigns', 'kind', 'executable', 'bogus', '__proto__', 'constructor', 'toString', 'history', '']) assert.equal(authoringDesignKey(key), false, key);
});
test('[COMPANION-CLI] original Unicode/whitespace bytes returned, zero writes even to missing target', async t => {
  const f = await fixture(t), text = '  ' + seed.replace('"Workbench"', '"Workbench — ä"') + '\n\n';
  await writeFile(f.input, text);
  const before = await snapshot(f.dir);
  const result = run(['--input', f.input, '--target', 'plugins/new companion', '--vault', f.vault]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, text); assert.equal(result.stderr, '');
  assert.deepEqual(await snapshot(f.dir), before);
});
test('[COMPANION-READ] exported service returns data and canonical targets without reformatting', async t => {
  const f = await fixture(t), canonicalRoot = await realpath(f.vault);
  const alias = join(f.dir, 'vault-alias');
  await symlink(f.vault, alias, 'junction');
  const before = await snapshot(f.dir);
  // Keep the supplied spelling, including a Windows 8.3 temp path, as the input.
  for (const vault of [f.vault, alias]) {
    for (const target of ['.', 'plugins/new companion']) {
      const result = await readCompanionProject({ input: f.input, vault, target });
      assert.equal(result.content.toString(), seed);
      assert.deepEqual(result.document, document);
      assert.equal('migration' in result, false);
      assert.equal(result.vault, canonicalRoot);
      assert.equal(result.target, resolve(canonicalRoot, target));
    }
  }
  assert.deepEqual(await snapshot(f.dir), before);
});
test('[COMPANION-READ] retired v4 and v5 exports are rejected on read and by the CLI, never migrated', async t => {
  const f = await fixture(t);
  for (const version of [4, 5]) {
    await writeFile(f.input, retiredProjectText(version));
    await assert.rejects(readCompanionProject({ input: f.input, vault: f.vault, target: '.' }), /COMPANION_VERSION: Unsupported project schemaVersion [45]; only schema 6 is supported/);
    const before = await snapshot(f.dir), result = run(['--input', f.input, '--vault', f.vault, '--target', 'not-created']);
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /^COMPANION_VERSION: .*Earlier formats are not migrated/);
    assert.deepEqual(await snapshot(f.dir), before);
  }
});
test('[COMPANION-CWD] explicit vault and default current-vault invocation work outside the shell', async t => {
  const f = await fixture(t);
  const result = run(['--input', '../export.json', '--target', '.'], f.vault);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, seed);
});
test('[COMPANION-FOLDERS] custom folders survive the shell boundary', async t => {
  const f = await fixture(t), value = structuredClone(document);
  value.settings = { codebaseFolder: 'plugin/code', testsFolder: 'specifications/tests' };
  const text = JSON.stringify(value); await writeFile(f.input, text);
  const result = run(['--input', f.input, '--vault', f.vault, '--target', 'workspace']);
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, text);
});
test('[COMPANION-PATHS] traversal, reserved names, absolute and ambiguous portable targets are rejected', () => {
  for (const path of ['', '../src', 'src/../other', '/tmp/src', 'C:/src', 'C:\\src', '\\\\server\\src',
    'src//more', './src', 'src/', '.obsidian/plugins', 'node_modules/x', '.git', 'CON', 'NUL.txt',
    'src/aux.txt', 'src/trailing.', 'src/trailing ', 'src/constructor', 'a\npath']) {
    assert.equal(companionRelativeFolder(path), false, path);
  }
  assert.equal(companionRelativeFolder('.', true), true);
  assert.equal(companionRelativeFolder('plugins/My plugin'), true);
});
test('[COMPANION-OVERLAP] case-insensitive ancestor folders are refused, siblings are accepted', () => {
  for (const [codebaseFolder, testsFolder] of [['src', 'SRC'], ['src', 'src/test'], ['src/app', 'src']]) {
    assert.throws(() => validateCompanionFolders({ codebaseFolder, testsFolder }), /overlap/);
  }
  assert.deepEqual(validateCompanionFolders({ codebaseFolder: 'app/src', testsFolder: 'app/tests' }),
    { codebaseFolder: 'app/src', testsFolder: 'app/tests' });
});
test('[COMPANION-INVALID] malformed/future/wrong-kind/authority documents produce no stdout or writes', async t => {
  const f = await fixture(t);
  const cases = ['{', 'null', '[]', '{"schema":2,"project":{}}'];
  for (const patch of [{ kind: 'plugin-shell-blueprint' }, { schemaVersion: 999 }, { executable: true }, { trusted: true },
    { settings: { codebaseFolder: '../src', testsFolder: 'tests' } }, { project: { ...document.project, id: '../bad' } },
    { design: { ...document.design, nodes: [{ id: 'duplicate' }, { id: 'duplicate' }] } }]) cases.push(JSON.stringify({ ...document, ...patch }));
  for (const text of cases) {
    await writeFile(f.input, text); const before = await snapshot(f.dir);
    const result = run(['--input', f.input, '--vault', f.vault, '--target', 'not-created']);
    assert.notEqual(result.status, 0); assert.equal(result.stdout, ''); assert.match(result.stderr, /COMPANION_/);
    assert.deepEqual(await snapshot(f.dir), before);
  }
});
test('[COMPANION-BOUNDS] size, nesting, unsafe keys and invalid UTF-8 fail closed', async t => {
  assert.throws(() => parseCompanionDocument(unsafeRootDocument(seed)), /Unsafe key/);
  const value = structuredClone(document); value.notes = [JSON.parse('{"constructor":1}')];
  assert.throws(() => parseCompanionDocument(JSON.stringify(value)), /Unsafe key/);
  assert.throws(() => parseCompanionDocument(' '.repeat(COMPANION_MAX_BYTES) + seed), /limit/);
  const nested = '['.repeat(42) + '1' + ']'.repeat(42);
  assert.throws(() => parseCompanionDocument(nested), /nesting/);
  const f = await fixture(t);
  for (const bytes of [Buffer.alloc(COMPANION_MAX_BYTES + 1, 32), Buffer.from([0xff, 0xfe, 0xfa])]) {
    await writeFile(f.input, bytes);
    const result = run(['--input', f.input, '--vault', f.vault, '--target', '.']);
    assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
  }
});
test('[COMPANION-EOL] LF, CRLF and trailing whitespace preserve bytes and unsafe-key checks', async t => {
  const f = await fixture(t);
  for (const eol of ['\n', '\r\n']) {
    for (const trailing of ['', eol, eol + ' \t' + eol]) {
      const text = JSON.stringify(document, null, 2).replace(/\n/g, eol) + trailing;
      assert.deepEqual(parseCompanionDocument(text), document);
      await writeFile(f.input, text);
      const before = await snapshot(f.dir);
      const result = run(['--input', f.input, '--vault', f.vault, '--target', 'not-created']);
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, text); assert.equal(result.stderr, '');
      assert.deepEqual(await snapshot(f.dir), before);
      for (const key of ['__proto__', 'constructor', 'prototype']) {
        const unsafe = unsafeRootDocument(text, key).replace(/\n/g, eol) + trailing;
        // A valid JSON fixture must reach the unsafe-key guard, not a syntax error.
        assert.equal(Object.hasOwn(JSON.parse(unsafe), key), true);
        assert.throws(() => parseCompanionDocument(unsafe), /Unsafe key/);
        await writeFile(f.input, unsafe);
        const retained = await snapshot(f.dir);
        const rejected = run(['--input', f.input, '--vault', f.vault, '--target', 'not-created']);
        assert.equal(rejected.error, undefined, rejected.error?.message);
        assert.equal(rejected.status, 1); assert.equal(rejected.stdout, '');
        assert.match(rejected.stderr, /SITEMAP_JSON: Unsafe key/);
        assert.deepEqual(await snapshot(f.dir), retained);
      }
    }
  }
});
test('[COMPANION-LINKS] target links, child-folder redirects and input links are refused', async t => {
  const f = await fixture(t);
  await mkdir(join(f.dir, 'outside'));
  await symlink(join(f.dir, 'outside'), join(f.vault, 'redirect'), 'junction');
  await symlink(join(f.dir, 'outside'), join(f.vault, 'src'), 'junction');
  for (const target of ['redirect/new', '.']) {
    const result = run(['--input', f.input, '--vault', f.vault, '--target', target]);
    assert.notEqual(result.status, 0); assert.equal(result.stdout, ''); assert.match(result.stderr, /link/);
  }
  assert.deepEqual(await readdir(join(f.dir, 'outside')), []);
});
test('[COMPANION-LINKS] input file links are refused', async t => {
  const f = await fixture(t);
  if (!await fileSymlink(t, f.input, join(f.dir, 'input-link.json'))) return;
  const result = run(['--input', join(f.dir, 'input-link.json'), '--vault', f.vault, '--target', 'new']);
  assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
  assert.equal((await readdir(f.vault)).includes('new'), false);
});
test('[COMPANION-NONFILE] directories, absent inputs and targets through files are refused', async t => {
  const f = await fixture(t);
  for (const [input, target] of [[f.vault, '.'], [join(f.dir, 'missing.json'), '.'], [f.input, 'note.md/child']]) {
    const result = run(['--input', input, '--vault', f.vault, '--target', target]);
    assert.notEqual(result.status, 0); assert.equal(result.stdout, '');
  }
});
test('[COMPANION-USAGE] explicit required arguments, no unknown or duplicate options', () => {
  for (const args of [[], ['--input', 'x'], ['--target', '.'], ['--wat'], ['--input', 'x', '--target', '.', '--target', 'x'], ['--input=x', '--target', '.']]) {
    const result = run(args); assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /COMPANION_USAGE/);
  }
  const result = run(['--help']); assert.equal(result.status, 0); assert.match(result.stdout, /READ ONLY/); assert.equal(result.stderr, '');
});
