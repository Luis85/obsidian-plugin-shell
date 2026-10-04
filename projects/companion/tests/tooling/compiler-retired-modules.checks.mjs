import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { inspectModule } from '../../scripts/compiler/check-architecture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const owners = JSON.parse(await readFile(new URL('../fixtures/tooling/retired-module-owners.json', import.meta.url), 'utf8'));
function retiredImports(sources) {
  const findings = [];
  for (const [file, source] of sources) {
    for (const dependency of inspectModule(file, source).dependencies) {
      if (!dependency.specifier.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(file), dependency.specifier));
      if (Object.hasOwn(owners, target)) findings.push(`${file}: use ${owners[target]} instead of ${target}`);
    }
  }
  return findings.sort();
}
async function sources() {
  const entries = new Map();
  async function walk(folder) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
      if (['node_modules', '.git', '__pycache__', 'vendor'].includes(entry.name)) continue;
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(?:[cm]?js|[cm]?ts)$/.test(entry.name)) entries.set(path, await readFile(resolve(root, path), 'utf8'));
    }
  }
  for (const folder of ['bin', 'scripts', 'configs', 'plugins', 'src', 'tests']) await walk(folder);
  return entries;
}
test('executable source imports only canonical modules, never deleted compatibility entries', async () => {
  const inventory = await sources();
  assert.ok(inventory.size > 400);
  assert.deepEqual(retiredImports(inventory), []);
});
test('retired-module guard catches static, dynamic, side-effect and re-export dependencies', () => {
  const file = 'tests/tooling/example.checks.mjs';
  for (const source of [
    "import { hash } from '../../scripts/framework/files.ts';",
    "export { runNodeScript } from '../../scripts/shared/process.mjs';",
    "const load = () => import('../../scripts/compiler/adapters/project-files.ts');",
    "import '../../scripts/contracts/json-data.mjs';",
  ]) assert.equal(retiredImports(new Map([[file, source]])).length, 1, source);
});
test('guard preserves generated-source strings and accepts canonical source imports', () => {
  assert.deepEqual(retiredImports(new Map([['tests/tooling/example.checks.mjs', [
    "import { hash } from '../../bin/adapters/framework/files.ts';",
    'const output = `import "../../scripts/shared/hash.mjs";`;',
  ].join('\n')]])), []);
});

const kitMakerCopy = ['bin', 'template', 'bin', 'adapters', 'makers'].join('/');
function retiredLayoutLiterals(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) && /^\.framework\/(?:kit\.json$|(?:compiled|template)(?:\/|$))/.test(node.text)) found.push(node.text);
    // Generated consumer code receives maker primitives by injection; no source may probe the kit's editable copy.
    const text = ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? node.text : '';
    if (text.includes(kitMakerCopy)) found.push(kitMakerCopy);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return found;
}
test('runtime discovery never probes retired distribution layouts', async () => {
  for (const [file, source] of await sources()) {
    if (!/^(?:bin|scripts)\//.test(file)) continue;
    assert.deepEqual(retiredLayoutLiterals(source, file), [], file);
  }
  assert.deepEqual(retiredLayoutLiterals("const root = join(base, '.framework/template');", 'example.ts'), ['.framework/template']);
  assert.deepEqual(retiredLayoutLiterals("// Retired .framework/template layout.\nconst root = join(base, 'bin/template');", 'example.ts'), []);
  const probe = 'const source = `const makers = new URL(\'${up}' + kitMakerCopy + '/\', import.meta.url);`;';
  assert.deepEqual(retiredLayoutLiterals(probe, 'example.ts'), [kitMakerCopy]);
});
