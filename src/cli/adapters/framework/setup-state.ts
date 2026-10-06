import { join } from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { readBounded, readConfiguration, exists, hash } from './files.ts';
import { designFile, configFile } from './configuration.ts';
import { parseAuthoringDocument } from '../../../../scripts/companion/authoring-contract.ts';
import { kitPresent, verifyKit } from './kit-integrity.ts';
import { requireThat, type Context } from './contracts.ts';

type Config = NonNullable<Awaited<ReturnType<typeof readConfiguration>>>;
const identityKeys = ['id', 'name', 'author', 'version', 'description'] as const;
async function checkedConfiguration(context: Context): Promise<Config> {
  const config = await readConfiguration(context.root);
  requireThat(config, 'CONFIG_REQUIRED', 'Run setup with a starter or imported JSON first.');
  const design = await readBounded(join(context.root, designFile), 4_000_000);
  const parsed = parseAuthoringDocument(new TextDecoder('utf-8', { fatal: true }).decode(design));
  const sameIdentity = identityKeys.every(key => parsed.project[key] === config.project[key]);
  const samePaths = parsed.settings.codebaseFolder === config.paths.codebaseFolder && parsed.settings.testsFolder === config.paths.testsFolder;
  requireThat(sameIdentity && samePaths, 'SETUP_IDENTITY', 'Configured and imported identities differ. Review setup again.');
  return config;
}
/** Bounded, link-refusing inventory of every file whose bytes can affect a setup stage. */
class Inventory {
  readonly files = new Map<string, string>(); total = 0;
  private readonly root: string;
  constructor(root: string) { this.root = root; }
  async file(path: string): Promise<void> {
    if (this.files.has(path) || !await exists(join(this.root, path))) return;
    const bytes = await readBounded(join(this.root, path), 8_000_000);
    this.total += bytes.length;
    requireThat(this.files.size < 6000 && this.total <= 120_000_000, 'SETUP_INVENTORY_LIMIT', 'Setup input inventory exceeds its bound; no stage ran.');
    this.files.set(path, hash(bytes));
  }
  async visit(path: string): Promise<void> {
    const stat = await lstat(join(this.root, path));
    requireThat(!stat.isSymbolicLink(), 'SETUP_SYMLINK', 'Setup source inventory refuses symbolic links.');
    if (stat.isDirectory()) for (const name of (await readdir(join(this.root, path))).sort()) await this.visit(path + '/' + name);
    else await this.file(path);
  }
}
async function collectInventory(context: Context, config: Config): Promise<Inventory> {
  const inventory = new Inventory(context.root);
  for (const path of [configFile, designFile, 'bin/kit.json', '.companion/generation.json', 'package.json', 'package-lock.json', 'manifest.json', 'bin/app']) await inventory.file(path);
  // Custom folders relocate generated product code, not the inherited framework.
  // Both still execute during verification; neither can be omitted from approval.
  const sourceRoots = new Set(['src', 'tests', 'scripts', 'templates', 'harness', 'configs', config.paths.codebaseFolder, config.paths.testsFolder]);
  for (const path of sourceRoots) if (await exists(join(context.root, path))) await inventory.visit(path);
  // Root configs can execute during a build. Include new and modified configs, not only package.json.
  for (const name of (await readdir(context.root)).sort()) if (/\.(?:[cm]?[jt]s|json)$/.test(name)) await inventory.file(name);
  return inventory;
}
async function generationRecorded(context: Context, config: Config, inventory: Inventory): Promise<boolean> {
  if (!inventory.files.has('.companion/generation.json')) return false;
  const receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(context.root, '.companion/generation.json'), 4_000_000)));
  requireThat(receipt?.version === 1 && receipt.projectId === config.project.id && Array.isArray(receipt.files) && receipt.files.length > 0 && receipt.files.length <= 5000,
    'SETUP_GENERATION_INVALID', 'Preserve and inspect the invalid generation receipt. No setup stage ran.');
  return true;
}
/** Fingerprint code as well as design: an edited or newly added consumer file invalidates prior progress. */
export async function setupSnapshot(context: Context) {
  const config = await checkedConfiguration(context);
  const kit = await kitPresent(context.root) ? await verifyKit(context.root) : null;
  const inventory = await collectInventory(context, config), files = inventory.files;
  const generated = await generationRecorded(context, config, inventory);
  const binding = { configuration: files.get(configFile), design: files.get(designFile), kit: files.get('bin/kit.json') ?? null };
  return { fingerprint: hash(JSON.stringify([...files].sort(([a], [b]) => a.localeCompare(b)))), binding: hash(JSON.stringify(binding)),
    files: files.size, bytes: inventory.total, kitVerified: kit !== null, generated };
}
