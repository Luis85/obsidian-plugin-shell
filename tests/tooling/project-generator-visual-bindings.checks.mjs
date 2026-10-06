// Generated source-binding tests are executed in a real generated workspace and must fail when bound data stops reaching the UI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { projectModel } from '../../src/cli/compiler/emitters/model.ts';
import { projectFiles } from '../support/project-render.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
// Resolved through the package manifest so the check also runs where node_modules sits in an ancestor directory.
const vitest = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
const modules = dirname(dirname(vitest));
// Compact project v6 generator fixture (two visual pages, one reusable component, one bound list source).
const fixture = JSON.parse(await readFile(new URL('../fixtures/companion/visual-project.json', import.meta.url), 'utf8'));
const source = (field = '') => ({ kind: 'source', sourceId: 'ds-source-1', operationId: 'ds-operation-6', field });
/** The component library page gains a data table and a badge bound to the same list operation as its bound text. */
function bindingFixture() {
  const d = structuredClone(fixture), store = d.design.visualDesigns, content = store.pages[1].root[0];
  content.children.push(
    { id: 'vn-40', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-table' }, props: { data: source() }, slots: {}, events: [] },
    { id: 'vn-41', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-badge' }, props: { label: source('0.id') }, slots: {}, events: [] });
  store.nextId = 42;
  return d;
}
const bindings = 'tests/project/visual/vp-15-bindings.test.ts', page = 'src/generated/presentation/components/details/vp-15.vue';
test('generated binding tests assert every bound prop, table rows and cells, and text', async () => {
  const test = (await projectFiles(root, projectModel(bindingFixture()))).find(f => f.path === bindings).content;
  for (const id of ['vn-17', 'vn-40', 'vn-41']) assert.match(test, new RegExp(`\\[${id}\\] displays validated source output`));
  assert.match(test, /expect\(bound\(wrapper\.findAllComponents\(\{ name: "Table" \}\), "vn-40", "data"\)\)\.toEqual\(\[\{"id":"fixture","type":"component"/);
  assert.match(test, /expect\(bound\(wrapper\.findAllComponents\(\{ name: "Badge" \}\), "vn-41", "label"\)\)\.toEqual\("fixture"\);/);
  assert.match(test, /findAll\('tbody tr'\)\)\.toHaveLength\(1\);/);
  assert.match(test, /findAll\('tbody tr'\)\[0\]!\.findAll\('td'\)\[1\]!\.text\(\)\)\.toBe\("component"\);/);
  assert.match(test, /expect\(wrapper\.get\("\[data-design-node=\\"vn-17\\"\]"\)\.text\(\)\)\.toBe\(/);
});
test('generated binding tests pass in a generated workspace and fail once bound data no longer reaches the table', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'visual-bindings-')));
  const run = () => spawnSync(process.execPath, [vitest, 'run', '--config', 'configs/testing/vitest.project.config.mjs', bindings], { cwd: dir, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT')) });
  try {
    for (const file of await projectFiles(root, projectModel(bindingFixture()))) {
      await mkdir(dirname(join(dir, file.path)), { recursive: true });
      await writeFile(join(dir, file.path), file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content);
    }
    await symlink(modules, join(dir, 'node_modules'), 'junction');
    const green = run();
    assert.equal(green.status, 0, green.stdout + green.stderr); assert.match(stripVTControlCharacters(green.stdout), /Tests\s+3 passed/);
    const sfc = await readFile(join(dir, page), 'utf8'), unbound = sfc.replace(` v-bind="model.props('vn-40')"`, '');
    assert.notEqual(unbound, sfc); await writeFile(join(dir, page), unbound);
    const red = run();
    assert.notEqual(red.status, 0, red.stdout); const redOutput = stripVTControlCharacters(red.stdout);
    assert.match(redOutput, /\[vn-40\] displays validated source output/); assert.match(redOutput, /Tests\s+1 failed \| 2 passed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
