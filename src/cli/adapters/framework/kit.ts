import { bundledNoticeFiles } from './docs-vendor.ts';
import { cliArtifact } from './cli-artifact.ts';
import { bundleReleaseCli } from './release-bundle.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { prototypeSkillFiles } from './prototype-skill.ts';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '#shared/platform/file-plan.ts';
import { readBounded, hash, readJson, exists } from './files.ts';
import { bootstrapFiles, launcherFiles, listFiles, pluginConfigFiles, readPluginConfig, verifyKit, type Kit, type KitFile } from './kit-integrity.ts';
import { zip, type ArchiveFile } from './zip.ts';
import { object } from './configuration.ts';
import { included, kitRootReadme, standaloneSource, updateOwnership } from './distribution.ts';
import { OperationError, requireThat, type Context } from './contracts.ts';
import { stat } from 'node:fs/promises';
import { isProtectedSegment } from '#shared/platform/protected-directories.ts';
import { templateRootFiles as templateFiles, templateRoots } from '../../compiler/domain/template-inputs.ts';
import { communityPluginsFolder } from '../../domain/community-plugin.ts';
export interface Compiler { version: string; compile: (source: string, path: string) => string }
export async function installedCompiler(): Promise<Compiler> {
  const ts = (await import('typescript')).default;
  return { version: ts.version, compile(source, fileName) {
    const output = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, rewriteRelativeImportExtensions: true,
    } });
    requireThat(!output.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error), 'KIT_COMPILE', `Cannot compile ${fileName}.`);
    return output.outputText;
  } };
}
/** Every script of a freshly extracted kit is a bundled-CLI command; generation replaces package.json with the project's own. */
export const kitScripts: Readonly<Record<string, string>> = Object.freeze({
  app: 'node bin/app', help: 'node bin/app help', setup: 'node bin/app setup', new: 'node bin/app new', make: 'node bin/app make',
  generate: 'node bin/app generate', status: 'node bin/app status', doctor: 'node bin/app doctor', 'framework:status': 'node bin/app framework status',
});
const pluginGuide = `${communityPluginsFolder}/DEVELOPER-GUIDE.md`;
const pluginGuideSource = 'src/cli/plugins/DEVELOPER-GUIDE.md';
async function bootstrapSource(root: string, path: string): Promise<Buffer> {
  if (path === 'bin/README.md') return Buffer.from('# Workbench CLI\n\nKeep this entire folder together. With Node.js 22.13 or newer, run `node app help`.\nThe runtime, authoring tools, templates, plugin defaults and license notices are included.\nProject build, test and browser commands use the target project’s installed dependencies.\n');
  const source = path === 'bin/app' ? 'src/cli/launcher.mjs' : path.replace(/^bin\//, '');
  const bytes = standaloneSource(source, await readBounded(join(root, source), 8_000_000));
  return path === 'README.md' ? kitRootReadme(bytes) : bytes;
}
async function assembleBootstrap(root: string, pkg: Record<string, unknown>): Promise<{ files: ArchiveFile[]; bootstrap: Kit['bootstrap'] }> {
  const files: ArchiveFile[] = [], bootstrap: Kit['bootstrap'] = [];
  const kitPackage = { ...pkg, bin: { 'obs-shell': 'bin/app' }, scripts: { ...kitScripts } };
  for (const path of bootstrapFiles) {
    const bytes = path === 'bin/package.json' ? Buffer.from(json({ name: String(pkg.name) + '-cli', version: pkg.version, type: 'module', private: true }))
      : path === 'package.json' ? Buffer.from(json(kitPackage)) : await bootstrapSource(root, path);
    files.push({ path, bytes }); bootstrap.push({ path, hash: hash(bytes) });
  }
  return { files, bootstrap };
}
export async function assembleKit(context: Context, compiler: Compiler): Promise<ArchiveFile[]> {
  const skill = new Map((await prototypeSkillFiles(context.frameworkRoot)).map(file => [file.path, file.bytes]));
  const paths = [...templateFiles.filter(path => !path.startsWith('bin/')), ...skill.keys()];
  // The source checkout's own bin/plugins holds locally installed app plugins: never walked, never shipped. Only the
  // app plugin developer guide ships, fingerprinted in the template and copied beside the user's plugins.
  for (const folder of templateRoots.filter(path => !path.startsWith('bin/'))) paths.push(...await listFiles(context.frameworkRoot, folder, path => path === communityPluginsFolder));
  const files: ArchiveFile[] = [], records: KitFile[] = [];
  const add = (path: string, bytes: Buffer) => { files.push({ path, bytes }); records.push({ path, hash: hash(bytes), bytes: bytes.length }); };
  const sourceInventory: Array<{path: string; hash: string}> = [];
  const originals = new Map<string, Buffer>();
  for (const path of paths.filter(included).sort()) {
    requireThat(!/\.(?:ttf|otf|woff2?)$/i.test(path) && !/(?:^|\/)(?:\.env(?:\..*)?|credentials|node_modules|reports)(?:\/|$)/i.test(path), 'KIT_PRIVATE_INPUT', `Disallowed distribution input: ${path}.`);
    const original = await readBounded(join(context.frameworkRoot, path), 8_000_000); originals.set(path, original); sourceInventory.push({ path, hash: hash(original) });
    // Skill templates are literal authoring inputs; preserve their byte-exact inventory.
    const bytes = skill.get(path) ?? standaloneSource(path, original);
    add('bin/template/' + path, bytes);
    // Templates stay editable source data; runtime code is shipped only in the bundled CLI.
    // The bundle reads each Workbench plugin's config.json beside app.js, so enabling a plugin stays a data edit:
    // that copy is schema-checked editable data, not inventory; its fingerprinted default is the template copy.
    if (/^plugins\/[^/]+\/config\.json$/.test(path)) files.push({ path: 'bin/' + path, bytes });
    if (path === pluginGuideSource) files.push({ path: pluginGuide, bytes });
  }
  const ownership = files.find(file => file.path === 'bin/template/scripts/examples/ownership.json')!;
  const shipped = new Map(files.filter(file => file.path.startsWith('bin/template/')).map(file => [file.path.slice('bin/template/'.length), file.bytes]));
  ownership.bytes = updateOwnership(originals, shipped, ownership.bytes);
  // The runtime is now a single bundle. Only the editable template copy of
  // ownership.json ships; no per-module compiled ownership file exists.
  const ownershipRecord = records.find(entry => entry.path === ownership.path)!;
  ownershipRecord.hash = hash(ownership.bytes);
  ownershipRecord.bytes = ownership.bytes.length;
  const bundle = await bundleReleaseCli(context.frameworkRoot);
  add('bin/app.js', bundle.bytes);
  for (const tool of bundle.tools) add(tool.path, tool.bytes);
  const pkg = object(await readJson(join(context.frameworkRoot, 'package.json')));
  const templateScripts: Record<string, unknown> = { ...object(pkg.scripts), ...kitScripts };
  delete templateScripts.shell;
  const rootPackage = { ...pkg, bin: { 'obs-shell': 'bin/app' }, scripts: templateScripts };
  // Before generation the kit root holds only bin/; its scripts route through the bundled CLI so each one resolves.
  const boot = await assembleBootstrap(context.frameworkRoot, pkg);
  files.push(...boot.files);
  // Make the template's aliases identical to the initial project-local CLI entry.
  const templatePackage = files.find(file => file.path === 'bin/template/package.json')!;
  templatePackage.bytes = Buffer.from(json(rootPackage));
  const packageRecord = records.find(file => file.path === templatePackage.path)!;
  packageRecord.hash = hash(templatePackage.bytes); packageRecord.bytes = templatePackage.bytes.length;
  for (const file of await bundledNoticeFiles(context.frameworkRoot, bundle.packages)) add(file.path, file.bytes);
  const runtime = cliArtifact(files);
  add('bin/cli.json', runtime.bytes);
  // Generated source projects carry the same compiled authoring tools, plus an inventory for safe rebuilding.
  for (const path of [...runtime.paths, 'bin/cli.json']) add('bin/template/' + path, files.find(file => file.path === path)!.bytes);
  const kit: Kit = { schemaVersion: 3, version: String(pkg.version), compilerVersion: compiler.version,
    sourceHash: hash(json(sourceInventory)), files: records.sort((a, b) => a.path < b.path ? -1 : 1), bootstrap: boot.bootstrap };
  files.push({ path: 'bin/kit.json', bytes: Buffer.from(json(kit)) });
  return files;
}
export async function packKit(context: Context, output: string) {
  // The requested output is validated before the source is inspected, so a bad path fails the same way everywhere.
  const destination = resolve(context.root, output), parts = relative(context.root, destination).split(sep);
  requireThat(destination.endsWith('.zip') && !parts.some(part => isProtectedSegment(part)), 'KIT_OUTPUT_PATH', 'Choose a ZIP output outside protected project directories.');
  requireThat(!await exists(join(context.frameworkRoot, 'shell.config.json')), 'KIT_AUTHORING_ROOT', 'Build framework distributions from a clean framework source, not a configured consumer project.');
  const identity = object(await readJson(join(context.frameworkRoot, 'manifest.json')));
  requireThat(identity.id === 'plugin-shell' && !await exists(join(context.frameworkRoot, '.companion/generation.json')), 'KIT_AUTHORING_ROOT', 'Consumer plugins are not framework distribution sources.');
  const compiler = await installedCompiler();
  const files = await assembleKit(context, compiler), bytes = zip(files), path = resolve(context.root, output);
  const plan = await createFilePlan(dirname(path), [{ path: basename(path), content: bytes.toString('base64'), encoding: 'base64' }]);
  requireThat(!plan.changes.some(change => change.status === 'update'), 'KIT_OUTPUT_EXISTS', 'Refusing to replace a different existing archive.');
  await applyFilePlan(plan);
  return { archive: path, sha256: hash(bytes), bytes: bytes.length, files: files.length, compiler: compiler.version, publication: 'not-authorized' };
}
/** An upgrade source is an extracted kit folder; a ZIP or other file gets an explicit extraction step instead of a raw I/O error. */
async function extractedKitRoot(context: Context, from: string): Promise<string> {
  const path = resolve(context.root, from);
  const entry = await stat(path).catch(() => null);
  if (!entry?.isDirectory()) throw new OperationError(entry ? 'KIT_ARCHIVE_NOT_EXTRACTED' : 'KIT_SOURCE_MISSING',
    entry ? `${from} is a file, not an extracted kit folder.` : `${from} does not exist.`,
    `Extract the kit ZIP into a new empty folder, then run: node bin/app framework upgrade --from <extracted-folder>`);
  return path;
}
export async function upgradePlan(context: Context, from: string) {
  const nextRoot = await extractedKitRoot(context, from), current = await verifyKit(context.root), next = await verifyKit(nextRoot);
  const { compareVersions } = await import('../../tooling/release/prepare.mjs');
  requireThat(compareVersions(next.version, current.version) >= 0, 'KIT_DOWNGRADE', 'Downgrades require separate migration review.');
  requireThat(next.version !== current.version || (next.sourceHash === current.sourceHash && JSON.stringify(next.files) === JSON.stringify(current.files)), 'KIT_VERSION_REUSED', 'A different kit must have a new version.');
  const entries: Array<{path: string; content: string | null; encoding?: 'base64'}> = [];
  const nextPaths = new Set(next.files.map(file => file.path));
  for (const item of next.files) entries.push({ path: item.path, content: (await readBounded(join(nextRoot, item.path), 8_000_000)).toString('base64'), encoding: 'base64' });
  for (const item of current.files.filter(file => !nextPaths.has(file.path))) entries.push({ path: item.path, content: null });
  for (const launcher of current.bootstrap.filter(file => launcherFiles.includes(file.path))) {
    requireThat(hash(await readBounded(join(context.root, launcher.path))) === launcher.hash, 'LAUNCHER_EDITED', 'Preserve the edited launcher and review its migration.');
  }
  for (const launcher of next.bootstrap.filter(file => launcherFiles.includes(file.path))) {
    entries.push({ path: launcher.path, content: (await readBounded(join(nextRoot, launcher.path))).toString('utf8') });
  }
  const configs = await pluginConfigPlan(context.root, current, nextRoot, next);
  const guide = await pluginGuidePlan(context.root, current, nextRoot, next);
  entries.push(...configs.entries, ...guide, { path: 'bin/kit.json', content: json(next) });
  return { plan: await createFilePlan(context.root, entries), conflicts: configs.conflicts,
    summary: { from: current.version, to: next.version, sourceRegeneration: 'separate-reviewed-operation', dependencies: 'unchanged', preservedPluginConfigs: configs.preserved,
      pluginGuide: guide.length ? 'updated' : 'unchanged-or-edited' } };
}
/**
 * Runtime plugin configs are user data. An unedited config follows the new shipped default; an edit is kept when the
 * default did not change, and is reported as a conflict (never overwritten or deleted) when both changed.
 */
async function pluginConfigPlan(root: string, current: Kit, nextRoot: string, next: Kit) {
  const entries: Array<{path: string; content: string | null; encoding?: 'base64'}> = [], conflicts: string[] = [], preserved: string[] = [];
  const shipped = new Map(pluginConfigFiles(current).map(file => [file.path, file.defaults.hash]));
  const installed = async (path: string) => shipped.has(path) ? hash(await readPluginConfig(root, path)) : undefined;
  for (const { path, defaults } of pluginConfigFiles(next)) {
    const bytes = await readBounded(join(nextRoot, defaults.path), 8_000_000), actual = await installed(path);
    if (actual === undefined || actual === shipped.get(path)) entries.push({ path, content: bytes.toString('base64'), encoding: 'base64' });
    else if (actual !== defaults.hash && shipped.get(path) === defaults.hash) preserved.push(path);
    else if (actual !== defaults.hash) conflicts.push(path);
  }
  const retained = new Set(pluginConfigFiles(next).map(file => file.path));
  for (const [path, defaults] of shipped) if (!retained.has(path)) {
    if (await installed(path) === defaults) entries.push({ path, content: null }); else conflicts.push(path);
  }
  return { entries, conflicts, preserved };
}
/** The shipped bin/plugins guide follows the new kit unless the user edited it; an edited guide is kept. */
async function pluginGuidePlan(root: string, current: Kit, nextRoot: string, next: Kit): Promise<Array<{ path: string; content: string; encoding: 'base64' }>> {
  const shipped = (kit: Kit) => kit.files.find(file => file.path === 'bin/template/' + pluginGuideSource);
  const defaults = shipped(next);
  if (!defaults) return [];
  const installed = await exists(join(root, pluginGuide)) ? hash(await readBounded(join(root, pluginGuide), 8_000_000)) : undefined;
  if (installed !== undefined && installed !== shipped(current)?.hash) return [];
  return [{ path: pluginGuide, content: (await readBounded(join(nextRoot, defaults.path), 8_000_000)).toString('base64'), encoding: 'base64' }];
}
