import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { setupOptions } from '../setup/options.mjs';
import { planIdentity } from '../setup/identity.mjs';
import { askAzureDetails, hostingPromptDefault, planHostingFiles, recordedHosting, requestedHosting } from '../setup/hosting.mjs';
import { askSetupForm, loadSetupForm } from '../setup/form.mjs';
import { inputFingerprint } from '../setup/journal.mjs';
import { applyFilePlan } from '../../src/shared/platform/file-plan.ts';
import { fixture, run, snapshot } from './setup-identity-fixture.mjs';

const flags = ['--yes', '--no-interaction', '--json'];
const azure = ['--hosting', 'azure-devops', '--azure-organization', 'https://dev.azure.com/contoso', '--azure-project', 'Field Notes', '--azure-repository', 'field-notes'];
const remote = 'https://dev.azure.com/contoso/Field%20Notes/_git/field-notes';
const read = (root, path) => readFile(join(root, path), 'utf8');

test('[SETUP-HOSTING-01] hosting is default-unchanged data, validated by the shared contract, and misuse fails closed', async () => {
  const none = await setupOptions([]);
  assert.equal(none.hosting, undefined); assert.equal(requestedHosting(none), undefined); assert.equal(none.identityRequested, false);
  const chosen = await setupOptions(azure);
  assert.deepEqual(requestedHosting(chosen), { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Field Notes', repository: 'field-notes' } });
  assert.equal(chosen.identityRequested, true);
  assert.deepEqual(requestedHosting(await setupOptions(['--hosting', 'none'])), { platform: 'none' });
  assert.deepEqual(requestedHosting(await setupOptions(['--hosting', 'azure-devops'])), { platform: 'azure-devops' });
  for (const [args, message] of [
    [['--hosting', 'gitlab'], /github, azure-devops or none/],
    [['--azure-project', 'Demo'], /need --hosting azure-devops/],
    [['--hosting', 'github', '--azure-project', 'Demo'], /need --hosting azure-devops/],
    [['--hosting', 'azure-devops', '--azure-project', 'Demo'], /both --azure-organization and --azure-project/],
    [['--hosting', 'azure-devops', '--azure-organization', 'https://example.com/contoso', '--azure-project', 'Demo'], /organization must be/],
    [['--hosting', 'azure-devops', '--azure-organization', 'https://dev.azure.com/contoso', '--azure-project', 'bad/name'], /project must be/],
    [['--hosting', 'azure-devops', '--repo', 'owner/name'], /GitHub owner\/name shorthand/],
  ]) await assert.rejects(setupOptions(args), message, args.join(' '));
});

test('[SETUP-HOSTING-02] the dry run is read-only; GitHub and the default plan no hosting files and keep the identity file list', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const before = await snapshot(f.root);
  const preview = run(f.root, f.launcher, ['--dry-run', '--json', ...azure]);
  assert.equal(preview.status, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout);
  assert.deepEqual(plan.files.map(item => item.path), ['manifest.json', 'package.json', 'package-lock.json', 'versions.json', 'PROJECT-IDENTITY.md']);
  assert.equal(plan.hosting.platform, 'azure-devops'); assert.equal(plan.hosting.repositoryUrl, remote);
  assert.deepEqual(plan.hosting.files.map(item => [item.path, item.status]), [['azure-pipelines.yml', 'create'], ['.azuredevops/pull_request_template.md', 'create']]);
  assert.deepEqual(await snapshot(f.root), before);
  for (const args of [[], ['--hosting', 'github']]) {
    const plain = JSON.parse(run(f.root, f.launcher, ['--dry-run', '--json', ...args]).stdout);
    assert.deepEqual(plain.hosting.files, []); assert.equal(plain.hosting.repositoryUrl, null);
  }
  assert.equal(JSON.parse(run(f.root, f.launcher, ['--dry-run', '--json']).stdout).hosting.action, 'preserve');
});

test('[SETUP-HOSTING-03] apply writes create-only Azure files, the _git repository URL and one identity line; reruns preserve them', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await mkdir(join(f.root, '.github'), { recursive: true });
  await writeFile(join(f.root, '.github/pull_request_template.md'), '## Checkout template\n');
  const applied = run(f.root, f.launcher, [...flags, ...azure]);
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  assert.equal(JSON.parse(applied.stdout).hosting.platform, 'azure-devops');
  assert.match(await read(f.root, 'azure-pipelines.yml'), /run verify -- --json/);
  assert.equal(await read(f.root, '.azuredevops/pull_request_template.md'), '## Checkout template\n');
  assert.equal(await read(f.root, '.github/pull_request_template.md'), '## Checkout template\n');
  assert.deepEqual(JSON.parse(await read(f.root, 'package.json')).repository, { type: 'git', url: remote });
  const identity = await read(f.root, 'PROJECT-IDENTITY.md');
  assert.deepEqual(recordedHosting(identity), requestedHosting(await setupOptions(azure)));
  assert.equal(identity.match(/^Hosting: /gm).length, 1);
  const journal = JSON.parse(await read(f.root, '.template-state/setup.json'));
  assert.equal(journal.options.hosting, 'azure-devops'); assert.equal(journal.options['azure-project'], 'Field Notes');
  // A later identity change keeps the recorded platform; edited Azure files are never replaced.
  await writeFile(join(f.root, 'azure-pipelines.yml'), '# edited by the team\n');
  const renamed = run(f.root, f.launcher, [...flags, '--name', 'Field Notes Pro']);
  assert.equal(renamed.status, 0, renamed.stdout + renamed.stderr);
  assert.equal(await read(f.root, 'azure-pipelines.yml'), '# edited by the team\n');
  assert.deepEqual(recordedHosting(await read(f.root, 'PROJECT-IDENTITY.md')), requestedHosting(await setupOptions(azure)));
  assert.deepEqual(JSON.parse(await read(f.root, 'package.json')).repository, { type: 'git', url: remote });
  const again = await planHostingFiles(f.root, requestedHosting(await setupOptions(azure)));
  assert.deepEqual(again.files, []); assert.deepEqual(again.preserved, ['azure-pipelines.yml', '.azuredevops/pull_request_template.md']);
  // A tampered hosting line is a user edit, not a platform to adopt.
  await writeFile(join(f.root, 'PROJECT-IDENTITY.md'), (await read(f.root, 'PROJECT-IDENTITY.md')).replace('contoso', 'fabrikam'));
  await assert.rejects(planIdentity(f.root, await setupOptions(['--name', 'Other'])), /user edits/);
});

test('[SETUP-HOSTING-04] none and GitHub never delete .github; GitHub adds no identity line, none records one', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await mkdir(join(f.root, '.github/workflows'), { recursive: true });
  await writeFile(join(f.root, '.github/workflows/ci.yml'), 'name: CI\n');
  const github = await planIdentity(f.root, await setupOptions(['--hosting', 'github', '--repo', 'owner/field-notes']));
  await applyFilePlan(github.plan);
  assert.equal(recordedHosting(await read(f.root, 'PROJECT-IDENTITY.md')), undefined);
  assert.doesNotMatch(await read(f.root, 'PROJECT-IDENTITY.md'), /Hosting:/);
  assert.equal(JSON.parse(await read(f.root, 'package.json')).repository.url, 'https://github.com/owner/field-notes.git');
  const none = run(f.root, f.launcher, [...flags, '--hosting', 'none']);
  assert.equal(none.status, 0, none.stdout + none.stderr);
  assert.deepEqual(recordedHosting(await read(f.root, 'PROJECT-IDENTITY.md')), { platform: 'none' });
  assert.equal(await read(f.root, '.github/workflows/ci.yml'), 'name: CI\n');
  await assert.rejects(read(f.root, 'azure-pipelines.yml'), { code: 'ENOENT' });
});

test('[SETUP-HOSTING-05] the journal fingerprint covers Azure files without changing a checkout that has none', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const toolchain = { node: 'v24.21.0', npm: '11.19.1', platform: 'linux', architecture: 'x64' }, options = await setupOptions([]);
  const before = await inputFingerprint(f.root, toolchain, options);
  await mkdir(join(f.root, '.azuredevops'), { recursive: true });
  await writeFile(join(f.root, '.azuredevops/pull_request_template.md'), 'x\n');
  assert.notEqual(await inputFingerprint(f.root, toolchain, options), before);
  await rm(join(f.root, '.azuredevops'), { recursive: true });
  assert.equal(await inputFingerprint(f.root, toolchain, options), before);
});

test('[SETUP-HOSTING-06] the interactive question keeps the platform on a blank answer and defaults Azure details from origin', async t => {
  const f = await fixture(); t.after(() => rm(f.root, { recursive: true, force: true }));
  await mkdir(join(f.root, '.git'), { recursive: true });
  await writeFile(join(f.root, '.git/config'), '[remote "origin"]\n\turl = https://contoso@dev.azure.com/contoso/Demo/_git/demo-repo\n');
  // The platform question is the setup form's hosting field; its shown default names the origin's platform, never the URL.
  const form = await loadSetupForm(new URL('../../configs/forms/setup-identity.json', import.meta.url));
  const defaults = { hosting: await hostingPromptDefault(f.root) }, asked = [];
  const kept = await askSetupForm(form, { question: async question => { asked.push(question); return ''; } }, { defaults, skip: ['id', 'name', 'description', 'author', 'repo', 'version', 'mcp'] });
  assert.deepEqual(kept, {}); assert.match(asked[0], /^Hosting platform.*origin looks like azure-devops\]: $/); assert.ok(asked.every(question => !question.includes('contoso@')));
  const answers = ['', '', ''], chosen = { hosting: 'azure-devops' };
  await askAzureDetails(f.root, chosen, async question => { asked.push(question); return answers.shift(); });
  assert.deepEqual(chosen, { hosting: 'azure-devops', 'azure-organization': 'https://dev.azure.com/contoso', 'azure-project': 'Demo', 'azure-repository': 'demo-repo' });
  assert.deepEqual(requestedHosting(chosen).azureDevOps.repository, 'demo-repo'); assert.ok(asked.every(question => !question.includes('contoso@')));
  const plain = await fixture(); t.after(() => rm(plain.root, { recursive: true, force: true }));
  assert.equal(await hostingPromptDefault(plain.root), 'keep current');
  const later = { hosting: 'azure-devops' };
  await askAzureDetails(plain.root, later, async () => '');
  assert.deepEqual(later, { hosting: 'azure-devops' }, 'a blank organization without an origin default records the platform only');
});
