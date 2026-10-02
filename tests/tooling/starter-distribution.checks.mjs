import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { assembleKit, installedCompiler } from '../../bin/adapters/framework/kit.ts';
import { included } from '../../bin/adapters/framework/distribution.ts';
import { maintainerOnly } from '../../scripts/companion/compiler/framework-docs.ts';
import { zip } from '../../bin/adapters/framework/zip.ts';
import { inspectWorkflow } from '../../scripts/quality/check-repository.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
import { assembleStarterPack } from '../../scripts/starters/operations.ts';
import { loadDefinitions } from '../../scripts/starters/repository.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { extractArchive } from './framework-archive-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
async function temp(t) { const path = await realpath(await mkdtemp(join(tmpdir(), 'starter-distribution-'))); t.after(() => rm(path, { recursive: true, force: true })); return path; }
/** CI uses the locked workspace TypeScript. Dependency-free local archive smoke is explicitly NOT typechecking. */
async function compiler() {
  try { return await installedCompiler(); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    return { version: 'node-strip-types-local-smoke-not-qualified', compile(source, fileName) {
      return stripTypeScriptTypes(source, { mode: 'transform', sourceUrl: fileName }).replace(/\.ts(['"])/g, '.js$1');
    } };
  }
}
test('distribution boundaries exclude canonical and legacy definitions from shell and generated framework copies', () => {
  for (const path of ['configs/starters/webapp.json', 'docs/concepts/companion/companion-project.json', 'docs/concepts/companion/seeds/visual-self-project.json', 'docs/concepts/companion/starters/catalog.json', 'docs/concepts/companion/starters/blank.companion.json']) {
    assert.equal(included(path), false); assert.equal(maintainerOnly(path), true);
  }
  assert.equal(included('scripts/starters/starter.schema.json'), true);
  assert.equal(included('docs/concepts/companion/vendor/vue-flow-core.iife.js'), true);
  assert.equal(included('docs/concepts/companion/vendor/vue.runtime.global.prod.js'), false);
});
test('standalone starter ZIP is deterministic and loads after independent extraction', async t => {
  const directory = await temp(t), files = await assembleStarterPack({ root, frameworkRoot: root });
  assert.equal(files.length, 26); assert.ok(files.every(file => /^configs\/starters\/[a-z-]+\.json$/.test(file.path)));
  const first = zip(files), second = zip(await assembleStarterPack({ root, frameworkRoot: root })); assert.deepEqual(first, second);
  await extractArchive(first, directory); const loaded = await loadDefinitions(directory, []); assert.equal(loaded.length, 26);
  for (const entry of loaded) assert.deepEqual(entry.bytes, files.find(file => file.path === entry.file).bytes);
});
test('pack preview is read-only and publishing/overwriting archives is never implicit', async t => {
  const directory = await temp(t), context = { root, frameworkRoot: root }, request = { command: 'starters pack', args: [], options: { out: join(directory, 'starters.zip') } };
  assert.equal((await executeOperation(request, context)).status, 'planned'); assert.deepEqual(await readdir(directory), []);
  const result = await executeOperation({ ...request, options: { ...request.options, yes: true } }, context);
  assert.equal(result.status, 'applied'); assert.equal(result.data.publication, 'not-authorized');
  await writeFile(join(directory, 'starters.zip'), 'user archive');
  const refused = await executeOperation({ ...request, options: { ...request.options, yes: true } }, context);
  assert.equal(refused.diagnostics[0].code, 'STARTER_ARCHIVE_EXISTS'); assert.equal(await readFile(join(directory, 'starters.zip'), 'utf8'), 'user archive');
});
test('extracted compiled shell contains no starter data; a separate pack enables discovery and generation', async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples removed; kit packing requires the reviewed framework source preimages.'); return; }
  const directory = await temp(t), shellRoot = join(directory, 'shell'); await mkdir(shellRoot);
  const files = await assembleKit({ root, frameworkRoot: root }, await compiler());
  assert.ok(!files.some(file => /(?:^|\/)configs\/starters\//.test(file.path) || file.path.includes('/companion/starters/')));
  assert.ok(!files.some(file => file.path.endsWith('/companion/companion-project.json') || file.path.includes('/companion/seeds/')));
  for (const asset of ['vue-flow-core.iife.js', 'vue-flow.scoped.css', 'packages.json', 'vue-flow-core-LICENSE.txt', 'd3-NOTICE.txt', 'vueuse-NOTICE.txt']) assert.ok(files.some(file => file.path === 'bin/template/docs/concepts/companion/vendor/' + asset), asset);
  const archive = zip(files); await extractArchive(archive, shellRoot);
  const cli = args => {
    const result = spawnSync(process.execPath, [join(shellRoot, 'bin/app'), ...args, '--json'], { cwd: shellRoot, encoding: 'utf8', timeout: 90000, maxBuffer: 16_000_000 });
    assert.equal(result.stdout.trim().split('\n').length, 1, result.stderr); return { code: result.status, result: JSON.parse(result.stdout) };
  };
  const bare = cli(['starters', 'list']); assert.equal(bare.code, 0, JSON.stringify(bare)); assert.deepEqual(bare.result.data.starters, []);
  const emptyNew = cli(['new', '../missing-product', '--starter', 'blank']); assert.equal(emptyNew.code, 1); assert.equal(emptyNew.result.diagnostics[0].code, 'STARTER_UNKNOWN');
  await extractArchive(zip(await assembleStarterPack({ root, frameworkRoot: root })), shellRoot);
  assert.equal(cli(['new', '--list']).result.data.starters.length, 26);
  const direct = cli(['new', '../direct-project', '--starter', 'plugin-angular']); assert.equal(direct.code, 1); assert.equal(direct.result.diagnostics[0].code, 'STARTER_KIND');
  const guided = cli(['new', 'guide', '--starter', 'plugin-angular']); assert.equal(guided.code, 0, JSON.stringify(guided)); assert.equal(guided.result.data.selection.framework, 'angular');
  assert.equal(cli(['starters', 'schema']).result.data.title, 'Workbench starter definition');
  const model = cli(['starters', 'coverage', 'feature-showcase', '--require-model-coverage']);
  assert.equal(model.code, 0, JSON.stringify(model)); assert.equal(model.result.data.modeled.complete, true);
  const showcase = cli(['new', '../showcase', '--starter', 'feature-showcase', '--yes']);
  assert.equal(showcase.code, 0, JSON.stringify(showcase));
  assert.ok((await readFile(join(directory, 'showcase/src/generated/presentation/composables/use-visual.ts'), 'utf8')).includes('readJsonControl'));
  assert.ok((await readFile(join(directory, 'showcase/docs/concepts/companion/vendor/vue-flow-core.iife.js'))).length > 1000);
  const created = cli(['new', '../product', '--starter', 'webapp', '--yes']); assert.equal(created.code, 0, JSON.stringify(created));
  assert.equal(JSON.parse(await readFile(join(directory, 'product/package.json'))).name, 'product');
  const executed = cli(['starters', 'run', '--project', '../product', '--process', 'verify,build', '--yes', '--trust-processes']);
  assert.equal(executed.code, 0, JSON.stringify(executed)); assert.ok((await readdir(join(directory, 'product/dist'))).includes('index.html'));
});

test('distribution workflow is read-only: it builds separate assets and never publishes', async () => {
  const workflow = await readFile(join(root, '.github/workflows/starter-distribution.yml'), 'utf8');
  assert.doesNotThrow(() => inspectWorkflow(workflow));
  assert.doesNotMatch(workflow, /contents:\s*write|gh release|--clobber|pull_request_target|environment:/);
  assert.match(workflow, /workbench-shell-\$RELEASE_VERSION\.zip/);
  assert.match(workflow, /workbench-starters-\$RELEASE_VERSION\.zip/);
  assert.match(workflow, /workbench-SHA256SUMS/);
  assert.match(workflow, /publication: 'separate-explicit-approval'/);
  for (const pin of workflow.matchAll(/uses: actions\/[^@]+@([^\s]+)/g)) assert.match(pin[1], /^[a-f0-9]{40}$/);
  // The gate that enforces this also rejects a write-scoped job, so re-adding an attach job fails twice.
  assert.throws(() => inspectWorkflow(workflow + '  attach:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - run: echo\n'), /WORKFLOW_PERMISSIONS_NOT_READ_ONLY/);
});
