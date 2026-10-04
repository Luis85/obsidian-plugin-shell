export type HostingPlatform = 'github' | 'azure-devops' | 'none';
/** Non-secret Azure DevOps identifiers. Organization is https://dev.azure.com/<org> or https://<org>.visualstudio.com. */
export interface AzureDevOpsDetails { organization: string; project: string; repository?: string }
export interface ProjectHosting { platform: HostingPlatform; azureDevOps?: AzureDevOpsDetails }
export interface HostingPermissions { allow: string[]; ask: string[]; deny: string[] }
export interface HostingProfile {
  platform: HostingPlatform;
  /** Where agents and people find the pull-request (or, without hosting, change-summary) template. */
  prTemplatePath: string;
  /** [output path, devkit template] pairs, in emission order. */
  reviewFiles: Array<[string, string]>;
  ciFiles: Array<[string, string]>;
  /** Framework input path prefixes ('folder/') or exact paths a project on this platform does not receive. */
  prune: string[];
  /** Markdown section for README.md. */
  cliHints: string;
  /** One sentence that ends the definition-of-done step in AGENTS.md. */
  agentHint: string;
  remoteUrl: string | null;
  claudePermissions: HostingPermissions;
}
export declare const hostingPlatforms: readonly HostingPlatform[];
/** Throws COMPANION_TOOLING_INVALID; undefined means the default platform (GitHub). */
export declare function validateHosting(value: unknown): asserts value is ProjectHosting | undefined;
export declare function hostingSchema(): Record<string, unknown>;
export declare function projectHosting(document: unknown): ProjectHosting | undefined;
export declare function hostingProfile(hosting: unknown): HostingProfile;
export declare function prunedByHosting(profile: Pick<HostingProfile, 'prune'>, path: string): boolean;
export declare function classifyRemote(url: unknown): 'github' | 'azure-devops' | null;
export declare function azureRemoteDetails(url: unknown): Required<AzureDevOpsDetails> | null;
