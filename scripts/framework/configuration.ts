import { OperationError, requireThat } from './contracts.ts';
import { companionRelativeFolder } from '../companion/project-contract.mjs';
export interface Identity { id: string; name: string; author: string; version: string; description: string }
export interface Configuration {
  schemaVersion: 1;
  project: Identity;
  paths: { codebaseFolder: string; testsFolder: string; testVaultFolder: string; configDirectory: string };
}
export const configFile = 'shell.config.json';
export const designFile = 'design/project.json';
export function object(value: unknown): Record<string, unknown> {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DATA', 'Expected an object.');
  return value as Record<string, unknown>;
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  requireThat(Object.keys(value).every(key => keys.includes(key)), 'UNKNOWN_FIELD', 'Unexpected data field.');
}
export function identity(value: unknown): Identity {
  const input = object(value); exactKeys(input, ['id', 'name', 'author', 'version', 'description']);
  const text = (key: string, limit: number) => {
    const item = input[key];
    requireThat(typeof item === 'string' && item.length <= limit && item === item.trim() && !/[\u0000-\u001f]/.test(item), 'INVALID_IDENTITY', `Invalid project ${key}.`);
    return item;
  };
  const id = text('id', 60), name = text('name', 80), author = text('author', 80);
  const version = text('version', 32), description = text('description', 400);
  requireThat(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) && !/^(?:constructor|prototype|con|aux|nul|prn|com[1-9]|lpt[1-9])$/.test(id), 'INVALID_IDENTITY', 'Use a portable lowercase plugin ID.');
  requireThat(name.length && author.length && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version), 'INVALID_IDENTITY', 'Supply name, author and an x.y.z version.');
  return { id, name, author, version, description };
}
export function configuration(value: unknown): Configuration {
  const input = object(value); exactKeys(input, ['schemaVersion', 'project', 'paths']);
  requireThat(input.schemaVersion === 1, 'CONFIG_VERSION', 'Unsupported configuration version; original data is preserved.');
  const paths = object(input.paths); exactKeys(paths, ['codebaseFolder', 'testsFolder', 'testVaultFolder', 'configDirectory']);
  const source = paths.codebaseFolder, tests = paths.testsFolder, vault = paths.testVaultFolder, directory = paths.configDirectory;
  requireThat(companionRelativeFolder(source) && companionRelativeFolder(tests), 'CONFIG_PATH', 'Use portable project-relative source and test folders.');
  requireThat(typeof source === 'string' && typeof tests === 'string' && typeof vault === 'string' && typeof directory === 'string', 'CONFIG_PATH', 'Paths must be strings.');
  requireThat(/^\.[a-zA-Z0-9_-]+$/.test(vault) && !['.git', '.framework', '.companion', '.qualification', '.native-runner'].includes(vault.toLowerCase()), 'CONFIG_PATH', 'Use a dedicated hidden test-vault folder.');
  requireThat(/^\.[a-zA-Z0-9_-]+$/.test(directory) && !['.git', '.framework'].includes(directory.toLowerCase()), 'CONFIG_PATH', 'Invalid Obsidian configuration directory.');
  const reserved = ['.framework', '.companion', 'design', 'dist', 'scripts', 'harness', 'node_modules', '.git'];
  const values = [source, tests, vault].map(path => path.toLowerCase());
  const overlaps = (a: string, b: string) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
  requireThat(!values.some((a, i) => values.some((b, j) => i !== j && overlaps(a, b))), 'CONFIG_OVERLAP', 'Source, tests and test vault must not overlap.');
  requireThat(![source, tests].some(path => reserved.some(base => overlaps(path.toLowerCase(), base))), 'CONFIG_PATH', 'Source or tests overlap a framework-owned path.');
  return { schemaVersion: 1, project: identity(input.project), paths: { codebaseFolder: source, testsFolder: tests, testVaultFolder: vault, configDirectory: directory } };
}
export function defaults(project: Identity): Configuration {
  return configuration({ schemaVersion: 1, project, paths: { codebaseFolder: 'src', testsFolder: 'tests', testVaultFolder: '.test-vault', configDirectory: '.obsidian' } });
}
export function resolveImport(config: Configuration | null, document: Record<string, unknown>, policy?: string) {
  requireThat(policy === undefined || ['project', 'import'].includes(policy), 'INVALID_POLICY', 'Resolution must be project or import.');
  const imported = identity(document.project), settings = object(document.settings);
  const proposed = configuration({ ...defaults(imported), paths: { ...defaults(imported).paths, ...settings } });
  if (!config) return { config: proposed, document };
  const differences = [...Object.keys(imported).filter(key => object(config.project)[key] !== object(imported)[key]),
    ...['codebaseFolder', 'testsFolder'].filter(key => object(config.paths)[key] !== settings[key])];
  if (differences.length && !policy) throw new OperationError('IMPORT_CONFLICT', 'Configured and imported values differ: ' + differences.join(', '), 'Review the differences; select --resolve project or --resolve import.');
  const selected = policy === 'import' ? configuration({ ...proposed, paths: { ...config.paths, ...settings } }) : config;
  return { config: selected, document: { ...document, project: selected.project,
    settings: { codebaseFolder: selected.paths.codebaseFolder, testsFolder: selected.paths.testsFolder } } };
}
