import { serializeJson as json } from '../contracts/serialization.ts';
import { join, dirname, basename, resolve, relative, sep } from 'node:path';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
import { readBounded, hash, readJson, exists } from './files.ts';
import { listFiles, verifyKit, type Kit, type KitFile } from './kit-integrity.ts';
import { zip, type ArchiveFile } from './zip.ts';
import { object } from './configuration.ts';
import { included, standaloneSource, updateOwnership } from './distribution.ts';
import { requireThat, type Context } from './contracts.ts';
const templateRoots = ['src', 'scripts', 'tests', 'harness', 'docs', '.github'];
const templateFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', 'tsconfig.generator.json', 'tsconfig.framework.json', 'vite.config.mjs', 'vite.harness.config.mjs', 'vitest.config.mjs', 'vitest.production.config.mjs', 'playwright.config.ts', 'eslint.config.mjs', '.fallowrc.json', '.oxlintrc.json', '.gitignore', '.nvmrc', 'AGENTS.md', 'LICENSE', 'README.md', 'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'shell.mjs', 'vitest.obsidian.config.mjs'];
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
  const paths = [...templateFiles];
  for (const folder of templateRoots) paths.push(...await listFiles(context.frameworkRoot, folder));
  const files: ArchiveFile[] = [], records: KitFile[] = [];
  const add = (path: string, bytes: Buffer) => { files.push({ path, bytes }); records.push({ path, hash: hash(bytes), bytes: bytes.length }); };
  const sourceInventory: Array<{path: string; hash: string}> = [];
  const originals = new Map<string, Buffer>();
  for (const path of paths.filter(included).sort()) {
    requireThat(!/\.(?:ttf|otf|woff2?)$/i.test(path) && !/(?:^|\/)(?:\.env(?:\..*)?|credentials|node_modules|reports)(?:\/|$)/i.test(path), 'KIT_PRIVATE_INPUT', `Disallowed distribution input: ${path}.`);
    const original = await readBounded(join(context.frameworkRoot, path), 8_000_000); originals.set(path, original); sourceInventory.push({ path, hash: hash(original) });
    const bytes = standaloneSource(path, original);
    add('.framework/template/' + path, bytes);
    if (path.startsWith('scripts/') || path.startsWith('docs/concepts/companion/test-kit/')) {
      if (path.endsWith('.ts') && !path.endsWith('.d.ts')) add('.framework/compiled/' + path.slice(0, -3) + '.js', Buffer.from(compiler.compile(bytes.toString('utf8'), path)));
      else if (!path.endsWith('.ts')) add('.framework/compiled/' + path, bytes);
    }
  }
  const ownership = files.find(file => file.path === '.framework/template/scripts/examples/ownership.json')!;
  const shipped = new Map(files.filter(file => file.path.startsWith('.framework/template/')).map(file => [file.path.slice('.framework/template/'.length), file.bytes]));
  ownership.bytes = updateOwnership(originals, shipped, ownership.bytes);
  for (const path of [ownership.path, '.framework/compiled/scripts/examples/ownership.json']) {
    const file = files.find(entry => entry.path === path)!; file.bytes = ownership.bytes;
    const record = records.find(entry => entry.path === path)!; record.hash = hash(file.bytes); record.bytes = file.bytes.length;
  }
  add('.framework/compiled/package.json', Buffer.from('{"type":"module"}\n'));
  const pkg = object(await readJson(join(context.frameworkRoot, 'package.json')));
  const rootPackage = { ...pkg, bin: { 'obs-shell': 'shell.mjs' }, scripts: { ...object(pkg.scripts), setup: 'node shell.mjs setup', shell: 'node shell.mjs', make: 'node shell.mjs make' } };
  const bootstrap: Kit['bootstrap'] = [];
  for (const path of ['shell.mjs', 'package.json', 'README.md', 'LICENSE']) {
    const bytes = path === 'package.json' ? Buffer.from(json(rootPackage)) : standaloneSource(path, await readBounded(join(context.frameworkRoot, path), 8_000_000));
    files.push({ path, bytes }); bootstrap.push({ path, hash: hash(bytes) });
  }
  // Make the template's aliases identical to the initial project-local CLI entry.
  const templatePackage = files.find(file => file.path === '.framework/template/package.json')!;
  templatePackage.bytes = Buffer.from(json(rootPackage));
  const packageRecord = records.find(file => file.path === templatePackage.path)!;
  packageRecord.hash = hash(templatePackage.bytes); packageRecord.bytes = templatePackage.bytes.length;
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
  const entries: Array<{path: string; content: string; encoding?: 'base64'}> = [];
  const nextPaths = new Set(next.files.map(file => file.path));
  for (const file of next.files) entries.push({ path: file.path, content: (await readBounded(join(nextRoot, file.path), 8_000_000)).toString('base64'), encoding: 'base64' });
  requireThat(current.files.every(file => nextPaths.has(file.path)), 'KIT_REMOVAL_REQUIRES_MIGRATION', 'This kit removes files; an explicit removal migration is required.');
  const launcher = current.bootstrap.find(file => file.path === 'shell.mjs')!;
  requireThat(hash(await readBounded(join(context.root, 'shell.mjs'))) === launcher.hash, 'LAUNCHER_EDITED', 'Preserve the edited launcher and review its migration.');
  entries.push({ path: 'shell.mjs', content: (await readBounded(join(nextRoot, 'shell.mjs'))).toString('utf8') });
  entries.push({ path: '.framework/kit.json', content: json(next) });
  return { plan: await createFilePlan(context.root, entries), conflicts: [] as string[], summary: { from: current.version, to: next.version, sourceRegeneration: 'separate-reviewed-operation', dependencies: 'unchanged' } };
}
