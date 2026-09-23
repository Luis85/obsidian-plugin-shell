import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readRegistry } from './registry.mjs';

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
    await writeFile(entry, `${imports.join('\n')}\nimport { validateDocumentCatalog } from ${specifier('src/application/document-definition.ts')};\nexport const entries = [${definitions.join(',')}];\nvalidateDocumentCatalog(entries.map(entry => entry.feature.document));\n`);
    const { build } = await import('vite');
    const output = await build({ root, configFile: false, envFile: false, logLevel: 'silent', build: { write: false, minify: false, target: 'es2022', lib: { entry, formats: ['es'], fileName: 'entity-catalog' } } });
    const bundles = Array.isArray(output) ? output : [output];
    const chunks = bundles.flatMap(bundle => bundle.output).filter(chunk => chunk.type === 'chunk');
    if (chunks.length !== 1 || chunks[0].imports.length || chunks[0].dynamicImports.length) throw new Error('CATALOG_UNEXPECTED_EXTERNAL_IMPORT');
    const loaded = await import(`data:text/javascript;base64,${Buffer.from(chunks[0].code).toString('base64')}`);
    const catalog = loaded.entries.map(({ key, override, feature }) => {
      const { entity, mappings } = feature.document;
      if (!feature.defaultFolder || !mappings.length || mappings.length !== Object.keys(entity.fields).length) throw new Error(`CATALOG_INCOMPLETE_MAPPING: ${key}`);
      const fields = Object.entries(entity.fields).map(([name, field]) => {
        const absent = field.read(undefined);
        return { name, type: field.kind, requiredInput: field.required, optionalStored: field.optional === true,
          ...(absent.ok && absent.value !== undefined ? { default: absent.value } : {}) };
      });
      return { registration: key, entity: entity.key, schemaVersion: entity.schemaVersion, defaultFolder: feature.defaultFolder, liveFolderOverride: override, fields, mappings };
    });
    return { version: 1, status: 'passed', entities: catalog };
  } finally { await rm(directory, { recursive: true, force: true }); }
}
