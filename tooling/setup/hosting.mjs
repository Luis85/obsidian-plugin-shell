// Optional hosting platform for `npm run setup` in a framework checkout. Dependency-free: the shared contract module
// has no imports. Setup only prepares files and package metadata; it never runs gh/az, adds a remote, signs in,
// stores a token or deletes .github.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '../../src/shared/platform/file-plan.ts';
import { azureRemoteDetails, classifyRemote, hostingPlatforms, hostingProfile, validateHosting } from '../../src/shared/companion/schema/hosting.mjs';
export const hostingKeys = ['hosting', 'azure-organization', 'azure-project', 'azure-repository'];
const azureFields = [['azure-organization', 'organization'], ['azure-project', 'project'], ['azure-repository', 'repository']];
/** The explicit choice from setup options, validated by the shared contract; undefined keeps the current platform. */
export function requestedHosting(options) {
  const given = azureFields.filter(([key]) => options[key] !== undefined);
  if (options.hosting === undefined) {
    if (given.length) throw new Error('--azure-organization, --azure-project and --azure-repository need --hosting azure-devops');
    return undefined;
  }
  if (!hostingPlatforms.includes(options.hosting)) throw new Error('Hosting must be github, azure-devops or none');
  if (given.length && options.hosting !== 'azure-devops') throw new Error('Azure DevOps details need --hosting azure-devops');
  if (options.hosting === 'azure-devops' && options.repo !== undefined) throw new Error('--repo is the GitHub owner/name shorthand; use --azure-organization and --azure-project for Azure DevOps');
  const hosting = { platform: options.hosting };
  if (given.length) {
    if (!options['azure-organization'] || !options['azure-project']) throw new Error('Azure DevOps details need both --azure-organization and --azure-project');
    hosting.azureDevOps = Object.fromEntries(given.map(([key, field]) => [field, options[key]]));
  }
  try { validateHosting(hosting); } catch (error) { throw new Error(error.message.replace(/^COMPANION_TOOLING_INVALID: /, '')); }
  return hosting;
}
/** PROJECT-IDENTITY.md records a non-default platform on one line; GitHub (the default) adds nothing. */
export function hostingLine(hosting) {
  return hosting && hosting.platform !== 'github' ? `\nHosting: \`${JSON.stringify(hosting)}\`\n` : '';
}
/** The platform a previous setup recorded in PROJECT-IDENTITY.md, or undefined (GitHub). An invalid line reads as an edit. */
export function recordedHosting(text) {
  const match = /\nHosting: `(\{[^`\n]*\})`\n$/.exec(text);
  if (!match) return undefined;
  try { const hosting = JSON.parse(match[1]); validateHosting(hosting); return hosting; } catch { return undefined; }
}
/** The package.json repository URL of an Azure DevOps project with known details (Azure Repos `_git` form). */
export const azureRepositoryUrl = hosting => hosting?.platform === 'azure-devops' ? hostingProfile(hosting).remoteUrl : null;
const pipeline = `# Azure Pipelines for this framework checkout, prepared by npm run setup -- --hosting azure-devops.
# It runs the dependency-free baseline and the complete local verify gate on Linux. The GitHub workflows in .github
# (browser journeys, Windows/macOS legs, native qualification, release tiers) are not reproduced here; extend this
# file deliberately. Azure Repos ignores YAML pr: triggers: add the pipeline to main as a build-validation branch
# policy. No secret is needed; never add a personal access token to this file.
trigger:
  branches:
    include: [main]
pool:
  vmImage: ubuntu-latest
variables:
  npm_config_cache: $(Pipeline.Workspace)/.npm
steps:
  - checkout: self
    persistCredentials: false
  - task: NodeTool@0
    displayName: Use the Node version in .nvmrc
    inputs:
      versionSource: fromFile
      versionFilePath: .nvmrc
  - script: node tooling/testing/verify-baseline.mjs --json
    displayName: Dependency-free executable baseline
  - script: |
      npm install --prefix "$(Agent.TempDirectory)/pinned-npm" --ignore-scripts --no-fund --package-lock=false npm@11.19.1
      echo "##vso[task.setvariable variable=PINNED_NPM]$(Agent.TempDirectory)/pinned-npm/node_modules/npm/bin/npm-cli.js"
    displayName: Select the pinned npm
  - script: node "$(PINNED_NPM)" ci --no-fund
    displayName: Install exact dependencies
  - script: node "$(PINNED_NPM)" run verify -- --json
    displayName: Static, service, coverage and artifact gates
`;
const fallbackTemplate = '## Summary\n\n<!-- What changed and why. Paste real command output; "not run" needs a reason. -->\n';
/** Create-only Azure DevOps files; an existing file is preserved and reported, never replaced. */
export async function planHostingFiles(root, hosting) {
  const platform = hosting?.platform;
  if (platform !== 'azure-devops') return { platform: platform ?? null, action: hosting ? 'set' : 'preserve', plan: await createFilePlan(root, []), files: [], preserved: [] };
  const template = await readFile(join(root, '.github/pull_request_template.md'), 'utf8').catch(() => fallbackTemplate);
  const wanted = [{ path: 'azure-pipelines.yml', content: pipeline }, { path: '.azuredevops/pull_request_template.md', content: template }];
  const probe = await createFilePlan(root, wanted.map(({ path }) => ({ path, content: null })));
  const absent = new Set(probe.changes.filter(change => change.beforeHash === null).map(change => change.path));
  const plan = await createFilePlan(root, wanted.filter(({ path }) => absent.has(path)));
  return { platform, action: 'set', plan, files: plan.changes.map(({ path, status, beforeHash, afterHash }) => ({ path, status, beforeHash, afterHash })),
    preserved: wanted.map(({ path }) => path).filter(path => !absent.has(path)) };
}
/** The origin remote of a plain checkout, read without running git; it is used for defaults and never printed. */
async function originUrl(root) {
  const config = await readFile(join(root, '.git/config'), 'utf8').catch(() => '');
  return /\[\s*remote\s+"origin"\s*\][^[]*?\burl\s*=\s*(\S+)/i.exec(config)?.[1] ?? null;
}
/** The shown default of the setup form's hosting question: blank keeps the current platform; the origin remote only suggests. */
export async function hostingPromptDefault(root) {
  const detected = classifyRemote(await originUrl(root));
  return `keep current${detected ? `, origin looks like ${detected}` : ''}`;
}
/** After an interactive azure-devops answer: organization, project and repository, each defaulting from an Azure DevOps
 * origin remote. A blank organization without a default records the platform only; the project name is not stored twice. */
export async function askAzureDetails(root, options, question) {
  const details = azureRemoteDetails(await originUrl(root));
  for (const [key, field] of azureFields) {
    const fallback = details?.[field] ?? (field === 'repository' ? options['azure-project'] : undefined);
    const value = (await question(`Azure DevOps ${field}${fallback ? ` [${fallback}]` : ''}: `)).trim() || fallback;
    if (value && !(field === 'repository' && value === options['azure-project'])) options[key] = value;
    if (!value && field === 'organization') return;
  }
}
