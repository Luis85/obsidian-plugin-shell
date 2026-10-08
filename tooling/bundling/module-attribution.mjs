import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Observe the accepted build graph without changing any installable asset. */
export function moduleAttribution(root = process.cwd()) {
  return { name: 'plugin-shell-module-attribution',
    writeBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(value => value.type === 'chunk' && value.isEntry);
      if (chunks.length !== 1 || chunks[0].fileName !== 'main.js') throw new Error('ATTRIBUTION_ENTRY_INVENTORY');
      const chunk = chunks[0];
      const modules = Object.entries(chunk.modules).filter(([id]) => id.replaceAll('\\', '/').includes('/node_modules/yaml/'))
        .map(([id, value]) => {
          if (!Number.isSafeInteger(value.renderedLength) || value.renderedLength < 0) throw new Error('ATTRIBUTION_MODULE_SCHEMA');
          return { id: id.replaceAll('\\', '/').split('/node_modules/').at(-1), renderedLength: value.renderedLength };
        }).sort((a, b) => a.id.localeCompare(b.id));
      if (!modules.length) throw new Error('ATTRIBUTION_SERIALIZER_MISSING');
      const sha256 = createHash('sha256').update(chunk.code).digest('hex');
      const version = name => JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
      const report = { schemaVersion: 1, mode: 'build-module-attribution',
        asset: { file: 'main.js', sha256, bytes: Buffer.byteLength(chunk.code) },
        tools: { node: process.version, vite: version('vite'), rolldown: version('rolldown') },
        serializer: { package: 'yaml', version: version('yaml'), modules,
          renderedLength: modules.reduce((sum, module) => sum + module.renderedLength, 0) },
        definition: 'Rolldown renderedLength for tree-shaken YAML modules in this build graph. Not an additive allocation of final minified/compressed bytes or a counterfactual saving from removing YAML.' };
      const directory = join(root, 'reports/bundling'); mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, `${sha256}.json`), JSON.stringify(report, null, 2) + '\n');
    },
  };
}
