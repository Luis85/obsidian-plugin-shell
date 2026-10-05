/**
 * The hosting-platform questions shared by the `framework-setup` and `new-starter` wizards (configs/wizards). Answers
 * become the same flags a headless caller passes (--hosting, --azure-*), so the operation validates them; explicit
 * flags are never asked again. Only the platform name and non-secret Azure DevOps identifiers enter the wizard state,
 * never the origin URL itself.
 */
import { azureRemoteDetails, classifyRemote, hostingPlatforms } from '../../../scripts/companion/schema/hosting.mjs';
import { requireThat, type Request } from '../../adapters/framework/contracts.ts';
import { getPath, type FormValues } from '../../domain/form-model.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
type Options = Request['options'];
type Details = ReturnType<typeof azureRemoteDetails>;
interface HostingState {
  ask: boolean; fallback?: string; details?: Details; given?: { organization: boolean; project: boolean; repository: boolean };
  answer?: string; platform?: string; set?: boolean; azure?: boolean; askOrganization?: boolean; askProject?: boolean; askRepository?: boolean;
  organization?: string; project?: string; repository?: string; repositoryDefault?: string; projectOption?: string;
}
const azureFlags = ['azure-organization', 'azure-project', 'azure-repository'] as const;
const isOptions = (value: unknown): value is Options => typeof value === 'object' && value !== null && !Array.isArray(value);
const hostingOf = (state: FormValues): HostingState => {
  const value = state.hosting;
  requireThat(typeof value === 'object' && value !== null && !Array.isArray(value), 'WIZARD_OPTIONS', 'The hosting questions need hosting.prepare first.');
  return value as HostingState;
};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
/**
 * Which platform hosts pull requests and CI. The default follows the origin remote, else GitHub (Azure DevOps when an
 * --azure-* flag was given); accepting the plain GitHub default leaves the document unchanged (absent hosting means GitHub).
 */
export function prepareHosting(state: FormValues, options: Options, origin: string | null, ask: boolean): void {
  if (!ask || options.hosting !== undefined) { state.hosting = { ask: false }; return; }
  const fallback = classifyRemote(origin) ?? (azureFlags.some(flag => options[flag] !== undefined) ? 'azure-devops' : 'github');
  state.hosting = { ask: true, fallback, details: azureRemoteDetails(origin), projectOption: typeof options['azure-project'] === 'string' ? options['azure-project'] : undefined,
    given: { organization: options['azure-organization'] !== undefined, project: options['azure-project'] !== undefined, repository: options['azure-repository'] !== undefined } };
}
const notes: Record<string, string> = {
  github: 'GitHub hosting: generate emits .github workflows and a pull-request template; gh stays optional.',
  'azure-devops': 'Azure DevOps hosting: generate emits azure-pipelines.yml and .azuredevops/pull_request_template.md; az is never run and no token is stored.',
  none: 'No hosting platform: generate emits no CI pipeline or pull-request template.',
};
/** One platform-aware sentence after the setup interview; without a new design the stored platform is unchanged. */
export function hostingNote(options: Options, designed: boolean): string {
  const platform = typeof options.hosting === 'string' ? options.hosting : 'github';
  const lead = designed || options.hosting !== undefined ? notes[platform] ?? '' : 'Hosting is unchanged (node bin/app hosting show).';
  return `${lead} Setup stays local and preserves every existing remote. Use your reviewed Git client to connect later.\n`;
}
/** The options object `with.into` names (setup: `setup`, new: `result.options`) receives the answers as flags. */
function target(context: ActionContext): Options {
  const into = context.step.with?.into, options = into ? getPath(context.state, into) : undefined;
  requireThat(isOptions(options), 'WIZARD_ACTION', 'hosting.apply needs with.into naming the request options.');
  return options;
}
/** The repository is stored only when asked and different from the project, whose name is not stored twice. */
function repositoryAnswer(hosting: HostingState, project: string | undefined): Options {
  const repository = text(hosting.repository) || hosting.repositoryDefault;
  return hosting.askRepository && repository && repository !== project ? { 'azure-repository': repository } : {};
}
/** Asked Azure DevOps details as flags; a blank organization without a remote default records the platform only. */
function azureAnswers(hosting: HostingState): Options {
  if (!hosting.azure || (hosting.askOrganization && !hosting.organization)) return {};
  const project = text(hosting.project) || hosting.projectOption;
  return { ...(hosting.askOrganization ? { 'azure-organization': String(hosting.organization) } : {}),
    ...(!hosting.given?.project && project ? { 'azure-project': project } : {}), ...repositoryAnswer(hosting, project) };
}
/** Actions behind the hosting steps of configs/wizards/framework-setup.json and new-starter.json. */
export const hostingModule: WizardModule = {
  actions: {
    'hosting.platform': ({ state }) => {
      const hosting = hostingOf(state), answer = text(hosting.answer).toLowerCase(), platform = answer || String(hosting.fallback);
      requireThat(hostingPlatforms.some(item => item === platform), 'HOSTING_OPTION_PLATFORM', 'Choose github, azure-devops or none. No files were changed.');
      const azure = platform === 'azure-devops';
      Object.assign(hosting, { platform, set: Boolean(answer) || platform !== 'github', azure, askOrganization: azure && !hosting.given?.organization, askProject: false, askRepository: false });
      if (azure && hosting.given?.organization) hosting.askProject = !hosting.given.project;
    },
    /** A blank organization without a remote default records the platform only, so the generated hints keep placeholders. */
    'hosting.organization': ({ state }) => {
      const hosting = hostingOf(state), organization = text(hosting.organization) || hosting.details?.organization;
      hosting.organization = organization;
      hosting.askProject = Boolean(organization) && !hosting.given?.project;
    },
    /** The repository defaults to the remote's, else the project; the project name is not stored twice. */
    'hosting.project': ({ state }) => {
      const hosting = hostingOf(state), project = text(hosting.project) || hosting.projectOption;
      hosting.repositoryDefault = hosting.details?.repository ?? project;
      hosting.askRepository = Boolean((hosting.given?.organization || hosting.organization) && project) && !hosting.given?.repository;
    },
    'hosting.apply': context => {
      const hosting = hostingOf(context.state), options = target(context);
      if (!hosting.ask) return;
      if (hosting.set) options.hosting = String(hosting.platform);
      Object.assign(options, azureAnswers(hosting));
    },
  },
};
