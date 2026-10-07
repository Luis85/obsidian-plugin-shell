import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../adapters/framework/operations.ts';
import { parseCliArguments } from '../adapters/framework/catalog.ts';
import { planOperation } from '../adapters/framework/planning.ts';
import { status } from '../adapters/framework/inspection.ts';
import { parseAzureVersion } from '../adapters/framework/hosting-cli.ts';
import { hash } from '../adapters/framework/files.ts';
import { starterDocumentText } from '#shared/testing/starter-documents.mjs';
const frameworkRoot = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const azure = ['--azure-organization', 'https://dev.azure.com/contoso', '--azure-project', 'Demo'];
/** A folder set up from quick-capture JSON: design, intake receipt and configuration, no generated files yet. */
async function project(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hosting-command-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'input.json'), starterDocumentText('quick-capture'));
  const context = { root, frameworkRoot };
  assert.equal((await run(context, ['setup', '--input', 'input.json', '--yes'])).status, 'applied');
  return context;
}
const run = (context, argv) => executeOperation(parseCliArguments(argv), context);
const read = (context, path) => readFile(join(context.root, path), 'utf8');
const design = async context => JSON.parse(await read(context, 'design/project.json'));

test('hosting show reads the platform without writes; hosting set previews, then applies only the reviewed plan', async t => {
  const context = await project(t);
  const shown = await run(context, ['hosting', 'show']);
  assert.equal(shown.status, 'ok'); assert.equal(shown.data.platform, 'github'); assert.equal(shown.data.hosting, null);
  assert.equal(shown.data.originPlatform, null); assert.equal(shown.data.remote, 'not-contacted');
  const intakeBefore = await read(context, '.framework/intake.json');
  const preview = await run(context, ['hosting', 'set', 'azure-devops', ...azure, '--dry-run']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview.diagnostics));
  assert.deepEqual(preview.data.changes.map(change => [change.path, change.status]),
    [['design/project.json', 'update'], ['.azuredevops/pull_request_template.md', 'create'], ['azure-pipelines.yml', 'create'], ['.framework/intake.json', 'update']]);
  assert.equal(await read(context, '.framework/intake.json'), intakeBefore);
  await assert.rejects(read(context, 'azure-pipelines.yml'), { code: 'ENOENT' });
  const applied = await run(context, ['hosting', 'set', 'azure-devops', ...azure, '--apply', preview.data.planHash]);
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  assert.deepEqual((await design(context)).tooling.hosting, { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Demo' } });
  assert.equal(JSON.parse(await read(context, '.framework/intake.json')).files['design/project.json'], hash(await read(context, 'design/project.json')));
  assert.equal((await run(context, ['hosting', 'show'])).data.remoteUrl, 'https://dev.azure.com/contoso/Demo/_git/Demo');
  const again = await run(context, ['hosting', 'set', 'azure-devops', '--yes']);
  assert.equal(again.status, 'unchanged', JSON.stringify(again.diagnostics));
});

test('hosting set creates platform files byte-identical to generation and never replaces or deletes existing ones', async t => {
  const context = await project(t);
  const planned = await planOperation(parseCliArguments(['hosting', 'set', 'azure-devops', ...azure]), context);
  const created = new Map(planned.plan.changes.map(change => [change.path, change.content]));
  const target = join(context.root, 'compare');
  const generated = await planOperation(parseCliArguments(['new', target, '--starter', 'quick-capture', '--hosting', 'azure-devops', ...azure]), { root: frameworkRoot, frameworkRoot });
  const emitted = new Map(generated.plan.changes.map(change => [change.path.slice(generated.summary.target.length + 1), change.content]));
  for (const path of ['azure-pipelines.yml', '.azuredevops/pull_request_template.md']) assert.equal(created.get(path), emitted.get(path), path);
  await writeFile(join(context.root, 'azure-pipelines.yml'), '# team pipeline\n');
  await mkdir(join(context.root, '.github/workflows'), { recursive: true });
  await writeFile(join(context.root, '.github/workflows/ci.yml'), 'name: CI\n');
  const applied = await run(context, ['hosting', 'set', 'azure-devops', ...azure, '--yes']);
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  assert.deepEqual(applied.data.summary.preserved, ['azure-pipelines.yml']); assert.deepEqual(applied.data.summary.created, ['.azuredevops/pull_request_template.md']);
  assert.deepEqual(applied.data.summary.retired, [{ path: '.github/workflows/ci.yml', state: 'not-generated' }]);
  assert.match(applied.data.summary.deletion, /^none/);
  assert.equal(await read(context, 'azure-pipelines.yml'), '# team pipeline\n'); assert.equal(await read(context, '.github/workflows/ci.yml'), 'name: CI\n');
  const back = await run(context, ['hosting', 'set', 'none', '--yes']);
  assert.equal(back.status, 'applied', JSON.stringify(back.diagnostics));
  assert.deepEqual((await design(context)).tooling.hosting, { platform: 'none' });
  assert.deepEqual(back.data.summary.retired.map(item => item.path), ['.azuredevops/pull_request_template.md', 'azure-pipelines.yml']);
  assert.equal(await read(context, 'azure-pipelines.yml'), '# team pipeline\n');
  assert.match(await read(context, 'docs/project-tasks/CHANGE-SUMMARY.md'), /\S/);
});

test('hosting set refuses misuse and an edited design before planning any write', async t => {
  const context = await project(t);
  const code = async argv => (await run(context, argv)).diagnostics[0]?.code;
  assert.equal(await code(['hosting', 'set']), 'HOSTING_OPTION_PLATFORM');
  assert.equal(await code(['hosting', 'set', 'gitlab']), 'HOSTING_OPTION_PLATFORM');
  assert.equal(await code(['hosting', 'set', 'github', ...azure]), 'HOSTING_OPTION_CONFLICT');
  assert.equal(await code(['hosting', 'set', 'azure-devops', '--azure-project', 'Demo']), 'HOSTING_OPTION_INCOMPLETE');
  assert.equal(await code(['hosting', 'set', 'azure-devops', '--azure-organization', 'https://dev.azure.com/contoso', '--azure-project', 'a/b']), 'COMPANION_TOOLING_INVALID');
  assert.throws(() => parseCliArguments(['hosting', 'set', 'azure-devops', '--token', 'x']), { code: 'INVALID_OPTION' });
  const edited = { ...(await design(context)), notes: [] };
  await writeFile(join(context.root, 'design/project.json'), JSON.stringify(edited, null, 2) + '\n');
  assert.equal(await code(['hosting', 'set', 'none', '--dry-run']), 'HOSTING_OWNERSHIP');
  await assert.rejects(read(context, 'docs/project-tasks/CHANGE-SUMMARY.md'), { code: 'ENOENT' });
});

test('doctor reports the platform and probes az only for an Azure DevOps project, never installing anything', async t => {
  const context = await project(t);
  const never = async () => assert.fail('GitHub projects and plain status never probe az');
  assert.deepEqual((await status(context, 'doctor', never)).data.hosting, { platform: 'github', configured: false });
  assert.equal((await run(context, ['hosting', 'set', 'azure-devops', ...azure, '--yes'])).status, 'applied');
  assert.deepEqual((await status(context, 'status', never)).data.hosting, { platform: 'azure-devops', configured: true });
  const codes = async cli => (await status(context, 'doctor', async () => cli)).diagnostics.map(item => item.code).filter(code => code.startsWith('AZURE'));
  assert.deepEqual(await codes({ available: false, version: null, devopsExtension: null }), ['AZURE_CLI_MISSING']);
  assert.deepEqual(await codes({ available: true, version: '2.70.0', devopsExtension: null }), ['AZURE_DEVOPS_EXTENSION_MISSING']);
  const ready = await status(context, 'doctor', async () => ({ available: true, version: '2.70.0', devopsExtension: '1.0.1' }));
  assert.deepEqual(ready.data.hosting.azureCli, { available: true, version: '2.70.0', devopsExtension: '1.0.1' });
  assert.ok(ready.diagnostics.every(item => !item.code.startsWith('AZURE')));
  const missing = (await status(context, 'doctor', async () => ({ available: false, version: null, devopsExtension: null }))).diagnostics.at(-1);
  assert.match(missing.next, /az extension add --name azure-devops/);
});

test('the az version probe parses only well-formed output and reads anything else as unavailable', () => {
  assert.deepEqual(parseAzureVersion('{"azure-cli": "2.70.0", "azure-cli-core": "2.70.0", "extensions": {"azure-devops": "1.0.1"}}'),
    { available: true, version: '2.70.0', devopsExtension: '1.0.1' });
  assert.deepEqual(parseAzureVersion('{"azure-cli": "2.70.0", "extensions": {}}'), { available: true, version: '2.70.0', devopsExtension: null });
  for (const output of ['', 'not json', '[]', 'null', '{"azure-cli": 2}']) assert.deepEqual(parseAzureVersion(output), { available: false, version: null, devopsExtension: null });
});

test('in a project created by new, hosting set re-owns the generation receipt and classifies the retired GitHub files', async t => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'hosting-generated-')));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const created = await run({ root: frameworkRoot, frameworkRoot }, ['new', join(parent, 'gh-demo'), '--starter', 'quick-capture', '--yes', '--no-git']);
  assert.equal(created.status, 'applied', JSON.stringify(created.diagnostics));
  const context = { root: join(parent, 'gh-demo'), frameworkRoot };
  await writeFile(join(context.root, '.github/pull_request_template.md'), '## Our own template\n');
  const applied = await run(context, ['hosting', 'set', 'azure-devops', ...azure, '--yes']);
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  const states = Object.fromEntries(applied.data.summary.retired.map(item => [item.path, item.state]));
  assert.equal(states['.github/pull_request_template.md'], 'edited'); assert.equal(states['.github/workflows/ci.yml'], 'generated-unchanged');
  assert.match(applied.data.summary.next, /no in-place generate/);
  const receipt = JSON.parse(await read(context, '.companion/generation.json'));
  const record = path => receipt.files.find(item => item.path === path);
  assert.equal(record('design/project.json').hash, hash(await read(context, 'design/project.json')));
  assert.deepEqual(record('azure-pipelines.yml'), { path: 'azure-pipelines.yml', hash: hash(await read(context, 'azure-pipelines.yml')), ownership: 'extension' });
  assert.equal(await read(context, '.github/pull_request_template.md'), '## Our own template\n');
});
