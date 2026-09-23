import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.mjs';
import { planMigration } from './migration.mjs';
const portable = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const identityDocument = identity => `# Project identity\n\nConfigured by explicit setup. Original attribution remains in LICENSE and repository history.\n\n\`\`\`json\n${json(identity)}\`\`\`\n\nOnly the repository-contained development vault is an installation target.\n`;
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function dependencyEntries(value) {
  if (!plain(value) || Object.values(value).some(pin => typeof pin !== 'string')) throw new Error('Malformed dependency declarations');
  return Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
export function validateIdentity(identity) {
  if (typeof identity.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(identity.id) || identity.id.length > 64 || portable.test(identity.id)) throw new Error('Invalid portable plugin id');
  for (const [key, max] of [['name', 80], ['description', 300], ['author', 120]]) {
    const value = identity[key];
    if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error(`Invalid identity ${key}`);
  }
  if (typeof identity.version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(identity.version)) throw new Error('Version must be an explicit stable x.y.z version');
  if (identity.repo !== null && (typeof identity.repo !== 'string' || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(identity.repo) || identity.repo.endsWith('.git'))) throw new Error('Repository must be owner/name, without credentials or URL');
  return Object.freeze({ ...identity });
}
export async function planIdentity(root, options, previousJournal = null, { afterRead } = {}) {
  const inspected = await createFilePlan(root, ['manifest.json', 'package.json', 'package-lock.json', 'versions.json'].map(path => ({ path, content: null })));
  const expectedHashes = new Map(inspected.changes.map(change => [change.path, change.beforeHash]));
  const originals = new Map();
  async function metadata(path) {
    const bytes = await readFile(join(root, path)); const text = bytes.toString('utf8');
    if (hash(bytes) !== expectedHashes.get(path)) throw new Error('Identity planning inputs changed; review a new plan');
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Identity metadata is not lossless UTF-8');
    originals.set(path, text); return JSON.parse(text);
  }
  const manifest = await metadata('manifest.json'); const pkg = await metadata('package.json');
  const lock = await metadata('package-lock.json'); const versions = await metadata('versions.json');
  if (!plain(manifest) || !plain(pkg) || !plain(lock) || !plain(lock.packages?.['']) || !plain(versions) || lock.lockfileVersion !== 3) throw new Error('Malformed project identity or lockfile');
  if (pkg.name !== lock.name || pkg.version !== lock.version || lock.packages[''].name !== pkg.name || lock.packages[''].version !== pkg.version) throw new Error('Package and lockfile root identity disagree');
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) if (JSON.stringify(dependencyEntries(pkg[key] ?? {})) !== JSON.stringify(dependencyEntries(lock.packages[''][key] ?? {}))) throw new Error(`Package and lockfile ${key} disagree`);
  const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const repo = typeof repository === 'string' ? /^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/.exec(repository)?.[1] ?? null : null;
  const identity = validateIdentity(Object.fromEntries(['id', 'name', 'description', 'author', 'version', 'repo'].map(key => [key, options[key] ?? (key === 'repo' ? repo : manifest[key])])));
  if (typeof manifest.minAppVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion)) throw new Error('Invalid manifest host version floor');
  if (Object.hasOwn(versions, identity.version) && versions[identity.version] !== manifest.minAppVersion) throw new Error('Chosen version has a conflicting historical host floor; choose a new version');
  const nextManifest = { ...manifest, id: identity.id, name: identity.name, description: identity.description, author: identity.author, version: identity.version };
  const entries = [];
  if (options.identityRequested) {
    const existingDoc = await createFilePlan(root, [{ path: 'PROJECT-IDENTITY.md', content: null }]);
    expectedHashes.set('PROJECT-IDENTITY.md', existingDoc.changes[0].beforeHash);
    if (existingDoc.changes[0].beforeHash !== null) {
      const previousIdentity = Object.fromEntries(['id', 'name', 'description', 'author', 'version', 'repo'].map(key => [key, key === 'repo' ? repo : manifest[key]]));
      const bytes = await readFile(join(root, 'PROJECT-IDENTITY.md'));
      if (hash(bytes) !== expectedHashes.get('PROJECT-IDENTITY.md')) throw new Error('Identity planning inputs changed; review a new plan');
      if (bytes.toString('utf8') !== identityDocument(previousIdentity)) throw new Error('PROJECT-IDENTITY.md has user edits; preserve or relocate it before configuring identity');
    }
    const nextPackage = { ...pkg, name: identity.id, version: identity.version, description: identity.description, author: identity.author,
      ...(identity.repo ? { repository: { type: 'git', url: `https://github.com/${identity.repo}.git` } } : {}) };
    const nextLock = { ...lock, name: identity.id, version: identity.version, packages: { ...lock.packages,
      '': { ...lock.packages[''], name: identity.id, version: identity.version } } };
    entries.push({ path: 'manifest.json', content: json(nextManifest) }, { path: 'package.json', content: json(nextPackage) },
      { path: 'package-lock.json', content: json(nextLock) }, { path: 'versions.json', content: json({ ...versions, [identity.version]: manifest.minAppVersion }) },
      { path: 'PROJECT-IDENTITY.md', content: identityDocument(identity) });
  } else for (const [path, content] of originals) entries.push({ path, content });
  if (options['migrate-from']) validateIdentity({ ...identity, id: options['migrate-from'] });
  const migration = await planMigration(root, { from: options['migrate-from'], to: identity.id, previousId: manifest.id, profile: options.profile,
    expectedManifest: nextManifest, previousManifest: manifest, receipt: previousJournal?.migration });
  await afterRead?.();
  const plan = await createFilePlan(root, entries);
  if (plan.changes.some(change => change.beforeHash !== expectedHashes.get(change.path))) throw new Error('Identity planning inputs changed; review a new plan');
  return { identity, manifest: nextManifest, previousManifest: manifest, plan, migration };
}
