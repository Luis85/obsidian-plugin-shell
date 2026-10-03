import { join } from 'node:path';
import type { TargetVersion, WorkbenchTargets } from '../../domain/adoption/contracts.ts';
import { field, recordField, textField } from '../../domain/adoption/source.ts';
import { majorOf, versionOf } from '../../domain/adoption/version.ts';
import { exists, readBounded, readJson } from './files.ts';

const unknown: TargetVersion = { version: null, major: null, source: null };
const starters = ['webapp-angular', 'hybrid-angular', 'plugin-angular'];

async function firstJson(roots: readonly string[], paths: readonly string[]): Promise<{ path: string; json: unknown } | null> {
  for (const root of roots) {
    for (const path of paths) {
      try { if (await exists(join(root, path))) return { path, json: await readJson(join(root, path)) }; } catch { /* an unreadable candidate is treated as absent */ }
    }
  }
  return null;
}
const target = (version: string | null, source: string): TargetVersion => version ? { version, major: majorOf(version), source } : { ...unknown };
/** The Angular version Workbench generates, read from the installed Angular project starter, never hard-coded. */
async function angularTarget(root: string): Promise<TargetVersion> {
  const found = await firstJson([root], starters.map(id => `configs/starters/${id}.json`));
  if (!found) return { ...unknown };
  const pin = field(recordField(recordField(found.json, 'generator'), 'angularPins'), '@angular/core');
  return typeof pin === 'string' ? target(versionOf(pin) ?? pin, found.path) : { ...unknown };
}
async function nodeTarget(root: string): Promise<TargetVersion> {
  for (const base of ['', 'bin/template/']) {
    try {
      if (!await exists(join(root, base + '.nvmrc'))) continue;
      const text = (await readBounded(join(root, base + '.nvmrc'), 64)).toString('utf8').trim().replace(/^v/, '');
      const version = versionOf(text) ?? (majorOf(text) === null ? null : text);
      if (version !== null) return target(version, base + '.nvmrc');
    } catch { /* fall through to the next candidate */ }
  }
  return { ...unknown };
}
async function typescriptTarget(root: string): Promise<TargetVersion> {
  const found = await firstJson([root], ['package.json', 'bin/template/package.json']);
  const dependencies = recordField(found?.json, 'devDependencies');
  const range = textField(dependencies, 'typescript');
  return range && found ? target(versionOf(range), found.path) : { ...unknown };
}
/** Reads the versions the report is compared with from the kit or checkout that runs the command. */
export async function readTargets(frameworkRoot: string): Promise<WorkbenchTargets> {
  return { angular: await angularTarget(frameworkRoot), node: await nodeTarget(frameworkRoot), typescript: await typescriptTarget(frameworkRoot) };
}
