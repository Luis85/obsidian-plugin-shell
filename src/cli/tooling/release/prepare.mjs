/**
 * Plan (default apply, or --dry-run) one stable version bump across package.json, package-lock.json,
 * manifest.json, versions.json and CHANGELOG.md. The changelog's Unreleased section (merged with an optional
 * --notes-file) becomes "## [X.Y.Z] - date" and link references are rewritten. Never commits, tags or pushes.
 * Callers may add generated, version-stamped outputs (the Workbench repository adds its CLI manual through
 * tooling/release/prepare.mjs and the cut); they join the same reviewed plan and stale-input check.
 *
 *   npm run release:prepare -- --version X.Y.Z [--date YYYY-MM-DD] [--notes-file notes.md] [--min-app-version A.B.C] [--dry-run]
 *
 * The host floor (manifest minAppVersion) carries forward unchanged unless --min-app-version names a reviewed, higher
 * floor; then manifest.json and the new versions.json entry change together. Released entries are never rewritten.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createFilePlan, applyFilePlan } from '#shared/platform/file-plan.ts';
import { checkDependencyPins } from '../security/dependency-pins.mjs';
import { promoteUnreleased, repositoryUrl, validDate } from './changelog.mjs';

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
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
/** A reviewed new host floor: a stable x.y.z version, or HOST_FLOOR_INVALID. */
export function hostFloor(value) {
  try { return stableVersion(value); } catch { throw new Error(`HOST_FLOOR_INVALID: ${String(value)}`); }
}
/** notes is optional extra Markdown; Unreleased plus notes must not be empty (RELEASE_NOTES_EMPTY).
 * minAppVersion is an explicit, reviewed host floor that must be higher than the current one (HOST_FLOOR_NOT_RAISED).
 * generated lists outputs derived from the new version: render(version) must return exactly the declared paths
 * (RELEASE_GENERATED_CONTRACT); their current bytes are part of the stale-input check.
 * @typedef {{ id: string, paths: readonly string[], render: (version: string) => Promise<Record<string, string>> }} GeneratedOutput
 * @param {string} root
 * @param {string} version
 * @param {string} [notes]
 * @param {{ beforeFinalize?: () => unknown, date?: string, minAppVersion?: string, generated?: readonly GeneratedOutput[] }} [options] */
export async function prepareVersion(root, version, notes = '', { beforeFinalize, date = today(), minAppVersion, generated = [] } = {}) {
  stableVersion(version);
  if (minAppVersion !== undefined) hostFloor(minAppVersion);
  if (typeof notes !== 'string') throw new Error('RELEASE_NOTES_INVALID');
  if (!validDate(date)) throw new Error('RELEASE_DATE_INVALID');
  const dependencyPins = await checkDependencyPins(root);
  const names = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'CHANGELOG.md'];
  const derived = generated.flatMap(output => output.paths);
  if (new Set([...names, ...derived]).size !== names.length + derived.length) throw new Error('RELEASE_GENERATED_CONTRACT: duplicate output path');
  const initial = await createFilePlan(root, [...names, ...derived].map(path => ({ path, content: null })));
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
  const previousMinAppVersion = manifest.minAppVersion;
  if (minAppVersion !== undefined && compareVersions(minAppVersion, previousMinAppVersion) <= 0) throw new Error(`HOST_FLOOR_NOT_RAISED: ${minAppVersion} is not above ${previousMinAppVersion}`);
  const changelog = promoteUnreleased(originals[4], { version, date, notes, repository: repositoryUrl(pkg) });
  pkg.version = version; lock.version = version; lock.packages[''].version = version; manifest.version = version;
  if (minAppVersion !== undefined) manifest.minAppVersion = minAppVersion;
  versions[version] = manifest.minAppVersion;
  const entries = Object.entries({ 'package.json': pkg, 'package-lock.json': lock, 'manifest.json': manifest, 'versions.json': versions }).map(([path, value]) => ({ path, content: JSON.stringify(value, null, 2) + '\n' }));
  entries.push({ path: 'CHANGELOG.md', content: changelog.text });
  for (const output of generated) {
    const files = await output.render(version);
    if (Object.keys(files).sort().join('\0') !== [...output.paths].sort().join('\0') || Object.values(files).some(content => typeof content !== 'string')) throw new Error(`RELEASE_GENERATED_CONTRACT: ${output.id}`);
    for (const path of output.paths) entries.push({ path, content: files[path] });
  }
  await beforeFinalize?.();
  const plan = await createFilePlan(root, entries);
  for (const change of plan.changes) if (hashes.get(change.path) !== change.beforeHash) throw new Error(`RELEASE_STALE_INPUT: ${change.path}`);
  const finalPins = await checkDependencyPins(root);
  if (JSON.stringify(finalPins) !== JSON.stringify(dependencyPins)) throw new Error('DEPENDENCY_PINS_STALE: Dependency manifests or lockfile changed while preparing the release.');
  return { plan, version, date, minAppVersion: manifest.minAppVersion, previousMinAppVersion, hostFloorChanged: manifest.minAppVersion !== previousMinAppVersion, dependencyPins,
    changelog: { section: changelog.section, linkReferences: changelog.linkReferences }, generated: generated.map(({ id, paths }) => ({ id, paths: [...paths] })) };
}
export function parsePrepareArguments(args) {
  const options = {}; const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`DUPLICATE_ARGUMENT: ${flag}`); seen.add(flag);
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--help') options.help = true;
    else if (flag === '--version' || flag === '--notes-file' || flag === '--date' || flag === '--min-app-version') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT_VALUE: ${flag}`);
      options[{ '--version': 'version', '--notes-file': 'notes', '--date': 'date', '--min-app-version': 'minAppVersion' }[flag]] = value;
    } else throw new Error(`UNKNOWN_ARGUMENT: ${flag}`);
  }
  if (!args.length) return { help: true };
  if (options.help) { if (args.length !== 1) throw new Error('HELP_MUST_BE_USED_ALONE'); return options; }
  if (!options.version) throw new Error('VERSION_REQUIRED');
  if (options.date !== undefined && !validDate(options.date)) throw new Error('RELEASE_DATE_INVALID');
  if (options.minAppVersion !== undefined) hostFloor(options.minAppVersion);
  stableVersion(options.version); return options;
}
/** The release:prepare command line; generated outputs come from the caller (see tooling/release/prepare.mjs). */
export async function runPrepare(args, { cwd = process.cwd(), generated = [] } = {}) {
  try {
    const options = parsePrepareArguments(args);
    if (options.help) { process.stdout.write('npm run release:prepare -- --version X.Y.Z [--date YYYY-MM-DD] [--notes-file <file>] [--min-app-version A.B.C] [--dry-run]\nPromotes CHANGELOG [Unreleased] (plus optional notes) into the version and reviews or applies consistent source metadata and generated, version-stamped outputs only. --min-app-version raises the reviewed host floor in manifest.json and the new versions.json entry. No commit, tag, push or publication.\n'); return 0; }
    const notes = options.notes ? await readFile(resolve(options.notes), 'utf8') : '';
    const { date, minAppVersion } = options;
    const result = await prepareVersion(cwd, options.version, notes, { ...(date ? { date } : {}), ...(minAppVersion ? { minAppVersion } : {}), generated });
    console.log(JSON.stringify({ ...result, mode: options.dryRun ? 'dry-run' : 'apply' }, null, 2));
    if (!options.dryRun) console.log(JSON.stringify(await applyFilePlan(result.plan)));
    return 0;
  } catch (error) { console.error(error.message); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await runPrepare(process.argv.slice(2));
