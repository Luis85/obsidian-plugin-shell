import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { statIfPresent } from '#shared/platform/fs-presence.ts';
import type { ProjectSelection } from '../compiler/domain/project-starter.ts';
import { validateProjectSelection } from '../compiler/adapters/project/selection.ts';
import { discoverProjectConfig, projectConfigCandidates, projectConfigFolder, projectConfigPattern, retiredProjectConfigPath, type ProjectConfigDiscovery } from '../compiler/domain/project-config.ts';
import { requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import { readData } from './storage.ts';
const entryLimit = 256;
/** Entry names directly inside configs/. The contained-path inspection refuses a linked or escaping folder chain. */
async function configEntries(root: string): Promise<string[]> {
  await createFilePlan(root, [{ path: projectConfigFolder + '/.project-config-probe', content: null }]);
  const folder = await statIfPresent(join(root, projectConfigFolder));
  if (!folder) return [];
  requireSketch(folder.isDirectory() && !folder.isSymbolicLink(), 'PROJECT_CONFIG_FOLDER', `${projectConfigFolder}/ must be a directory, not a link or file.`);
  const names = await readdir(join(root, projectConfigFolder));
  requireSketch(names.length <= entryLimit, 'PROJECT_CONFIG_LIMIT', `${projectConfigFolder}/ supports at most ${entryLimit} entries.`);
  return names.sort();
}
async function present(root: string, path: string): Promise<boolean> {
  return (await createFilePlan(root, [{ path, content: null }])).changes[0]!.beforeHash !== null;
}
/** The coded relocation help for the retired root file; there is no silent fallback to it. */
const relocationHelp = `${retiredProjectConfigPath} at the project root is no longer read; the project configuration belongs in ${projectConfigPattern}. ` +
  'In a project created by project-setup, move it with the reviewed migration: pipe {"schemaVersion":1} to node bin/app settings migrate --input - --json, ' +
  'then repeat with --apply <planHash>. Otherwise move the file by hand, naming it after the project ID in design/project.json; regenerate prepared packages and generated sources.';
function located(found: ProjectConfigDiscovery): string | undefined {
  if (found.kind === 'found') return found.path;
  if (found.kind === 'none') return undefined;
  if (found.kind === 'ambiguous') throw new SketchError('PROJECT_CONFIG_AMBIGUOUS', `More than one project configuration: ${found.candidates.join(', ')}. Choose one with --config <path>.`);
  if (found.kind === 'retired') throw new SketchError('PROJECT_CONFIG_RELOCATED', relocationHelp);
  if (found.kind === 'missing') throw new SketchError('PROJECT_CONFIG_MISSING', `The chosen project configuration ${found.path} does not exist.`);
  throw new SketchError('PROJECT_CONFIG_INVALID', `${found.path} is not a project configuration name. Use ${projectConfigPattern} with the lowercase portable project ID.`);
}
/** The explicit --config choice, otherwise the single top-level configs/*-config.json; undefined when the folder has none. */
export async function locateProjectConfig(root: string, explicit?: string): Promise<string | undefined> {
  const names = await configEntries(root);
  const retired = await present(root, retiredProjectConfigPath);
  return located(discoverProjectConfig({ names, retired, ...(explicit === undefined ? {} : { explicit }) }));
}
/** Every candidate path, for read guards that must notice a changed configuration without failing discovery. */
export async function projectConfigFiles(root: string): Promise<string[]> {
  return projectConfigCandidates(await configEntries(root));
}
/** The saved selection records the chosen starter and its complete generator data, so generation never needs the starter again. */
export async function savedProjectConfig(root: string, explicit?: string): Promise<{ path: string; selection: ProjectSelection } | undefined> {
  const path = await locateProjectConfig(root, explicit);
  if (path === undefined) return undefined;
  requireSketch(await present(root, path), 'PROJECT_CONFIG_MISSING', `The project configuration ${path} is not a regular file.`);
  return { path, selection: validateProjectSelection(await readData(join(root, path))) };
}
export async function savedProjectSelection(root: string, explicit?: string): Promise<ProjectSelection | undefined> {
  return (await savedProjectConfig(root, explicit))?.selection;
}
/** A writer may create or keep its own project configuration, never a second one beside another project's. */
export async function requireProjectConfigSlot(root: string, path: string): Promise<void> {
  const existing = await locateProjectConfig(root);
  requireSketch(existing === undefined || existing === path, 'PROJECT_CONFIG_CONFLICT', `${existing} already configures another project in this folder; writing ${path} would make the project ambiguous.`);
}
