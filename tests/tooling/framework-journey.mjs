/** Explicit CI qualification of the assembled ZIP. This never publishes or activates a plugin. */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extractArchive } from './framework-archive-fixture.mjs';
const repository = process.cwd(), npm = process.env.QUALIFIED_NPM;
assert.ok(npm, 'Explicit qualified npm is required; no global installation.');
const evidence = join(repository, 'reports/framework-cli'); await mkdir(evidence, { recursive: true });
const checks = [], targets = [];
function run(name, cwd, entry, args, { allowBlocked = false } = {}) {
  const output = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', timeout: 900000, maxBuffer: 16_000_000 });
  checks.push({ name, exitCode: output.status, error: output.error?.message, scope: allowBlocked ? 'expected readiness refusal' : 'executed' });
  return { output, persist: async () => {
    await writeFile(join(evidence, name + '.log'), (output.stdout ?? '') + (output.stderr ?? ''));
    await writeFile(join(evidence, 'checks.json'), JSON.stringify(checks, null, 2));
    assert.ifError(output.error); assert.equal(output.status, allowBlocked ? 1 : 0, output.stdout + output.stderr);
    return JSON.parse(output.stdout);
  } };
}
const archive = join(evidence, 'plugin-framework.zip');
await run('pack', repository, join(repository, 'app.mjs'), ['framework', 'pack', '--out', archive, '--yes', '--json']).persist();
const bytes = await readFile(archive), archiveHash = createHash('sha256').update(bytes).digest('hex');
const full = JSON.parse(await readFile(join(repository, 'docs/concepts/companion/companion-project.json'), 'utf8'));
for (const [id, paths] of [['field-notes', {codebaseFolder: 'app/source', testsFolder: 'spec'}], ['task-board', {codebaseFolder: 'src', testsFolder: 'tests'}]]) {
  const target = await realpath(await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), id + '-kit-'))); targets.push(target);
  await extractArchive(bytes, target);
  const invoke = async (stage, args, options) => run(id + '-' + stage, target, join(target, 'app.mjs'), [...args, '--json', '--no-interaction'], options).persist();
  await invoke('bootstrap', ['capabilities']);
  const design = structuredClone(full); design.project = { id, name: id === 'field-notes' ? 'Field Notes' : 'Task Board', author: 'Qualification fixture', version: '0.1.0', description: 'Independent archive consumer' }; design.settings = paths;
  if (id === 'task-board') {
    // A structurally different bounded design, not merely a renamed self-project.
    design.design.nodes = [design.design.nodes[0]]; const node = design.design.nodes[0];
    node.parent = null; node.components = []; node.slug = 'tasks'; node.label = 'Tasks';
    design.design.links = []; design.design.library = []; node.bricks = [];
    design.design.prds = []; design.design.storymaps = {schema: 1, nextId: 1, maps: []};
    delete design.design.visualDesigns;
    design.design.dataSources = {schema: 1, nextId: 1, sources: [], flows: []};
    design.design.semantic = { entities: [{id: 'tasks', slug: 'task', name: 'Task', folder: 'Tasks', properties: [{key:'title', type:'text', required:true}, {key:'done', type:'checkbox', required:true}]}], relationships: [] };
  }
  await writeFile(join(target, 'input.json'), JSON.stringify(design));
  await invoke('setup', ['setup', '--input', 'input.json', '--yes']);
  await invoke('generate', ['generate', '--yes']);
  const lock = JSON.parse(await readFile(join(target, 'package-lock.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(lock.packages[''].name, pkg.name); assert.deepEqual(lock.packages[''].bin, pkg.bin);
  await invoke('install', ['install', '--yes', '--timeout', '900000']);
  await invoke('build', ['build']);
  await invoke('project-verification', ['verify', '--profile', 'project']);
  await invoke('vault', ['vault', 'prepare', '--yes']);
  await invoke('plugin-install', ['plugin', 'install', '--yes']);
  await invoke('regenerate', ['generate', '--yes']);
  await invoke('release-readiness', ['release', 'check'], { allowBlocked: true });
  await writeFile(join(evidence, 'targets.json'), JSON.stringify(targets, null, 2));
}
// Exercise a published data-only starter as well as the two JSON-import journeys.
// The generated consumer must install from its *unchanged* shipped lockfile;
// npm install --package-lock-only is not an acceptable qualification workaround.
const starterFixture = await realpath(await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'blank-starter-kit-')));
const starterKit = join(starterFixture, 'framework'), starterConsumer = join(starterFixture, 'blank-consumer');
await mkdir(starterKit);
await extractArchive(bytes, starterKit);
assert.equal((await (await import('node:fs/promises')).readdir(starterKit)).includes('node_modules'), false, 'extracted kit starts without installed packages');
const starterApp = join(starterKit, 'bin/app');
await run('blank-starter-discovery', starterKit, starterApp, ['new', '--list', '--json', '--no-interaction']).persist();
const starter = await run('blank-starter-new', starterKit, starterApp,
  ['new', starterConsumer, '--starter', 'blank', '--id', 'blank-consumer', '--name', 'Blank Consumer',
    '--author', 'Qualification fixture', '--yes', '--json', '--no-interaction']).persist();
assert.equal(starter.status, 'applied', 'blank starter must be generated through the shipped CLI');
const starterPkg = JSON.parse(await readFile(join(starterConsumer, 'package.json'), 'utf8'));
const starterLockBytes = await readFile(join(starterConsumer, 'package-lock.json'));
const starterLock = JSON.parse(starterLockBytes);
assert.equal(starterLock.packages?.['']?.name, starterPkg.name, 'generated lockfile root must match starter identity');
for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const [name, pin] of Object.entries(starterPkg[group] ?? {})) {
    assert.match(pin, /^\d+\.\d+\.\d+$/, group + ': non-exact ' + name);
    assert.equal(starterLock.packages?.['']?.[group]?.[name], pin, group + ': stale root lockfile declaration for ' + name);
    assert.equal(starterLock.packages?.['node_modules/' + name]?.version, pin, group + ': stale installed lockfile entry for ' + name);
  }
}
assert.equal((await (await import('node:fs/promises')).readdir(starterConsumer)).includes('node_modules'), false,
  'starter must not install dependencies before explicit npm approval');
const pinCheck = spawnSync(process.execPath, [join(starterConsumer, 'scripts/security/dependency-pins.mjs')], {
  cwd: starterConsumer, encoding: 'utf8', timeout: 30000, maxBuffer: 4_000_000,
});
checks.push({ name: 'blank-starter-dependency-pins', exitCode: pinCheck.status, error: pinCheck.error?.message, scope: 'offline release dependency gate before install' });
await writeFile(join(evidence, 'blank-starter-dependency-pins.log'), (pinCheck.stdout ?? '') + (pinCheck.stderr ?? ''));
await writeFile(join(evidence, 'checks.json'), JSON.stringify(checks, null, 2));
assert.ifError(pinCheck.error); assert.equal(pinCheck.status, 0, pinCheck.stderr);
const pinReceipt = JSON.parse(pinCheck.stdout);
assert.equal(pinReceipt.policy, 'exact-npm-pins-v1'); assert.equal(pinReceipt.manifests[0].path, 'package.json');
assert.equal(pinReceipt.lockfile.hash, (await import('node:crypto')).createHash('sha256').update(starterLockBytes).digest('hex'));
async function qualifiedNpm(stage, args, scope) {
  const output = spawnSync(process.execPath, [npm, ...args], {
    cwd: starterConsumer, encoding: 'utf8', timeout: 900000, maxBuffer: 16_000_000,
  });
  checks.push({ name: stage, exitCode: output.status, error: output.error?.message, scope });
  await writeFile(join(evidence, stage + '.log'), (output.stdout ?? '') + (output.stderr ?? ''));
  await writeFile(join(evidence, 'checks.json'), JSON.stringify(checks, null, 2));
  assert.ifError(output.error);
  assert.equal(output.status, 0, stage + ' failed: ' + output.stdout + output.stderr);
  assert.deepEqual(await readFile(join(starterConsumer, 'package-lock.json')), starterLockBytes, stage + ' must not rewrite shipped lockfile');
}
await qualifiedNpm('blank-starter-npm-install', ['install', '--no-audit', '--no-fund'], 'shipped lockfile ordinary install');
await rm(join(starterConsumer, 'node_modules'), { recursive: true, force: true });
await qualifiedNpm('blank-starter-npm-ci', ['ci', '--no-audit', '--no-fund'], 'shipped lockfile clean install');
targets.push(starterConsumer);
await writeFile(join(evidence, 'targets.json'), JSON.stringify(targets, null, 2));
await writeFile(join(evidence, 'summary.json'), JSON.stringify({ status: 'archive-project-journey-qualified', archiveHash, consumers: targets.length,
  platform: process.platform, node: process.version, native: 'not-run', publication: 'not-run', acceptance: 'generated scaffold contracts only; PRD requirements remain obligations' }, null, 2));
console.log(JSON.stringify({ archiveHash, evidence, targets }));
