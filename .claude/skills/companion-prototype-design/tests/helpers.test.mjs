import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { args, readBytes, readText, writeBuild, noLinks, sha256 } from '../scripts/lib/io.mjs';
import { assemble } from '../scripts/build-single-file.mjs';
import { checkHtml, checkCss } from '../scripts/lib/offline.mjs';
import { diffValues, changeReport } from '../scripts/diff-project.mjs';
import { inspectRepository } from '../scripts/inspect-repository.mjs';
const project = Buffer.from('{ "kind":"obsidian-companion-project", "executable":false, "notes":["Café </script>"] }\n');
const configuration = { javascript: '(function(){document.documentElement.dataset.prototypeReady="true"})();',
  css: '.prototype-root { color: var(--text-normal); }', projectBytes: project, title: 'Café & notes' };
function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-helper-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('strict arguments reject unknown, duplicate and missing values', () => {
  assert.deepEqual(args(['--root', 'here', '--replace'], ['--root'], ['--replace']), { root: 'here', replace: true });
  for (const a of [['--bad'], ['--root'], ['--root', '--replace'], ['--root', 'a', '--root', 'b']]) {
    assert.throws(() => args(a, ['--root'], ['--replace']));
  }
});
test('bounded UTF-8 reading rejects oversized, directories and invalid bytes', t => {
  const root = scratch(t), file = path.join(root, 'data');
  fs.writeFileSync(file, 'abc');
  assert.equal(readText(file, 3), 'abc');
  assert.throws(() => readBytes(file, 2));
  assert.throws(() => readBytes(root));
  fs.writeFileSync(file, Buffer.from([0xff]));
  assert.throws(() => readText(file));
});
test('reads and output checks refuse linked files and linked ancestors', t => {
  const root = scratch(t), file = path.join(root, 'file');
  fs.writeFileSync(file, 'ok');
  fs.symlinkSync(file, path.join(root, 'linked'));
  assert.throws(() => readText(path.join(root, 'linked')), /Symlink/);
  fs.symlinkSync(root, path.join(root, 'linked-directory'));
  assert.throws(() => noLinks(path.join(root, 'linked-directory', 'future')), /Symlink/);
});
test('build output is fresh by default; replacement requires explicit flag', t => {
  const file = path.join(scratch(t), 'prototype.html');
  writeBuild(file, 'old');
  assert.throws(() => writeBuild(file, 'bad'));
  assert.equal(readText(file), 'old');
  writeBuild(file, 'new', true);
  assert.equal(readText(file), 'new');
});
test('assembler is deterministic and preserves original UTF-8 project bytes', () => {
  const first = assemble(configuration), second = assemble(configuration);
  assert.equal(first, second);
  assert.match(first, /<title>Café &amp; notes<\/title>/);
  const data = JSON.parse(first.match(/id="prototype-project-data" type="application\/json">([^<]+)</)[1]);
  assert.ok(Buffer.from(data.content, 'base64').equals(project));
  assert.equal(data.sha256, sha256(project));
  assert.deepEqual(checkHtml(first), []);
});
test('assembler escapes script termination and CSP hash matches executable bytes', () => {
  const html = assemble({ ...configuration, javascript: 'globalThis.message="</script>";' });
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  assert.equal([...html.matchAll(/<script\b/g)].length, 2);
  const context = {}; vm.runInNewContext(js, context);
  assert.equal(context.message, '</script>');
  const hash = Buffer.from(sha256(js), 'hex').toString('base64');
  assert.ok(html.includes(`sha256-${hash}`));
});
test('assembler rejects ESM, dynamic imports and sourcemap resource dependencies', () => {
  for (const javascript of ['import x from "vue";', 'export const a=1;', 'const x=import.meta.url;',
    'import("./chunk.js")', '// sourceMappingURL=missing.map\nvoid 0']) {
    assert.throws(() => assemble({ ...configuration, javascript }));
  }
});
test('assembler rejects unsafe CSS, empty JavaScript and wrong project carrier', () => {
  for (const css of ['@import "remote.css";', 'a {background:url(image.png)}',
    '@font-face{font-family:x;src:url(data:font/woff2;base64,QQ==)}', '</style><script>bad</script>']) {
    assert.throws(() => assemble({ ...configuration, css }));
  }
  assert.throws(() => assemble({ ...configuration, javascript: '' }));
  assert.throws(() => assemble({ ...configuration, projectBytes: Buffer.from('{"executable":true}') }));
});
test('static HTML checker rejects external resources and executable HTML handlers', () => {
  for (const fragment of ['<script src="foo.js"></script>', '<script type="module">void 0</script>',
    '<script type="importmap">{}</script>', '<link rel="stylesheet" href="foo.css">',
    '<img src="https://example.invalid/x">', '<img src="x.svg">', '<iframe srcdoc="hello"></iframe>',
    '<button onclick="alert(1)">x</button>', '<meta http-equiv="refresh" content="0">', '<base href="/">']) {
    const issues = checkHtml(`<!doctype html>${fragment}`);
    assert.ok(issues.length > 0, fragment);
  }
});
test('static checker permits embedded images, local anchors and nonexecuted URL text', () => {
  const html = '<!doctype html><img src="data:image/png;base64,AA=="><a href="#main">back</a><script>const text="https://example.invalid/documentation";</script>';
  assert.deepEqual(checkHtml(html), []);
  assert.deepEqual(checkCss('.x {background:url("data:image/svg+xml;base64,AA==")}'), []);
  assert.deepEqual(checkCss('.\\32xl\\:text {color:red}'), []);
});
test('change diff ignores property order, escapes pointers and flags changed arrays', () => {
  assert.deepEqual(diffValues({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
  assert.deepEqual(diffValues({ 'a/b': 1 }, { 'a/b': 2, 'a~b': 3 }),
    [{ op: 'replace', path: '/a~1b' }, { op: 'add', path: '/a~0b' }]);
  assert.deepEqual(diffValues({ nodes: [{ id: 'a' }] }, { nodes: [{ id: 'b' }] }), [{ op: 'replace', path: '/nodes' }]);
});
test('change report preserves identity and never claims to be executable', () => {
  const before = Buffer.from('{"project":{"id":"same"},"x":1}');
  const after = Buffer.from('{"project":{"id":"same"},"x":2}');
  const report = changeReport(before, after);
  assert.equal(report.executable, false);
  assert.equal(report.baselineSha256, sha256(before));
  assert.deepEqual(report.changes, [{ op: 'replace', path: '/x' }]);
  assert.throws(() => changeReport(before, Buffer.from('{"project":{"id":"other"}}')), /identity/);
});
test('repository inspection reports declared/locked mismatch without executing source', t => {
  const root = scratch(t);
  fs.mkdirSync(path.join(root, 'scripts/companion'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { vue: '3.5.43' }, packageManager: 'npm@11.19.1' }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/vue': { version: '3.5.42' } } }));
  fs.writeFileSync(path.join(root, '.nvmrc'), '24.21.0\n');
  fs.writeFileSync(path.join(root, 'scripts/companion/project-contract.mjs'),
    'export const COMPANION_VERSION = 5;\nexport const COMPANION_MAX_BYTES = 4_000_000;\nthrow new Error("must not execute");');
  const report = inspectRepository(root);
  assert.equal(report.contract.version, 5);
  assert.equal(report.contract.maxBytes, 4000000);
  assert.equal(report.pins.vue.declared, '3.5.43');
  assert.equal(report.pins.vue.locked, '3.5.42');
  assert.equal(report.status, 'inspection-only-not-verification');
  assert.ok(report.files.some(file => file.error));
});

test('inline assembler rejects HTML comment parser state ambiguity', () => {
  assert.throws(() => assemble({ ...configuration, javascript: 'const text="<!--<script>";' }), /HTML comment/);
});
