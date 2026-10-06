/** Read-only probe of the Azure CLI for `doctor`: one `az version --output json` call, which lists the installed
 * extensions too. It never installs, signs in, upgrades or reads a token; telemetry is switched off for the call. */
import { execFile } from 'node:child_process';
import type { Diagnostic } from './contracts.ts';
export interface AzureCli { available: boolean; version: string | null; devopsExtension: string | null }
export type AzureProbe = () => Promise<AzureCli>;
const missing: AzureCli = { available: false, version: null, devopsExtension: null };
/** Parses `az version --output json`; anything unexpected reads as unavailable rather than guessed. */
export function parseAzureVersion(stdout: string): AzureCli {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { return missing; }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return missing;
  const record = value as Record<string, unknown>, extensions = record.extensions;
  const version = typeof record['azure-cli'] === 'string' ? record['azure-cli'] : null;
  const devops = extensions && typeof extensions === 'object' ? (extensions as Record<string, unknown>)['azure-devops'] : undefined;
  return { available: version !== null, version, devopsExtension: typeof devops === 'string' ? devops : null };
}
function probeEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, AZURE_CORE_COLLECT_TELEMETRY: 'false', AZURE_CORE_NO_COLOR: 'true' };
  delete environment.AZURE_DEVOPS_EXT_PAT;
  return environment;
}
/** Windows installs az as a .cmd shim, which Node starts only through a shell; the arguments are fixed. */
export const probeAzureCli: AzureProbe = () => new Promise(accept => {
  const windows = process.platform === 'win32';
  execFile(windows ? 'az.cmd' : 'az', ['version', '--output', 'json'], { shell: windows, windowsHide: true, timeout: 20_000,
    maxBuffer: 1_048_576, encoding: 'utf8', env: probeEnvironment() }, (error, stdout) => accept(error ? missing : parseAzureVersion(stdout)));
});
/** Doctor diagnostics for an Azure DevOps project; the next steps are printed, never run. */
export function azureDiagnostics(cli: AzureCli): Diagnostic[] {
  if (!cli.available) return [{ code: 'AZURE_CLI_MISSING', message: 'This project is hosted on Azure DevOps, but the az CLI was not found. Nothing was installed.',
    next: 'Install the Azure CLI (https://aka.ms/installazurecli), then: az extension add --name azure-devops; az login' }];
  if (!cli.devopsExtension) return [{ code: 'AZURE_DEVOPS_EXTENSION_MISSING', message: 'The az CLI has no azure-devops extension, so az repos and az pipelines are unavailable. Nothing was installed.',
    next: 'az extension add --name azure-devops' }];
  return [];
}
