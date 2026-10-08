/** Deterministic, source-driven manual generation. Run from a trusted source checkout, not a consumer's compiled kit. */
import { readFile, writeFile, mkdir, readdir, lstat, rename, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { buildModel, renderReference, renderDiagnostics } from './render.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const destination = 'docs/user-manual/shell-cli/generated';
const inputs = [ 'src/cli/adapters/framework/catalog.ts', 'src/cli/adapters/framework/help-text.ts', 'src/cli/adapters/framework/increment-catalog.ts', 'src/cli/adapters/framework/increment-help.ts',
  'src/cli/compiler/domain/diagnostics.ts', 'tooling/documentation/render.mjs', 'tooling/documentation/manual.mjs'];
const owned = ['reference.md', 'diagnostics.md', 'commands.json', 'manifest.json'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
async function regular(path) {
  try { const stat = await lstat(path); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`MANUAL_UNSAFE_PATH: ${path}`); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
/** Refuse symlinks on every owned-directory component, even in --check mode. */
async function safeDirectory(base, relative, create) {
  let current = base;
  for (const part of relative.split('/')) {
    current = join(current, part);
    let stat;
    try { stat = await lstat(current); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!create) return false;
      await mkdir(current); stat = await lstat(current);
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`MANUAL_UNSAFE_DIRECTORY: ${current}`);
  }
  return true;
}
export async function outputs(base = root) {
  const [{ commands, parameterKinds }, { commandHelp, groups }, { diagnosticCatalog }] = await Promise.all([
    import(pathToFileURL(join(base, 'src/cli/adapters/framework/catalog.ts')).href),
    import(pathToFileURL(join(base, 'src/cli/adapters/framework/help-text.ts')).href),
    import(pathToFileURL(join(base, 'src/cli/compiler/domain/diagnostics.ts')).href),
  ]);
  const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'));
  const model = buildModel(commands, commandHelp, parameterKinds, groups, pkg.version, diagnosticCatalog);
  // The machine catalog is vendored into generated projects; compact JSON preserves every field without padding their bounded inputs.
  const files = { 'reference.md': renderReference(model), 'diagnostics.md': renderDiagnostics(model), 'commands.json': JSON.stringify(model) + '\n' };
  const sources = await Promise.all(inputs.map(async path => ({ path, sha256: hash(await readFile(join(base, path))) })));
  sources.unshift({ path: 'package.json', selector: '/version', sha256: hash(json(pkg.version)) });
  files['manifest.json'] = json({ schemaVersion: 2, frameworkVersion: pkg.version, commandCount: model.commands.length, sources,
    outputs: Object.entries(files).map(([path, content]) => ({ path, sha256: hash(content) })) });
  return files;
}
/** Only these known generated files are replaceable. Unknown content is never removed. */
export async function synchronize(files, { base = root, check = false } = {}) {
  if (Object.keys(files).sort().join('\0') !== [...owned].sort().join('\0')) throw new Error('MANUAL_OUTPUT_CONTRACT');
  const present = await safeDirectory(base, destination, !check);
  const folder = join(base, destination);
  const unknown = present ? (await readdir(folder)).filter(name => !owned.includes(name)) : [];
  if (unknown.length) throw new Error(`MANUAL_UNOWNED_FILE: move authored content outside generated/: ${unknown.join(', ')}`);
  const stale = [];
  for (const name of owned) {
    const path = join(folder, name);
    const exists = present && await regular(path);
    if (exists && await readFile(path, 'utf8') === files[name]) continue;
    stale.push(name);
    if (!check) {
      const temporary = join(dirname(path), `.manual-${randomUUID()}.tmp`);
      try { await writeFile(temporary, files[name], { flag: 'wx' }); await rename(temporary, path); }
      finally { await rm(temporary, { force: true }); }
    }
  }
  return stale;
}
export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node --experimental-strip-types tooling/documentation/manual.mjs [--check]\nGenerates Markdown/JSON from trusted command metadata. --check never writes.'); return 0;
  }
  if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('MANUAL_ARGUMENT: expected no arguments or --check');
  const check = args.includes('--check'); const files = await outputs(); const stale = await synchronize(files, { check });
  if (check && stale.length) throw new Error(`MANUAL_STALE: ${stale.join(', ')}. Run node --experimental-strip-types tooling/documentation/manual.mjs`);
  console.log(`Manual ${check ? 'checked' : 'generated'}: ${JSON.parse(files['commands.json']).commands.length} commands; ${stale.length} changed files.`);
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
