/** Offline exact-pin policy shared by audit, release and generated consumers. No install or lockfile rewrite. */
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const groups = Object.freeze(['dependencies', 'devDependencies', 'optionalDependencies']);
const exact = value => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function fail(code, message) { throw new Error(code + ': ' + message); }
function object(value, code, message) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code, message);
  return value;
}
async function regular(path, limit, missingCode) {
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error?.code === 'ENOENT') fail(missingCode, relative(process.cwd(), path) || path);
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit) fail('DEPENDENCY_INPUT_INVALID', 'Expected a bounded regular file: ' + path);
  return readFile(path);
}
function decode(bytes, path) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('DEPENDENCY_INPUT_INVALID', 'Invalid UTF-8: ' + path); }
}
async function jsonFile(path, limit, missingCode) {
  const bytes = await regular(path, limit, missingCode);
  let data;
  try { data = JSON.parse(decode(bytes, path)); } catch { fail('DEPENDENCY_INPUT_INVALID', 'Invalid JSON: ' + path); }
  return { bytes, data: object(data, 'DEPENDENCY_INPUT_INVALID', 'Expected a JSON object: ' + path) };
}
function portableWorkspace(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 240 || isAbsolute(pattern) || pattern.includes('\\') ||
      /[\u0000-\u001f\[\]{}!]/.test(pattern) || pattern.split('/').some(part => !part || part === '.' || part === '..'))
    fail('DEPENDENCY_WORKSPACE_INVALID', 'Unsupported workspace pattern: ' + String(pattern));
  return pattern.replace(/\/+$/, '');
}
function workspacePatterns(pkg) {
  if (pkg.workspaces === undefined) return [];
  const raw = Array.isArray(pkg.workspaces) ? pkg.workspaces : object(pkg.workspaces, 'DEPENDENCY_WORKSPACE_INVALID', 'Invalid workspaces field.').packages;
  if (!Array.isArray(raw) || raw.length > 100) fail('DEPENDENCY_WORKSPACE_INVALID', 'Workspaces must be a bounded package-pattern array.');
  return raw.map(portableWorkspace);
}
function segmentPattern(value) {
  let source = '^';
  for (const char of value) {
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(source + '$');
}
async function childDirectories(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !['node_modules', '.git'].includes(entry.name)).map(entry => entry.name).sort();
}
async function expandPattern(root, pattern, state) {
  const segments = pattern.split('/'), matches = new Set();
  async function walk(base, index, relativeParts) {
    if (++state.visits > 20000) fail('DEPENDENCY_WORKSPACE_LIMIT', 'Workspace expansion exceeded 20000 directories.');
    if (index === segments.length) {
      const manifest = join(base, 'package.json');
      try {
        const stat = await lstat(manifest);
        if (stat.isFile() && !stat.isSymbolicLink()) matches.add(relativeParts.join('/'));
      } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      return;
    }
    const segment = segments[index];
    if (segment === '**') {
      await walk(base, index + 1, relativeParts);
      for (const name of await childDirectories(base)) await walk(join(base, name), index, [...relativeParts, name]);
      return;
    }
    const pattern = segmentPattern(segment);
    for (const name of await childDirectories(base)) if (pattern.test(name)) await walk(join(base, name), index + 1, [...relativeParts, name]);
  }
  await walk(root, 0, []);
  if (!matches.size) fail('DEPENDENCY_WORKSPACE_MISSING', 'Workspace pattern matched no package: ' + pattern);
  return [...matches];
}
async function workspaceDirectories(root, pkg) {
  const state = { visits: 0 }, found = new Set();
  for (const pattern of workspacePatterns(pkg)) for (const path of await expandPattern(root, pattern, state)) found.add(path);
  if (found.size > 100) fail('DEPENDENCY_WORKSPACE_LIMIT', 'More than 100 workspace manifests are not supported by the release gate.');
  return [...found].sort();
}
function dependencyMap(pkg, group, manifest) {
  const raw = pkg[group];
  if (raw === undefined) return {};
  const map = object(raw, 'DEPENDENCY_MANIFEST_INVALID', manifest + ' ' + group + ' must be an object.');
  for (const [name, specifier] of Object.entries(map)) {
    if (!name || typeof specifier !== 'string' || !exact(specifier))
      fail('DEPENDENCY_PIN_INVALID', manifest + ' ' + group + ' ' + name + ' must be exact MAJOR.MINOR.PATCH; got ' + JSON.stringify(specifier));
  }
  return map;
}
function selectorSpecifier(selector) {
  if (selector === '.') return null;
  if (selector.startsWith('@')) {
    const slash = selector.indexOf('/');
    if (slash <= 1) fail('DEPENDENCY_OVERRIDE_INVALID', 'Invalid scoped override selector: ' + selector);
    const at = selector.indexOf('@', slash + 1);
    return at === -1 ? null : selector.slice(at + 1);
  }
  const at = selector.lastIndexOf('@');
  return at > 0 ? selector.slice(at + 1) : null;
}
function checkOverrides(value, manifest, trail = 'overrides') {
  if (value === undefined) return { values: 0, selectors: 0 };
  const overrides = object(value, 'DEPENDENCY_OVERRIDE_INVALID', manifest + ' overrides must be an object.');
  let values = 0, selectors = 0;
  for (const [selector, rule] of Object.entries(overrides)) {
    if (!selector || /[\u0000-\u001f]/.test(selector)) fail('DEPENDENCY_OVERRIDE_INVALID', manifest + ' contains an invalid override selector.');
    const selected = selectorSpecifier(selector);
    if (selected !== null) {
      selectors++;
      if (!exact(selected)) fail('DEPENDENCY_PIN_INVALID', manifest + ' ' + trail + ' selector ' + selector + ' is not exact.');
    }
    if (typeof rule === 'string') {
      values++;
      if (!exact(rule)) fail('DEPENDENCY_PIN_INVALID', manifest + ' ' + trail + '.' + selector + ' must be exact MAJOR.MINOR.PATCH; got ' + JSON.stringify(rule));
    } else {
      const nested = checkOverrides(rule, manifest, trail + '.' + selector);
      values += nested.values; selectors += nested.selectors;
    }
  }
  return { values, selectors };
}
function resolveLockedVersion(lockPackages, lockKey, name) {
  const candidates = [...new Set([lockKey ? lockKey + '/node_modules/' + name : 'node_modules/' + name, 'node_modules/' + name])];
  for (const candidate of candidates) {
    const entry = lockPackages[candidate];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.version === 'string') return entry.version;
    if (entry.link === true && typeof entry.resolved === 'string') {
      const target = entry.resolved.replaceAll('\\', '/').replace(/^\.\//, '');
      const linked = lockPackages[target];
      if (linked && typeof linked.version === 'string') return linked.version;
    }
  }
  return null;
}
function validateManifest(pkg, manifest, lockPackages, lockKey) {
  const lockEntry = object(lockPackages[lockKey], 'DEPENDENCY_LOCK_DECLARATION_MISSING', 'Lockfile has no package entry for ' + manifest + '.');
  const declarations = [];
  for (const group of groups) {
    const map = dependencyMap(pkg, group, manifest);
    const locked = map && Object.keys(map).length ? object(lockEntry[group] ?? {}, 'DEPENDENCY_LOCK_DECLARATION_MISMATCH', 'Missing lock declaration group for ' + manifest + ' ' + group + '.') : {};
    for (const [name, version] of Object.entries(map)) {
      if (locked[name] !== version) fail('DEPENDENCY_LOCK_DECLARATION_MISMATCH', manifest + ' ' + group + ' ' + name + ': manifest=' + version + ' lock=' + JSON.stringify(locked[name]));
      const resolved = resolveLockedVersion(lockPackages, lockKey, name);
      if (resolved !== version) fail('DEPENDENCY_LOCK_RESOLUTION_MISMATCH', manifest + ' ' + group + ' ' + name + ': manifest=' + version + ' resolved=' + JSON.stringify(resolved));
      declarations.push({ group, name, version });
    }
  }
  const overrides = checkOverrides(pkg.overrides, manifest);
  return { declarations, overrides };
}
export async function checkDependencyPins(root = process.cwd()) {
  root = resolve(root);
  const rootManifest = await jsonFile(join(root, 'package.json'), 1024 * 1024, 'DEPENDENCY_MANIFEST_MISSING');
  const lockfile = await jsonFile(join(root, 'package-lock.json'), 16 * 1024 * 1024, 'DEPENDENCY_LOCKFILE_MISSING');
  if (!Number.isInteger(lockfile.data.lockfileVersion) || lockfile.data.lockfileVersion < 2)
    fail('DEPENDENCY_LOCKFILE_INVALID', 'A package-lock with packages metadata is required.');
  const lockPackages = object(lockfile.data.packages, 'DEPENDENCY_LOCKFILE_INVALID', 'Lockfile packages metadata is required.');
  const manifests = [{ path: 'package.json', lockKey: '', source: rootManifest }];
  for (const directory of await workspaceDirectories(root, rootManifest.data)) {
    const source = await jsonFile(join(root, ...directory.split('/'), 'package.json'), 1024 * 1024, 'DEPENDENCY_MANIFEST_MISSING');
    manifests.push({ path: directory + '/package.json', lockKey: directory, source });
  }
  const checked = []; let declarations = 0, overrideValues = 0, overrideSelectors = 0;
  for (const item of manifests) {
    const validation = validateManifest(item.source.data, item.path, lockPackages, item.lockKey);
    declarations += validation.declarations.length; overrideValues += validation.overrides.values; overrideSelectors += validation.overrides.selectors;
    checked.push({ path: item.path, hash: hash(item.source.bytes), lockKey: item.lockKey, declarations: validation.declarations.length,
      overrideValues: validation.overrides.values, overrideSelectors: validation.overrides.selectors });
  }
  return { schemaVersion: 1, policy: 'exact-npm-pins-v1', manifests: checked,
    lockfile: { path: 'package-lock.json', hash: hash(lockfile.bytes), lockfileVersion: lockfile.data.lockfileVersion },
    checked: { manifests: checked.length, dependencyDeclarations: declarations, overrideValues, overrideSelectors } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await checkDependencyPins(process.cwd()), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'DEPENDENCY_PIN_CHECK_FAILED'); process.exitCode = 1; }
}
