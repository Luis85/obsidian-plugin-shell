import type * as Yaml from 'yaml';
import { requireSketch } from '../domain/errors.ts';
let loaded: typeof Yaml | undefined;
/** Dependencies load lazily, so `node bin/app` keeps working before installation; call this before yamlRuntime(). */
export async function loadYaml(): Promise<typeof Yaml> {
  loaded ??= await import('yaml');
  return loaded;
}
/** The loaded `yaml` module for synchronous helpers whose async entry point already awaited loadYaml(). */
export function yamlRuntime(): typeof Yaml {
  requireSketch(loaded, 'YAML_NOT_LOADED', 'Internal error: YAML was used before it was loaded.');
  return loaded;
}
