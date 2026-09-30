/** Reproducible dependency-free release CLI; all templates remain source data under .framework/template. */
import { readFile } from 'node:fs/promises';
import { relative, resolve, isAbsolute, sep, posix, basename } from 'node:path';
import { requireThat } from './contracts.ts';

/** Rebase module-relative data references from the bundled file to the separately shipped template tree. */
export async function bundleReleaseCli(frameworkRoot) {
  const root = resolve(frameworkRoot);
  const { build } = await import('esbuild');
  const result = await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'scripts/framework/release-entry.ts')],
    outfile: resolve(root, '.framework/compiled/app.js'),
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22',
    packages: 'bundle', legalComments: 'inline', sourcemap: false, logLevel: 'silent',
    // These are maintainer-only/optional tools. Regular extracted-kit commands never load them.
    external: ['node:*', 'typescript', 'esbuild'],
    plugins: [{
      name: 'release-template-locations',
      setup(builder) {
        builder.onLoad({ filter: /\.(?:[cm]?js|ts)$/ }, async ({ path }) => {
          const relativePath = relative(root, path);
          if (!relativePath || relativePath === 'node_modules' || relativePath.startsWith('node_modules' + sep) ||
              relativePath === '..' || relativePath.startsWith('..' + sep) || isAbsolute(relativePath)) return;
          const file = relativePath.split(sep).join('/');
          let content = await readFile(path, 'utf8');
          if (/\bimport\.meta\.(?:url|dirname)\b/.test(content)) {
            const target = '../template/' + file;
            const folder = '../template/' + posix.dirname(file) + '/';
            // Replace each original token exactly once: replacements also contain import.meta.url.
            content = content.replace(/\bimport\.meta\.(dirname|url)\b/g, (_, kind) => kind === 'dirname'
              ? '__kitFileURLToPath(new URL(' + JSON.stringify(folder) + ', import.meta.url))'
              : 'new URL(' + JSON.stringify(target) + ', import.meta.url).href');
            if (content.includes('__kitFileURLToPath')) content = "import { fileURLToPath as __kitFileURLToPath } from 'node:url';\n" + content;
          }
          return { contents: content, loader: path.endsWith('.ts') ? 'ts' : 'js', resolveDir: resolve(path, '..') };
        });
      },
    }],
  });
  const output = result.outputFiles ?? [];
  requireThat(output.length === 1 && basename(output[0].path) === 'app.js', 'KIT_BUNDLE', 'Release build must emit one app.js.');
  requireThat(output[0].contents.length <= 8_000_000, 'KIT_BUNDLE', 'Bundled CLI exceeds the verified per-file archive limit.');
  return Buffer.from(output[0].contents);
}
