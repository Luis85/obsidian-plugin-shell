import { join } from 'node:path';
import { readBounded, readJson } from './files.ts';
import { object } from './configuration.ts';
import { requireThat } from './contracts.ts';
/** YAML runtime is bundled into app.js; keep its exact-version evidence and external license. */
export async function docsParserFiles(root: string) {
  const expected = object(object(await readJson(join(root, 'package.json'))).dependencies).yaml;
  const pkg = object(await readJson(join(root, 'node_modules/yaml/package.json')));
  requireThat(pkg.version === expected && typeof expected === 'string', 'DOCS_PARSER_VERSION', 'Install the exact locked YAML parser before packaging.');
  return [{ path: 'bin/licenses/yaml.LICENSE', bytes: await readBounded(join(root, 'node_modules/yaml/LICENSE')) }];
}
