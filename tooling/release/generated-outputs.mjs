/**
 * Generated, version-stamped files a release commit must carry for its new version. Today that is the CLI manual
 * (docs/user-manual/shell-cli/generated), which records the framework version and hashes package.json /version, so a
 * bare version bump fails `manual.mjs --check` (MANUAL_STALE). Each output is rendered by the release root's own
 * generator; a root without that generator (a generated project, a release fixture) has none. Release preparation
 * plans these beside the version metadata, and the release-branch gate proves them current.
 */
import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const generators = Object.freeze([
  { id: 'cli-manual', module: 'tooling/documentation/manual.mjs', regenerate: 'node --experimental-strip-types tooling/documentation/manual.mjs' },
]);

async function present(path) {
  try { const stat = await lstat(path); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`RELEASE_GENERATOR_UNSAFE: ${path}`); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

/** @returns {Promise<Array<{ id: string, regenerate: string, paths: readonly string[], render: (version: string) => Promise<Record<string, string>> }>>} */
export async function releaseOutputs(root) {
  root = resolve(root); const found = [];
  for (const { id, module, regenerate } of generators) {
    const path = join(root, module);
    if (!await present(path)) continue;
    const generator = await import(pathToFileURL(path).href);
    found.push({ id, regenerate, paths: generator.releasePaths, render: version => generator.releaseOutputs(version, root) });
  }
  return found;
}

/** Outputs whose committed bytes differ from what `version` renders: [{ id, regenerate, stale: [path] }], read-only. */
export async function staleOutputs(root, version) {
  const results = [];
  for (const output of await releaseOutputs(root)) {
    const files = await output.render(version); const stale = [];
    for (const path of output.paths) {
      let current = null;
      try { current = await readFile(join(resolve(root), path), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (current !== files[path]) stale.push(path);
    }
    results.push({ id: output.id, regenerate: output.regenerate, stale });
  }
  return results;
}
