import { readFirstRunReport } from '../domain/first-run-report.ts';
import { dirname, join, resolve } from 'node:path';
import { npmEntry } from '../../scripts/framework/process.ts';
import { hash, readBounded } from '../../scripts/framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { object, text } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { installCommand, readFirstRunRequest, type FirstRunRequest } from '../domain/first-run.ts';
import { guardedText, loadSettings, jsonText } from './user-settings.ts';
import { firstRunInventory } from './first-run-inventory.ts';
import { setupPrerequisites } from './project-setup.ts';
import { savedProjectSelection } from './project-selection.ts';
export interface FirstRunTool { entry: string; sha256: string; version: string; node: string }
export interface FirstRunStep { id: 'install' | 'typecheck' | 'test' | 'build'; args: string[] }
export interface FirstRunPlan {
  root: string; app: string; target: 'webapp' | 'website'; options: FirstRunRequest;
  planHash: string; inputHash: string; inventory: { path: string; sha256: string }[];
  tool: FirstRunTool; expected: { node: string; npm: string }; blockers: string[];
  steps: FirstRunStep[]; package: Record<string, unknown>; reportPath: string; reportBeforeHash: string | null;
  review: string[]; guards: { path: string; beforeHash: string | null }[];
}
export async function firstRunTool(): Promise<FirstRunTool> {
  const entry = await npmEntry();
  requireSketch(entry.endsWith('npm-cli.js'), 'FIRST_RUN_NPM', 'Select npm-cli.js using QUALIFIED_NPM, not a command shell or wrapper.');
  const pkg = object(parseJsonData((await readBounded(join(dirname(entry), '../package.json'), 250_000)).toString('utf8')));
  return { entry, sha256: hash(await readBounded(entry)), version: text(pkg.version, 'npm version'), node: process.versions.node };
}
export async function firstRunReport(root: string, path: string) {
  const snapshot = await guardedText(root, path);
  return { ...snapshot, report: snapshot.content === null ? null : readFirstRunReport(parseJsonData(snapshot.content)) };
}
async function readApplication(root: string, app: string) {
  const snapshots = await Promise.all(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.nvmrc', '.maker/receipt.json'].map(path => guardedText(root, app + '/' + path)));
  const [manifest, lock, shrinkwrap, nodeVersion, receipt] = snapshots;
  requireSketch(manifest?.content && nodeVersion?.content && receipt?.content, 'FIRST_RUN_PROJECT', 'First run requires a generated application, its .nvmrc and maker receipt.');
  requireSketch(shrinkwrap?.content === null, 'FIRST_RUN_LOCK', 'npm-shrinkwrap.json is not supported by this generated-project first run.');
  const owner = object(parseJsonData(receipt.content));
  requireSketch(owner.schemaVersion === 1 && Array.isArray(owner.files), 'FIRST_RUN_PROJECT', 'Invalid generated-project ownership receipt.');
  return { manifest, lock, nodeVersion: nodeVersion.content };
}
async function applicationPlan(root: string, app: string, options: FirstRunRequest, tool: FirstRunTool) {
  const { manifest, lock, nodeVersion } = await readApplication(root, app);
  const pkg = object(parseJsonData(manifest.content)), scripts = object(pkg.scripts);
  requireSketch(pkg.workspaces === undefined, 'FIRST_RUN_WORKSPACES', 'First run is scoped to one generated app, not an npm workspace.');
  for (const id of ['typecheck', 'test', 'build']) text(scripts[id], id + ' script', 2000);
  const expectedNode = nodeVersion.trim(), manager = text(pkg.packageManager, 'packageManager');
  requireSketch(/^\d+\.\d+\.\d+$/.test(expectedNode) && /^npm@\d+\.\d+\.\d+$/.test(manager), 'FIRST_RUN_TOOLCHAIN', 'Use exact .nvmrc and npm packageManager versions.');
  const expected = { node: expectedNode, npm: manager.slice(4) };
  const blockers = [tool.node === expected.node ? '' : `Use Node ${expected.node}; found ${tool.node}.`, tool.version === expected.npm ? '' : `Use npm ${expected.npm}; found ${tool.version}.`].filter(Boolean);
  const install = installCommand(options.install, lock?.content ? parseJsonData(lock.content) : null);
  const prefix = ['--prefix', join(root, app), '--workspaces=false'];
  const steps: FirstRunStep[] = [
    { id: 'install', args: [install, ...prefix, '--include=dev', '--no-fund'] },
    ...(['typecheck', 'test', 'build'] as const).map(id => ({ id, args: ['run', id, ...prefix] })),
  ];
  return { expected, blockers, steps, pkg, install };
}
/** Read-only execution proposal. A file-generation approval never authorizes this plan. */
export async function firstRunPlan(root: string, input: unknown, selectedTool?: FirstRunTool): Promise<FirstRunPlan> {
  const tool = selectedTool ?? await firstRunTool();
  root = resolve(root); await setupPrerequisites(root);
  const loaded = await loadSettings(root), settings = loaded.settings;
  const options = readFirstRunRequest(input, settings.preferences.firstRun);
  const app = settings.paths.app, selection = await savedProjectSelection(join(root, app));
  const target = selection?.targets.find(value => value === 'webapp' || value === 'website');
  requireSketch(target === 'webapp' || target === 'website', 'FIRST_RUN_TARGET', 'Generate a browser application before requesting its first run.');
  const { expected, blockers, steps, pkg, install } = await applicationPlan(root, app, options, tool);
  const inventory = await firstRunInventory(root, app);
  const report = await firstRunReport(root, settings.paths.firstRunReport);
  const guards = await Promise.all(['configs/user-settings.json', 'configs/project-setup.json', 'project.config.json', '.npmrc'].map(async path => ({ path, beforeHash: (await guardedText(root, path)).beforeHash })));
  const inputHash = hash(jsonText({ inventory, guards, tool }));
  const planHash = hash(jsonText({ root, app, target, options, inputHash, steps, report: { path: settings.paths.firstRunReport, hash: report.beforeHash } }));
  return { root, app, target, options, inputHash, planHash, inventory, tool, expected, blockers, steps, package: pkg,
    guards, reportPath: settings.paths.firstRunReport, reportBeforeHash: report.beforeHash,
    review: [
      'Downloads dependencies. npm lifecycle and project scripts run with your user permissions, not in a sandbox.',
      install === 'install' ? 'npm install resolves/updates package-lock.json. Review and commit the resolved lock afterward.' : 'npm ci replaces node_modules and refuses lock/manifest mismatches. No fallback to install.',
      'Stops on the first failure. Generated source is kept; external effects and npm caches are not rolled back. No automatic retry.',
      'Uses normal user/global npm configuration and credentials. Do not change source or configuration during execution.',
      options.mode === 'showcase' ? `Serves built ${target} files only on 127.0.0.1:${options.port}, for at most ${options.showcaseDurationMs / 1000} seconds. Browser opening: ${options.openBrowser}. No background daemon.` : 'Verification only: no server and no browser.',
    ] };
}
/** New/removed/edited source and changed tools require a new approval. npm's own lock mutation is accounted for explicitly. */
export async function validateFirstRunInputs(plan: FirstRunPlan, afterInstall = false): Promise<void> {
  await setupPrerequisites(plan.root);
  const inventory = await firstRunInventory(plan.root, plan.app);
  const omitLock = (files: typeof inventory) => files.filter(file => !afterInstall || file.path !== plan.app + '/package-lock.json');
  requireSketch(jsonText(omitLock(inventory)) === jsonText(omitLock(plan.inventory)), 'FIRST_RUN_STALE', 'Application inputs changed after review. Inspect changes and prepare a new first-run plan.');
  for (const guard of plan.guards) requireSketch((await guardedText(plan.root, guard.path)).beforeHash === guard.beforeHash, 'FIRST_RUN_STALE', 'Project settings or configuration changed after review.');
  requireSketch(hash(await readBounded(plan.tool.entry)) === plan.tool.sha256, 'FIRST_RUN_STALE', 'The selected npm executable changed after review.');
}
