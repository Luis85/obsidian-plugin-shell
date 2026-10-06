import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { compileProject, loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { planProject, applyProject } from '../../bin/compiler/adapters/project-plan.ts';
import { markdownLinks } from '../../scripts/quality/check-repository.mjs';
import { withHostingOption } from '../../scripts/companion/tooling-options.ts';
import { permission } from '../support/claude-permissions.mjs';
import { starterDocument } from '../support/starter-documents.mjs';

// The hosting platform (tooling.hosting) decides which CI, pull-request and agent files a generated project receives.
// Absent means GitHub; every GitHub expectation lives in project-generator-devkit/-framework-scope and stays unchanged.
const root = fileURLToPath(new URL('../../', import.meta.url));
const template = await loadTemplateSnapshot(root);
const source = starterDocument('quick-capture');
const azureOptions = { hosting: 'azure-devops', azureOrganization: 'https://dev.azure.com/contoso', azureProject: 'Quick Capture', azureRepository: 'quick-capture' };
async function render(document, snapshot = template) {
  const result = await compileProject({ source: JSON.stringify(document), template: snapshot });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  return new Map(result.artifacts.map(file => [file.path, file]));
}
const github = await render(source);
const azure = await render(withHostingOption(source, azureOptions));
const none = await render(withHostingOption(source, { hosting: 'none' }));
const text = (files, path) => { const file = files.get(path); assert.ok(file, `missing ${path}`); return file.content; };
const githubFiles = path => path.startsWith('.github/') || path.startsWith('docs/framework/workflows/');
const productDocs = files => [...files.keys()].filter(path => /^(?:README|AGENTS|CLAUDE|BRIEF)\.md$|^\.(?:claude|agents)\/skills\/[^/]+\/SKILL\.md$|^docs\/project-tasks\//.test(path));

test('[GENERATOR-HOSTING-01] an explicit github choice emits exactly the files of a project without the field', async () => {
  const explicit = await render(withHostingOption(source, { hosting: 'github' }));
  assert.deepEqual([...explicit.keys()].sort(), [...github.keys()].sort());
  // Only the recorded design input differs: it now carries the explicit choice.
  const changed = [...github.keys()].filter(path => github.get(path).content !== explicit.get(path).content);
  assert.ok(changed.length > 0 && changed.every(path => path.startsWith('design/')), changed.join());
  assert.deepEqual(JSON.parse(text(explicit, 'design/project.json')).tooling.hosting, { platform: 'github' });
  for (const path of ['.github/workflows/ci.yml', '.github/workflows/obsidian.yml', '.github/pull_request_template.md', '.github/copilot-instructions.md', '.github/dependabot.yml'])
    assert.ok(github.has(path), path);
  assert.ok(!github.has('azure-pipelines.yml') && !github.has('.azuredevops/pull_request_template.md') && !github.has('docs/project-tasks/CHANGE-SUMMARY.md'));
});
test('[GENERATOR-HOSTING-02] Azure DevOps replaces every GitHub file with azure-pipelines.yml and an Azure Repos PR template', () => {
  const removed = [...github.keys()].filter(path => !azure.has(path)).sort();
  assert.deepEqual(removed, [...github.keys()].filter(githubFiles).sort());
  for (const path of ['.github/CODEOWNERS', '.github/dependabot.yml', '.github/actions/setup-qualified/action.yml', '.github/copilot-instructions.md',
    '.github/workflows/ci.yml', 'docs/framework/workflows/ci.yml']) assert.ok(removed.includes(path), path);
  assert.deepEqual([...azure.keys()].filter(path => !github.has(path)).sort(), ['.azuredevops/pull_request_template.md', 'azure-pipelines.yml']);
  assert.ok(![...azure.keys()].some(path => path.startsWith('.github/') || path.startsWith('docs/framework/workflows/')));
  assert.equal(text(azure, '.azuredevops/pull_request_template.md'), text(github, '.github/pull_request_template.md'));
  for (const path of ['.azuredevops/pull_request_template.md', 'azure-pipelines.yml']) assert.equal(azure.get(path).ownership, 'extension', path);
  // Outside the hosting files, the docs naming them and the design input, only framework docs whose links pointed at a
  // pruned GitHub file differ, and only because those links became plain text.
  const hostingAware = new Set(['README.md', 'AGENTS.md', '.claude/settings.json', '.claude/skills/self-review/SKILL.md']);
  const differing = [...azure].filter(([path, file]) => github.has(path) && !hostingAware.has(path) && !path.startsWith('design/') && file.content !== github.get(path).content);
  assert.ok(differing.every(([path, file]) => path.startsWith('docs/framework/') && path.endsWith('.md') && file.content.includes('(maintainer-only asset, not included)')),
    differing.map(([path]) => path).join());
});
test('[GENERATOR-HOSTING-03] none keeps the shared agent kit with a local change summary and no CI or hosting files', () => {
  assert.deepEqual([...github.keys()].filter(path => !none.has(path)).sort(), [...github.keys()].filter(githubFiles).sort());
  assert.deepEqual([...none.keys()].filter(path => !github.has(path)), ['docs/project-tasks/CHANGE-SUMMARY.md']);
  assert.equal(text(none, 'docs/project-tasks/CHANGE-SUMMARY.md'), text(github, '.github/pull_request_template.md'));
  assert.equal(text(none, '.claude/settings.json'), text(github, '.claude/settings.json'));
  const readme = text(none, 'README.md');
  assert.match(readme, /No hosting platform is configured/); assert.doesNotMatch(readme, /`(?:gh|az) /);
  assert.match(text(none, 'AGENTS.md'), /fill `docs\/project-tasks\/CHANGE-SUMMARY\.md`/);
  assert.match(text(none, '.claude/skills/self-review/SKILL.md'), /Fill `docs\/project-tasks\/CHANGE-SUMMARY\.md`/);
});
test('[GENERATOR-HOSTING-04] product docs name the platform\'s template and commands, stay within limits and keep every link valid', () => {
  const readme = text(azure, 'README.md');
  for (const needle of ['## Hosting and pull requests', 'az extension add --name azure-devops', 'organization=https://dev.azure.com/contoso project="Quick Capture"',
    'az repos pr create --draft true', 'az repos pr update --id <pr-id> --draft false', 'az pipelines run --name <pipeline>', 'runObsidian=true',
    'az pipelines runs list', 'az boards work-item show', 'pull requests use `.azuredevops/pull_request_template.md`'])
    assert.ok(readme.includes(needle), needle);
  assert.match(text(github, 'README.md'), /## Hosting and pull requests\n\nThis project is prepared for GitHub[\s\S]*gh pr create --draft/);
  assert.match(text(azure, 'AGENTS.md'), /then fill `\.azuredevops\/pull_request_template\.md`:[\s\S]*untested scope\. Pull requests and pipelines are on Azure DevOps/);
  assert.match(text(azure, '.claude/skills/self-review/SKILL.md'), /Fill `\.azuredevops\/pull_request_template\.md`/);
  for (const files of [github, azure, none]) {
    const lines = text(files, 'AGENTS.md').split('\n').length;
    assert.ok(lines >= 60 && lines <= 160, `AGENTS.md has ${lines} lines`);
    for (const [path, file] of files) if (file.ownership !== 'framework' && !file.encoding) assert.doesNotMatch(file.content, /\{\{[A-Za-z]+\}\}/, path);
  }
  for (const files of [azure, none]) {
    for (const path of productDocs(files)) assert.doesNotMatch(text(files, path), /\.github\//, path);
    let checked = 0;
    for (const [path, entry] of files) {
      if (!path.endsWith('.md') || entry.encoding || !(path.startsWith('docs/') || !path.includes('/'))) continue;
      for (const link of markdownLinks(entry.content)) {
        const target = posix.normalize(posix.join(posix.dirname(path), link));
        assert.ok(files.has(target) || [...files.keys()].some(file => file.startsWith(target.replace(/\/$/, '') + '/')), `${path} -> ${link}`);
        checked++;
      }
    }
    assert.ok(checked > 300, `${checked} links checked`);
  }
});
test('[GENERATOR-HOSTING-05] Azure CLI permissions: read-only status is allowed, writes ask, sign-in and tokens are denied', () => {
  const base = JSON.parse(text(github, '.claude/settings.json')), settings = JSON.parse(text(azure, '.claude/settings.json'));
  for (const decision of ['allow', 'ask', 'deny']) assert.deepEqual(settings.permissions[decision].slice(0, base.permissions[decision].length), base.permissions[decision], decision);
  assert.deepEqual(settings.hooks, base.hooks);
  for (const command of ['az repos pr list', 'az repos pr list --status active', 'az repos pr show --id 7', 'az pipelines runs list --branch main --top 5',
    'az pipelines runs show --id 9', 'az boards work-item show --id 3', 'npm run check', 'git status']) assert.equal(permission(settings, command), 'allow', command);
  for (const command of ['az repos pr create --draft true --title x', 'az repos pr update --id 7 --draft false', 'az pipelines run --name ci --parameters runObsidian=true',
    'az repos ref create --name refs/heads/x', 'az repos pr list --output json']) assert.equal(permission(settings, command), 'ask', command);
  for (const command of ['az devops login', 'az devops login --organization https://dev.azure.com/contoso', 'AZURE_DEVOPS_EXT_PAT=abc az repos pr list',
    'export AZURE_DEVOPS_EXT_PAT=abc', 'OBSIDIAN_ALLOW_DOWNLOAD=1 npm run test:obsidian']) assert.equal(permission(settings, command), 'deny', command);
  for (const command of ['az repos delete --id 1', 'az pipelines delete --id 1', 'az repos pr set-vote --id 1 --vote approve', 'az repos policy list'])
    assert.notEqual(permission(settings, command), 'allow', command);
  for (const command of ['az repos pr list', 'gh pr list']) assert.equal(permission(base, command), 'unlisted', command);
});
const steps = stage => stage.jobs.flatMap(job => job.steps);
const scripts = stage => steps(stage).filter(step => typeof step.script === 'string').map(step => step.script).join('\n');
/** The structural contract of the emitted pipeline; mutated copies below prove each rule can fail. */
function assertPipeline(pipeline) {
  assert.deepEqual(pipeline.trigger, { branches: { include: ['main'] } }); assert.ok(!('pr' in pipeline), 'Azure Repos ignores pr:; branch policy runs it');
  assert.deepEqual(pipeline.parameters.map(item => [item.name, item.type, item.default]), [['runE2E', 'boolean', false], ['runObsidian', 'boolean', false]]);
  assert.deepEqual(pipeline.stages.map(stage => stage.stage), ['Check', 'UI', 'Obsidian']);
  for (const stage of pipeline.stages) {
    assert.deepEqual(stage.dependsOn, [], stage.stage); assert.equal(stage.jobs.length, 1, stage.stage);
    const all = steps(stage), node = all.findIndex(step => step.task === 'NodeTool@0'), install = all.findIndex(step => / ci --no-fund$/.test(step.script ?? ''));
    assert.deepEqual(all[0], { checkout: 'self', persistCredentials: false }, stage.stage);
    assert.deepEqual(all[node]?.inputs, { versionSource: 'fromFile', versionFilePath: '.nvmrc' }, stage.stage);
    assert.ok(node > 0 && install > node, stage.stage + ' installs exact dependencies after selecting Node');
    assert.ok(!stage.jobs[0].variables && !stage.variables, stage.stage + ' has no stage- or job-wide variables');
  }
  const [check, ui, obsidian] = pipeline.stages;
  assert.equal(check.condition, undefined);
  assert.equal([...scripts(check).matchAll(/ run check$/gm)].length, 1); assert.match(scripts(check), / run verify:artifacts$/m);
  assert.doesNotMatch(scripts(check), /test:e2e|test:obsidian|verify:project/);
  assert.equal(steps(check).find(step => /check:submission/.test(step.script ?? '')).continueOnError, true);
  // End-to-end stages: always on main (the project's Release tier), otherwise only when a run sets runE2E.
  const main = "and(ne(variables['Build.Reason'], 'PullRequest'), eq(variables['Build.SourceBranch'], 'refs/heads/main'))";
  assert.equal(ui.condition, `or(eq('\${{ parameters.runE2E }}', 'true'), ${main})`);
  const body = scripts(ui);
  assert.ok(body.indexOf('install --with-deps chromium') < body.indexOf('run test:e2e'));
  for (const script of ['test:e2e', 'ui:gallery']) assert.match(body, new RegExp(`scripts\\?\\.\\['${script}'\\][\\s\\S]*task\\.logissue type=warning\\]package\\.json has no ${script} script`));
  assert.match(body, /task\.uploadsummary/); assert.match(body, /evidence for human review, not acceptance/);
  const uploads = steps(ui).filter(step => step.task === 'PublishPipelineArtifact@1');
  assert.deepEqual(uploads.map(step => [step.inputs.artifact, step.inputs.targetPath]), [['ui-review-gallery', 'reports/ui-gallery'], ['ui-e2e-reports', 'reports/e2e']]);
  for (const step of uploads) assert.deepEqual([step.condition, step.continueOnError], ['always()', true]);
  assert.equal(obsidian.condition, `or(eq('\${{ parameters.runE2E }}', 'true'), eq('\${{ parameters.runObsidian }}', 'true'), ${main})`);
  const downloads = steps(obsidian).filter(step => step.env?.OBSIDIAN_ALLOW_DOWNLOAD !== undefined);
  assert.deepEqual(downloads.map(step => step.env.OBSIDIAN_ALLOW_DOWNLOAD), ['1', '1']); assert.match(scripts(obsidian), / run test:obsidian$/m);
  assert.ok(steps(obsidian).some(step => step.task === 'Cache@2' && step.inputs.path === '.native-cache'));
  assert.deepEqual(Object.keys(pipeline.variables), ['npm_config_cache'], 'the download opt-in is never pipeline-wide');
  const data = JSON.stringify(pipeline);
  assert.doesNotMatch(data, /AccessToken|EXT_PAT|\$\(\w*(?:Token|Secret|Password)\w*\)/i, 'no secret or token is referenced');
  assert.doesNotMatch(data, /IsDraft/, 'no stage or step depends on draft detection');
}
test('[GENERATOR-HOSTING-06] azure-pipelines.yml is strict YAML that mirrors the GitHub gates without secrets or draft detection', () => {
  const yaml = text(azure, 'azure-pipelines.yml');
  const document = parseDocument(yaml, { strict: true, uniqueKeys: true, prettyErrors: false, version: '1.2', schema: 'core' });
  assert.deepEqual([document.errors, document.warnings], [[], []]);
  const pipeline = document.toJS({ maxAliasCount: 0 });
  assertPipeline(pipeline);
  assert.doesNotMatch(yaml, /\{\{[A-Za-z]+\}\}|actions\/|github\./);
  const broken = [
    item => { item.stages[0].jobs[0].steps = item.stages[0].jobs[0].steps.filter(step => step.task !== 'NodeTool@0'); },
    item => { item.stages[0].jobs[0].steps.push({ script: 'node "$(PINNED_NPM)" run check' }); },
    item => { item.stages[2].jobs[0].variables = { OBSIDIAN_ALLOW_DOWNLOAD: '1' }; },
    item => { item.stages[2].condition = "eq(variables['System.PullRequest.IsDraft'], 'false')"; },
    item => { item.stages[1].condition = "or(eq(variables['Build.Reason'], 'PullRequest'), eq(variables['Build.Reason'], 'Manual'))"; },
    item => { item.parameters = item.parameters.filter(parameter => parameter.name !== 'runE2E'); },
    item => { item.stages[1].jobs[0].steps.push({ script: 'echo $(System.AccessToken)' }); },
    item => { item.stages[0].jobs[0].steps[0].persistCredentials = true; },
    item => { item.pr = { branches: { include: ['main'] } }; },
  ];
  for (const [index, edit] of broken.entries()) {
    const copy = structuredClone(pipeline); edit(copy);
    assert.throws(() => assertPipeline(copy), assert.AssertionError, `mutation ${index} must fail the pipeline contract`);
  }
});
test('[GENERATOR-HOSTING-07] an applied Azure project has no .github folder, replays cleanly and is still a template root', async t => {
  const vault = await mkdtemp(join(tmpdir(), 'generator-hosting-'));
  t.after(() => rm(vault, { recursive: true, force: true }));
  const input = join(vault, 'project.json'); await writeFile(input, JSON.stringify(withHostingOption(source, azureOptions)));
  const plan = await planProject({ input, vault, target: 'plugin' }); await applyProject(plan, plan.hash);
  const project = join(vault, 'plugin');
  await assert.rejects(stat(join(project, '.github')), { code: 'ENOENT' });
  assert.ok((await stat(join(project, 'azure-pipelines.yml'))).isFile()); assert.ok((await stat(join(project, '.azuredevops/pull_request_template.md'))).isFile());
  const replay = await planProject({ input, vault, target: 'plugin' });
  assert.deepEqual(replay.conflicts, []);
  const replayed = replay.plan.changes.map(change => change.path);
  assert.ok(replayed.some(path => path.endsWith('azure-pipelines.yml')), 'the replay covers the whole project');
  assert.deepEqual(replayed.filter(path => /(?:^|\/)\.github\//.test(path)), [], 'regeneration never brings GitHub files back');
  // Without the optional .github root, the generated project still snapshots as a template input (with the Azure template).
  const snapshot = await loadTemplateSnapshot(project);
  assert.ok(!snapshot.frameworkFiles.some(file => file.path.startsWith('.github/')));
  assert.equal(snapshot.text('templates/companion/devkit/azure-pipelines.yml.tmpl'), template.text('templates/companion/devkit/azure-pipelines.yml.tmpl'));
});
