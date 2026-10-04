import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { discoverProjectConfig, overlapsProjectConfig, projectConfigId, projectConfigPath, projectConfigPattern } from '../../bin/compiler/domain/project-config.ts';
import { savedProjectConfig, locateProjectConfig, projectConfigFiles } from '../../bin/adapters/project-selection.ts';
import { projectStarter } from '../../bin/adapters/projects.ts';
import { projectSetupPlan } from '../../bin/adapters/project-setup.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { readSettings } from '../../bin/domain/user-settings.ts';
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const { selection: cli } = await projectStarter(frameworkRoot, 'cli');
const json = value => JSON.stringify(value, null, 2) + '\n';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'project-config-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root, path, content) {
  await mkdir(join(root, path, '..'), { recursive: true }); await writeFile(join(root, path), content);
}
const code = expected => error => error.code === expected && /\S/.test(error.message);
test('one domain rule names, recognises and discovers configs/<project-id>-config.json', () => {
  assert.equal(projectConfigPath('issue-desk'), 'configs/issue-desk-config.json');
  assert.equal(projectConfigPattern, 'configs/<project-id>-config.json');
  for (const id of ['Issue', '1desk', 'desk-', 'a'.repeat(61), '', '../x']) assert.throws(() => projectConfigPath(id), /portable project ID/);
  assert.equal(projectConfigId('configs/app-config-config.json'), 'app-config');
  for (const path of ['configs/starters/a-config.json', 'project.config.json', 'configs/Issue-config.json', 'other/a-config.json']) assert.equal(projectConfigId(path), undefined, path);
  assert.ok(overlapsProjectConfig('configs') && overlapsProjectConfig('Configs/Desk-config.json/notes'));
  assert.ok(!overlapsProjectConfig('configs/prds') && !overlapsProjectConfig('docs/configs'));
  const names = ['starters', 'types', 'quality', 'user-settings.json', 'project-setup.json'];
  assert.deepEqual(discoverProjectConfig({ names, retired: false }), { kind: 'none' });
  assert.deepEqual(discoverProjectConfig({ names, retired: true }), { kind: 'retired', path: 'project.config.json' });
  assert.deepEqual(discoverProjectConfig({ names: [...names, 'desk-config.json'], retired: true }), { kind: 'found', path: 'configs/desk-config.json' });
  assert.deepEqual(discoverProjectConfig({ names: ['b-config.json', 'a-config.json'], retired: false }), { kind: 'ambiguous', candidates: ['configs/a-config.json', 'configs/b-config.json'] });
  assert.deepEqual(discoverProjectConfig({ names: ['Desk-config.json'], retired: false }), { kind: 'invalid', path: 'configs/Desk-config.json' });
  assert.deepEqual(discoverProjectConfig({ names: ['a-config.json', 'b-config.json'], retired: false, explicit: 'configs/b-config.json' }), { kind: 'found', path: 'configs/b-config.json' });
  assert.deepEqual(discoverProjectConfig({ names: [], retired: false, explicit: 'configs/c-config.json' }), { kind: 'missing', path: 'configs/c-config.json' });
  assert.deepEqual(discoverProjectConfig({ names: [], retired: false, explicit: 'configs/types/c-config.json' }), { kind: 'invalid', path: 'configs/types/c-config.json' });
});
test('discovery reads the single top-level configuration, ignores subfolders and never falls back to the retired root file', async () => scratch(async root => {
  assert.equal(await savedProjectConfig(root), undefined);
  await put(root, 'configs/starters/x-config.json', json(cli)); await put(root, 'configs/types/y-config.json', '{}');
  assert.equal(await savedProjectConfig(root), undefined, 'subfolders such as starters/ and types/ are never searched');
  await put(root, 'project.config.json', json(cli));
  await assert.rejects(() => savedProjectConfig(root), error => code('PROJECT_CONFIG_RELOCATED')(error) && /configs\/<project-id>-config\.json/.test(error.message) && /settings migrate/.test(error.message));
  await put(root, 'configs/desk-config.json', json(cli));
  assert.deepEqual(await savedProjectConfig(root), { path: 'configs/desk-config.json', selection: cli });
  await put(root, 'configs/board-config.json', json(cli));
  await assert.rejects(() => locateProjectConfig(root), error => code('PROJECT_CONFIG_AMBIGUOUS')(error)
    && error.message.includes('configs/board-config.json, configs/desk-config.json') && error.message.includes('--config <path>'));
  assert.deepEqual(await projectConfigFiles(root), ['configs/board-config.json', 'configs/desk-config.json']);
  assert.equal((await savedProjectConfig(root, 'configs/board-config.json')).path, 'configs/board-config.json');
  await assert.rejects(() => savedProjectConfig(root, 'configs/other-config.json'), code('PROJECT_CONFIG_MISSING'));
  await assert.rejects(() => savedProjectConfig(root, 'project.config.json'), code('PROJECT_CONFIG_INVALID'));
  await put(root, 'configs/Upper-config.json', '{}');
  await assert.rejects(() => locateProjectConfig(root), code('PROJECT_CONFIG_INVALID'));
}));
test('linked configuration folders and files are refused, never followed', async () => scratch(async root => {
  await put(root, 'outside/desk-config.json', json(cli));
  await symlink(join(root, 'outside'), join(root, 'configs'));
  await assert.rejects(() => savedProjectConfig(root), /PLAN_SYMLINK: configs\//);
  await rm(join(root, 'configs'));
  await mkdir(join(root, 'configs')); await symlink(join(root, 'outside/desk-config.json'), join(root, 'configs/desk-config.json'));
  await assert.rejects(() => savedProjectConfig(root), /PLAN_SYMLINK: configs\/desk-config\.json/);
}));
test('sketch generation reads the discovered configuration and --config chooses among several', async () => scratch(async root => {
  await put(root, 'design/project.json', documentText(runOperations(newDocument('CLI'), [{ op: 'page.add', title: 'Commands' }]).document));
  await put(root, 'configs/cli-config.json', json(cli)); await put(root, 'configs/second-config.json', json(cli));
  const context = config => ({ root, frameworkRoot, input: Readable.from([]), ...(config ? { config } : {}) });
  await assert.rejects(() => execute(parseArguments(['sketch', 'generate', '--out', 'code']), context()), code('PROJECT_CONFIG_AMBIGUOUS'));
  const plan = await execute(parseArguments(['sketch', 'generate', '--out', 'code', '--config', 'configs/cli-config.json']), context('configs/cli-config.json'));
  assert.equal(plan.outputKind, 'project');
  assert.ok(plan.changes.some(item => item.path === 'code/configs/cli-config.json'));
  assert.ok(!plan.changes.some(item => item.path.endsWith('project.config.json')));
  const child = spawnSync(process.execPath, [join(frameworkRoot, 'bin/app'), 'sketch', 'generate', '--root', root, '--out', 'code', '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(child.status, 1); assert.equal(JSON.parse(child.stdout).diagnostics[0].code, 'PROJECT_CONFIG_AMBIGUOUS');
  const chosen = spawnSync(process.execPath, [join(frameworkRoot, 'bin/app'), 'sketch', 'generate', '--root', root, '--out', 'code', '--config', 'configs/cli-config.json', '--json'], { encoding: 'utf8', timeout: 60000 });
  assert.equal(chosen.status, 0, chosen.stdout + chosen.stderr); assert.equal(JSON.parse(chosen.stdout).data.status, 'planned');
  for (const [args, expected] of [[['project-setup', 'status'], 'SETUP_OPTION'], [['first-run', 'status'], 'FIRST_RUN_OPTION'], [['new', 'starters'], 'PROJECT_OPTION']])
    await assert.rejects(() => execute(parseArguments([...args, '--config', 'configs/cli-config.json']), context('configs/cli-config.json')), code(expected), args[0] + ' does not read a saved project configuration');
}));
async function vault(root) {
  assert.equal(spawnSync('git', ['init', root]).status, 0);
  await mkdir(join(root, '.obsidian')); await put(root, 'docs/prds/one.md', '---\ntype: prd\nid: PRD-1\n---\nOriginal.\n');
}
const setupRequest = { schemaVersion: 1, project: { name: 'Field desk', description: 'Keep it.', product: 'Portable.' }, prds: { mode: 'scan' }, prototypeInterview: null, operations: [], boilerplate: false };
test('setup writes configs/<project-id>-config.json and refuses a folder already configured for another project', async () => scratch(async root => {
  await vault(root);
  const plan = await projectSetupPlan({ root, frameworkRoot }, setupRequest);
  assert.ok(plan.plan.changes.some(change => change.path === 'configs/field-desk-config.json' && change.status === 'create'));
  await put(root, 'configs/other-config.json', json(cli));
  await assert.rejects(() => applyPrepared(plan, plan.planHash), code('PROJECT_CONFIG_CONFLICT'));
  await assert.rejects(readFile(join(root, 'configs/field-desk-config.json')), 'nothing is written after the late conflict');
  await assert.rejects(() => projectSetupPlan({ root, frameworkRoot }, setupRequest), code('PROJECT_CONFIG_CONFLICT'));
  await rm(join(root, 'configs/other-config.json'));
  const fresh = await projectSetupPlan({ root, frameworkRoot }, setupRequest);
  assert.equal((await applyPrepared(fresh, fresh.planHash)).status, 'applied');
  assert.equal((await savedProjectConfig(root)).path, 'configs/field-desk-config.json');
  assert.equal((await savedProjectConfig(root)).selection.starter.id, 'webapp-angular');
}));
test('settings migrate moves a retired root project.config.json through a reviewed, hash-guarded plan', async () => scratch(async root => {
  await vault(root);
  const setup = await projectSetupPlan({ root, frameworkRoot }, setupRequest); await applyPrepared(setup, setup.planHash);
  const bytes = await readFile(join(root, 'configs/field-desk-config.json'));
  await rm(join(root, 'configs/field-desk-config.json')); await writeFile(join(root, 'project.config.json'), bytes);
  await assert.rejects(() => savedProjectConfig(root), code('PROJECT_CONFIG_RELOCATED'));
  await assert.rejects(() => settingsMigrationPlan(root, { schemaVersion: 1, paths: { prds: 'requirements' } }), code('MIGRATION_ORDER'));
  const plan = await settingsMigrationPlan(root, { schemaVersion: 1 });
  assert.deepEqual(plan.plan.changes.map(({ path, status }) => [path, status]), [['configs/field-desk-config.json', 'create'], ['project.config.json', 'delete']]);
  assert.equal((await applyPrepared(plan)).status, 'planned');
  assert.deepEqual(await readFile(join(root, 'project.config.json')), bytes, 'preview writes nothing');
  await writeFile(join(root, 'project.config.json'), Buffer.concat([bytes, Buffer.from('\n')]));
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /changed/);
  await writeFile(join(root, 'project.config.json'), bytes);
  const fresh = await settingsMigrationPlan(root, { schemaVersion: 1 });
  assert.equal((await applyPrepared(fresh, fresh.planHash)).status, 'applied');
  assert.deepEqual(await readFile(join(root, 'configs/field-desk-config.json')), bytes, 'bytes move unchanged');
  assert.ok(!(await readdir(root)).includes('project.config.json'));
  assert.equal((await savedProjectConfig(root)).path, 'configs/field-desk-config.json');
  await assert.rejects(() => settingsMigrationPlan(root, { schemaVersion: 1 }), code('MIGRATION_EMPTY'));
  await writeFile(join(root, 'project.config.json'), bytes);
  await assert.rejects(() => settingsMigrationPlan(root, { schemaVersion: 1 }), code('MIGRATION_CONFLICT'));
}));
test('configured project paths stay outside configs/, which holds every project configuration', () => {
  for (const paths of [{ prds: 'configs/prds' }, { project: 'configs/desk-config.json' }, { design: 'Configs/design' }])
    assert.throws(() => readSettings({ schemaVersion: 1, paths }), code('SETTINGS_OVERLAP'));
  assert.equal(readSettings({ schemaVersion: 1, paths: { prds: 'docs/configs' } }).paths.prds, 'docs/configs');
});
