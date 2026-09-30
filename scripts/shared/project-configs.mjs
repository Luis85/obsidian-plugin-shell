import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generated-project tool configuration lives under configs/<concern>/. Projects generated before that
 * layout keep their root copy: regeneration never removes a retired file, so readers fall back to it.
 */
export const projectConfigs = Object.freeze({
  vitest: { path: 'configs/testing/vitest.project.config.mjs', legacy: 'vitest.project.config.mjs' },
  typescript: { path: 'configs/types/tsconfig.project.json', legacy: 'tsconfig.project.json' },
  preview: { path: 'configs/bundling/vite.preview.config.mjs', legacy: 'vite.preview.config.mjs' },
});

/** The project-relative config path to use, or null when the project has neither location. */
export function projectConfigPath(root, kind) {
  const config = projectConfigs[kind];
  if (!config) throw new Error(`Unknown project config: ${kind}`);
  if (existsSync(join(root, config.path))) return config.path;
  return existsSync(join(root, config.legacy)) ? config.legacy : null;
}

/** tsconfig include globs are relative to the config file; report them project-relative. */
export function projectRelativeInclude(configPath, include) {
  const prefix = configPath.includes('/') ? '../'.repeat(configPath.split('/').length - 1) : '';
  return include.map(glob => prefix && glob.startsWith(prefix) ? glob.slice(prefix.length) : glob);
}
