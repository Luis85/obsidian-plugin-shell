/** Explicit creation/setup choices copied into a project document. Callers (setup, `new`, a `hosting set` command)
 * pass the parsed options; omission preserves the input document unchanged.
 * - withAirshipOption(document, { airship?: true, 'no-airship'?: true })
 * - withHostingOption(document, { hosting?: 'github'|'azure-devops'|'none', azureOrganization?, azureProject?, azureRepository? })
 *   Azure keys require the azure-devops platform (given here or already in the document) and merge into the stored
 *   details; choosing github or none drops them. Values are validated by the shared hosting contract; tokens are never
 *   accepted. Errors start with HOSTING_OPTION_ (option misuse) or COMPANION_TOOLING_INVALID (invalid value). */
import { validateAuthoringDocument, type AuthoringDocument } from './authoring-contract.ts';
import { airshipOptions } from './tooling-contract.mjs';
import { hostingPlatforms, projectHosting, type HostingPlatform, type ProjectHosting } from './hosting-contract.mjs';
/** Explicit creation/setup flags override data; omission preserves the original bytes. */
export function withAirshipOption(input: unknown, flags: Record<string, string | boolean>): AuthoringDocument {
  const document = validateAuthoringDocument(input);
  if (flags.airship && flags['no-airship']) throw new Error('AIRSHIP_OPTION_CONFLICT: Choose --airship or --no-airship.');
  if (!flags.airship && !flags['no-airship']) return document;
  const next = structuredClone(document);
  next.tooling = { ...next.tooling, airship: { ...airshipOptions(next.tooling), enabled: flags.airship === true } };
  return validateAuthoringDocument(next);
}
const azureOptions = { organization: 'azureOrganization', project: 'azureProject', repository: 'azureRepository' } as const;
function optionText(options: Readonly<Record<string, string | boolean | undefined>>, key: string): string | undefined {
  const value = options[key];
  if (value !== undefined && typeof value !== 'string') throw new Error(`HOSTING_OPTION_VALUE: ${key} needs a value.`);
  return value;
}
function hostingPlatform(value: string): HostingPlatform {
  const platform = hostingPlatforms.find(item => item === value);
  if (platform === undefined) throw new Error(`HOSTING_OPTION_PLATFORM: Choose one of ${hostingPlatforms.join(', ')}.`);
  return platform;
}
/** Sets tooling.hosting from explicit options; see the module comment for the accepted keys. */
export function withHostingOption(input: unknown, options: Readonly<Record<string, string | boolean | undefined>>): AuthoringDocument {
  const document = validateAuthoringDocument(input);
  const requested = optionText(options, 'hosting');
  const given = { organization: optionText(options, azureOptions.organization), project: optionText(options, azureOptions.project),
    repository: optionText(options, azureOptions.repository) };
  const azureGiven = Object.values(given).some(value => value !== undefined);
  if (requested === undefined && !azureGiven) return document;
  const current = projectHosting(document);
  const platform = requested === undefined ? current?.platform ?? 'github' : hostingPlatform(requested);
  if (azureGiven && platform !== 'azure-devops') throw new Error('HOSTING_OPTION_CONFLICT: Azure DevOps details need the azure-devops hosting platform.');
  let hosting: ProjectHosting = { platform };
  if (platform === 'azure-devops') {
    const stored = current?.platform === 'azure-devops' ? current.azureDevOps : undefined;
    const organization = given.organization ?? stored?.organization, project = given.project ?? stored?.project;
    const repository = given.repository ?? stored?.repository;
    if (organization !== undefined || project !== undefined || repository !== undefined) {
      if (organization === undefined || project === undefined)
        throw new Error('HOSTING_OPTION_INCOMPLETE: Azure DevOps details need both an organization and a project.');
      hosting = { platform, azureDevOps: { organization, project, ...(repository === undefined ? {} : { repository }) } };
    }
  }
  const next = structuredClone(document);
  next.tooling = { ...next.tooling, hosting };
  return validateAuthoringDocument(next);
}
