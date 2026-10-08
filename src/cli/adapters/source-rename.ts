/**
 * `source rename <old> <new>`: one reviewed plan moves src/<old> to src/<new> (each file deleted at the old path and
 * created at the new one, byte-identical unless an import changes), renames the manifest entry and every reference,
 * the `#old/*` alias, the derived tsconfigs, and rewrites every import specifier that named the old alias or path in
 * src/, tooling/, tests/ and configs/. Other textual mentions (paths in JSON or scripts) are listed for review.
 */
import { join } from 'node:path';
import { createFilePlan, type FilePlanEntry } from '#shared/platform/file-plan.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { renameProject } from '../domain/source-projects-edit.ts';
import { testsTsconfig, type SourceManifest, type SourceProject } from '../domain/source-projects.ts';
import { normalizePath, renamedSpecifier, type AliasPrefixes, type ProjectRename } from '../domain/source-imports.ts';
import { hash, readBounded } from './framework/files.ts';
import { requireThat, type Context, type Request } from './framework/contracts.ts';
import { derivedChanges } from './source-derived.ts';
import { declaredManifest, manifestEntry, selected, type SourcePlanned } from './source-plan-support.ts';
import { codeFile, domain, listFiles, parseSourceJson, repositoryAliases, scanImports } from './source-workspace.ts';
import { readReceipt, receiptPath } from './source-scaffold.ts';
import { renameSuite } from './source-suites.ts';

type TestsConfig = { compilerOptions?: { tsBuildInfoFile?: string } };
const testsBuildInfo = (project: SourceProject, manifest: SourceManifest): string | undefined => (testsTsconfig(project, manifest) as TestsConfig).compilerOptions?.tsBuildInfoFile;

const scanned = ['src', 'tooling', 'tests', 'configs'];
const within = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);
const moved = (path: string, rename: ProjectRename): string => within(path, rename.fromPath) ? rename.toPath + path.slice(rename.fromPath.length) : path;

/** Encode the decoded replacement in the original literal's quote style. */
function encodedSpecifier(value: string, quote: string | undefined): string {
  const text = JSON.stringify(value).slice(1, -1);
  if (quote === "'") return text.replace(/'/g, "\\'");
  return quote === '`' ? text.replace(/`|\$\{/g, match => `\\${match}`) : text;
}
/** Every code file whose specifiers change, with its rewritten text. */
async function rewrites(root: string, files: readonly string[], rename: ProjectRename, aliases: AliasPrefixes) {
  const changed = new Map<string, string>(), skipped: string[] = [];
  for (const { file, text, specifiers } of await scanImports(root, files)) {
    let next = text;
    for (const item of [...specifiers].sort((a, b) => b.start - a.start)) {
      const replacement = renamedSpecifier(file, item.specifier, rename, aliases);
      if (replacement === null) continue;
      const encoded = encodedSpecifier(replacement, text[item.start - 1]);
      next = next.slice(0, item.start) + encoded + next.slice(item.end);
    }
    if (next !== text) changed.set(file, next);
  }
  return { changed, skipped };
}
/** Repository files outside the moved folder that still mention the old path as text (scripts, JSON, docs in configs). */
async function mentions(root: string, files: readonly string[], fromPath: string): Promise<string[]> {
  const found: string[] = [];
  for (const file of files.filter(path => /\.(?:json|ya?ml|mjs|cjs|js|ts)$/.test(path)).slice(0, 5000)) {
    const text = (await readBounded(join(root, file), 8_000_000)).toString('utf8');
    if (text.includes(`${fromPath}/`)) found.push(file);
  }
  return found;
}
interface Moved { entries: FilePlanEntry[]; overlay: Map<string, string> }
/** Each project file deleted at its old path and created at the new one: byte-identical unless an import changed. */
async function movedFiles(root: string, project: readonly string[], rename: ProjectRename, changed: ReadonlyMap<string, string>): Promise<Moved> {
  const overlay = new Map<string, string>(), entries: FilePlanEntry[] = [];
  for (const path of project) {
    const target = moved(path, rename), text = changed.get(path);
    const bytes = text === undefined ? await readBounded(join(root, path), 8_000_000) : null;
    // Derived JSON is recomputed from the moved content (overlay) instead of the old disk location.
    if (codeFile.test(path) || path.endsWith('.json')) overlay.set(target, text ?? bytes!.toString('utf8'));
    if (target === path) { if (text !== undefined) entries.push({ path, content: text }); continue; }
    entries.push({ path, content: null }, text === undefined ? { path: target, content: bytes!.toString('base64'), encoding: 'base64' } : { path: target, content: text });
  }
  return { entries, overlay };
}
/** A derived file replaces the moved or rewritten entry for the same path. */
function merged(entries: FilePlanEntry[], derived: readonly FilePlanEntry[]): FilePlanEntry[] {
  const paths = new Set(derived.map(entry => entry.path));
  return [...entries.filter(entry => !paths.has(entry.path)), ...derived];
}
async function receiptEntries(root: string, from: string, to: string, rename: ProjectRename, entries: readonly FilePlanEntry[]): Promise<FilePlanEntry[]> {
  const receipt = await readReceipt(root, from);
  if (!receipt) return [];
  const files: Record<string, string> = {};
  for (const [path, digest] of Object.entries(receipt.files)) {
    const target = moved(path, rename), entry = entries.find(item => item.path === target && item.content !== null);
    const original = normalizePath(path) === path && within(path, rename.fromPath) ? await readBounded(join(root, path), 8_000_000).catch(() => null) : null;
    files[target] = entry && original && hash(original) === digest
      ? hash(entry.encoding === 'base64' ? Buffer.from(entry.content!, 'base64') : entry.content!) : digest;
  }
  return [{ path: receiptPath(from), content: null }, { path: receiptPath(to), content: json({ ...receipt, project: to, files }) }];
}
function renameOf(current: SourceManifest, manifest: SourceManifest, from: string, to: string): ProjectRename {
  const before = current.projects.find(item => item.name === from)!, after = manifest.projects.find(item => item.name === to)!;
  return { fromPath: before.path, toPath: after.path, ...(before.kind === 'library' ? { fromAlias: `#${from}/`, toAlias: `#${to}/` } : {}) };
}
export async function sourceRenamePlan(request: Request, context: Context): Promise<SourcePlanned> {
  const [from, to] = request.args;
  requireThat(from && to && request.args.length === 2, 'SOURCE_ARGUMENTS', 'Supply both names: source rename <old> <new>.');
  const current = await declaredManifest(context), manifest = await domain(() => renameProject(current, from, to));
  const rename = renameOf(current, manifest, from, to), root = context.root;
  requireThat(rename.fromPath === rename.toPath || !(await listFiles(root, rename.toPath)).length, 'SOURCE_PATH_EXISTS', `${rename.toPath} already holds files.`);
  const project = await listFiles(root, rename.fromPath);
  const others = (await Promise.all(scanned.map(folder => listFiles(root, folder)))).flat().filter(path => !within(path, rename.fromPath));
  const { changed, skipped } = await rewrites(root, [...project, ...others], rename, await repositoryAliases(root, current));
  const { entries, overlay } = await movedFiles(root, project, rename, changed);
  for (const [path, text] of changed) if (!within(path, rename.fromPath)) entries.push({ path, content: text });
  const before = current.projects.find(item => item.name === from)!, after = manifest.projects.find(item => item.name === to)!;
  const testsPath = `${after.path}/tests/tsconfig.json`, testsText = overlay.get(testsPath);
  if (testsText !== undefined) {
    const config = await parseSourceJson(testsText, testsPath) as TestsConfig;
    if (config.compilerOptions && config.compilerOptions.tsBuildInfoFile === testsBuildInfo(before, current)) {
      config.compilerOptions.tsBuildInfoFile = testsBuildInfo(after, manifest);
      overlay.set(testsPath, json(config));
      const entry = entries.find(item => item.path === testsPath);
      if (entry) { entry.content = json(config); delete entry.encoding; }
    }
  }
  const users = manifest.projects.filter(item => item.references.includes(to)).map(item => item.path);
  const touched = (path: string) => path === 'tsconfig.json' || path === 'package.json' || [rename.toPath, ...users].some(base => path === `${base}/tsconfig.json` || path === `${base}/tests/tsconfig.json`);
  const changes = selected(await derivedChanges(root, manifest, { overlay, renamed: [[rename.fromPath, rename.toPath]] }), touched);
  const files = merged(entries, changes.entries), suites = await renameSuite(root, from, to, rename.fromPath, rename.toPath);
  const plan = [...files, ...suites.entries, ...await receiptEntries(root, from, to, rename, files), manifestEntry(manifest)];
  return { plan: await createFilePlan(root, plan), conflicts: [],
    summary: { rename: { from, to, path: rename.toPath, alias: rename.toAlias ? `${rename.toAlias}*` : null }, moved: project.length, rewrittenImports: [...changed.keys()],
      unrewritable: skipped, review: await mentions(root, others, rename.fromPath), manual: [...changes.manual, ...suites.manual], otherDrift: changes.otherDrift,
      next: 'source check, then run the project type check (npm run typecheck)' } };
}
