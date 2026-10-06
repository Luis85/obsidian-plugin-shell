import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readRegistry } from './registry.ts';

type Data = Record<string, unknown>;
interface CatalogField { readonly name: string; readonly type: unknown; readonly requiredInput: unknown; readonly optionalStored: boolean; readonly default?: unknown }
interface CatalogEntry {
  readonly registration: string; readonly backend: unknown; readonly entity: unknown; readonly schemaVersion: unknown;
  readonly defaultFolder?: unknown; readonly liveFolderOverride?: unknown; readonly fields: readonly CatalogField[]; readonly mappings: readonly unknown[];
}
interface Bundled { readonly type: string; readonly code?: string; readonly imports?: readonly string[]; readonly dynamicImports?: readonly string[] }
const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null;
const records = (value: unknown): Data[] => Array.isArray(value) ? value.filter(isData) : [];
function catalogInvalid(detail: string): never { throw new Error(`CATALOG_INVALID: ${detail}`); }
function field(name: string, value: unknown): CatalogField {
  if (!isData(value) || typeof value.read !== 'function') catalogInvalid(name);
  const absent: unknown = value.read(undefined);
  const fallback = isData(absent) && absent.ok === true && absent.value !== undefined ? { default: absent.value } : {};
  return { name, type: value.kind, requiredInput: value.required, optionalStored: value.optional === true, ...fallback };
}
function catalogFields(entity: Data): CatalogField[] {
  return Object.entries(isData(entity.fields) ? entity.fields : {}).map(([name, value]) => field(name, value));
}
const fieldCount = (entity: Data): number => Object.keys(isData(entity.fields) ? entity.fields : {}).length;
function featureEntity(key: string, feature: Data, document: Data | undefined): Data {
  if (isData(document?.entity)) return document.entity;
  return isData(feature.entity) ? feature.entity : catalogInvalid(key);
}
function noteEntry(key: string, override: unknown, feature: Data): CatalogEntry {
  const document = isData(feature.document) ? feature.document : undefined;
  const entity = featureEntity(key, feature, document);
  const mappings = Array.isArray(document?.mappings) ? document.mappings : [];
  if (document && (!feature.defaultFolder || !mappings.length || mappings.length !== fieldCount(entity))) throw new Error(`CATALOG_INCOMPLETE_MAPPING: ${key}`);
  return { registration: key, backend: feature.backend ?? 'markdown', entity: entity.key, schemaVersion: entity.schemaVersion, defaultFolder: feature.defaultFolder, liveFolderOverride: override, fields: catalogFields(entity), mappings };
}
const domainEntry = (entity: Data): CatalogEntry => ({ registration: String(entity.key), backend: 'domain', entity: entity.key, schemaVersion: entity.schemaVersion, fields: catalogFields(entity), mappings: [] });
async function catalogEntry(root: string, directory: string): Promise<string> {
  const registry = await readRegistry(root);
  const specifier = (path: string) => JSON.stringify(resolve(root, path).replaceAll('\\', '/'));
  const imports = registry.registrations.map((registration, index) => `import { ${registration.exported} as feature${index} } from ${specifier(`src/bootstrap/${registration.from.endsWith('.ts') ? registration.from : `${registration.from}.ts`}`)};`);
  const definitions = registry.registrations.map((registration, index) => `{ key: ${JSON.stringify(registration.key)}, override: ${registration.override}, feature: feature${index} }`);
  let domains = 'export const domains = [];';
  try { await access(resolve(root, 'src/bootstrap/authoring-domains.ts')); domains = `export { authoringDomains as domains } from ${specifier('src/bootstrap/authoring-domains.ts')};`; }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  const entry = join(directory, 'catalog-entry.ts');
  await writeFile(entry, `${imports.join('\n')}\nimport { validateDocumentCatalog } from ${specifier('src/application/document-definition.ts')};\nexport const entries = [${definitions.join(',')}];\nvalidateDocumentCatalog(entries.filter(entry => entry.feature.document).map(entry => entry.feature.document));\n${domains}\n`);
  return entry;
}
/** One self-contained chunk: the bundle may not reach back into the developer's environment at load time. */
async function bundle(root: string, entry: string): Promise<string> {
  const { build } = await import('vite');
  const output = await build({ root, configFile: false, envFile: false, logLevel: 'silent', build: { write: false, minify: false, target: 'es2022', lib: { entry, formats: ['es'], fileName: 'entity-catalog' } } });
  const bundles: readonly unknown[] = Array.isArray(output) ? output : [output];
  const chunks = bundles.flatMap(item => isData(item) && Array.isArray(item.output) ? records(item.output) : []).filter((chunk): chunk is Data & Bundled => chunk.type === 'chunk');
  const [chunk, ...rest] = chunks;
  if (!chunk || rest.length || chunk.imports?.length || chunk.dynamicImports?.length || typeof chunk.code !== 'string') throw new Error('CATALOG_UNEXPECTED_EXTERNAL_IMPORT');
  return chunk.code;
}
/** Bundles trusted, checked-in definitions using the installed Vite toolchain.
 * No source scan discovers entities: only explicit feature registrations count. */
export async function loadCatalog(root = process.cwd()): Promise<{ version: 1; status: 'passed'; entities: CatalogEntry[] }> {
  const directory = await mkdtemp(join(tmpdir(), 'plugin-entity-catalog-'));
  try {
    const code = await bundle(root, await catalogEntry(root, directory));
    const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
    if (!isData(loaded)) catalogInvalid('module');
    const catalog = records(loaded.entries).map(({ key, override, feature }) => noteEntry(String(key), override, isData(feature) ? feature : catalogInvalid(String(key))));
    catalog.push(...records(loaded.domains).map(domainEntry));
    const identities = new Set<unknown>();
    for (const item of catalog) { if (identities.has(item.entity)) throw new Error(`CATALOG_DUPLICATE_ENTITY: ${String(item.entity)}`); identities.add(item.entity); }
    return { version: 1, status: 'passed', entities: catalog };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
