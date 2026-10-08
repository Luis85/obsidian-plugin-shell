/** Trusted worker launched with cwd set by the shell's existing runNode process adapter. */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { args, need, readBytes, readJson, layoutPath, noLinks, writeBuild, sha256, isMain, cli } from './io.mjs';
import { assemble } from '../build-single-file.mjs';
import { singleBundle } from './build-output.mjs';
import { withBuildDiagnostics } from './worker-output.mjs';

export function prototypeBuildConfig({ shared, entry, licenses }) {
  const native = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
  return { ...shared, configFile: false, publicDir: false, logLevel: 'silent',
    plugins: [{ name: 'prototype-browser-boundary', enforce: 'pre', resolveId(id) {
      if (id === 'obsidian' || id.startsWith('node:') || native.has(id)) throw new Error(`PROTOTYPE_HOST_IMPORT: ${id}`);
    } }, ...shared.plugins, licenses],
    build: { ...shared.build, write: false, sourcemap: false, cssCodeSplit: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      lib: { entry, name: 'CompanionPrototype', formats: ['iife'], fileName: () => 'prototype.js' },
      rolldownOptions: { output: { codeSplitting: false } } },
  };
}
async function compile(options) {
  const root = noLinks(process.cwd());
  const entry = noLinks(need(options, 'entry'));
  const relative = path.relative(root, entry).split(path.sep).join('/');
  if (!relative.startsWith('harness/prototype/') || !relative.endsWith('.ts')) throw new Error('PROTOTYPE_ENTRY: use a TypeScript bootstrap under harness/prototype/');
  readBytes(entry);
  const input = noLinks(need(options, 'project')), out = noLinks(need(options, 'out'));
  if (out.split(path.sep).some(part => ['.git', '.obsidian', '.dev-vault', '.test-vault', 'node_modules'].includes(part.toLowerCase()))) throw new Error('PROTOTYPE_OUTPUT: protected directory');
  if (!out.endsWith('.html') || [entry, input].includes(out)) throw new Error('PROTOTYPE_OUTPUT: choose a distinct HTML artifact');
  if (!options.replace && fs.existsSync(out)) throw new Error('PROTOTYPE_OUTPUT_EXISTS: use a new path or explicit --replace');
  const pkg = readJson(path.join(root, 'package.json'));
  const lock = readJson(path.join(root, 'package-lock.json'));
  for (const name of ['vue', 'pinia', '@nuxt/ui', 'vite', '@vitejs/plugin-vue', 'typescript']) {
    const version = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    const installed = readJson(path.join(root, 'node_modules', name, 'package.json')).version;
    if (!version || version !== installed || version !== lock.packages?.[`node_modules/${name}`]?.version) throw new Error(`PROTOTYPE_PIN_MISMATCH: ${name}; use the workspace lockfile`);
  }
  const projectBytes = readBytes(input, 4_000_000);
  const identity = readJson(path.join(root, 'manifest.json')).id;
  if (JSON.parse(projectBytes.toString('utf8')).project?.id !== identity) throw new Error('PROTOTYPE_IDENTITY: generated workspace and design must match');
  const require = createRequire(pathToFileURL(path.join(root, 'package.json')));
  const { build } = await import(pathToFileURL(require.resolve('vite')).href);
  const { sharedConfig } = await import(pathToFileURL(path.join(root, layoutPath(root, 'tooling/bundling/vite-shared.mjs', 'scripts/bundling/vite-shared.mjs'))).href);
  const { licenseNotices } = await import(pathToFileURL(path.join(root, layoutPath(root, 'tooling/bundling/license-notices.mjs', 'scripts/bundling/license-notices.mjs'))).href);
  const result = await build(prototypeBuildConfig({ shared: sharedConfig(), entry, licenses: licenseNotices() }));
  const { javascript, css, modules } = singleBundle(result);
  const html = assemble({ javascript, css, projectBytes, title: need(options, 'title') });
  // Do not replace last-good output until compile, contract and static offline checks pass.
  writeBuild(out, html, Boolean(options.replace));
  return { status: 'built-not-browser-verified', artifact: path.basename(out), sha256: sha256(html), bytes: Buffer.byteLength(html),
    projectSha256: sha256(projectBytes), entry: relative, bundledModules: modules,
    pipeline: ['vite-shared', 'qualified-static-ui', 'css-ownership', 'license-notices', 'single-file-assembly'],
    limitations: ['Vite compilation is not TypeScript checking, browser acceptance or native acceptance.'] };
}
if (isMain(import.meta.url)) cli(async () => {
  const options = args(process.argv.slice(2), ['--entry', '--project', '--out', '--title'], ['--replace']);
  console.log(JSON.stringify(await withBuildDiagnostics(() => compile(options))));
});
