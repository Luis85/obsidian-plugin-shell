import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';

export function stableVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) || value.split('.').some(part => !Number.isSafeInteger(Number(part)))) throw new Error('INVALID_STABLE_VERSION');
  return value;
}
export function compareVersions(a, b) {
  stableVersion(a); stableVersion(b);
  const left = a.split('.').map(Number); const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}
export async function prepareVersion(root, version, notes, { beforeFinalize } = {}) {
  stableVersion(version);
  if (typeof notes !== 'string' || !notes.trim()) throw new Error('RELEASE_NOTES_REQUIRED');
  const names = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'CHANGELOG.md'];
  const initial = await createFilePlan(root, names.map(path => ({ path, content: null })));
  const hashes = new Map(initial.changes.map(change => [change.path, change.beforeHash]));
  const read = async name => {
    let content = null;
    try { content = await readFile(resolve(root, name), 'utf8'); } catch (error) { if (error.code !== 'ENOENT' || name !== 'CHANGELOG.md') throw error; }
    const hash = content === null ? null : createHash('sha256').update(content).digest('hex');
    if (hash !== hashes.get(name)) throw new Error(`RELEASE_STALE_INPUT: ${name}`);
    return content;
  };
  const originals = await Promise.all(names.map(read));
  const [pkg, lock, manifest, versions] = originals.slice(0, 4).map(value => JSON.parse(value));
  if (pkg.version !== manifest.version || lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) throw new Error('SOURCE_VERSION_MISMATCH');
  if (compareVersions(version, pkg.version) <= 0 || Object.hasOwn(versions, version)) throw new Error('VERSION_NOT_NEW');
  stableVersion(manifest.minAppVersion);
  if (versions[pkg.version] !== manifest.minAppVersion) throw new Error('UNREVIEWED_HOST_FLOOR_CHANGE');
  const changelog = originals[4] ?? '# Changelog\n';
  if (changelog.includes(`## ${version}`)) throw new Error('CHANGELOG_VERSION_EXISTS');
  pkg.version = version; lock.version = version; lock.packages[''].version = version; manifest.version = version;
  versions[version] = manifest.minAppVersion;
  const entries = Object.entries({ 'package.json': pkg, 'package-lock.json': lock, 'manifest.json': manifest, 'versions.json': versions }).map(([path, value]) => ({ path, content: JSON.stringify(value, null, 2) + '\n' }));
  entries.push({ path: 'CHANGELOG.md', content: `# Changelog\n\n## ${version}\n\n${notes.trim()}\n\n${changelog.replace(/^# Changelog\s*/, '')}` });
  await beforeFinalize?.();
  const plan = await createFilePlan(root, entries);
  for (const change of plan.changes) if (hashes.get(change.path) !== change.beforeHash) throw new Error(`RELEASE_STALE_INPUT: ${change.path}`);
  return { plan, version, minAppVersion: manifest.minAppVersion, hostFloorChanged: false };
}
export function parsePrepareArguments(args) {
  const options = {}; const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`); seen.add(flag);
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--help') options.help = true;
    else if (flag === '--version' || flag === '--notes-file') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[flag === '--version' ? 'version' : 'notes'] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  if (!args.length) return { help: true };
  if (options.help) { if (args.length !== 1) throw new Error('HELP_MUST_BE_USED_ALONE'); return options; }
  if (!options.version || !options.notes) throw new Error('VERSION_AND_NOTES_FILE_REQUIRED');
  stableVersion(options.version); return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parsePrepareArguments(process.argv.slice(2));
    if (options.help) { console.log('npm run release:prepare -- --version X.Y.Z --notes-file <file> [--dry-run]\nReviews or applies consistent source metadata only. No commit, tag, push or publication.'); process.exit(0); }
    const notes = options.notes ? await readFile(resolve(options.notes), 'utf8') : '';
    const result = await prepareVersion(process.cwd(), options.version, notes);
    console.log(JSON.stringify({ ...result, mode: options.dryRun ? 'dry-run' : 'apply' }, null, 2));
    if (!options.dryRun) console.log(JSON.stringify(await applyFilePlan(result.plan)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
