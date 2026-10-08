import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const plugins = join(root, 'src/cli/sdk');
const registry = await readFile(join(plugins, 'registry.ts'), 'utf8');
const reserved = new Set(['api.ts', 'registry.ts', 'runtime.ts', 'template-contributions.ts', 'README.md']);
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;

async function regular(path, label) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('PLUGIN_STRUCTURE: ' + label + ' must be a regular file.');
}
async function directory(path, label) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PLUGIN_STRUCTURE: ' + label + ' must be a regular directory.');
}
async function tests(path) {
  const found = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('PLUGIN_STRUCTURE: symlinks are not allowed in plugin tests.');
      const current = join(folder, entry.name);
      if (entry.isDirectory()) await walk(current);
      else if (entry.isFile() && entry.name.endsWith('.test.ts')) found.push(current);
    }
  }
  await walk(path);
  return found;
}

let count = 0;
for (const entry of await readdir(plugins, { withFileTypes: true })) {
  if (entry.isSymbolicLink()) throw new Error('PLUGIN_STRUCTURE: symlinks are not allowed in src/cli/sdk/.');
  if (entry.isFile()) {
    if (!reserved.has(entry.name)) throw new Error('PLUGIN_STRUCTURE: unexpected root plugin file ' + entry.name + '.');
    continue;
  }
  if (!entry.isDirectory()) throw new Error('PLUGIN_STRUCTURE: unsupported src/cli/sdk/ entry ' + entry.name + '.');
  const id = entry.name;
  if (!idPattern.test(id)) throw new Error('PLUGIN_STRUCTURE: plugin directory must use a lower-case hyphenated ID: ' + id);
  const folder = join(plugins, id);
  await regular(join(folder, 'manifest.json'), id + '/manifest.json');
  await regular(join(folder, 'config.json'), id + '/config.json');
  await directory(join(folder, 'src'), id + '/src');
  await directory(join(folder, 'tests'), id + '/tests');
  await regular(join(folder, 'src/index.ts'), id + '/src/index.ts');

  const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'));
  if (!manifest || manifest.id !== id || typeof manifest.name !== 'string' || !manifest.name
    || typeof manifest.version !== 'string' || !versionPattern.test(manifest.version)
    || Object.keys(manifest).some(key => !['id', 'name', 'version', 'description'].includes(key)))
    throw new Error('PLUGIN_MANIFEST: invalid manifest for ' + id + '.');

  const config = JSON.parse(await readFile(join(folder, 'config.json'), 'utf8'));
  if (!config || typeof config !== 'object' || Array.isArray(config)
    || (config.enabled !== undefined && typeof config.enabled !== 'boolean'))
    throw new Error('PLUGIN_CONFIG: invalid config for ' + id + '.');

  const source = await readFile(join(folder, 'src/index.ts'), 'utf8');
  if (!/export\s+const\s+PluginObject\b/.test(source)) throw new Error('PLUGIN_OBJECT: ' + id + ' must export const PluginObject.');
  if (!(await tests(join(folder, 'tests'))).length) throw new Error('PLUGIN_TESTS: ' + id + ' needs at least one *.test.ts under tests/.');
  if (!registry.includes('./' + id + '/src/index.ts')) throw new Error('PLUGIN_REGISTRY: ' + id + ' is not explicitly registered.');
  count += 1;
}
console.log('Workbench plugin structure passed: ' + count + ' registered plugin' + (count === 1 ? '' : 's') + '.');
