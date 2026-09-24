import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertJsonData, parseJsonData } from '../contracts/json-data.mjs';

const slug = /^[a-z][a-z0-9]*(?:[-.][a-z0-9]+)*$/;
function requireThat(condition, code = 'CATALOG_INVALID') { if (!condition) throw new Error(code); }
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
function schema(value) {
  requireThat(value && ['object', 'array', 'string', 'integer', 'number', 'boolean'].includes(value.type), 'CATALOG_SCHEMA');
  const allowed = ['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'maxLength', 'maxItems', 'pattern'];
  requireThat(Object.keys(value).every(key => allowed.includes(key)), 'CATALOG_SCHEMA');
  if (value.enum) requireThat(strings(value.enum) && value.enum.length > 0, 'CATALOG_SCHEMA');
  if (value.maxLength !== undefined) requireThat(Number.isSafeInteger(value.maxLength) && value.maxLength > 0, 'CATALOG_SCHEMA');
  if (value.maxItems !== undefined) requireThat(Number.isSafeInteger(value.maxItems) && value.maxItems > 0, 'CATALOG_SCHEMA');
  if (value.pattern !== undefined) requireThat(typeof value.pattern === 'string', 'CATALOG_SCHEMA');
  if (value.items) { requireThat(value.type === 'array', 'CATALOG_SCHEMA'); schema(value.items); }
  if (value.properties) {
    requireThat(value.type === 'object' && !Array.isArray(value.properties), 'CATALOG_SCHEMA');
    for (const child of Object.values(value.properties)) schema(child);
  }
  if (value.required) requireThat(strings(value.required) && value.required.every(key => Object.hasOwn(value.properties ?? {}, key)), 'CATALOG_SCHEMA');
  if (value.additionalProperties !== undefined) requireThat(value.additionalProperties === false && value.type === 'object', 'CATALOG_SCHEMA');
}
function names(items) {
  const seen = new Set();
  for (const item of items) {
    requireThat(strings(item.aliases), 'CATALOG_ALIASES');
    for (const name of [item.id, ...item.aliases]) {
      requireThat(typeof name === 'string' && slug.test(name) && name.length <= 64 && !seen.has(name), 'CATALOG_DUPLICATE_ID_OR_ALIAS');
      seen.add(name);
    }
  }
}
function descriptor(item) {
  requireThat(['implemented', 'planned'].includes(item.status));
  requireThat(typeof item.description === 'string' && item.description.length > 0);
  requireThat(strings(item.prerequisites) && strings(item.sideEffects));
  requireThat(['none', 'possible', 'required'].includes(item.network));
  schema(item.inputSchema);
}
function operation(item) {
  descriptor(item); schema(item.outputSchema);
  requireThat(strings(item.transports) && item.transports.every(value => ['cli', 'protocol'].includes(value)));
  requireThat(new Set(item.transports).size === item.transports.length);
  if (item.status === 'planned') requireThat(item.transports.length === 0 && !item.cli && typeof item.reason === 'string', 'CATALOG_FALSE_SUPPORT');
  else requireThat(item.transports.length > 0, 'CATALOG_FALSE_SUPPORT');
  requireThat(item.transports.includes('cli') === Boolean(item.cli), 'CATALOG_CLI');
  if (item.cli) {
    requireThat(typeof item.cli.script === 'string' && typeof item.cli.command === 'string', 'CATALOG_CLI');
    requireThat(strings(item.cli.sourceFiles) && item.cli.sourceFiles.length > 0, 'CATALOG_CLI');
    requireThat(item.cli.sourceFiles.every(path => /^scripts\/[a-z0-9/-]+\.mjs$/.test(path)), 'CATALOG_CLI');
  }
}
export function validateCatalog(catalog) {
  try { assertJsonData(catalog); } catch { throw new Error('CATALOG_JSON'); }
  requireThat(catalog.schemaVersion === 1 && catalog.protocolVersion === 1, 'CATALOG_VERSION');
  requireThat(Array.isArray(catalog.makers) && Array.isArray(catalog.operations));
  names(catalog.makers); names(catalog.operations);
  for (const maker of catalog.makers) {
    descriptor(maker);
    requireThat(maker.version === 2 && strings(maker.options) && strings(maker.outputs));
    requireThat(new Set(maker.options).size === maker.options.length);
    requireThat(JSON.stringify([...maker.options].sort()) === JSON.stringify(Object.keys(maker.inputSchema.properties.options.properties).sort()), 'CATALOG_OPTION_DRIFT');
  }
  for (const item of catalog.operations) operation(item);
  return true;
}
export function capabilityCatalog() {
  const catalog = {
    schemaVersion: 1, protocolVersion: 1, capabilityVersion: '1.0.0',
    id: 'obsidian-plugin-shell.authoring',
    compatibility: 'Discovery v1 only. CLI contracts remain independently versioned; metadata is not execution approval or qualification evidence.',
    customRecipes: 'Explicitly trusted execution only; custom registries are never imported for discovery.',
    makers: parseJsonData(readFileSync(new URL('../makers/recipes.json', import.meta.url), 'utf8')),
    operations: parseJsonData(readFileSync(new URL('./operations.json', import.meta.url), 'utf8')),
  };
  validateCatalog(catalog);
  return catalog;
}
export function catalogDigest(catalog = capabilityCatalog()) {
  validateCatalog(catalog);
  return createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
}
export function validateCatalogParity(catalog, makerHandlers, protocolHandlers) {
  validateCatalog(catalog);
  const equal = (left, right) => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
  requireThat(equal(catalog.makers.map(item => item.id), makerHandlers), 'CATALOG_HANDLER_DRIFT');
  if (protocolHandlers) requireThat(equal(catalog.operations.filter(item => item.transports.includes('protocol')).map(item => item.id), protocolHandlers), 'CATALOG_HANDLER_DRIFT');
  return true;
}
