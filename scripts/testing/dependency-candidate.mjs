// Temporary, explicit upgrade research. Never called by setup, install hooks or verify.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const output = 'reports/dependency-candidate'; mkdirSync(output, { recursive: true });
const registry = {};
for (const name of ['eslint-plugin-import', '@microsoft/eslint-plugin-sdl', 'eslint-plugin-obsidianmd', '@eslint/js', 'esbuild', 'fontless', '@nuxt/fonts']) {
  registry[name] = JSON.parse(execFileSync('npm', ['view', name, 'version', 'engines', 'dependencies', 'peerDependencies', 'scripts', '--json'], { encoding: 'utf8' }));
}
writeFileSync(`${output}/registry.json`, JSON.stringify(registry, null, 2));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.devDependencies.eslint = '10.11.0';
pkg.engines.node = '>=22.13.0';
// Reviewed fontless 0.2.1 uses esbuild only for transform(loader:css); not serve/build.
// Its latest supported parent still pins ^0.27.0. Qualify this exact narrow patch.
pkg.overrides = { 'fontless@0.2.1': { esbuild: '0.28.2' } };
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
function run(name, args) {
  const r = spawnSync('npm', args, { encoding: 'utf8', timeout: 180000 });
  writeFileSync(`${output}/${name}.log`, `${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  writeFileSync(`${output}/${name}.exit`, String(r.status)); return r;
}
run('install', ['install']);
run('supported-parent-update', ['update', 'esbuild', 'eslint-plugin-import', '@microsoft/eslint-plugin-sdl', '@eslint/js']);
run('dedupe', ['dedupe']);
run('lint', ['run', 'lint']);
run('audit', ['audit', '--json']);
run('tree', ['ls', '--all', '--json']);
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const hooks = Object.entries(lock.packages).filter(([, value]) => value.hasInstallScript).map(([path, value]) => ({ path, version: value.version }));
writeFileSync(`${output}/lifecycle-hooks.json`, JSON.stringify(hooks, null, 2));
const files = {};
for (const path of ['node_modules/esbuild/package.json', 'node_modules/esbuild/install.js', 'node_modules/fontless/dist/index.mjs']) {
  try { const data = readFileSync(path); files[path] = { sha256: createHash('sha256').update(data).digest('hex'), source: data.toString() }; } catch { files[path] = { absent: true }; }
}
writeFileSync(`${output}/reviewed-sources.json`, JSON.stringify(files, null, 2));
for (const name of ['package.json', 'package-lock.json']) writeFileSync(`${output}/${name}`, readFileSync(name));
const { transformCSS } = await import('fontless');
const result = await transformCSS({ dev: false, processCSSVariables: true, fontsToPreload: new Map(), shouldPreload: () => false,
  resolveFontFace: async () => ({ fonts: [{ src: [{ url: '/fixture.woff2', format: 'woff2' }], style: 'normal', weight: 400, display: 'swap' }] }) },
  '.fixture { font-family: "Fixture"; }', '/fixture.css');
const css = result.toString();
if (!css.includes('@font-face') || !css.includes('/fixture.woff2') || css.includes('undefined')) throw new Error('FONTLESS_TRANSFORM_REGRESSION');
writeFileSync(`${output}/fontless-transform.css`, css);
