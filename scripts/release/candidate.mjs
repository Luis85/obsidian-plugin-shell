import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, mkdir, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stableVersion } from './prepare.mjs';

export const assetNames = Object.freeze(['main.js', 'manifest.json', 'styles.css']);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); }
export function fixedSource(root, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit ?? '') || git(root, ['rev-parse', 'HEAD']) !== commit) throw new Error('FIXED_COMMIT_REQUIRED');
  if (git(root, ['status', '--porcelain', '--untracked-files=normal'])) throw new Error('SOURCE_NOT_CLEAN');
  return commit;
}
async function regularBytes(path) {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink() || !entry.size) throw new Error('UNSAFE_OR_EMPTY_ASSET');
  return readFile(path);
}
async function directory(path) {
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('UNSAFE_CANDIDATE_DIRECTORY');
}
export async function collectAssets(root, input, version) {
  stableVersion(version); await directory(input);
  const names = (await readdir(input)).sort();
  if (JSON.stringify(names) !== JSON.stringify([...assetNames].sort())) throw new Error('ASSET_SET_MISMATCH');
  const bytes = Object.fromEntries(await Promise.all(assetNames.map(async name => [name, await regularBytes(join(input, name))])));
  const manifest = JSON.parse(bytes['manifest.json'].toString());
  const source = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== version || JSON.stringify(manifest) !== JSON.stringify(source)) throw new Error('ASSET_MANIFEST_MISMATCH');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id.includes('obsidian') || typeof manifest.isDesktopOnly !== 'boolean') throw new Error('INVALID_MANIFEST_IDENTITY');
  stableVersion(manifest.minAppVersion);
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
  const versions = JSON.parse(await readFile(join(root, 'versions.json'), 'utf8'));
  if (pkg.version !== version || lock.version !== version || lock.packages?.['']?.version !== version || versions[version] !== manifest.minAppVersion) throw new Error('SOURCE_VERSION_MISMATCH');
  return { bytes, manifest };
}
export async function retainCandidate({ root, input, output, commit, version, qualification }) {
  fixedSource(root, commit);
  if (qualification?.status !== 'passed' || qualification.sourceCommit !== commit || qualification.command !== 'verify') throw new Error('QUALIFICATION_REQUIRED');
  if (qualification.node !== 'v24.21.0' || qualification.npm !== '11.19.1') throw new Error('QUALIFIED_TOOLCHAIN_REQUIRED');
  const { bytes, manifest } = await collectAssets(root, input, version);
  const hashes = Object.fromEntries(assetNames.map(name => [name, sha256(bytes[name])]));
  if (JSON.stringify(qualification.assetHashes) !== JSON.stringify(hashes)) throw new Error('QUALIFICATION_HASH_MISMATCH');
  const notes = await regularBytes(join(root, 'CHANGELOG.md'));
  if (!notes.toString().includes(`## ${version}\n`)) throw new Error('VERSION_NOTES_REQUIRED');
  const record = { schemaVersion: 1, kind: 'release-rehearsal', sourceCommit: commit, version,
    identity: manifest.id, minAppVersion: manifest.minAppVersion, isDesktopOnly: manifest.isDesktopOnly,
    assetHashes: hashes, notesHash: sha256(notes), lockHash: sha256(await readFile(join(root, 'package-lock.json'))),
    tools: { node: qualification.node, npm: qualification.npm }, packagingNode: process.version, createdAt: new Date().toISOString(),
    qualification, nativeAcceptance: { status: 'not-run' }, publication: 'not-authorized' };
  output = resolve(output); await mkdir(dirname(output), { recursive: true });
  try { await lstat(output); throw new Error('CANDIDATE_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stage = await mkdtemp(join(dirname(output), '.candidate-'));
  try {
    for (const name of assetNames) await writeFile(join(stage, name), bytes[name], { flag: 'wx' });
    await writeFile(join(stage, 'release-notes.md'), notes, { flag: 'wx' });
    await writeFile(join(stage, 'candidate.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    fixedSource(root, commit);
    await rename(stage, output);
  } finally { await rm(stage, { recursive: true, force: true }); }
  return record;
}
export async function validateRetained(directoryPath, expectedCommit, expectedVersion) {
  if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) throw new Error('FIXED_COMMIT_REQUIRED');
  stableVersion(expectedVersion); await directory(directoryPath);
  const expectedFiles = [...assetNames, 'release-notes.md', 'candidate.json'].sort();
  if (JSON.stringify((await readdir(directoryPath)).sort()) !== JSON.stringify(expectedFiles)) throw new Error('ASSET_SET_MISMATCH');
  const record = JSON.parse(await regularBytes(join(directoryPath, 'candidate.json')));
  if (record.schemaVersion !== 1 || record.kind !== 'release-rehearsal' || record.sourceCommit !== expectedCommit || record.version !== expectedVersion) throw new Error('PROVENANCE_MISMATCH');
  if (record.tools?.node !== 'v24.21.0' || record.tools?.npm !== '11.19.1' || record.qualification?.node !== record.tools.node || record.qualification?.npm !== '11.19.1') throw new Error('QUALIFIED_TOOLCHAIN_REQUIRED');
  if (!/^[a-f0-9]{64}$/.test(record.lockHash ?? '') || !Number.isFinite(Date.parse(record.createdAt)) || record.publication !== 'not-authorized' || record.nativeAcceptance?.status !== 'not-run') throw new Error('PROVENANCE_MISMATCH');
  if (record.qualification?.status !== 'passed' || record.qualification.command !== 'verify' || record.qualification.sourceCommit !== expectedCommit) throw new Error('QUALIFICATION_REQUIRED');
  if (JSON.stringify(Object.keys(record.assetHashes ?? {}).sort()) !== JSON.stringify([...assetNames].sort())) throw new Error('ASSET_SET_MISMATCH');
  for (const name of assetNames) {
    if (sha256(await regularBytes(join(directoryPath, name))) !== record.assetHashes[name] || record.qualification.assetHashes?.[name] !== record.assetHashes[name]) throw new Error('ASSET_HASH_MISMATCH');
  }
  if (sha256(await regularBytes(join(directoryPath, 'release-notes.md'))) !== record.notesHash) throw new Error('NOTES_HASH_MISMATCH');
  const manifest = JSON.parse(await regularBytes(join(directoryPath, 'manifest.json')));
  stableVersion(manifest.minAppVersion);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id.includes('obsidian') || typeof manifest.isDesktopOnly !== 'boolean') throw new Error('INVALID_MANIFEST_IDENTITY');
  if (manifest.version !== expectedVersion || manifest.id !== record.identity || manifest.minAppVersion !== record.minAppVersion || manifest.isDesktopOnly !== record.isDesktopOnly) throw new Error('ASSET_MANIFEST_MISMATCH');
  return record;
}
