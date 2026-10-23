import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '#shared/platform/hash.ts';
import { stableVersion } from './prepare.mjs';

/**
 * The downloadable Workbench CLI that a release carries next to the plugin assets: the framework kit and the
 * starters that "Independent Workbench distributions" packs on the Release tier (artifact
 * `workbench-distributions-<sha>`), their manifest and checksums. Publish uploads exactly these files.
 */
export const distributionArtifact = sha => `workbench-distributions-${sha}`;
const zips = version => [`workbench-shell-${version}.zip`, `workbench-starters-${version}.zip`];
export const distributionAssetNames = version => Object.freeze([...zips(version), 'workbench-distributions.json', 'workbench-SHA256SUMS']);
const coded = message => Object.assign(new Error(`DISTRIBUTION_INVALID: ${message}`), { code: 'DISTRIBUTION_INVALID' });

async function regularBytes(path, name) {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink() || !entry.size) throw coded(`${name} is not a regular non-empty file.`);
  return readFile(path);
}

/** Verifies the downloaded distribution folder against the release version and head; returns name → SHA-256. */
export async function validateDistributions(directory, sha, version) {
  stableVersion(version);
  const names = distributionAssetNames(version);
  const present = (await readdir(directory)).sort();
  if (JSON.stringify(present) !== JSON.stringify([...names].sort())) throw coded(`expected ${names.join(', ')}; found ${present.join(', ') || 'nothing'}.`);
  const bytes = Object.fromEntries(await Promise.all(names.map(async name => [name, await regularBytes(join(directory, name), name)])));
  const hashes = Object.fromEntries(names.map(name => [name, sha256(bytes[name])]));
  let manifest;
  try { manifest = JSON.parse(bytes['workbench-distributions.json'].toString('utf8')); }
  catch { throw coded('workbench-distributions.json is not JSON.'); }
  if (manifest?.schemaVersion !== 1 || manifest.version !== version) throw coded(`the manifest names version ${manifest?.version}, not ${version}.`);
  if (manifest.sourceCommit !== sha) throw coded(`the manifest names source ${manifest.sourceCommit}, not the release head ${sha}.`);
  const listed = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (JSON.stringify(listed.map(asset => asset?.name)) !== JSON.stringify(zips(version))) throw coded('the manifest does not list exactly the shell and starters archives.');
  for (const asset of listed)
    if (asset.sha256 !== hashes[asset.name] || asset.bytes !== bytes[asset.name].length) throw coded(`the manifest entry for ${asset.name} does not match its bytes.`);
  const sums = zips(version).map(name => `${hashes[name]}  ${name}\n`).join('');
  if (bytes['workbench-SHA256SUMS'].toString('utf8') !== sums) throw coded('workbench-SHA256SUMS does not match the archives.');
  return hashes;
}
