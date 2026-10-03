import { bundledNoticeFiles } from './docs-vendor.ts';
import { bundleReleaseCli } from './release-bundle.ts';
import { serializeJson as json } from '../../../scripts/contracts/serialization.ts';
import { prototypeSkillFiles } from './prototype-skill.ts';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '../../../scripts/shared/file-plan.ts';
import { readBounded, hash, readJson, exists } from './files.ts';
import { bootstrapFiles, launcherFiles, listFiles, pluginConfigFiles, readPluginConfig, verifyKit, type Kit, type KitFile } from './kit-integrity.ts';
import { zip, type ArchiveFile } from './zip.ts';
import { object } from './configuration.ts';
import { included, standaloneSource, updateOwnership } from './distribution.ts';
import { requireThat, type Context } from './contracts.ts';
const templateRoots = ['src', 'scripts', 'templates', 'tests', 'harness', 'docs', '.github', 'bin', 'plugins', 'configs'];
const templateFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc', 'AGENTS.md', 'LICENSE', 'README.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md'];
export interface Compiler { version: string; compile: (source: string, path: string) => string }
export async function installedCompiler(): Promise<Compiler> {
  const ts = await import('typescript');
  return { version: ts.version, compile(source, fileName) {
    const output = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, rewriteRelativeImportExtensions: true,
    } });
    requireThat(!output.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error), 'KIT_COMPILE', `Cannot compile ${fileName}.`);
    return output.outputText;
  } };
}
export async function assembleKit(context: Context, compiler: Compiler): Promise<ArchiveFile[]> {
  const skill = new Map((await prototypeSkillFiles(context.frameworkRoot)).map(file => [file.path, file.bytes]));
  const paths = [...templateFiles, ...skill.keys()];
  for (const folder of templateRoots) paths.push(...await listFiles(context.frameworkRoot, folder));
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
  const pkg = object(await readJson(join(context.frameworkRoot, 'package.json')));
  const rootScripts: Record<string, unknown> = { ...object(pkg.scripts), setup: 'node bin/app setup', app: 'node bin/app', make: 'node bin/app make', new: 'node bin/app new' };
  delete rootScripts.shell;
  const rootPackage = { ...pkg, bin: { 'obs-shell': 'bin/app' }, scripts: rootScripts };
  const bootstrap: Kit['bootstrap'] = [];
  for (const path of bootstrapFiles) {
    const bytes = path === 'package.json' ? Buffer.from(json(rootPackage)) : standaloneSource(path, await readBounded(join(context.frameworkRoot, path), 8_000_000));
    files.push({ path, bytes }); bootstrap.push({ path, hash: hash(bytes) });
  }
  // Make the template's aliases identical to the initial project-local CLI entry.
  const templatePackage = files.find(file => file.path === 'bin/template/package.json')!;
  templatePackage.bytes = Buffer.from(json(rootPackage));
  const packageRecord = records.find(file => file.path === templatePackage.path)!;
  packageRecord.hash = hash(templatePackage.bytes); packageRecord.bytes = templatePackage.bytes.length;
  for (const file of await bundledNoticeFiles(context.frameworkRoot, bundle.packages)) add(file.path, file.bytes);
  const kit: Kit = { schemaVersion: 2, version: String(pkg.version), compilerVersion: compiler.version,
    sourceHash: hash(json(sourceInventory)), files: records.sort((a, b) => a.path < b.path ? -1 : 1), bootstrap };
  files.push({ path: 'bin/kit.json', bytes: Buffer.from(json(kit)) });
  return files;
}
export async function packKit(context: Context, output: string) {
  requireThat(!await exists(join(context.frameworkRoot, 'shell.config.json')), 'KIT_AUTHORING_ROOT', 'Build framework distributions from a clean framework source, not a configured consumer project.');
  const identity = object(await readJson(join(context.frameworkRoot, 'manifest.json')));
  requireThat(identity.id === 'plugin-shell' && !await exists(join(context.frameworkRoot, '.companion/generation.json')), 'KIT_AUTHORING_ROOT', 'Consumer plugins are not framework distribution sources.');
  const destination = resolve(context.root, output), parts = relative(context.root, destination).split(sep);
  requireThat(destination.endsWith('.zip') && !parts.some(part => ['.git', 'node_modules', '.framework', '.companion'].includes(part.toLowerCase())), 'KIT_OUTPUT_PATH', 'Choose a ZIP output outside protected project directories.');
  const compiler = await installedCompiler();
  const files = await assembleKit(context, compiler), bytes = zip(files), path = resolve(context.root, output);
  const plan = await createFilePlan(dirname(path), [{ path: basename(path), content: bytes.toString('base64'), encoding: 'base64' }]);
  requireThat(!plan.changes.some(change => change.status === 'update'), 'KIT_OUTPUT_EXISTS', 'Refusing to replace a different existing archive.');
  await applyFilePlan(plan);
  return { archive: path, sha256: hash(bytes), bytes: bytes.length, files: files.length, compiler: compiler.version, publication: 'not-authorized' };
}
export async function upgradePlan(context: Context, from: string) {
  const nextRoot = resolve(context.root, from), current = await verifyKit(context.root), next = await verifyKit(nextRoot);
  const { compareVersions } = await import('../../../scripts/release/prepare.mjs');
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
  entries.push(...configs.entries, { path: 'bin/kit.json', content: json(next) });
  return { plan: await createFilePlan(context.root, entries), conflicts: configs.conflicts,
    summary: { from: current.version, to: next.version, sourceRegeneration: 'separate-reviewed-operation', dependencies: 'unchanged', preservedPluginConfigs: configs.preserved } };
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
