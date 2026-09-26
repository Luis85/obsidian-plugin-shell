import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
const inlineMap = /(\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,)([A-Za-z0-9+/=]+)(\s*)$/;
/** Dev-only inline source maps were generated before the banner; shift them by its lines.
 * Release builds carry no source map, so their bytes are unchanged. */
function shiftInlineMap(code, banner) {
  const match = inlineMap.exec(code);
  if (!match) return code;
  const map = JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
  map.mappings = ';'.repeat(banner.split('\n').length - 1) + map.mappings;
  return code.slice(0, match.index) + match[1] + Buffer.from(JSON.stringify(map)).toString('base64') + match[3];
}
/** Retain the licenses of bundled modules in the native JS artifact itself. */
export function licenseNotices() {
  return {
    name: 'plugin-shell-license-notices',
    generateBundle(_options, bundle) {
      const packages = new Map();
      const inspect = input => {
        let dir = dirname(input.split('?')[0]);
        while (dir.includes('node_modules')) {
          const manifest = join(dir, 'package.json');
          if (existsSync(manifest)) {
            const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
            if (pkg.name) { packages.set(pkg.name, { ...pkg, directory: dir }); break; }
          }
          const parent = dirname(dir); if (parent === dir) break; dir = parent;
        }
      };
      for (const value of Object.values(bundle)) if (value.type === 'chunk') for (const id of Object.keys(value.modules)) if (id.includes('node_modules')) inspect(id);
      // CSS and pre-bundled SVG data can be absent from the JS module inventory.
      inspect(resolve('node_modules/tailwindcss/index.css'));
      inspect(resolve('node_modules/@iconify-json/lucide/icons.json'));
      const notices = [];
      for (const [name, pkg] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
        const licenses = readdirSync(pkg.directory).filter(file => /^(license|licence|copying)(\.|$)/i.test(file));
        if (!licenses.length && name !== '@iconify-json/lucide') throw new Error(`Missing bundled dependency license: ${name}`);
        const text = name === '@iconify-json/lucide' ? readFileSync('docs/licenses/lucide.txt', 'utf8') : licenses.map(file => readFileSync(join(pkg.directory, file), 'utf8')).join('\n');
        notices.push(`${name}@${pkg.version} (${pkg.license ?? 'see license'})\n${text}`);
      }
      if (!notices.length) throw new Error('Bundled dependency license inventory is empty');
      const banner = `/*!\nPlugin Shell — bundled dependency notices\n${notices.join('\n\n----------------------------------------\n\n').replaceAll('*/', '* /')}\n*/\n`;
      for (const value of Object.values(bundle)) if (value.type === 'chunk' && value.isEntry) value.code = shiftInlineMap(banner + value.code, banner);
    },
  };
}
