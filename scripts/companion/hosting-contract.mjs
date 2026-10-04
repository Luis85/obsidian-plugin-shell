/** Optional hosting-platform setting (`tooling.hosting`) of a project schema 6 document, and the pure profile the
 * compiler emits from it. Absent means GitHub, the behaviour every project had before this field existed.
 * Only non-secret identifiers are stored: personal access tokens are never part of a project document (sign in with
 * `az login` or a session-only AZURE_DEVOPS_EXT_PAT). Nothing here reads files, runs a CLI or contacts a host. */
export const hostingPlatforms = Object.freeze(['github', 'azure-devops', 'none']);
const ORGANIZATION = /^https:\/\/(?:dev\.azure\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,48}[A-Za-z0-9])?)|([a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?)\.visualstudio\.com)$/;
/** A conservative subset of Azure DevOps project and repository names: safe in Markdown, YAML and a quoted shell word. */
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{0,62}[A-Za-z0-9_-])?$/;
function requireHosting(condition, message) {
  if (!condition) throw new Error('COMPANION_TOOLING_INVALID: ' + message);
}
/** Descriptors are inspected before any value is read, so an accessor can never run. */
function dataRecord(value, allowed, label) {
  requireHosting(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), label + ' must be a plain object.');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    requireHosting(typeof key === 'string' && allowed.includes(key), 'Unknown ' + label + ' field.');
    requireHosting(Object.hasOwn(descriptors[key], 'value') && descriptors[key].enumerable, label + ' must contain only enumerable data fields.');
  }
}
/** Throws COMPANION_TOOLING_INVALID; undefined means the default platform (GitHub). */
export function validateHosting(value) {
  if (value === undefined) return;
  dataRecord(value, ['platform', 'azureDevOps'], 'tooling.hosting');
  requireHosting(hostingPlatforms.includes(value.platform), 'tooling.hosting.platform must be one of ' + hostingPlatforms.join(', ') + '.');
  if (!Object.hasOwn(value, 'azureDevOps')) return;
  requireHosting(value.platform === 'azure-devops', 'tooling.hosting.azureDevOps is allowed only with the azure-devops platform.');
  const azure = value.azureDevOps;
  dataRecord(azure, ['organization', 'project', 'repository'], 'tooling.hosting.azureDevOps');
  requireHosting(typeof azure.organization === 'string' && azure.organization.length <= 120 && ORGANIZATION.test(azure.organization),
    'Azure DevOps organization must be https://dev.azure.com/<organization> or https://<organization>.visualstudio.com.');
  for (const key of ['project', 'repository']) requireHosting((key === 'repository' && azure[key] === undefined) ||
    (typeof azure[key] === 'string' && NAME.test(azure[key])), 'Azure DevOps ' + key + ' must be 1-64 letters, digits, spaces, dots, underscores or hyphens.');
}
/** JSON Schema of the field. The runtime validator stays authoritative (platform/azureDevOps pairing). */
export function hostingSchema() {
  const name = { type: 'string', minLength: 1, maxLength: 64, pattern: NAME.source };
  return { type: 'object', additionalProperties: false, required: ['platform'], properties: {
    platform: { enum: [...hostingPlatforms], default: 'github' },
    azureDevOps: { type: 'object', additionalProperties: false, required: ['organization', 'project'], properties: {
      organization: { type: 'string', maxLength: 120, pattern: ORGANIZATION.source }, project: name, repository: name,
    }, description: 'Only with the azure-devops platform. Repository defaults to the project name. Never a token.' },
  }, description: 'Where pull requests and CI live; absent means github. Prepares files and CLI hints only: no sign-in, token or remote call.' };
}
/** The validated hosting value of an already validated project document, or undefined. */
export function projectHosting(document) {
  const tooling = document?.tooling;
  if (tooling === undefined || !Object.hasOwn(tooling, 'hosting')) return undefined;
  validateHosting(tooling.hosting);
  return tooling.hosting;
}
/** `https://dev.azure.com/org` or legacy `https://org.visualstudio.com`, with project and repository URL-encoded. */
function azureRemote(azure) {
  if (!azure) return null;
  const path = encodeURIComponent(azure.project) + '/_git/' + encodeURIComponent(azure.repository ?? azure.project);
  return azure.organization + '/' + path;
}
const githubHints = prTemplatePath => `## Hosting and pull requests

This project is prepared for GitHub. \`.github/workflows/ci.yml\` runs the gates on every pull request and push to
\`main\`; \`.github/workflows/obsidian.yml\` runs real Obsidian on \`main\` and on a pull request labelled \`run-obsidian\`.
Pull requests use \`${prTemplatePath}\`. With the GitHub CLI (sign in once with \`gh auth login\`):

- \`gh pr create --draft --fill\`: open a draft pull request, then fill the template with real output.
- \`gh pr ready\`: mark it ready for review after the checks pass.
- \`gh run list --branch <branch>\` and \`gh run view <run-id> --log-failed\`: CI results.
`;
function azureHints(prTemplatePath, azure) {
  const organization = azure?.organization ?? 'https://dev.azure.com/<organization>';
  const project = azure?.project ?? '<project>', repository = azure?.repository ?? azure?.project ?? '<repository>';
  const remote = azureRemote(azure);
  const setup = [...(remote ? [`Connect this folder to its repository when it has no remote yet: \`git remote add origin ${remote}\``] : []),
    'Create the pipeline from `azure-pipelines.yml` and add it to `main` as a build-validation branch policy.\n   ' +
    'Azure Repos ignores YAML `pr:` triggers; the policy runs the checks on every pull-request update.',
    'Sign in with `az login`, or set `AZURE_DEVOPS_EXT_PAT` in your own shell for one session. Never commit a token.',
    '`az extension add --name azure-devops`', `\`az devops configure --defaults organization=${organization} project="${project}"\``];
  return `## Hosting and pull requests

This project is prepared for Azure DevOps (Azure Repos and Azure Pipelines). \`azure-pipelines.yml\` has a \`Check\`
stage (typecheck, lint, product tests, release build, advisory community-review rules), a \`UI\` stage (browser
journeys and the UI review gallery as pipeline artifacts on pull requests and manual runs) and an \`Obsidian\` stage
that runs real Obsidian on \`main\` and when a run sets the \`runObsidian\` parameter (Azure Repos has no pull-request
labels). Pull requests use \`${prTemplatePath}\`.

Set up once; no token is stored in this repository:

${setup.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Daily loop:

- \`az repos pr create --draft true --repository "${repository}" --source-branch <branch> --target-branch main --title "<title>"\`: open a draft pull request, then fill the template with real output.
- \`az repos pr update --id <pr-id> --draft false\`: publish the draft for review after the checks pass.
- \`az pipelines runs list --branch <branch> --top 5\` and \`az pipelines runs show --id <run-id>\`: pipeline results.
- \`az pipelines run --name <pipeline> --branch <branch> --parameters runObsidian=true\`: real-Obsidian evidence on demand.
- \`az boards work-item show --id <work-item-id>\`: read the work item a requirement traces to.

Tiers: Dev is the local loop (\`npm run check:fast\`, a draft pull request); Integration is the build-validation run
of \`Check\` and \`UI\` on every pull-request update, plus a \`runObsidian\` run when host behaviour changed; Release is
a push to \`main\`, which also runs \`Obsidian\`. Draft detection is unreliable on Azure Repos, so nothing depends on
\`System.PullRequest.IsDraft\`.
Dependabot is GitHub-only and is not emitted: review \`npm outdated\` and update dependencies through a pull request.
`;
}
const noneHints = prTemplatePath => `## Hosting and pull requests

No hosting platform is configured, so this project has no CI pipeline and no pull-request template. Run the gates
locally (\`npm run check\`, \`npm run verify:project\`) and record each change with \`${prTemplatePath}\`. To prepare
GitHub or Azure DevOps integration, set \`tooling.hosting\` in the project definition and regenerate.
`;
/** Read-only status commands are pre-approved; anything that creates, publishes or queues asks; token handling is denied. */
const azurePermissions = Object.freeze({
  allow: ['Bash(az repos pr list)', 'Bash(az repos pr list *)', 'Bash(az repos pr show *)', 'Bash(az pipelines runs list)',
    'Bash(az pipelines runs list *)', 'Bash(az pipelines runs show *)', 'Bash(az boards work-item show *)'],
  ask: ['Bash(az repos pr create *)', 'Bash(az repos pr update *)', 'Bash(az pipelines run *)', 'Bash(az repos ref create *)'],
  deny: ['Bash(az devops login*)', 'Bash(*AZURE_DEVOPS_EXT_PAT=*)'],
});
const noPermissions = Object.freeze({ allow: [], ask: [], deny: [] });
/** Platform files, in emission order: review files after the task template, CI files after the editor config. */
const platformFiles = {
  github: { prTemplatePath: '.github/pull_request_template.md',
    reviewFiles: [['.github/pull_request_template.md', 'pull-request-template.md.tmpl'], ['.github/copilot-instructions.md', 'agent-pointer.md.tmpl']],
    ciFiles: [['.github/workflows/ci.yml', 'workflow-ci.yml.tmpl'], ['.github/workflows/obsidian.yml', 'workflow-obsidian.yml.tmpl']], prune: [] },
  'azure-devops': { prTemplatePath: '.azuredevops/pull_request_template.md',
    reviewFiles: [['.azuredevops/pull_request_template.md', 'pull-request-template.md.tmpl']],
    ciFiles: [['azure-pipelines.yml', 'azure-pipelines.yml.tmpl']], prune: ['.github/'] },
  none: { prTemplatePath: 'docs/project-tasks/CHANGE-SUMMARY.md',
    reviewFiles: [['docs/project-tasks/CHANGE-SUMMARY.md', 'pull-request-template.md.tmpl']], ciFiles: [], prune: ['.github/'] },
};
/** One sentence that ends the definition-of-done step in AGENTS.md. */
const agentHints = {
  github: 'Pull requests and CI are on GitHub (`gh`): see "Hosting and pull requests" in `README.md`.',
  'azure-devops': 'Pull requests and pipelines are on Azure DevOps (`az repos`, `az pipelines`): see "Hosting and pull requests" in `README.md`.',
  none: 'No hosting platform is configured, so there is no CI: see "Hosting and pull requests" in `README.md`.',
};
/**
 * What a generated project receives for its hosting platform. `prune` lists framework input prefixes (pre-relocation
 * paths) a project on this platform does not receive; `remoteUrl` is null unless Azure details are known.
 */
export function hostingProfile(hosting) {
  validateHosting(hosting);
  const platform = hosting?.platform ?? 'github', files = platformFiles[platform];
  const cliHints = platform === 'github' ? githubHints(files.prTemplatePath)
    : platform === 'azure-devops' ? azureHints(files.prTemplatePath, hosting.azureDevOps) : noneHints(files.prTemplatePath);
  const permissions = platform === 'azure-devops' ? azurePermissions : noPermissions;
  return { platform, prTemplatePath: files.prTemplatePath, reviewFiles: files.reviewFiles.map(pair => [...pair]),
    ciFiles: files.ciFiles.map(pair => [...pair]), prune: [...files.prune], cliHints, agentHint: agentHints[platform],
    remoteUrl: platform === 'azure-devops' ? azureRemote(hosting.azureDevOps) : null,
    claudePermissions: { allow: [...permissions.allow], ask: [...permissions.ask], deny: [...permissions.deny] } };
}
/** True when a framework input path is not part of a project on this profile's platform. */
export function prunedByHosting(profile, path) {
  return profile.prune.some(prefix => prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix);
}
/** Host of an https/ssh URL or an scp-like `user@host:path` remote, lower-cased; null for anything else. */
function remoteHost(url) {
  if (typeof url !== 'string' || url.length > 2048 || /[\u0000- \u007f]/.test(url)) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
  }
  return /^(?:[^@/:]+@)?([A-Za-z0-9.-]+):(?!\/\/)/.exec(url)?.[1]?.toLowerCase() ?? null;
}
/** Which supported platform a git remote URL points to: 'github', 'azure-devops' or null (unknown or unsupported). */
export function classifyRemote(url) {
  const host = remoteHost(url);
  if (host === null) return null;
  if (host === 'github.com' || host === 'ssh.github.com') return 'github';
  if (host === 'dev.azure.com' || host === 'ssh.dev.azure.com' || /^(?:[a-z0-9-]+\.)+visualstudio\.com$/.test(host)) return 'azure-devops';
  return null;
}
/** Azure DevOps details from a dev.azure.com https or ssh (v3) remote, for a setup prompt default; null otherwise. */
export function azureRemoteDetails(url) {
  if (classifyRemote(url) !== 'azure-devops') return null;
  const match = /^https:\/\/(?:[^@/]+@)?dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/?#]+)$/.exec(url) ??
    /^(?:ssh:\/\/)?git@ssh\.dev\.azure\.com[:/]v3\/([^/]+)\/([^/]+)\/([^/?#]+)$/.exec(url);
  if (!match) return null;
  let parts;
  try { parts = match.slice(1).map(part => decodeURIComponent(part)); } catch { return null; }
  const details = { organization: 'https://dev.azure.com/' + parts[0], project: parts[1], repository: parts[2] };
  try { validateHosting({ platform: 'azure-devops', azureDevOps: details }); } catch { return null; }
  return details;
}
