import { join } from 'node:path';
import { listFiles } from './kit-integrity.ts';
import { readBounded, readJson } from './files.ts';
import { object } from './configuration.ts';
import { requireThat } from './contracts.ts';
/** Ship the existing pinned data parser, not arbitrary node_modules or lifecycle hooks. */
export async function docsParserFiles(root: string) {
  const expected = object(object(await readJson(join(root, 'package.json'))).dependencies).yaml;
  const pkg = object(await readJson(join(root, 'node_modules/yaml/package.json')));
  requireThat(pkg.version === expected && typeof expected === 'string', 'DOCS_PARSER_VERSION', 'Install the exact locked YAML parser before packaging.');
  const names = ['node_modules/yaml/package.json', 'node_modules/yaml/LICENSE', ...await listFiles(root, 'node_modules/yaml/dist')];
  const output: Array<{ path: string; bytes: Buffer }> = [];
  for (const path of names) {
    if (!/\.(?:js|json)$/.test(path) && !path.endsWith('/LICENSE')) continue;
    output.push({ path: '.framework/compiled/' + path, bytes: await readBounded(join(root, path)) });
  }
  return output;
}
