import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
import { included } from '../../scripts/framework/distribution.ts';
import { maintainerOnly } from '../../scripts/companion/compiler/framework-docs.ts';
import { zip } from '../../scripts/framework/zip.ts';
import { assembleStarterPack } from '../../scripts/starters/operations.ts';
import { loadDefinitions } from '../../scripts/starters/repository.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
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
  for (const path of ['configs/starters/webapp.json', 'docs/concepts/companion/starters/catalog.json', 'docs/concepts/companion/starters/blank.companion.json']) {
    assert.equal(included(path), false); assert.equal(maintainerOnly(path), true);
  }
  assert.equal(included('scripts/starters/starter.schema.json'), true);
});
test('standalone starter ZIP is deterministic and loads after independent extraction', async t => {
  const directory = await temp(t), files = await assembleStarterPack({ root, frameworkRoot: root });
  assert.equal(files.length, 12); assert.ok(files.every(file => /^configs\/starters\/[a-z-]+\.json$/.test(file.path)));
  const first = zip(files), second = zip(await assembleStarterPack({ root, frameworkRoot: root })); assert.deepEqual(first, second);
  await extractArchive(first, directory); const loaded = await loadDefinitions(directory); assert.equal(loaded.length, 12);
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
  const directory = await temp(t), shellRoot = join(directory, 'shell'); await mkdir(shellRoot);
  const files = await assembleKit({ root, frameworkRoot: root }, await compiler());
  assert.ok(!files.some(file => /(?:^|\/)configs\/starters\//.test(file.path) || file.path.includes('/companion/starters/')));
  const archive = zip(files); await extractArchive(archive, shellRoot);
  const cli = args => {
    const result = spawnSync(process.execPath, [join(shellRoot, 'shell.mjs'), ...args, '--json'], { cwd: shellRoot, encoding: 'utf8', timeout: 30000, maxBuffer: 16_000_000 });
    assert.equal(result.stdout.trim().split('\n').length, 1, result.stderr); return { code: result.status, result: JSON.parse(result.stdout) };
  };
  const bare = cli(['starters', 'list']); assert.equal(bare.code, 0, JSON.stringify(bare)); assert.deepEqual(bare.result.data.starters, []);
  const emptyNew = cli(['new', '../missing-product', '--starter', 'blank']); assert.equal(emptyNew.code, 1); assert.equal(emptyNew.result.diagnostics[0].code, 'STARTER_UNKNOWN');
  await extractArchive(zip(await assembleStarterPack({ root, frameworkRoot: root })), shellRoot);
  assert.equal(cli(['new', '--list']).result.data.starters.length, 12);
  assert.equal(cli(['starters', 'schema']).result.data.title, 'Workbench starter definition');
  const created = cli(['new', '../product', '--starter', 'webapp', '--yes']); assert.equal(created.code, 0, JSON.stringify(created));
  assert.equal(JSON.parse(await readFile(join(directory, 'product/package.json'))).name, 'product');
  const executed = cli(['starters', 'run', '--project', '../product', '--process', 'verify,build', '--yes', '--trust-processes']);
  assert.equal(executed.code, 0, JSON.stringify(executed)); assert.ok((await readdir(join(directory, 'product/dist'))).includes('index.html'));
});

test('release attachments are opt-in and cannot create releases or overwrite existing assets', async () => {
  const workflow = await readFile(join(root, '.github/workflows/starter-distribution.yml'), 'utf8');
  assert.match(workflow, /attach_to_existing_release:[\s\S]*?default: false/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.attach_to_existing_release == true/);
  assert.match(workflow, /environment: workbench-release/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /refs\/tags\/\$RELEASE_VERSION\^\{commit\}/);
  assert.match(workflow, /workbench-shell-\$RELEASE_VERSION\.zip/);
  assert.match(workflow, /workbench-starters-\$RELEASE_VERSION\.zip/);
  assert.match(workflow, /sha256sum --check/);
  assert.match(workflow, /gh release upload/);
  assert.doesNotMatch(workflow, /gh release (?:create|edit)|--clobber|pull_request_target/);
  for (const pin of workflow.matchAll(/uses: actions\/[^@]+@([^\s]+)/g)) assert.match(pin[1], /^[a-f0-9]{40}$/);
});
