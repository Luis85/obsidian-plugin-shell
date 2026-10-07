/**
 * `source add` scaffolds a self-contained src/<name> from templates/sources/<kind> (code, one passing test, both
 * tsconfigs), declares it and records the scaffold hashes in .workbench/sources/<name>.json. `source remove` deletes
 * only files that still match those hashes (or the current derived tsconfig) and keeps and lists every other file.
 */
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createFilePlan, type FilePlanEntry } from '#shared/platform/file-plan.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { SOURCE_KINDS, projectTsconfig, testsTsconfig, type SourceKind, type SourcePlatform } from '../domain/source-projects.ts';
import { addProject, removeProject } from '../domain/source-projects-edit.ts';
import { renderTemplate } from '../compiler/emitters/devkit-files.ts';
import { resolveTemplateRoot } from './template-root.ts';
import { hash, readBounded } from './framework/files.ts';
import { requireThat, stringOption, type Context, type Request } from './framework/contracts.ts';
import { derivedChanges } from './source-derived.ts';
import { declaredManifest, manifestEntry, selected, type SourcePlanned } from './source-plan-support.ts';
import { domain, listFiles, readJsonFile, readSourceState } from './source-workspace.ts';
import { withSuite } from './source-suites.ts';

export const receiptPath = (name: string): string => `.workbench/sources/${name}.json`;
export interface SourceReceipt { schemaVersion: 1; project: string; kind: SourceKind; files: Record<string, string> }
export async function readReceipt(root: string, name: string): Promise<SourceReceipt | null> {
  const file = await readJsonFile(root, receiptPath(name)).catch(() => null);
  const value = file?.value as Partial<SourceReceipt> | undefined;
  return value?.schemaVersion === 1 && value.files && typeof value.files === 'object' ? value as SourceReceipt : null;
}
async function templateFiles(context: Context, kind: SourceKind, name: string): Promise<Map<string, string>> {
  const folder = `templates/sources/${kind}`, templateRoot = await resolveTemplateRoot(context.frameworkRoot);
  const files = new Map<string, string>();
  for (const path of await listFiles(templateRoot, folder)) {
    const relative = path.slice(folder.length + 1).replace(/\.tmpl$/, '');
    files.set(`src/${name}/${relative}`, renderTemplate((await readBounded(join(templateRoot, path))).toString('utf8'), { name }));
  }
  requireThat(files.size, 'SOURCE_TEMPLATE_MISSING', `The ${kind} template (${folder}) is missing from this Workbench installation.`);
  return files;
}
function addOptions(request: Request) {
  const [name] = request.args, kind = stringOption(request.options, 'kind'), platform = stringOption(request.options, 'platform');
  requireThat(name && request.args.length === 1, 'SOURCE_ARGUMENTS', 'Supply the project name: source add <name> --kind <kind>.');
  requireThat(kind && SOURCE_KINDS.includes(kind as SourceKind), 'SOURCE_KIND', `Supply --kind ${SOURCE_KINDS.join('|')}.`);
  requireThat(platform === undefined || platform === 'node' || platform === 'browser', 'SOURCE_PLATFORM', '--platform is node or browser.');
  const references = (stringOption(request.options, 'references') ?? '').split(',').map(item => item.trim()).filter(Boolean);
  return { name, kind: kind as SourceKind, ...(platform ? { platform: platform as SourcePlatform } : {}), references };
}
export async function sourceAddPlan(request: Request, context: Context): Promise<SourcePlanned> {
  const input = addOptions(request), state = await readSourceState(context.root);
  const manifest = await domain(() => addProject(state.manifest, input));
  const project = manifest.projects.find(item => item.name === input.name)!;
  requireThat(!(await listFiles(context.root, project.path)).length, 'SOURCE_PATH_EXISTS', `${project.path} already holds files; choose another name or declare it by hand.`);
  const files = await templateFiles(context, input.kind, input.name);
  files.set(`${project.path}/tsconfig.json`, json(projectTsconfig(project, manifest)));
  files.set(`${project.path}/tests/tsconfig.json`, json(testsTsconfig(project, manifest)));
  const changes = selected(await derivedChanges(context.root, manifest, { overlay: files }), path => path === 'tsconfig.json' || path === 'package.json');
  const suites = await withSuite(context.root, input.name);
  const receipt: SourceReceipt = { schemaVersion: 1, project: input.name, kind: input.kind, files: Object.fromEntries([...files].map(([path, text]) => [path, hash(text)])) };
  const entries: FilePlanEntry[] = [...[...files].map(([path, content]) => ({ path, content })), manifestEntry(manifest), ...changes.entries,
    ...suites.entries, { path: receiptPath(input.name), content: json(receipt) }];
  return { plan: await createFilePlan(context.root, entries), conflicts: [],
    summary: { project, alias: input.kind === 'library' ? `#${input.name}/*` : null, files: [...files.keys()], suite: suites.suite,
      manual: [...changes.manual, ...suites.manual], next: `source check, then node --test ${project.path}/tests` } };
}

/** Whether a file still holds exactly this JSON value (the derived tsconfig is regenerated by link/unlink, so it never matches its first hash). */
function holds(bytes: Buffer, value: unknown): boolean {
  try { return value !== undefined && isDeepStrictEqual(JSON.parse(bytes.toString('utf8')), value); } catch { return false; }
}
export async function sourceRemovePlan(request: Request, context: Context): Promise<SourcePlanned> {
  const [name] = request.args;
  requireThat(name && request.args.length === 1, 'SOURCE_ARGUMENTS', 'Supply the project name: source remove <name>.');
  const current = await declaredManifest(context), manifest = await domain(() => removeProject(current, name));
  const project = current.projects.find(item => item.name === name)!, receipt = await readReceipt(context.root, name);
  const derived = new Map([[`${project.path}/tsconfig.json`, projectTsconfig(project, current)], [`${project.path}/tests/tsconfig.json`, testsTsconfig(project, current)]]);
  const removed: string[] = [], retained: string[] = [];
  for (const path of await listFiles(context.root, project.path)) {
    const bytes = await readBounded(join(context.root, path), 8_000_000);
    (receipt?.files[path] === hash(bytes) || holds(bytes, derived.get(path)) ? removed : retained).push(path);
  }
  const changes = selected(await derivedChanges(context.root, manifest), path => path === 'tsconfig.json' || path === 'package.json');
  const entries: FilePlanEntry[] = [...removed.map(path => ({ path, content: null })), manifestEntry(manifest), ...changes.entries,
    ...(receipt ? [{ path: receiptPath(name), content: null }] : [])];
  return { plan: await createFilePlan(context.root, entries), conflicts: [],
    summary: { project: name, removed, retained, receipt: receipt ? receiptPath(name) : 'none (files not scaffolded by source add are always kept)',
      manual: [...changes.manual, ...(retained.length ? [`${project.path} keeps ${retained.length} edited or unrecorded files; move or delete them yourself (the boundary gate reports code outside declared projects).`] : []),
        `Remove the source:${name} suite from tests/suites.json if source add created it.`], next: 'source check' } };
}
