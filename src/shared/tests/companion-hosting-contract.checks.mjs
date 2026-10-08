import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { azureRemoteDetails, classifyRemote, hostingPlatforms, hostingProfile, hostingSchema, projectHosting, prunedByHosting, validateHosting }
  from '../companion/schema/hosting.mjs';
import { toolingSchema, validateTooling } from '../companion/tooling-contract.mjs';
import { validateAuthoringDocument } from '../companion/authoring-contract.ts';
import { withHostingOption } from '../companion/tooling-options.ts';
import { starterDocument } from '#shared/testing/starter-documents.mjs';

const azure = { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Quick Capture', repository: 'quick-capture' } };
const invalid = /^Error: COMPANION_TOOLING_INVALID: /;
// util.inspect never invokes getters, so the label cannot run an accessor before the validator does.
const rejects = (value, message = invalid) => assert.throws(() => validateHosting(value), error => message.test(String(error)), inspect(value));

test('[COMPANION-HOSTING-01] absent hosting is GitHub with today\'s files and no extra permissions', () => {
  assert.deepEqual(hostingPlatforms, ['github', 'azure-devops', 'none']);
  assert.equal(validateHosting(undefined), undefined);
  const profile = hostingProfile(undefined);
  assert.deepEqual(profile, hostingProfile({ platform: 'github' }));
  assert.equal(profile.platform, 'github'); assert.equal(profile.prTemplatePath, '.github/pull_request_template.md');
  assert.deepEqual(profile.ciFiles, [['.github/workflows/ci.yml', 'workflow-ci.yml.tmpl'], ['.github/workflows/obsidian.yml', 'workflow-obsidian.yml.tmpl']]);
  assert.deepEqual(profile.prune, []); assert.equal(profile.remoteUrl, null);
  assert.deepEqual(profile.claudePermissions, { allow: [], ask: [], deny: [] });
  assert.match(profile.cliHints, /^## Hosting and pull requests\n/); assert.match(profile.cliHints, /gh pr create --draft/);
  assert.match(profile.cliHints, /gh pr ready/); assert.match(profile.cliHints, /gh run list/);
  assert.equal(projectHosting({ tooling: {} }), undefined); assert.equal(projectHosting({}), undefined);
});
test('[COMPANION-HOSTING-02] Azure DevOps and none validate as inert schema 6 tooling data and round-trip unchanged', () => {
  for (const value of [azure, { platform: 'azure-devops' }, { platform: 'none' }, { platform: 'github' },
    { platform: 'azure-devops', azureDevOps: { organization: 'https://contoso.visualstudio.com', project: 'P' } }]) {
    validateHosting(value); validateTooling({ hosting: value });
    const document = { ...structuredClone(starterDocument('quick-capture')), tooling: { hosting: structuredClone(value) } };
    assert.deepEqual(validateAuthoringDocument(document).tooling.hosting, value);
    assert.equal(document.schemaVersion, 6); assert.deepEqual(projectHosting(document), value);
  }
});
test('[COMPANION-HOSTING-03] unknown fields, accessors, prototypes, mismatched details and unsafe values are refused', () => {
  let read = false;
  const getter = Object.defineProperty({}, 'platform', { enumerable: true, get() { read = true; return 'github'; } });
  rejects(getter, /enumerable data fields/); assert.equal(read, false, 'the accessor never ran');
  rejects({ platform: 'github', token: 'x' }, /Unknown tooling\.hosting field/);
  rejects({ ...azure, azureDevOps: { ...azure.azureDevOps, pat: 'secret' } }, /Unknown tooling\.hosting\.azureDevOps field/);
  rejects(Object.assign(Object.create({ inherited: true }), { platform: 'github' }), /plain object/);
  rejects(Object.defineProperty({ platform: 'github' }, 'azureDevOps', { value: azure.azureDevOps, enumerable: false }), /enumerable data fields/);
  rejects({ platform: 'github', [Symbol('x')]: 1 }, /Unknown/);
  for (const value of [null, [], 'github', { platform: 'gitlab' }, { platform: 'GitHub' }, {}]) rejects(value);
  rejects({ platform: 'github', azureDevOps: azure.azureDevOps }, /only with the azure-devops platform/);
  rejects({ platform: 'none', azureDevOps: azure.azureDevOps }, /only with the azure-devops platform/);
  const details = edit => ({ platform: 'azure-devops', azureDevOps: { ...azure.azureDevOps, ...edit } });
  for (const organization of ['http://dev.azure.com/contoso', 'https://dev.azure.com/contoso/', 'https://dev.azure.com/', 'https://dev.azure.com/contoso/project',
    'https://dev.azure.com/contoso?x=1', 'https://github.com/contoso', 'https://contoso.visualstudio.com/', 'https://evil.example/dev.azure.com/contoso',
    'https://dev.azure.com/-contoso', 'https://dev.azure.com/' + 'a'.repeat(51), 'https://dev.azure.com/con\ntoso', ' https://dev.azure.com/contoso', 42, undefined])
    rejects(details({ organization }), /organization must be/);
  for (const project of ['', ' lead', 'trail.', 'a'.repeat(65), 'tab\there', 'line\nbreak', 'nul\u0000', 'del\u007f', 'quote"d', 'back`tick', 'semi;colon', '$(cmd)', 'ü-umlaut', 5, undefined])
    rejects(details({ project }), /project must be/);
  for (const repository of ['', 'a'.repeat(65), 'bad/slash', 'esc\u001b', null]) rejects(details({ repository }), /repository must be/);
  validateHosting(details({ repository: undefined }));
  assert.throws(() => validateTooling({ hosting: { platform: 'gitlab' } }), invalid);
  assert.throws(() => validateAuthoringDocument({ ...structuredClone(starterDocument('quick-capture')), tooling: { hosting: { platform: 'azure-devops', azureDevOps: { organization: 'x', project: 'P' } } } }), invalid);
});
test('[COMPANION-HOSTING-04] remotes are classified by host only, and Azure details come only from exact remote shapes', () => {
  const cases = [['https://github.com/owner/repo.git', 'github'], ['git@github.com:owner/repo.git', 'github'], ['ssh://git@ssh.github.com:443/owner/repo.git', 'github'],
    ['https://dev.azure.com/contoso/Project/_git/repo', 'azure-devops'], ['https://contoso@dev.azure.com/contoso/Project/_git/repo', 'azure-devops'],
    ['git@ssh.dev.azure.com:v3/contoso/Project/repo', 'azure-devops'], ['https://contoso.visualstudio.com/Project/_git/repo', 'azure-devops'],
    ['contoso@vs-ssh.visualstudio.com:v3/contoso/Project/repo', 'azure-devops'], ['https://gitlab.com/owner/repo.git', null],
    ['https://github.com.evil.example/owner/repo', null], ['https://evil.example/dev.azure.com/contoso', null], ['https://dev.azure.com.evil.example/x', null],
    ['/local/path/repo', null], ['C:/repo', null], ['', null], ['https://github.com/owner/repo\n', null], [42, null], [undefined, null], ['https://' + 'a'.repeat(2050), null]];
  for (const [url, expected] of cases) assert.equal(classifyRemote(url), expected, String(url));
  const details = { organization: 'https://dev.azure.com/contoso', project: 'Quick Capture', repository: 'quick-capture' };
  assert.deepEqual(azureRemoteDetails('https://dev.azure.com/contoso/Quick%20Capture/_git/quick-capture'), details);
  assert.deepEqual(azureRemoteDetails('https://contoso@dev.azure.com/contoso/Quick%20Capture/_git/quick-capture'), details);
  assert.deepEqual(azureRemoteDetails('git@ssh.dev.azure.com:v3/contoso/Quick%20Capture/quick-capture'), details);
  for (const url of ['https://github.com/a/b', 'https://contoso.visualstudio.com/P/_git/r', 'https://dev.azure.com/contoso/P%ZZ/_git/r',
    'https://dev.azure.com/contoso/P%22%3B/_git/r', 'https://dev.azure.com/contoso/P/_git/r/extra']) assert.equal(azureRemoteDetails(url), null, url);
});
test('[COMPANION-HOSTING-05] the Azure profile prunes GitHub inputs, encodes the remote and only pre-approves read-only commands', () => {
  const profile = hostingProfile(azure);
  assert.equal(profile.prTemplatePath, '.azuredevops/pull_request_template.md');
  assert.deepEqual(profile.reviewFiles, [['.azuredevops/pull_request_template.md', 'pull-request-template.md.tmpl']]);
  assert.deepEqual(profile.ciFiles, [['azure-pipelines.yml', 'azure-pipelines.yml.tmpl']]);
  assert.equal(profile.remoteUrl, 'https://dev.azure.com/contoso/Quick%20Capture/_git/quick-capture');
  assert.equal(hostingProfile({ platform: 'azure-devops', azureDevOps: { organization: 'https://contoso.visualstudio.com', project: 'P' } }).remoteUrl,
    'https://contoso.visualstudio.com/P/_git/P');
  assert.equal(hostingProfile({ platform: 'azure-devops' }).remoteUrl, null);
  for (const path of ['.github/dependabot.yml', '.github/CODEOWNERS', '.github/actions/setup-qualified/action.yml', '.github/workflows/ci.yml']) assert.ok(prunedByHosting(profile, path), path);
  for (const path of ['.githubx/a', 'docs/.github/a', 'azure-pipelines.yml', '.github']) assert.ok(!prunedByHosting(profile, path), path);
  assert.ok(prunedByHosting({ prune: ['exact.md'] }, 'exact.md')); assert.ok(!prunedByHosting({ prune: ['exact.md'] }, 'exact.md/x'));
  const { allow, ask, deny } = profile.claudePermissions;
  assert.ok(allow.every(rule => /^Bash\(az (?:repos pr (?:list|show)|pipelines runs (?:list|show)|boards work-item show)(?: \*)?\)$/.test(rule)), allow.join());
  assert.deepEqual(ask, ['Bash(az repos pr create *)', 'Bash(az repos pr update *)', 'Bash(az pipelines run *)', 'Bash(az repos ref create *)']);
  assert.deepEqual(deny, ['Bash(az devops login*)', 'Bash(*AZURE_DEVOPS_EXT_PAT=*)']);
  for (const needle of ['az extension add --name azure-devops', 'az devops configure --defaults organization=https://dev.azure.com/contoso project="Quick Capture"',
    'az repos pr create --draft true --repository "quick-capture"', 'az repos pr update --id <pr-id> --draft false', 'az pipelines run --name <pipeline>',
    'az pipelines runs list', 'az boards work-item show', 'build-validation branch policy', 'System.PullRequest.IsDraft', 'git remote add origin https://dev.azure.com/contoso/Quick%20Capture/_git/quick-capture'])
    assert.ok(profile.cliHints.includes(needle), needle);
  const unknown = hostingProfile({ platform: 'azure-devops' }).cliHints;
  assert.ok(unknown.includes('organization=https://dev.azure.com/<organization> project="<project>"')); assert.ok(!unknown.includes('git remote add'));
  const none = hostingProfile({ platform: 'none' });
  assert.deepEqual([none.ciFiles, none.prune, none.prTemplatePath], [[], ['.github/'], 'docs/project-tasks/CHANGE-SUMMARY.md']);
  assert.doesNotMatch(none.cliHints, /\b(?:gh|az) /);
  for (const item of [profile, none, hostingProfile(undefined)]) assert.doesNotMatch(item.agentHint, /\n/);
  assert.throws(() => hostingProfile({ platform: 'gitlab' }), invalid);
});
test('[COMPANION-HOSTING-06] withHostingOption applies only explicit choices and refuses conflicting or incomplete ones', () => {
  const source = starterDocument('quick-capture'), before = JSON.stringify(source);
  assert.equal(withHostingOption(source, {}), source);
  assert.equal(withHostingOption(source, { airship: true }), source);
  const chosen = withHostingOption(source, { hosting: 'azure-devops', azureOrganization: 'https://dev.azure.com/contoso', azureProject: 'Quick Capture' });
  assert.deepEqual(chosen.tooling.hosting, { platform: 'azure-devops', azureDevOps: { organization: 'https://dev.azure.com/contoso', project: 'Quick Capture' } });
  assert.equal(JSON.stringify(source), before, 'the input document is never mutated');
  const merged = withHostingOption(chosen, { azureRepository: 'quick-capture' });
  assert.deepEqual(merged.tooling.hosting.azureDevOps, { organization: 'https://dev.azure.com/contoso', project: 'Quick Capture', repository: 'quick-capture' });
  assert.deepEqual(withHostingOption(merged, { hosting: 'azure-devops' }).tooling.hosting, merged.tooling.hosting);
  assert.deepEqual(withHostingOption(merged, { hosting: 'github' }).tooling.hosting, { platform: 'github' });
  assert.deepEqual(withHostingOption(source, { hosting: 'none' }).tooling.hosting, { platform: 'none' });
  assert.deepEqual(withHostingOption(source, { hosting: 'azure-devops' }).tooling.hosting, { platform: 'azure-devops' });
  const airship = { ...structuredClone(source), tooling: { airship: { enabled: true } } };
  assert.deepEqual(withHostingOption(airship, { hosting: 'none' }).tooling, { airship: { enabled: true }, hosting: { platform: 'none' } });
  assert.throws(() => withHostingOption(source, { hosting: 'gitlab' }), /^Error: HOSTING_OPTION_PLATFORM: Choose one of github, azure-devops, none\.$/);
  assert.throws(() => withHostingOption(source, { hosting: true }), /HOSTING_OPTION_VALUE: hosting needs a value/);
  assert.throws(() => withHostingOption(source, { azureProject: 'P' }), /HOSTING_OPTION_CONFLICT/);
  assert.throws(() => withHostingOption(source, { hosting: 'none', azureOrganization: 'https://dev.azure.com/c' }), /HOSTING_OPTION_CONFLICT/);
  assert.throws(() => withHostingOption(source, { hosting: 'azure-devops', azureProject: 'P' }), /HOSTING_OPTION_INCOMPLETE/);
  assert.throws(() => withHostingOption(source, { hosting: 'azure-devops', azureOrganization: 'https://dev.azure.com/c/', azureProject: 'P' }), invalid);
  assert.throws(() => withHostingOption(source, { hosting: 'azure-devops', azureOrganization: 'https://dev.azure.com/c', azureProject: 'P"; rm -rf /' }), invalid);
  assert.equal(JSON.stringify(source), before);
});
test('[COMPANION-HOSTING-07] the published schema describes the field and its patterns agree with the validator', () => {
  const schema = hostingSchema();
  assert.deepEqual(toolingSchema().properties.hosting, schema);
  assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.required, ['platform']);
  assert.deepEqual(schema.properties.platform.enum, hostingPlatforms);
  const azureSchema = schema.properties.azureDevOps;
  const organization = new RegExp(azureSchema.properties.organization.pattern), name = new RegExp(azureSchema.properties.project.pattern);
  for (const value of ['https://dev.azure.com/contoso', 'https://contoso.visualstudio.com']) assert.ok(organization.test(value), value);
  for (const value of ['https://dev.azure.com/contoso/', 'http://dev.azure.com/c', 'https://x.example']) assert.ok(!organization.test(value), value);
  for (const value of ['Quick Capture', 'a', 'repo_1-x']) assert.ok(name.test(value), value);
  for (const value of ['', ' a', 'a.', 'a"b', 'a\nb']) assert.ok(!name.test(value), value);
  assert.equal(azureSchema.properties.project.maxLength, 64);
});
