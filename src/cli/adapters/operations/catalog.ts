import { readFileSync } from 'node:fs';
import { sha256 } from '#shared/platform/hash.ts';
import { assertJsonData, parseJsonData } from '#shared/contracts/json-data.ts';

/** Dependency-free discovery metadata: Node built-ins and the typed JSON/hash contracts only. */
type Descriptor = { id: string; aliases: string[] } & Record<string, unknown>;
export interface OperationDescriptor extends Descriptor { status: 'implemented' | 'planned'; transports: string[] }
export interface CapabilityCatalog {
  schemaVersion: 1; protocolVersion: 1; capabilityVersion: string; id: string; compatibility: string; customRecipes: string;
  makers: Descriptor[]; operations: OperationDescriptor[];
}
type Data = Record<string, unknown>;
const SLUG = /^[a-z][a-z0-9]*(?:[-.][a-z0-9]+)*$/;
const SCHEMA_TYPES = ['object', 'array', 'string', 'integer', 'number', 'boolean'];
const SCHEMA_KEYS = ['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'maxLength', 'maxItems', 'pattern'];
const CLI_SOURCE = /^(?:scripts|src\/cli)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:mjs|ts)$/;
function requireThat(condition: unknown, code = 'CATALOG_INVALID'): asserts condition { if (!condition) throw new Error(code); }
const isData = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const optionalPositive = (value: unknown): boolean => value === undefined || Number.isSafeInteger(value) && Number(value) > 0;
function schemaKeywords(value: Data): void {
  if (value.enum) requireThat(strings(value.enum) && value.enum.length > 0, 'CATALOG_SCHEMA');
  requireThat(optionalPositive(value.maxLength) && optionalPositive(value.maxItems), 'CATALOG_SCHEMA');
  requireThat(value.pattern === undefined || typeof value.pattern === 'string', 'CATALOG_SCHEMA');
}
function schemaChildren(value: Data): void {
  if (value.items) { requireThat(value.type === 'array', 'CATALOG_SCHEMA'); schema(value.items); }
  if (!value.properties) return;
  requireThat(value.type === 'object' && isData(value.properties), 'CATALOG_SCHEMA');
  for (const child of Object.values(value.properties)) schema(child);
}
function schemaObject(value: Data): void {
  const properties = isData(value.properties) ? value.properties : {};
  if (value.required) requireThat(strings(value.required) && value.required.every(key => Object.hasOwn(properties, key)), 'CATALOG_SCHEMA');
  if (value.additionalProperties !== undefined) requireThat(value.additionalProperties === false && value.type === 'object', 'CATALOG_SCHEMA');
}
/** Only the reviewed JSON Schema subset is accepted; unknown keywords never pass silently. */
function schema(value: unknown): void {
  requireThat(isData(value) && SCHEMA_TYPES.includes(String(value.type)), 'CATALOG_SCHEMA');
  requireThat(Object.keys(value).every(key => SCHEMA_KEYS.includes(key)), 'CATALOG_SCHEMA');
  schemaKeywords(value); schemaChildren(value); schemaObject(value);
}
function names(items: unknown[]): asserts items is Descriptor[] {
  const seen = new Set<string>();
  for (const item of items) {
    requireThat(isData(item) && strings(item.aliases), 'CATALOG_ALIASES');
    for (const name of [item.id, ...item.aliases]) {
      requireThat(typeof name === 'string' && SLUG.test(name) && name.length <= 64 && !seen.has(name), 'CATALOG_DUPLICATE_ID_OR_ALIAS');
      seen.add(name);
    }
  }
}
function descriptor(item: Descriptor): void {
  requireThat(['implemented', 'planned'].includes(String(item.status)));
  requireThat(typeof item.description === 'string' && item.description.length > 0);
  requireThat(strings(item.prerequisites) && strings(item.sideEffects));
  requireThat(['none', 'possible', 'required'].includes(String(item.network)));
  schema(item.inputSchema);
}
function makerOptions(maker: Descriptor): string[] {
  const input = isData(maker.inputSchema) ? maker.inputSchema.properties : undefined;
  const options = isData(input) && isData(input.options) ? input.options.properties : undefined;
  requireThat(isData(options), 'CATALOG_OPTION_DRIFT');
  return Object.keys(options);
}
function maker(item: Descriptor): void {
  descriptor(item);
  requireThat(item.version === 2 && strings(item.options) && strings(item.outputs));
  requireThat(new Set(item.options).size === item.options.length);
  requireThat(JSON.stringify([...item.options].sort()) === JSON.stringify(makerOptions(item).sort()), 'CATALOG_OPTION_DRIFT');
}
function cliEntry(cli: unknown): void {
  requireThat(isData(cli) && typeof cli.script === 'string' && typeof cli.command === 'string', 'CATALOG_CLI');
  requireThat(strings(cli.sourceFiles) && cli.sourceFiles.length > 0, 'CATALOG_CLI');
  requireThat(cli.sourceFiles.every(path => path === 'bin/app' || CLI_SOURCE.test(path)), 'CATALOG_CLI');
}
function transports(item: Descriptor): asserts item is OperationDescriptor {
  const values = item.transports;
  requireThat(strings(values) && values.every(value => ['cli', 'protocol'].includes(value)));
  requireThat(new Set(values).size === values.length);
  // Planned capabilities may document intent but never claim a transport.
  if (item.status === 'planned') requireThat(values.length === 0 && !item.cli && typeof item.reason === 'string', 'CATALOG_FALSE_SUPPORT');
  else requireThat(values.length > 0, 'CATALOG_FALSE_SUPPORT');
  requireThat(values.includes('cli') === Boolean(item.cli), 'CATALOG_CLI');
}
function operation(item: Descriptor): void {
  descriptor(item); schema(item.outputSchema); transports(item);
  if (item.cli) cliEntry(item.cli);
}
function assertCatalog(catalog: unknown): asserts catalog is CapabilityCatalog {
  try { assertJsonData(catalog); } catch { throw new Error('CATALOG_JSON'); }
  requireThat(isData(catalog) && catalog.schemaVersion === 1 && catalog.protocolVersion === 1, 'CATALOG_VERSION');
  const { makers, operations } = catalog;
  requireThat(Array.isArray(makers) && Array.isArray(operations));
  names(makers); names(operations);
  for (const item of makers) maker(item);
  for (const item of operations) operation(item);
}
export function validateCatalog(catalog: unknown): true { assertCatalog(catalog); return true; }
const readData = (path: string): unknown => parseJsonData(readFileSync(new URL(path, import.meta.url), 'utf8'));
/** Parsed JSON is untyped until validateCatalog proves every maker and operation descriptor, including its string id. */
export function capabilityCatalog(): CapabilityCatalog {
  const catalog: unknown = {
    schemaVersion: 1, protocolVersion: 1, capabilityVersion: '1.0.0',
    id: 'obsidian-plugin-shell.authoring',
    compatibility: 'Discovery v1 only. CLI contracts remain independently versioned; metadata is not execution approval or qualification evidence.',
    customRecipes: 'Explicitly trusted execution only; custom registries are never imported for discovery.',
    makers: readData('../makers/recipes.json'),
    operations: readData('./operations.json'),
  };
  assertCatalog(catalog);
  return catalog;
}
export function catalogDigest(catalog: unknown = capabilityCatalog()): string {
  validateCatalog(catalog);
  return sha256(JSON.stringify(catalog));
}
const sameSet = (left: readonly string[], right: readonly string[]): boolean => JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
export function validateCatalogParity(catalog: unknown, makerHandlers: readonly string[], protocolHandlers?: readonly string[]): true {
  assertCatalog(catalog);
  requireThat(sameSet(catalog.makers.map(item => item.id), makerHandlers), 'CATALOG_HANDLER_DRIFT');
  if (protocolHandlers) requireThat(sameSet(catalog.operations.filter(item => item.transports.includes('protocol')).map(item => item.id), protocolHandlers), 'CATALOG_HANDLER_DRIFT');
  return true;
}
