/** Terminal-only hosting questions shared by `setup` and `new`. Answers become the same flags a headless caller
 * passes (--hosting, --azure-*), so the operation validates them; explicit flags are never asked again. */
import { azureRemoteDetails, classifyRemote, hostingPlatforms } from '../../../scripts/companion/hosting-contract.mjs';
import { requireThat, type Request } from '../../adapters/framework/contracts.ts';
type Prompt = (message: string) => Promise<string>;
type Options = Request['options'];
type Details = ReturnType<typeof azureRemoteDetails>;
const azureFlags = ['azure-organization', 'azure-project', 'azure-repository'] as const;
/** Organization, project and repository, each defaulting from an Azure DevOps origin remote; a blank organization
 * without a default records the platform only, so the generated hints keep placeholders. */
async function askAzure(options: Options, prompt: Prompt, details: Details): Promise<void> {
  if (options['azure-organization'] === undefined && !await askOrganization(options, prompt, details)) return;
  if (options['azure-project'] === undefined) {
    const project = (await prompt(`Azure DevOps project${details ? ` [${details.project}]` : ''}: `)).trim() || details?.project;
    requireThat(project, 'HOSTING_OPTION_INCOMPLETE', 'Azure DevOps details need both an organization and a project. No files were changed.');
    options['azure-project'] = project;
  }
  if (options['azure-repository'] === undefined) await askRepository(options, prompt, details);
}
/** False when the answer is blank and the remote offers no default: the platform is recorded without details. */
async function askOrganization(options: Options, prompt: Prompt, details: Details): Promise<boolean> {
  const suffix = details ? ` [${details.organization}]` : ', blank to add later';
  const organization = (await prompt(`Azure DevOps organization URL (https://dev.azure.com/<organization>)${suffix}: `)).trim() || details?.organization;
  if (organization) options['azure-organization'] = organization;
  return Boolean(organization);
}
/** The repository defaults to the remote's, else the project; the project name is not stored twice. */
async function askRepository(options: Options, prompt: Prompt, details: Details): Promise<void> {
  const fallback = details?.repository ?? String(options['azure-project']);
  const repository = (await prompt(`Azure DevOps repository [${fallback}]: `)).trim() || fallback;
  if (repository !== options['azure-project']) options['azure-repository'] = repository;
}
/** Which platform hosts pull requests and CI. The default follows the origin remote, else GitHub; accepting the plain
 * GitHub default leaves the document unchanged (absent hosting already means GitHub). */
export async function askHosting(options: Options, prompt: Prompt, origin: string | null): Promise<void> {
  if (options.hosting !== undefined) return;
  const detected = classifyRemote(origin);
  const fallback = detected ?? (azureFlags.some(flag => options[flag] !== undefined) ? 'azure-devops' : 'github');
  const answer = (await prompt(`Hosting platform for pull requests and CI: github, azure-devops or none? Prepares files and CLI hints only; nothing signs in. [${fallback}] `)).trim().toLowerCase();
  const platform = answer || fallback;
  requireThat(hostingPlatforms.some(item => item === platform), 'HOSTING_OPTION_PLATFORM', 'Choose github, azure-devops or none. No files were changed.');
  if (answer || platform !== 'github') options.hosting = platform;
  if (platform === 'azure-devops') await askAzure(options, prompt, azureRemoteDetails(origin));
}
const notes: Record<string, string> = {
  github: 'GitHub hosting: generate emits .github workflows and a pull-request template; gh stays optional.',
  'azure-devops': 'Azure DevOps hosting: generate emits azure-pipelines.yml and .azuredevops/pull_request_template.md; az is never run and no token is stored.',
  none: 'No hosting platform: generate emits no CI pipeline or pull-request template.',
};
/** One platform-aware sentence after the interview; without a new design the stored platform is unchanged. */
export function hostingNote(options: Options, designed: boolean): string {
  const platform = typeof options.hosting === 'string' ? options.hosting : 'github';
  const lead = designed || options.hosting !== undefined ? notes[platform] ?? '' : 'Hosting is unchanged (node bin/app hosting show).';
  return `${lead} Setup stays local and preserves every existing remote. Use your reviewed Git client to connect later.\n`;
}
