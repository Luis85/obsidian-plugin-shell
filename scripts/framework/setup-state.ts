import { join } from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { readBounded, readConfiguration, exists, hash } from './files.ts';
import { designFile, configFile } from './configuration.ts';
import { parseAuthoringDocument } from '../companion/authoring-contract.ts';
import { verifyKit } from './kit-integrity.ts';
import { requireThat, type Context } from './contracts.ts';

/** Fingerprint code as well as design: an edited or newly added consumer file invalidates prior progress. */
export async function setupSnapshot(context: Context) {
  const config = await readConfiguration(context.root);
  requireThat(config, 'CONFIG_REQUIRED', 'Run setup with a starter or imported JSON first.');
  const design = await readBounded(join(context.root, designFile), 4_000_000);
  const parsed = parseAuthoringDocument(new TextDecoder('utf-8', { fatal: true }).decode(design));
  requireThat((['id', 'name', 'author', 'version', 'description'] as const).every(key => parsed.project[key] === config.project[key]) && parsed.settings.codebaseFolder === config.paths.codebaseFolder && parsed.settings.testsFolder === config.paths.testsFolder, 'SETUP_IDENTITY', 'Configured and imported identities differ. Review setup again.');
  const kit = await exists(join(context.root, '.framework/kit.json')) ? await verifyKit(context.root) : null;
  const files = new Map<string, string>(); let total = 0;
  async function file(path: string) {
    if (files.has(path) || !await exists(join(context.root, path))) return;
    const bytes = await readBounded(join(context.root, path), 8_000_000);
    total += bytes.length;
    requireThat(files.size < 6000 && total <= 120_000_000, 'SETUP_INVENTORY_LIMIT', 'Setup input inventory exceeds its bound; no stage ran.');
    files.set(path, hash(bytes));
  }
  async function visit(path: string) {
    const stat = await lstat(join(context.root, path));
    requireThat(!stat.isSymbolicLink(), 'SETUP_SYMLINK', 'Setup source inventory refuses symbolic links.');
    if (stat.isDirectory()) for (const name of (await readdir(join(context.root, path))).sort()) await visit(path + '/' + name);
    else await file(path);
  }
  for (const path of [configFile, designFile, '.framework/kit.json', '.companion/generation.json', 'package.json', 'package-lock.json', 'manifest.json', 'shell.mjs']) await file(path);
  // Custom folders relocate generated product code, not the inherited framework.
  // Both still execute during verification; neither can be omitted from approval.
  const sourceRoots = new Set(['src', 'tests', 'scripts', 'harness', config.paths.codebaseFolder, config.paths.testsFolder]);
  for (const path of sourceRoots) if (await exists(join(context.root, path))) await visit(path);
  // Root configs can execute during a build. Include new and modified configs, not only package.json.
  for (const name of (await readdir(context.root)).sort()) if (/\.(?:[cm]?[jt]s|json)$/.test(name)) await file(name);
  let generated = false;
  if (files.has('.companion/generation.json')) {
    const receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(context.root, '.companion/generation.json'), 4_000_000)));
    requireThat(receipt?.version === 1 && receipt.projectId === config.project.id && Array.isArray(receipt.files) && receipt.files.length > 0 && receipt.files.length <= 5000,
      'SETUP_GENERATION_INVALID', 'Preserve and inspect the invalid generation receipt. No setup stage ran.');
    generated = true;
  }
  const binding = { configuration: files.get(configFile), design: files.get(designFile), kit: files.get('.framework/kit.json') ?? null };
  return { fingerprint: hash(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b)))), binding: hash(JSON.stringify(binding)),
    files: files.size, bytes: total, kitVerified: kit !== null, generated };
}
