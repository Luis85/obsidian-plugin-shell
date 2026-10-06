import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Generated-project configuration has one canonical location under configs/<concern>/. */
export const projectConfigs = Object.freeze({
  vitest: { path: 'configs/testing/vitest.project.config.mjs' },
  typescript: { path: 'configs/types/tsconfig.project.json' },
  preview: { path: 'configs/bundling/vite.preview.config.mjs' },
});

/** The project-relative config path to use, or null when the canonical file is absent. */
export function projectConfigPath(root, kind) {
  const config = projectConfigs[kind];
  if (!config) throw new Error(`Unknown project config: ${kind}`);
  return existsSync(join(root, config.path)) ? config.path : null;
}

/** tsconfig include globs are relative to the config file; report them project-relative. */
export function projectRelativeInclude(configPath, include) {
  const prefix = configPath.includes('/') ? '../'.repeat(configPath.split('/').length - 1) : '';
  return include.map(glob => prefix && glob.startsWith(prefix) ? glob.slice(prefix.length) : glob);
}
