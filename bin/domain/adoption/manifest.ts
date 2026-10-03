import type { PackageManagerFacts, RuntimeFacts } from './contracts.ts';
import { field, isRecord, recordField, textField, type InventoryView } from './source.ts';
import { majorOf } from './version.ts';

export interface Dependency { range: string; file: string }
/** Dependencies merged over every package.json read; the shallowest file wins a duplicate. */
export interface PackageFacts {
  files: string[]; name: string | null; dependencies: Map<string, Dependency>;
  scripts: string[]; engines: Record<string, string>; packageManagerField: string | null; workspaces: string[];
}
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const lockfiles: ReadonlyArray<[string, string]> = [
  ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'], ['yarn.lock', 'yarn'], ['pnpm-lock.yaml', 'pnpm'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'],
];
function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return isRecord(value) ? strings(field(value, 'packages')) : [];
}
function mergeDependencies(into: Map<string, Dependency>, file: string, json: unknown): void {
  for (const section of sections) {
    for (const [name, range] of Object.entries(recordField(json, section))) {
      if (typeof range === 'string' && !into.has(name)) into.set(name, { range, file });
    }
  }
}
export function readPackages(view: InventoryView): PackageFacts {
  const facts: PackageFacts = { files: view.find(/(^|\/)package\.json$/).slice(0, 50), name: null, dependencies: new Map(), scripts: [], engines: {}, packageManagerField: null, workspaces: [] };
  for (const file of facts.files) {
    const json = view.json(file);
    if (!isRecord(json)) continue;
    mergeDependencies(facts.dependencies, file, json);
    if (file !== 'package.json') continue;
    facts.name = textField(json, 'name');
    facts.scripts = Object.keys(recordField(json, 'scripts')).sort();
    facts.packageManagerField = textField(json, 'packageManager');
    facts.workspaces = strings(field(json, 'workspaces'));
    for (const [key, value] of Object.entries(recordField(json, 'engines'))) if (typeof value === 'string') facts.engines[key] = value;
  }
  return facts;
}
function packageManager(view: InventoryView, packages: PackageFacts): PackageManagerFacts {
  const found = lockfiles.filter(([file]) => view.has(file));
  const declared = /^([a-z]+)@(.+)$/.exec(packages.packageManagerField ?? '');
  const name = declared?.[1] ?? [...new Set(found.map(([, manager]) => manager))][0] ?? null;
  return { name, version: declared?.[2]?.split('+')[0] ?? null, lockfiles: found.map(([file]) => file) };
}
const firstLine = (text: string | undefined): string | null => text?.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#')) ?? null;
function nodeVersionFacts(view: InventoryView, packages: PackageFacts): RuntimeFacts['node'] {
  const tools = view.text('.tool-versions')?.split(/\r?\n/).map(line => /^nodejs?\s+(\S+)/.exec(line.trim())?.[1]).find(Boolean) ?? null;
  return { engines: packages.engines.node ?? null, nvmrc: firstLine(view.text('.nvmrc')), nodeVersionFile: firstLine(view.text('.node-version')), toolVersions: tools };
}
function tsconfigStrict(view: InventoryView, configs: string[]): boolean | null {
  for (const config of ['tsconfig.json', ...configs.filter(item => item !== 'tsconfig.json')]) {
    const options = recordField(view.json(config), 'compilerOptions');
    if (typeof options.strict === 'boolean') return options.strict;
  }
  return null;
}
export function readRuntime(view: InventoryView, packages: PackageFacts): RuntimeFacts {
  const range = packages.dependencies.get('typescript')?.range ?? null;
  const configs = view.find(/(^|\/)tsconfig(\.[A-Za-z0-9-]+)?\.json$/).slice(0, 30);
  return {
    packageManager: packageManager(view, packages),
    node: nodeVersionFacts(view, packages),
    typescript: { range, major: majorOf(range), strict: tsconfigStrict(view, configs), configs },
    scripts: packages.scripts,
  };
}
