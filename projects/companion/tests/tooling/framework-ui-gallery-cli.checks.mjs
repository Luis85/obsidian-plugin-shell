import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { galleryOptions, parseGalleryArguments } from '../../scripts/ui/gallery-options.ts';
import { runCli } from '../../scripts/ui/gallery-cli.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { galleryArguments } from '../../bin/adapters/framework/ui-gallery.ts';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { commandHelp } from '../../bin/adapters/framework/help-text.ts';
import { descriptor } from '../../bin/adapters/framework/catalog.ts';

const code = (value, pattern) => assert.throws(value, error => pattern.test(error.code ?? error.message));

test('defaults target the harness and the reports/ui-gallery folder', () => {
  assert.deepEqual(parseGalleryArguments([]), { target: 'harness', out: 'reports/ui-gallery', input: undefined, json: false });
  assert.deepEqual(parseGalleryArguments(['--target', 'clickdummy', '--out', 'reports/x', '--input', 'dist/clickdummy.html', '--json']),
    { target: 'clickdummy', out: 'reports/x', input: 'dist/clickdummy.html', json: true });
});

test('option parsing rejects unknown targets, options, positional words, repeats and missing values', () => {
  code(() => parseGalleryArguments(['--target', 'storybook']), /GALLERY_TARGET/);
  code(() => parseGalleryArguments(['--bogus', 'x']), /GALLERY_OPTION/);
  code(() => parseGalleryArguments(['positional']), /GALLERY_OPTION/);
  code(() => parseGalleryArguments(['--out']), /GALLERY_OPTION/);
  code(() => parseGalleryArguments(['--out', '--json']), /GALLERY_OPTION/);
  code(() => parseGalleryArguments(['--json', '--json']), /GALLERY_OPTION/);
  code(() => parseGalleryArguments(['--input', 'a.html']), /GALLERY_OPTION/);
});

test('output and input paths stay relative and inside the project', () => {
  for (const unsafe of ['/abs', '../up', 'a/../b', '.git/x', 'node_modules/x', 'a\\b', '']) code(() => galleryOptions({ out: unsafe }), /GALLERY_PATH/);
  code(() => galleryOptions({ target: 'clickdummy', input: '../x.html' }), /GALLERY_PATH/);
});

test('runCli reports success, failures and startup errors with the documented exit codes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ui-gallery-cli-')); t.after(() => rm(root, { recursive: true, force: true }));
  const text = { out: '', err: '' };
  const session = failing => ({ surfaces: async () => [{ id: 's', label: 'S', variants: [{ state: 'default', scenario: null }] }],
    capture: async job => { if (failing && job.width === 360) throw new Error('boom'); return Buffer.from(job.file); }, close: async () => {} });
  const deps = (make, extra = {}) => ({ root, clock: () => new Date(0), commit: async () => null, session: async () => make, out: value => { text.out += value; }, err: value => { text.err += value; }, ...extra });
  assert.equal(await runCli(['--json'], deps(session(false))), 0);
  assert.equal(JSON.parse(text.out).status, 'captured');
  assert.equal(JSON.parse(text.out).captures, 4);
  assert.equal(JSON.parse(await readFile(join(root, 'reports/ui-gallery/index.json'), 'utf8')).commit, null);
  text.out = '';
  assert.equal(await runCli([], deps(session(true))), 1);
  assert.match(text.out, /Evidence for human review — not acceptance, not a baseline/);
  assert.match(text.out, /FAILED s__default__none__light__360\.png: boom/);
  assert.equal(await runCli(['--target', 'nope', '--json'], deps(session(false))), 2);
  assert.match(text.err, /"code":"GALLERY_TARGET"/);
  const broken = deps(null, { session: async () => { throw new Error('GALLERY_CLICKDUMMY_MISSING: run build'); } });
  text.err = ''; assert.equal(await runCli([], broken), 2); assert.match(text.err, /GALLERY_CLICKDUMMY_MISSING/);
});

test('ui gallery is a catalogued command whose dry run launches nothing and whose bad options fail', async () => {
  const request = parseCliArguments(['ui', 'gallery', '--target', 'clickdummy', '--dry-run', '--json']);
  assert.equal(request.command, 'ui gallery');
  const response = await executeOperation(request, { root: tmpdir(), frameworkRoot: tmpdir() });
  assert.equal(response.status, 'planned'); assert.equal(response.data.execution, 'not-run'); assert.equal(response.data.target, 'clickdummy');
  assert.match(response.data.notice, /not acceptance, not a baseline/);
  const bad = await executeOperation(parseCliArguments(['ui', 'gallery', '--out', '../escape']), { root: tmpdir(), frameworkRoot: tmpdir() });
  assert.equal(bad.status, 'failed'); assert.equal(bad.diagnostics[0].code, 'GALLERY_PATH');
  assert.throws(() => parseCliArguments(['ui', 'gallery', '--bogus', 'x']));
  assert.deepEqual(galleryArguments({ target: 'clickdummy', out: 'o', input: 'i.html', json: false }), ['--target', 'clickdummy', '--out', 'o', '--input', 'i.html', '--json']);
  const help = commandHelp(descriptor('ui gallery'));
  assert.equal(help.group, 'ui'); assert.deepEqual(help.optionHelp.target.values, ['harness', 'clickdummy']);
});
