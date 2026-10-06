import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { planExampleRemoval } from '../examples/plan.mjs';
import { applyFilePlan } from '../../src/shared/platform/file-plan.ts';

// Example-owned: `examples:remove` deletes this rehearsal with the reviewed examples it rehearses.
const root = fileURLToPath(new URL('../../', import.meta.url));
// The planner reads the manifest, templates, owned files and the registry; the
// import scan also needs every tree a retained module can import from.
const copied = ['src', 'tests', 'harness', 'scripts', 'bin', 'templates', 'README.md'];
const scanned = ['src', 'tests', 'harness', 'scripts'];
const extensions = ['', '.ts', '.mts', '.mjs', '.js', '.vue', '.json', '.d.ts', '.d.mts', '/index.ts', '/index.mjs'];

const isFile = async path => { try { return (await stat(path)).isFile(); } catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; } };
async function* sources(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') yield* sources(path); }
    else if (/\.(?:m?ts|mjs|vue)$/.test(entry.name)) yield path;
  }
}
/**
 * Relative imports found by the TypeScript pre-processor (strings and templates are
 * not imports): specifiers resolving to no file, and the importers of each file.
 */
async function importGraph(base) {
  const missing = new Set(); const importers = new Map();
  const name = path => relative(base, path).replace(/\\/g, '/');
  for (const top of scanned) for await (const file of sources(join(base, top))) {
    let text = await readFile(file, 'utf8');
    if (file.endsWith('.vue')) text = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
    for (const { fileName } of ts.preProcessFile(text, true, true).importedFiles) {
      if (!/^\.\.?\//.test(fileName)) continue;
      const target = resolve(dirname(file), fileName.replace(/\?.*$/, ''));
      let found;
      for (const candidate of [...extensions.map(extension => target + extension), ...(target.endsWith('.js') ? [target.slice(0, -3) + '.ts'] : [])]) {
        if (await isFile(candidate)) { found = name(candidate); break; }
      }
      if (!found) missing.add(`${name(file)} -> ${fileName}`);
      else importers.set(found, new Set([...importers.get(found) ?? [], name(file)]));
    }
  }
  return { missing, importers };
}
const keys = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => child && typeof child === 'object' ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);

test('reviewed example removal applies to this checkout, keeps shared forms and strands no import or runtime module', { timeout: 120000 }, async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'example-removal-rehearsal-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  for (const path of copied) await cp(join(root, path), join(folder, path), { recursive: true, filter: source => !source.includes('node_modules') });
  const before = await importGraph(folder);
  const locale = async name => JSON.parse(await readFile(join(folder, `src/locales/${name}.json`), 'utf8'));
  const reviewedForm = (await locale('en')).form;
  assert.ok(reviewedForm && Object.keys(reviewedForm).length, 'the shared form messages exist before removal');

  // Fails with EXAMPLES_EDITED_FILES when a reviewed hash no longer matches the checked-in source.
  const planned = await planExampleRemoval(folder);
  await applyFilePlan(planned.plan);
  const manifest = JSON.parse(await readFile(join(folder, 'scripts/examples/ownership.json'), 'utf8'));
  const removed = new Set(manifest.files.filter(file => !file.template).map(file => file.path));
  for (const file of manifest.files) {
    if (file.template) assert.equal(await readFile(join(folder, file.path), 'utf8'), await readFile(join(folder, 'templates/examples', file.template), 'utf8'), file.path);
    else assert.equal(await isFile(join(folder, file.path)), false, `${file.path} is removed`);
  }

  const after = await importGraph(folder);
  assert.deepEqual([...after.missing].filter(entry => !before.missing.has(entry)), [], 'retained source must not import a removed example file');
  // A retained runtime module that only removed examples imported would survive as dead example code.
  const orphaned = [...before.importers.keys()].filter(path => path.startsWith('src/') && !after.importers.has(path) && !removed.has(path));
  assert.deepEqual(orphaned, [], 'every module used only by removed examples is example-owned');

  const [en, de] = [await locale('en'), await locale('de')];
  for (const messages of [en, de]) {
    assert.ok(!Object.hasOwn(messages, 'forms') && !Object.hasOwn(messages.nav, 'forms'), 'showcase Forms page messages are removed');
    assert.deepEqual(keys(messages.form ?? {}), keys(reviewedForm), 'shared DataForm messages survive removal');
  }
  assert.deepEqual(en.form, reviewedForm);
  assert.deepEqual(keys(de).sort(), keys(en).sort(), 'German keeps the same message keys as English');

  const app = await readFile(join(folder, 'src/styles/app.css'), 'utf8');
  assert.match(app, /@import "\.\/forms\.css";/);
  assert.match(await readFile(join(folder, 'src/styles/forms.css'), 'utf8'), /^\.shell-data-form-group \{/m);
  assert.ok(!(await readFile(join(folder, 'src/styles/panels.css'), 'utf8')).includes('.shell-data-form'), 'DataForm styles are not example-owned');
  assert.deepEqual((await applyFilePlan((await planExampleRemoval(folder)).plan)).written, [], 'an identical rerun writes nothing');
});
