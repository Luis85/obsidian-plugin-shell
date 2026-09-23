import { mkdtemp, mkdir, cp, writeFile, readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const source = fileURLToPath(new URL('../../', import.meta.url));
export async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'identity fixture ü space-'));
  await mkdir(join(root, 'scripts'), { recursive: true });
  for (const name of ['setup.mjs', 'setup', 'shared']) await cp(join(source, 'scripts', name), join(root, 'scripts', name), { recursive: true });
  const manifest = { id: 'original-plugin', name: 'Original Plugin', description: 'Fixture identity', author: 'Author', version: '1.0.0', minAppVersion: '1.13.7', isDesktopOnly: true };
  const pkg = { name: manifest.id, version: manifest.version, type: 'module', license: 'MIT', scripts: { setup: 'node scripts/setup.mjs' }, dependencies: { sample: '1.2.3' }, allowScripts: { 'sample@1.2.3': false } };
  const lock = { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version, dependencies: pkg.dependencies, license: pkg.license },
    'node_modules/sample': { version: '1.2.3', resolved: 'https://registry.example/sample.tgz', integrity: 'preserved-integrity' } } };
  for (const [name, value] of [['manifest.json', manifest], ['package.json', pkg], ['package-lock.json', lock], ['versions.json', { '1.0.0': '1.13.7' }]]) await writeFile(join(root, name), JSON.stringify(value, null, 2) + '\n');
  await writeFile(join(root, 'README.md'), '# User-owned README\n'); await writeFile(join(root, 'LICENSE'), 'Original attribution\n');
  const launcher = join(root, 'npm launcher.mjs');
  await writeFile(launcher, `import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
if(process.argv[2]==='--version'){console.log('11.19.1');process.exit(0);}
if(existsSync('.fail-install')) process.exit(6);
mkdirSync('node_modules/sample',{recursive:true});writeFileSync('node_modules/sample/package.json',JSON.stringify({version:'1.2.3'}));writeFileSync('node_modules/sample/bin.mjs','tool');
writeFileSync('node_modules/.package-lock.json',JSON.stringify({lockfileVersion:3,packages:{'node_modules/sample':{version:'1.2.3'}}}));
writeFileSync('install-count',String(Number(existsSync('install-count')?readFileSync('install-count','utf8'):0)+1));
console.log('Synthetic install boundary; not real dependency qualification');`);
  await mkdir(join(root, 'scripts/quality'), { recursive: true });
  await mkdir(join(root, 'scripts/dev'), { recursive: true });
  await cp(join(source, 'scripts/dev/install-local.mjs'), join(root, 'scripts/dev/install-local.mjs'));
  await writeFile(join(root, 'scripts/quality/verify.mjs'), `import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
if(existsSync('.fail-verify')) process.exit(7);
if(!existsSync('node_modules/sample/bin.mjs')) process.exit(8);
if(existsSync('.change-source')) writeFileSync('src/changed.ts','export const changed = true;');
if(existsSync('.change-journal')) writeFileSync('.template-state/setup.json','{"external":true}');
mkdirSync('dist',{recursive:true});writeFileSync('dist/main.js','verified fixture');writeFileSync('dist/styles.css','.fixture{}');writeFileSync('dist/manifest.json',readFileSync('manifest.json'));
writeFileSync('verify-count',String(Number(existsSync('verify-count')?readFileSync('verify-count','utf8'):0)+1));
console.log('Synthetic verify boundary; not real build qualification');`);
  await mkdir(join(root, 'src'), { recursive: true });
  return { root, manifest, pkg, lock, launcher };
}
export function run(root, launcher, args = [], env = {}) {
  return spawnSync(process.execPath, ['scripts/setup.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, npm_execpath: launcher, ...env } });
}
export async function snapshot(root) {
  const entries = {};
  async function visit(path = '') {
    for (const name of (await readdir(join(root, path))).sort()) {
      const relative = path ? `${path}/${name}` : name; const stat = await lstat(join(root, relative));
      if (stat.isDirectory()) await visit(relative);
      else entries[relative] = createHash('sha256').update(await readFile(join(root, relative))).digest('hex');
    }
  }
  await visit(); return entries;
}
