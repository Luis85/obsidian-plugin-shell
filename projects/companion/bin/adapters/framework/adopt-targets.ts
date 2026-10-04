import { join, relative, sep } from 'node:path';
import type { TargetVersion, WorkbenchTargets } from '../../domain/adoption/contracts.ts';
import { field, recordField, textField } from '../../domain/adoption/source.ts';
import { majorOf, versionOf } from '../../domain/adoption/version.ts';
import { exists, readBounded, readJson } from './files.ts';
import { resolveTemplateRoot } from '../template-root.ts';

const unknown: TargetVersion = { version: null, major: null, source: null };
const starters = ['webapp-angular', 'hybrid-angular', 'plugin-angular'];

async function readCandidate(root: string, path: string): Promise<{ path: string; json: unknown } | null> {
  try { return await exists(join(root, path)) ? { path, json: await readJson(join(root, path)) } : null; } catch { return null; /* an unreadable candidate is treated as absent */ }
}
async function firstJson(root: string, paths: readonly string[]): Promise<{ path: string; json: unknown } | null> {
  for (const path of paths) {
    const found = await readCandidate(root, path);
    if (found) return found;
  }
  return null;
}
const target = (version: string | null, source: string): TargetVersion => version ? { version, major: majorOf(version), source } : { ...unknown };
/** The Angular version Workbench generates, read from the installed Angular project starter, never hard-coded. */
async function angularTarget(root: string): Promise<TargetVersion> {
  const found = await firstJson(root, starters.map(id => `configs/starters/${id}.json`));
  if (!found) return { ...unknown };
  const pin = field(recordField(recordField(found.json, 'generator'), 'angularPins'), '@angular/core');
  return typeof pin === 'string' ? target(versionOf(pin) ?? pin, found.path) : { ...unknown };
}
/** Node and TypeScript pins come from the one template the kit rule selects; `prefix` reports it relative to the framework root. */
async function nodeTarget(template: string, prefix: string): Promise<TargetVersion> {
  try {
    if (!await exists(join(template, '.nvmrc'))) return { ...unknown };
    const text = (await readBounded(join(template, '.nvmrc'), 64)).toString('utf8').trim().replace(/^v/, '');
    const version = versionOf(text) ?? (majorOf(text) === null ? null : text);
    return version === null ? { ...unknown } : target(version, prefix + '.nvmrc');
  } catch { return { ...unknown }; }
}
async function typescriptTarget(template: string, prefix: string): Promise<TargetVersion> {
  const found = await readCandidate(template, 'package.json');
  const range = textField(recordField(found?.json, 'devDependencies'), 'typescript');
  return range && found ? target(versionOf(range), prefix + found.path) : { ...unknown };
}
/** Reads the versions the report is compared with from the kit or checkout that runs the command. */
export async function readTargets(frameworkRoot: string): Promise<WorkbenchTargets> {
  const template = await resolveTemplateRoot(frameworkRoot);
  const local = relative(frameworkRoot, template).split(sep).join('/'), prefix = local ? local + '/' : '';
  return { angular: await angularTarget(frameworkRoot), node: await nodeTarget(template, prefix), typescript: await typescriptTarget(template, prefix) };
}
