import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readRegistry } from './registry.mjs';
function catalogFields(entity) {
  return Object.entries(entity.fields).map(([name, field]) => {
    const absent = field.read(undefined);
    return { name, type: field.kind, requiredInput: field.required, optionalStored: field.optional === true,
      ...(absent.ok && absent.value !== undefined ? { default: absent.value } : {}) };
  });
}

/** Bundles trusted, checked-in definitions using the installed Vite toolchain.
 * No source scan discovers entities: only explicit feature registrations count. */
export async function loadCatalog(root = process.cwd()) {
  const registry = await readRegistry(root);
  const directory = await mkdtemp(join(tmpdir(), 'plugin-entity-catalog-'));
  try {
    const entry = join(directory, 'catalog-entry.ts');
    const specifier = path => JSON.stringify(resolve(root, path).replaceAll('\\', '/'));
    const imports = registry.registrations.map((registration, index) => `import { ${registration.exported} as feature${index} } from ${specifier(`src/bootstrap/${registration.from}.ts`)};`);
    const definitions = registry.registrations.map((registration, index) => `{ key: ${JSON.stringify(registration.key)}, override: ${registration.override}, feature: feature${index} }`);
    let domains = 'export const domains = [];';
    try { await access(resolve(root, 'src/bootstrap/authoring-domains.ts')); domains = `export { authoringDomains as domains } from ${specifier('src/bootstrap/authoring-domains.ts')};`; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(entry, `${imports.join('\n')}\nimport { validateDocumentCatalog } from ${specifier('src/application/document-definition.ts')};\nexport const entries = [${definitions.join(',')}];\nvalidateDocumentCatalog(entries.filter(entry => entry.feature.document).map(entry => entry.feature.document));\n${domains}\n`);
    const { build } = await import('vite');
    const output = await build({ root, configFile: false, envFile: false, logLevel: 'silent', build: { write: false, minify: false, target: 'es2022', lib: { entry, formats: ['es'], fileName: 'entity-catalog' } } });
    const bundles = Array.isArray(output) ? output : [output];
    const chunks = bundles.flatMap(bundle => bundle.output).filter(chunk => chunk.type === 'chunk');
    if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('CATALOG_UNEXPECTED_EXTERNAL_IMPORT');
    const loaded = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
    const catalog = loaded.entries.map(({ key, override, feature }) => {
      const entity = feature.document?.entity ?? feature.entity; const mappings = feature.document?.mappings ?? [];
      if (feature.document && (!feature.defaultFolder || !mappings.length || mappings.length !== Object.keys(entity.fields).length)) throw new Error(`CATALOG_INCOMPLETE_MAPPING: ${key}`);
      const fields = catalogFields(entity);
      return { registration: key, backend: feature.backend ?? 'markdown', entity: entity.key, schemaVersion: entity.schemaVersion, defaultFolder: feature.defaultFolder, liveFolderOverride: override, fields, mappings };
    });
    for (const entity of loaded.domains) catalog.push({ registration: entity.key, backend: 'domain', entity: entity.key, schemaVersion: entity.schemaVersion, fields: catalogFields(entity), mappings: [] });
    const identities = new Set();
    for (const entry of catalog) { if (identities.has(entry.entity)) throw new Error(`CATALOG_DUPLICATE_ENTITY: ${entry.entity}`); identities.add(entry.entity); }
    return { version: 1, status: 'passed', entities: catalog };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
