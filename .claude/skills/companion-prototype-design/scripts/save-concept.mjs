/** Save a reviewed delivery under docs/concepts using the shell's existing guarded writer. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { framework } from './lib/framework.mjs';
import { noLinks, readBytes, sha256 } from './lib/io.mjs';

function packageInventory(directory) {
  const child = spawnSync(process.env.PYTHON || 'python3', ['-B', fileURLToPath(new URL('pack-concept.py', import.meta.url)),
    '--root', directory, '--check'], { encoding: 'utf8', timeout: 60000, maxBuffer: 4_000_000, windowsHide: true });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`PROTOTYPE_PACKAGE: ${child.stderr.trim() || `exit ${child.status}`}`);
  const inventory = JSON.parse(child.stdout);
  if (inventory.kind !== 'prototype-package-inventory' || inventory.schemaVersion !== 1 || !Array.isArray(inventory.files)) throw new Error('PROTOTYPE_PACKAGE: unsupported inventory');
  return inventory;
}
export async function saveConcept(repo, directory, slug, { execute = false, apply, signal } = {}) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('PROTOTYPE_SLUG: portable lowercase concept name required');
  if (apply !== undefined && (!execute || !/^[a-f0-9]{64}$/.test(apply))) throw new Error('PROTOTYPE_APPROVAL: --execute and a SHA-256 --apply hash are required');
  const api = await framework(repo), root = noLinks(directory);
  api.requireThat(!signal?.aborted, 'CANCELLED', 'Concept save cancelled before planning.');
  // A source checkout contains the shared writer; an extracted kit ships it under bin/template.
  const { createFilePlan, applyFilePlan } = await import(pathToFileURL(noLinks(path.join(api.moduleRoot, 'scripts/shared/file-plan.ts'))).href);
  const inventory = packageInventory(root);
  if (inventory.slug !== slug) throw new Error('PROTOTYPE_SLUG: requested folder and package identity differ');
  const destination = `docs/concepts/${slug}`;
  const absolute = noLinks(path.join(api.root, destination));
  if (fs.existsSync(absolute)) throw new Error('PROTOTYPE_DESTINATION_EXISTS: choose a new concept folder; existing concepts are never replaced');
  // Read the same bounded bytes selected by the packer. Do not make a second inclusion policy.
  const entries = inventory.files.map(record => {
    const parts = record.path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..') || path.isAbsolute(record.path) || record.path.includes('\\')) throw new Error('PROTOTYPE_PACKAGE_PATH');
    const bytes = readBytes(path.join(root, ...parts), 64_000_000);
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error('PROTOTYPE_PACKAGE_STALE: ' + record.path);
    return { path: `${destination}/${record.path}`, content: bytes.toString('base64'), encoding: 'base64' };
  });
  const plan = await createFilePlan(api.root, entries);
  if (plan.changes.some(change => change.status !== 'create')) throw new Error('PROTOTYPE_DESTINATION_EXISTS');
  const changes = plan.changes.map(({ path, beforeHash, afterHash, status }) => ({ path, beforeHash, afterHash, status }));
  const planHash = sha256(JSON.stringify({ kind: 'prototype-concept-save', version: 1, root: plan.root, destination, changes }));
  const review = { destination, planHash, changes, packageStatus: inventory.prototypeStatus, execution: 'not-run', importer: 'not-invoked' };
  if (!apply) return api.result('prototype save', review, 'planned');
  if (apply !== planHash) throw new Error('PROTOTYPE_STALE_PLAN: re-review the current source and destination');
  api.requireThat(!signal?.aborted, 'CANCELLED', 'Concept save cancelled before writes.');
  const applied = await applyFilePlan(plan);
  return api.result('prototype save', { ...review, execution: 'shared-file-plan', applied }, 'applied');
}
