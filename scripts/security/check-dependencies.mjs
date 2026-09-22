import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import icons from '@iconify-json/lucide/icons.json' with { type: 'json' };
const require = createRequire(import.meta.url);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const pkg = await json('package.json'); const lock = await json('package-lock.json');
const policy = await json('scripts/security/dependency-policy.json');
for (const group of ['dependencies', 'devDependencies']) for (const [name, version] of Object.entries(pkg[group])) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || lock.packages[''][group][name] !== version || lock.packages[`node_modules/${name}`]?.version !== version)
    throw new Error(`DEPENDENCY_NOT_EXACT: ${name}`);
  if ((await json(`node_modules/${name}/package.json`)).version !== version) throw new Error(`INSTALLED_VERSION_MISMATCH: ${name}`);
}
for (const [name, version] of Object.entries(policy.packages)) if ((await json(`node_modules/${name}/package.json`)).version !== version) throw new Error(`UNREVIEWED_VERSION: ${name}`);
for (const [path, expected] of Object.entries(policy.reviewedSources)) {
  if (createHash('sha256').update(await readFile(path)).digest('hex') !== expected) throw new Error(`UNREVIEWED_SOURCE: ${path}`);
}
for (const [path, entry] of Object.entries(lock.packages)) if (entry.hasInstallScript) {
  const name = path.slice(path.lastIndexOf('node_modules/') + 13);
  if (pkg.allowScripts[`${name}@${entry.version}`] !== true && pkg.allowScripts[name] !== false) throw new Error(`UNREVIEWED_INSTALL_HOOK: ${name}@${entry.version}`);
}
if (!icons.icons['layout-dashboard'] || !icons.icons['ellipsis-vertical']) throw new Error('LOCAL_ICON_DATA_MISSING');
const fontlessPath = require.resolve('fontless'); // Exact reviewed transitive dependency, not a new direct product dependency.
const { transformCSS } = await import(pathToFileURL(fontlessPath).href);
const result = await transformCSS({ dev: false, processCSSVariables: true, fontsToPreload: new Map(), shouldPreload: () => false,
  resolveFontFace: async () => ({ fonts: [{ src: [{ url: '/fixture.woff2', format: 'woff2' }], style: 'normal', weight: 400, display: 'swap' }] }) },
  '.fixture { font-family: "Fixture"; }', '/fixture.css');
const css = result.toString();
if (!css.includes('@font-face') || !css.includes('/fixture.woff2') || css.includes('undefined')) throw new Error('FONTLESS_TRANSFORM_REGRESSION');
console.log('Exact direct/installed versions, reviewed transitive transform, installer source hashes, narrow hooks and local icons passed. No network used.');
