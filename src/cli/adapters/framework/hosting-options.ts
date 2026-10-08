/** CLI flags for the optional hosting platform (`tooling.hosting`), shared by setup, new and `hosting set`.
 * Only non-secret identifiers are accepted; nothing here runs `gh`/`az`, adds a remote or stores a token. */
import { withHostingOption } from '#shared/companion/tooling-options.ts';
import { hostingProfile, projectHosting, type ProjectHosting } from '#shared/companion/schema/hosting.mjs';
import type { AuthoringDocument } from '#shared/companion/authoring-contract.ts';
import type { Values } from './contracts.ts';
export const hostingFlags = ['hosting', 'azure-organization', 'azure-project', 'azure-repository'] as const;
export function hostingRequested(options: Values): boolean {
  return hostingFlags.some(flag => options[flag] !== undefined);
}
/** Explicit flags override the document; without them the input document is returned unchanged. */
export function withHostingFlags(document: unknown, options: Values, platform = options.hosting): AuthoringDocument {
  return withHostingOption(document, { hosting: platform, azureOrganization: options['azure-organization'],
    azureProject: options['azure-project'], azureRepository: options['azure-repository'] });
}
/** Printed hints that connect a new local repository to its platform; the user runs them after review. */
function connectSteps(hosting: ProjectHosting | undefined, name: string): string[] {
  if (hosting?.platform === 'azure-devops') return azureSteps(hosting);
  if (hosting?.platform === 'none') return ['No hosting platform: run the gates locally. Later: node bin/app hosting set github|azure-devops, then generate.'];
  return [`gh repo create ${name} --private --source . --remote origin`,
    'or connect an existing repository: git remote add origin https://github.com/<owner>/<repository>.git'];
}
/** Without known details the commands keep placeholders the user fills in. */
function azureSteps(hosting: ProjectHosting): string[] {
  const azure = { organization: 'https://dev.azure.com/<organization>', project: '<project>', ...hosting.azureDevOps };
  const repository = hosting.azureDevOps ? azure.repository ?? azure.project : '<repository>';
  const remote = hostingProfile(hosting).remoteUrl ?? 'https://dev.azure.com/<organization>/<project>/_git/<repository>';
  return ['az extension add --name azure-devops   (once), then az login',
    `az repos create --name "${repository}" --project "${azure.project}" --organization ${azure.organization}`,
    `git remote add origin ${remote}`];
}
/** What a plan or summary reports about the project's hosting platform. */
export function hostingSummary(document: AuthoringDocument) {
  const hosting = projectHosting(document), profile = hostingProfile(hosting);
  return { platform: profile.platform, configured: hosting !== undefined, remoteUrl: profile.remoteUrl,
    files: [...profile.reviewFiles, ...profile.ciFiles].map(([path]) => path), connect: connectSteps(hosting, document.project.id) };
}
