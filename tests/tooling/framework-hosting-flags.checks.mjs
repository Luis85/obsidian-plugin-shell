import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';
import { parseCliArguments } from '../../src/cli/adapters/framework/catalog.ts';
import { planOperation } from '../../src/cli/adapters/framework/planning.ts';
import { routeArguments } from '../../src/cli/adapters/router.ts';
import { guidedSetup } from '../../src/cli/presentation/terminal/setup-terminal.ts';
import { starterText } from '../../src/cli/presentation/terminal/starter-terminal.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const frameworkRoot = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const azure = ['--hosting', 'azure-devops', '--azure-organization', 'https://dev.azure.com/contoso', '--azure-project', 'Demo'];
async function scratch(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'hosting-flags-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
/** `new <dir> --starter quick-capture` planned through the real compiler; files keyed by project-relative path. */
async function newPlan(target, extra) {
  const planned = await planOperation(parseCliArguments(['new', target, '--starter', 'quick-capture', '--id', 'az-demo', ...extra]), { root: frameworkRoot, frameworkRoot });
  const prefix = planned.summary.target + '/';
  return { planned, files: new Map(planned.plan.changes.map(change => [change.path.slice(prefix.length), change.content])) };
}
const failureCode = async (argv, context) => (await executeOperation(parseCliArguments(argv), context)).diagnostics[0]?.code;

test('new with Azure DevOps flags renders Azure files through the compiler; the default stays GitHub', async t => {
  const root = await scratch(t);
  const { planned, files } = await newPlan(join(root, 'az-demo'), azure);
  assert.equal(planned.summary.hosting.platform, 'azure-devops');
  assert.equal(planned.summary.hosting.remoteUrl, 'https://dev.azure.com/contoso/Demo/_git/Demo');
  assert.ok(planned.summary.hosting.connect.includes('git remote add origin https://dev.azure.com/contoso/Demo/_git/Demo'));
  assert.deepEqual(JSON.parse(files.get('design/project.json')).tooling.hosting,
    { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Demo' } });
  assert.match(files.get('azure-pipelines.yml'), /stage: Check/);
  assert.ok(files.has('.azuredevops/pull_request_template.md'));
  assert.ok([...files.keys()].every(path => !path.startsWith('.github/')));
  assert.match(files.get('README.md'), /az repos pr create --draft true --repository "Demo"/);
  assert.ok(JSON.parse(files.get('.claude/settings.json')).permissions.deny.includes('Bash(az devops login*)'));
  const plain = await newPlan(join(root, 'gh-demo'), []);
  assert.equal(plain.planned.summary.hosting.platform, 'github'); assert.equal(plain.planned.summary.hosting.configured, false);
  assert.equal(JSON.parse(plain.files.get('design/project.json')).tooling?.hosting, undefined);
  assert.ok(plain.files.has('.github/workflows/ci.yml') && !plain.files.has('azure-pipelines.yml'));
  // An explicit GitHub choice records the field but emits exactly the default project files.
  const explicit = await newPlan(join(root, 'gh-demo'), ['--hosting', 'github']);
  const differing = [...explicit.files].filter(([path, content]) => plain.files.get(path) !== content).map(([path]) => path);
  assert.deepEqual(differing.filter(path => !['design/project.json', '.companion/generation.json', '.workbench/starter.json'].includes(path)), []);
});

test('hosting flags are routed to new <dir>, validated before planning and refused for file starters', async t => {
  const root = await scratch(t);
  assert.equal(routeArguments(['new', '--hosting', 'azure-devops', '--starter', 'quick-capture']).surface, 'framework');
  const context = { root: frameworkRoot, frameworkRoot }, target = join(root, 'refused');
  assert.equal(await failureCode(['new', target, '--starter', 'quick-capture', '--hosting', 'gitlab'], context), 'HOSTING_OPTION_PLATFORM');
  assert.equal(await failureCode(['new', target, '--starter', 'quick-capture', '--azure-project', 'Demo'], context), 'HOSTING_OPTION_CONFLICT');
  assert.equal(await failureCode(['new', target, '--starter', 'quick-capture', '--hosting', 'azure-devops', '--azure-project', 'Demo'], context), 'HOSTING_OPTION_INCOMPLETE');
  assert.equal(await failureCode(['new', target, '--starter', 'quick-capture', '--hosting', 'azure-devops', '--azure-organization', 'https://token@dev.azure.com/x', '--azure-project', 'Demo'], context), 'COMPANION_TOOLING_INVALID');
  await assert.rejects(readFile(join(target, 'manifest.json')), { code: 'ENOENT' });
});

test('setup applies explicit hosting flags to the accepted design and keeps the headless default', async t => {
  const root = await scratch(t), context = { root, frameworkRoot };
  await writeFile(join(root, 'input.json'), starterDocumentText('quick-capture'));
  const preview = await executeOperation(parseCliArguments(['setup', '--input', 'input.json', ...azure, '--azure-repository', 'demo-repo', '--dry-run']), context);
  assert.equal(preview.status, 'planned'); assert.equal(preview.data.summary.hosting.remoteUrl, 'https://dev.azure.com/contoso/Demo/_git/demo-repo');
  const applied = await executeOperation(parseCliArguments(['setup', '--input', 'input.json', ...azure, '--azure-repository', 'demo-repo', '--yes']), context);
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  const design = JSON.parse(await readFile(join(root, 'design/project.json'), 'utf8'));
  assert.deepEqual(design.tooling.hosting.azureDevOps, { organization: 'https://dev.azure.com/contoso', project: 'Demo', repository: 'demo-repo' });
  // Hosting changes on an existing design go through hosting set, like Airship.
  assert.equal(await failureCode(['setup', '--hosting', 'none', '--dry-run'], context), 'HOSTING_DESIGN_REQUIRED');
  const headless = await scratch(t);
  await writeFile(join(headless, 'input.json'), starterDocumentText('quick-capture'));
  const plain = await executeOperation(parseCliArguments(['setup', '--input', 'input.json', '--yes']), { root: headless, frameworkRoot });
  assert.equal(plain.status, 'applied', JSON.stringify(plain.diagnostics));
  assert.equal(JSON.parse(await readFile(join(headless, 'design/project.json'), 'utf8')).tooling?.hosting, undefined);
  assert.equal(await readFile(join(headless, 'design/project.json'), 'utf8'), starterDocumentText('quick-capture'));
});

test('the setup interview defaults hosting from an Azure DevOps origin without printing it', async t => {
  const root = await scratch(t), writes = [], prompts = [];
  await mkdir(join(root, '.git'), { recursive: true });
  await writeFile(join(root, '.git/config'), '[core]\n\tbare = false\n[remote "origin"]\n\turl = https://contoso:secret@dev.azure.com/contoso/Demo/_git/demo-repo\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n');
  const chosen = await guidedSetup({ command: 'setup', args: [], options: { input: 'input.json', 'no-airship': true, 'no-mcp': true } }, { root, frameworkRoot },
    async question => { prompts.push(question); return ''; }, text => writes.push(text));
  assert.match(prompts[0], /\[azure-devops\]: $/); assert.match(prompts[1], /\[https:\/\/dev\.azure\.com\/contoso\]/);
  assert.deepEqual([chosen.options.hosting, chosen.options['azure-organization'], chosen.options['azure-project'], chosen.options['azure-repository']],
    ['azure-devops', 'https://dev.azure.com/contoso', 'Demo', 'demo-repo']);
  assert.ok([...prompts, ...writes].every(text => !text.includes('secret')));
  const none = await guidedSetup({ command: 'setup', args: [], options: { input: 'input.json', 'no-airship': true, 'no-mcp': true, hosting: 'none' } }, { root, frameworkRoot },
    async () => assert.fail('An explicit --hosting never prompts'), text => writes.push(text));
  assert.equal(none.options.hosting, 'none'); assert.match(writes.at(-1), /^No hosting platform/);
});

test('the new summary names the platform and prints connect commands only after writing', () => {
  const summary = { starter: { id: 'quick-capture', title: 'Quick Capture', version: '1.0.0', sha256: 'a'.repeat(64) }, identity: { id: 'az-demo', name: 'Az Demo', author: '' },
    directory: '/tmp/az-demo', vault: '/tmp', files: 3, acceptanceTodos: 0, warnings: [], hosting: { platform: 'azure-devops', connect: ['az repos create --name "Demo"'] } };
  const planned = starterText({ command: 'new', status: 'planned', data: { planHash: 'h', summary, conflicts: [], next: 'Review.' }, diagnostics: [] });
  assert.match(planned, /Hosting {4}azure-devops/); assert.doesNotMatch(planned, /az repos create/);
  const written = starterText({ command: 'new', status: 'applied', data: { planHash: 'h', summary, conflicts: [], nextSteps: ['npm ci'] }, diagnostics: [] });
  assert.match(written, /Hosting azure-devops \(commands are printed, never run\):\n {2}az repos create --name "Demo"/);
});

test('new --from takes the hosting flags without prompting and emits the none-platform change summary', async t => {
  const root = await scratch(t);
  await writeFile(join(root, 'exported.json'), starterDocumentText('quick-capture'));
  const planned = await planOperation(parseCliArguments(['new', join(root, 'plain'), '--from', join(root, 'exported.json'), '--hosting', 'none']), { root: frameworkRoot, frameworkRoot });
  const paths = planned.plan.changes.map(change => change.path.slice(planned.summary.target.length + 1));
  assert.equal(planned.summary.hosting.platform, 'none');
  assert.ok(paths.includes('docs/project-tasks/CHANGE-SUMMARY.md'));
  assert.ok(paths.every(path => !path.startsWith('.github/') && path !== 'azure-pipelines.yml'));
});
