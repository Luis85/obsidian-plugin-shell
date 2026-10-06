import { join } from 'node:path';
import { mkdir, lstat, readdir } from 'node:fs/promises';
import { parseAuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { AIRSHIP_VERSION, airshipOptions, airshipConfig } from '../../../../scripts/companion/tooling-contract.mjs';
import { readBounded, readJson, exists } from './files.ts';
import { object } from './configuration.ts';
import { npmEntry, runNode } from './process.ts';
import { requireThat, result, stringOption, type Context, type Request } from './contracts.ts';
const prefix = '.airship-tooling';
const packagePath = prefix + '/node_modules/@airshiplabs/cli/package.json';
const entry = prefix + '/node_modules/@airshiplabs/cli/dist/index.js';
export interface AirshipExecutor { run: typeof runNode; npm: typeof npmEntry }
const defaultExecutor: AirshipExecutor = { run: runNode, npm: npmEntry };
/** Strip upstream configuration overrides; normal provider authentication is not read or logged. */
export function airshipEnvironment(environment: NodeJS.ProcessEnv = process.env): Record<string, undefined> {
  return Object.fromEntries(Object.keys(environment).filter(key => key.toUpperCase().startsWith('AIRSHIP_')).map(key => [key, undefined]));
}
async function installedVersion(root: string): Promise<string | null> {
  if (!await exists(join(root, packagePath))) return null;
  const pkg = object(await readJson(join(root, packagePath)));
  requireThat(pkg.name === '@airshiplabs/cli' && typeof pkg.version === 'string', 'AIRSHIP_PACKAGE_INVALID', 'Unexpected local Airship package.');
  return pkg.version;
}
/** npm must never write through pre-existing links in its isolated prefix. */
async function inspectInstallDirectory(directory: string, counter = { value: 0 }): Promise<void> {
  const stat = await lstat(directory);
  requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'AIRSHIP_TOOL_LINK', 'Tooling directories must not be symlinks.');
  for (const file of await readdir(directory, { withFileTypes: true })) {
    requireThat(++counter.value <= 100000, 'AIRSHIP_TOOL_LIMIT', 'Tooling inventory is too large to inspect safely.');
    if (file.isSymbolicLink()) {
      requireThat(directory.endsWith('/.bin') || directory.endsWith('\\.bin'), 'AIRSHIP_TOOL_LINK', 'Refusing a link in the isolated tooling prefix.');
    } else if (file.isDirectory()) await inspectInstallDirectory(join(directory, file.name), counter);
  }
}
/** The isolated prefix must be a real directory dedicated to the pinned CLI. */
async function prepareInstallPrefix(context: Context): Promise<void> {
  const directory = join(context.root, prefix);
  if (await exists(directory)) requireThat((await lstat(directory)).isDirectory() && !(await lstat(directory)).isSymbolicLink(), 'AIRSHIP_TOOL_LINK', 'Tooling directory must not be a symlink.');
  else await mkdir(directory);
  await inspectInstallDirectory(directory);
  if (!await exists(join(directory, 'package.json'))) return;
  const manifest = object(await readJson(join(directory, 'package.json'))), dependencies = object(manifest.dependencies);
  requireThat(Object.keys(dependencies).length === 1 && dependencies['@airshiplabs/cli'] === AIRSHIP_VERSION &&
    !manifest.devDependencies && !manifest.optionalDependencies, 'AIRSHIP_TOOL_MANIFEST', 'Keep this isolated prefix dedicated to the pinned Airship CLI.');
}
type Document = ReturnType<typeof parseAuthoringDocument>;
type Options = ReturnType<typeof airshipOptions>;
/** Launch only the installed pinned CLI against configuration identical to the validated project tooling. */
async function checkLaunchable(context: Context, document: Document, installed: string | null): Promise<void> {
  requireThat(installed === AIRSHIP_VERSION, 'AIRSHIP_NOT_INSTALLED', 'Run airship install --yes to install the pinned CLI locally.');
  const actual = object(await readJson(join(context.root, 'airship.config.json'))), expected = airshipConfig(document.tooling);
  requireThat(JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort()), 'AIRSHIP_CONFIG_CONFLICT', 'Airship configuration differs from validated project tooling. Reconcile it before launching.');
  // Reading checks every ancestor for links, including @airshiplabs and the executable itself.
  await readBounded(join(context.root, entry), 30_000_000);
}
function launchArgs(command: string, context: Context, options: Options): string[] {
  if (command === 'airship doctor') return ['doctor', '--cwd', context.root, '--target', String(options.targetPort), '--agent', options.agent];
  return ['--cwd', context.root, '--target', String(options.targetPort), '--port', String(options.port), '--host', '127.0.0.1', '--agent', options.agent, '--safe', '--no-commit'];
}
export async function airshipOperation(request: Request, context: Context, executor: AirshipExecutor = defaultExecutor) {
  const document = parseAuthoringDocument((await readBounded(join(context.root, 'design/project.json'), 4_000_000)).toString('utf8'));
  const options = airshipOptions(document.tooling), installed = await installedVersion(context.root);
  const state = { ...options, version: AIRSHIP_VERSION, installedVersion: installed,
    preview: `http://127.0.0.1:${options.targetPort}`, editor: `http://127.0.0.1:${options.port}`,
    productionDependency: false, providerAcceptance: 'not-inferred' };
  if (request.command === 'airship status') return result(request.command, state);
  requireThat(options.enabled, 'AIRSHIP_DISABLED', 'Airship is opt-in. Review airship enable before installing or starting it.');
  if (!request.options.yes || request.options['dry-run']) return result(request.command, { ...state, execution: 'not-run', requires: '--yes' }, 'planned');
  const environment = airshipEnvironment();
  const timeout = Number(stringOption(request.options, 'timeout') ?? (request.command === 'airship start' ? 3600000 : 600000));
  if (request.command === 'airship install') {
    await prepareInstallPrefix(context);
    const execution = await executor.run(context, await executor.npm(), ['install', '--prefix', prefix, '--save-exact', '--ignore-scripts', '--no-audit', '--no-fund', '@airshiplabs/cli@' + AIRSHIP_VERSION], timeout, environment);
    requireThat(await installedVersion(context.root) === AIRSHIP_VERSION, 'AIRSHIP_VERSION', 'The pinned CLI was not installed.');
    return result(request.command, { ...state, installedVersion: AIRSHIP_VERSION, execution }, 'applied');
  }
  await checkLaunchable(context, document, installed);
  return result(request.command, { ...state, execution: await executor.run(context, entry, launchArgs(request.command, context, options), timeout, environment) });
}
