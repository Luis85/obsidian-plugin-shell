/** Build adapter emitted as source; no install, native activation or process runs during compilation. */
export const buildSource = String.raw`import { readFile, writeFile, mkdir, copyFile, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const root = process.cwd();
const config = JSON.parse(await readFile('project.config.json', 'utf8'));
const identity = JSON.parse(await readFile('manifest.json', 'utf8'));
const args = process.argv.slice(2);
if (args.some(arg => !['--prototype', '--replace'].includes(arg)) || new Set(args).size !== args.length) throw new Error('Use --prototype and optionally --replace only.');
if (args.includes('--replace') && !args.includes('--prototype')) throw new Error('--replace applies only to prototype output.');
const prototype = args.includes('--prototype');
const visual = config.targets.some(target => target !== 'cli');
function run(tool, args) {
  const result = spawnSync(process.execPath, [tool, ...args], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Build tool failed: ' + tool);
}
async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
function escape(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function html(script, css, inline) {
  const policy = "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  const style = inline ? '<style>' + css.replace(/<\/style/gi, '<\\/style') + '</style>' : '<link rel="stylesheet" href="styles.css">';
  const js = inline ? '<script>' + script.replace(/<\/script/gi, '<\\/script') + '</script>' : '<script defer src="main.js"></script>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="' + escape(policy) + '"><title>' + escape(identity.name) + '</title>' + style + '</head><body><div data-project-root class="browser-project"></div>' + js + '</body></html>\n';
}
async function buildVisual(target, directory) {
  const { build } = await import('vite');
  let shared = {};
  if (config.framework === 'nuxtui') shared = (await import('./bundling/vite-shared.mjs')).sharedConfig();
  const linker = config.framework === 'angular' ? [(await import('./angular-linker.mjs')).angularLinker()] : [];
  const { projectLicenses } = await import('./licenses.mjs');
  const plugin = target === 'plugin';
  const entry = config.framework === 'angular' ? '.compiled/src/targets/' + target + '/main.js' : 'src/targets/' + target + '/main.ts';
  await build({ ...shared, configFile: false, root,
    // Libraries such as React read process.env.NODE_ENV; a browser bundle is always a production build.
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), ...(shared.define ?? {}), ...(config.framework === 'angular' ? { ngDevMode: false, ngJitMode: false } : {}) },
    plugins: [...linker, ...(shared.plugins ?? []), projectLicenses()],
    build: { ...(shared.build ?? {}), target: 'es2022', outDir: directory, emptyOutDir: true, sourcemap: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER, cssCodeSplit: false,
      lib: { entry: resolve(entry), name: 'ProjectStarter', formats: [plugin ? 'cjs' : 'iife'], fileName: () => 'main.js', cssFileName: 'styles' },
      rolldownOptions: { external: plugin ? ['obsidian'] : [], output: { exports: plugin ? 'default' : 'none', codeSplitting: false } } } });
  if (!await exists(join(directory, 'styles.css'))) await writeFile(join(directory, 'styles.css'), '');
  if (plugin) await copyFile('manifest.json', join(directory, 'manifest.json'));
  else await writeFile(join(directory, 'index.html'), html('', '', false));
}
if (prototype && !visual) throw new Error('CLI projects have no HTML prototype. Build and run the CLI transcript acceptance instead.');
if (prototype && !args.includes('--replace') && await exists('dist/prototype.html')) throw new Error('Prototype exists. Review before passing --replace.');
if (visual && config.framework === 'angular') {
  const angular = JSON.parse(await readFile('node_modules/@angular/compiler-cli/package.json', 'utf8'));
  run(join('node_modules/@angular/compiler-cli', angular.bin.ngc), ['--project', 'configs/types/tsconfig.angular.json']);
  // ngc emits JavaScript, not imported CSS. Preserve its explicit relative stylesheet dependency.
  await mkdir('.compiled/src/ui', { recursive: true });
  await copyFile('src/ui/styles.css', '.compiled/src/ui/styles.css');
}
if (prototype) {
  const directory = '.prototype-build';
  try {
    await buildVisual('preview', directory);
    const js = await readFile(join(directory, 'main.js'), 'utf8');
    const css = await readFile(join(directory, 'styles.css'), 'utf8');
    const model = (await readFile('design/project.json', 'utf8')).replaceAll('<', '\\u003c');
    let page = html(js, css, true);
    page = page.replace('</body>', '<script type="application/json" id="companion-project">' + model + '</script></body>');
    await mkdir('dist', { recursive: true });
    await writeFile('dist/prototype.html', page, { flag: args.includes('--replace') ? 'w' : 'wx' });
  } finally { await rm(directory, { recursive: true, force: true }); }
} else {
  for (const target of config.targets) {
    if (target === 'cli') {
      run('node_modules/typescript/bin/tsc', ['--project', 'configs/types/tsconfig.cli.json']);
      await writeFile('dist/cli/package.json', JSON.stringify({ type: 'module', private: true }) + '\n');
    } else await buildVisual(target, 'dist/' + target);
  }
}
`;

export const licenseSource = String.raw`import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
/** Inventory only installed modules actually bundled; a vanilla bundle may have no third-party JS. */
export function projectLicenses() {
  return { name: 'project-license-notices', generateBundle(_options, bundle) {
    const packages = new Map();
    function inspect(input) {
      let directory = dirname(input.split('?')[0]);
      while (directory.includes('node_modules')) {
        const path = join(directory, 'package.json');
        if (existsSync(path)) {
          const pkg = JSON.parse(readFileSync(path, 'utf8'));
          if (pkg.name) { packages.set(pkg.name, { ...pkg, directory }); return; }
        }
        const parent = dirname(directory); if (parent === directory) return; directory = parent;
      }
    }
    for (const item of Object.values(bundle)) if (item.type === 'chunk') for (const id of Object.keys(item.modules)) if (id.includes('node_modules')) inspect(id);
    if (existsSync('src/ui/Starter.vue')) {
      inspect(resolve('node_modules/tailwindcss/index.css'));
      inspect(resolve('node_modules/@iconify-json/lucide/icons.json'));
    }
    const notices = [];
    for (const [name, pkg] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
      const licenses = readdirSync(pkg.directory).filter(file => /^(license|licence|copying)(\.|$)/i.test(file));
      const text = name === '@iconify-json/lucide' ? readFileSync('docs/licenses/lucide.txt', 'utf8') : licenses.map(file => readFileSync(join(pkg.directory, file), 'utf8')).join('\n');
      if (!text) throw new Error('Missing bundled license: ' + name);
      notices.push(name + '@' + pkg.version + '\n' + text);
    }
    const banner = '/*! Bundled dependency notices\n' + (notices.join('\n\n') || 'No third-party JavaScript in this bundle.') .replaceAll('*/', '* /') + '\n*/\n';
    for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.isEntry) item.code = banner + item.code;
  } };
}
`;
