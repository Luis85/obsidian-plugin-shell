/**
 * The one reader of `workbench.sources.json` for JavaScript configs and repository gates (ESLint, Vitest, bundling,
 * the project boundary gate). It checks the shape those consumers rely on; `node bin/app source check` performs the
 * complete validation (src/cli/domain/source-projects.ts). Root `package.json` "imports" is read here as well, so a
 * gate resolves `#name/*` specifiers exactly as Node, Vite and TypeScript do.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const sourceManifestFile = 'workbench.sources.json';

function readJson(path, code) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  try { return JSON.parse(text); } catch { throw new Error(`${code}: ${path} is not JSON`); }
}
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isProject = value => isRecord(value) && typeof value.name === 'string' && typeof value.path === 'string' && typeof value.kind === 'string'
  && Array.isArray(value.references) && value.references.every(item => typeof item === 'string');

/**
 * The declared source projects of a root, or null when the root has no manifest.
 * @param {string} root
 * @returns {{ schemaVersion: 1, projects: Array<{ name: string, kind: string, path: string, references: string[] }> } | null}
 */
export function readSourceManifest(root) {
  const value = readJson(join(root, sourceManifestFile), 'SOURCE_MANIFEST_INVALID');
  if (value === undefined) return null;
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.projects) || !value.projects.every(isProject))
    throw new Error(`SOURCE_MANIFEST_INVALID: ${sourceManifestFile} must hold schemaVersion 1 and projects with name, kind, path and references`);
  return value;
}

/**
 * Project name -> the projects it may import (itself excluded).
 * @param {{ projects: Array<{ name: string, references: string[] }> }} manifest
 * @returns {Record<string, string[]>}
 */
export function sourceDependencies(manifest) {
  return Object.fromEntries(manifest.projects.map(project => [project.name, [...project.references]]));
}

/**
 * Root `package.json` "imports" (an empty object when absent).
 * @param {string} root
 * @returns {Record<string, unknown>}
 */
export function packageImports(root) {
  const value = readJson(join(root, 'package.json'), 'PACKAGE_JSON_INVALID');
  return isRecord(value) && isRecord(value.imports) ? value.imports : {};
}
