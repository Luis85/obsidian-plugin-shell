import { docsParserFiles } from './docs-vendor.ts';
import { bundleReleaseCli } from './release-bundle.mjs';
import { serializeJson as json } from '../contracts/serialization.ts';
import { prototypeSkillFiles } from '../companion/prototype-skill.mjs';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
import { readBounded, hash, readJson, exists } from './files.ts';
import { bootstrapFiles, launcherFiles, listFiles, verifyKit, type Kit, type KitFile } from './kit-integrity.ts';
import { zip, type ArchiveFile } from './zip.ts';
import { object } from './configuration.ts';
import { included, standaloneSource, updateOwnership } from './distribution.ts';
import { requireThat, type Context } from './contracts.ts';
const templateRoots = ['src', 'scripts', 'tests', 'harness', 'docs', '.github', 'bin', 'configs'];
const templateFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc', 'AGENTS.md', 'LICENSE', 'README.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md', 'app.mjs', 'shell.mjs'];
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
    add('.framework/template/' + path, bytes);
    // Templates stay editable source data; runtime code is shipped only in the bundled CLI.
  }
  const ownership = files.find(file => file.path === '.framework/template/scripts/examples/ownership.json')!;
  const shipped = new Map(files.filter(file => file.path.startsWith('.framework/template/')).map(file => [file.path.slice('.framework/template/'.length), file.bytes]));
  ownership.bytes = updateOwnership(originals, shipped, ownership.bytes);
  // The runtime is now a single bundle. Only the editable template copy of
  // ownership.json ships; no per-module compiled ownership file exists.
  const ownershipRecord = records.find(entry => entry.path === ownership.path)!;
  ownershipRecord.hash = hash(ownership.bytes);
  ownershipRecord.bytes = ownership.bytes.length;
  add('.framework/compiled/package.json', Buffer.from('{"type":"module"}\n'));
  add('.framework/compiled/app.js', await bundleReleaseCli(context.frameworkRoot));
  const pkg = object(await readJson(join(context.frameworkRoot, 'package.json')));
  const rootPackage = { ...pkg, bin: { 'obs-shell': 'bin/app' }, scripts: { ...object(pkg.scripts), setup: 'node app.mjs setup', shell: 'node app.mjs', app: 'node app.mjs', make: 'node app.mjs make' } };
  const bootstrap: Kit['bootstrap'] = [];
  for (const path of bootstrapFiles) {
    const bytes = path === 'package.json' ? Buffer.from(json(rootPackage)) : standaloneSource(path, await readBounded(join(context.frameworkRoot, path), 8_000_000));
    files.push({ path, bytes }); bootstrap.push({ path, hash: hash(bytes) });
  }
  // Make the template's aliases identical to the initial project-local CLI entry.
  const templatePackage = files.find(file => file.path === '.framework/template/package.json')!;
  templatePackage.bytes = Buffer.from(json(rootPackage));
  const packageRecord = records.find(file => file.path === templatePackage.path)!;
  packageRecord.hash = hash(templatePackage.bytes); packageRecord.bytes = templatePackage.bytes.length;
  for (const file of await docsParserFiles(context.frameworkRoot)) add(file.path, file.bytes);
  const kit: Kit = { schemaVersion: 1, version: String(pkg.version), compilerVersion: compiler.version,
    sourceHash: hash(json(sourceInventory)), files: records.sort((a, b) => a.path < b.path ? -1 : 1), bootstrap };
  files.push({ path: '.framework/kit.json', bytes: Buffer.from(json(kit)) });
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
  const { compareVersions } = await import('../release/prepare.mjs');
  requireThat(compareVersions(next.version, current.version) >= 0, 'KIT_DOWNGRADE', 'Downgrades require separate migration review.');
  requireThat(next.version !== current.version || (next.sourceHash === current.sourceHash && JSON.stringify(next.files) === JSON.stringify(current.files)), 'KIT_VERSION_REUSED', 'A different kit must have a new version.');
  const entries: Array<{path: string; content: string | null; encoding?: 'base64'}> = [];
  const nextPaths = new Set(next.files.map(file => file.path));
  for (const file of next.files) entries.push({ path: file.path, content: (await readBounded(join(nextRoot, file.path), 8_000_000)).toString('base64'), encoding: 'base64' });
  // Verified old runtime files can be removed only when replaced by the reviewed single-bundle layout.
  const removed = current.files.filter(file => !nextPaths.has(file.path));
  const previousRuntime = /^\\.framework\\/compiled\\/(?:scripts\\/|bin\\/|docs\\/concepts\\/companion\\/test-kit\\/|node_modules\\/yaml\\/)/;
  requireThat(removed.every(file => previousRuntime.test(file.path)) && (!removed.length || nextPaths.has('.framework/compiled/app.js')),
    'KIT_REMOVAL_REQUIRES_MIGRATION', 'Only previously verified compiled runtime copies may be removed by the app.js upgrade.');
  for (const file of removed) entries.push({ path: file.path, content: null });
  // Legacy kits own only shell.mjs; upgrading adds app.mjs and bin/app and turns shell.mjs into a forwarding shim.
  for (const launcher of current.bootstrap.filter(file => launcherFiles.includes(file.path))) {
    requireThat(hash(await readBounded(join(context.root, launcher.path))) === launcher.hash, 'LAUNCHER_EDITED', 'Preserve the edited launcher and review its migration.');
  }
  for (const launcher of next.bootstrap.filter(file => launcherFiles.includes(file.path))) {
    entries.push({ path: launcher.path, content: (await readBounded(join(nextRoot, launcher.path))).toString('utf8') });
  }
  entries.push({ path: '.framework/kit.json', content: json(next) });
  return { plan: await createFilePlan(context.root, entries), conflicts: [] as string[], summary: { from: current.version, to: next.version, sourceRegeneration: 'separate-reviewed-operation', dependencies: 'unchanged' } };
}
